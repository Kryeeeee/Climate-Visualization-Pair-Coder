async function exportCsv() {
  if (!savedRecords.length) {
    alert("There are no saved records to export.");
    return;
  }
  const invalidRecord = savedRecords.find((record) => validateRecord(record).length > 0);
  if (invalidRecord) {
    alert(`Cannot export because record "${invalidRecord.record_id}" is not fully coded. Source organization, Source figure ID, metadata, and all required coding fields must be complete.`);
    return;
  }
  const invalidImageRecord = savedRecords.find((record) => validateRecordImages(record).length > 0);
  if (invalidImageRecord) {
    alert(`Cannot export because record "${invalidImageRecord.record_id}" does not contain exportable image data. Import the media image files/folder, select the missing image, then save the pair again.`);
    return;
  }
  const headers = [
    ...metadataFields,
    "source_image_filename",
    "source_image_export_path",
    "media_image_filename",
    "media_image_export_path",
    "media_csv_local_path",
    "media_csv_article_id",
    "media_csv_image_url",
    ...getCodebookOutputFields(),
    "coded_at",
  ];

  const exportRows = savedRecords.map((record) => {
    const sourceExportFilename = buildExportImageFilename(record, "source");
    const mediaExportFilename = buildExportImageFilename(record, "media");
    return {
      ...record,
      source_image_export_path: sourceExportFilename ? `source_figures/${sourceExportFilename}` : "",
      media_image_export_path: mediaExportFilename ? `media_adaptations/${mediaExportFilename}` : "",
    };
  });
  const csvContent = recordsToCsv(exportRows, headers);

  try {
    elements.exportCsvBtn.disabled = true;
    elements.exportCsvBtn.textContent = "Exporting...";
    const zipEntries = [
      {
        path: "climate_visualization_coding.csv",
        data: textToUint8Array(csvContent),
      },
      {
        path: "status.xls",
        data: textToUint8Array(buildRowStatusWorkbookXml(getRowStatusHeaders())),
      },
    ];
    for (const record of savedRecords) {
      const sourceFilename = buildExportImageFilename(record, "source");
      const sourceBytes = await readRecordImageBytes(record, "source");
      zipEntries.push({ path: `source_figures/${sourceFilename}`, data: sourceBytes });

      const mediaFilename = buildExportImageFilename(record, "media");
      const mediaBytes = await readRecordImageBytes(record, "media");
      zipEntries.push({ path: `media_adaptations/${mediaFilename}`, data: mediaBytes });
    }

    const zipBlob = buildZipBlob(zipEntries);
    downloadBlob(zipBlob, "climate_visualization_export.zip");
  } finally {
    elements.exportCsvBtn.disabled = false;
    elements.exportCsvBtn.textContent = "Export";
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildExportImageFilename(record, kind) {
  const originalFilename = kind === "source"
    ? record.source_image_filename
    : record.media_image_filename || extractFilename(record.media_csv_local_path || "");
  if (!originalFilename) return "";
  const extension = getImageExtension(originalFilename, kind === "source" ? record.source_image_data_url : record.media_selected_data_url);
  return `${slugify(record.record_id || "record")}__${kind}${extension}`;
}

function getImageExtension(filename, dataUrl = "") {
  const dataMatch = String(dataUrl).match(/^data:image\/([a-zA-Z0-9.+-]+);/);
  if (dataMatch) {
    const normalized = dataMatch[1].toLowerCase();
    if (normalized === "jpeg") return ".jpg";
    if (normalized === "svg+xml") return ".svg";
    return `.${normalized}`;
  }
  const filenameMatch = String(filename || "").match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
  return filenameMatch ? `.${filenameMatch[1].toLowerCase()}` : ".png";
}

async function readRecordImageBytes(record, kind) {
  if (kind === "source") {
    return record.source_image_data_url ? dataUrlToUint8Array(record.source_image_data_url) : null;
  }
  if (record.media_selected_data_url) {
    return dataUrlToUint8Array(record.media_selected_data_url);
  }
  if (record.media_csv_data_url) {
    return dataUrlToUint8Array(record.media_csv_data_url);
  }
  return null;
}

function textToUint8Array(text) {
  return new TextEncoder().encode(text);
}

function dataUrlToUint8Array(dataUrl) {
  const parts = String(dataUrl).split(",");
  if (parts.length < 2) return null;
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildZipBlob(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const filenameBytes = textToUint8Array(entry.path.replace(/\\/g, "/"));
    const data = entry.data;
    const crc = crc32(data);
    const { dosTime, dosDate } = getZipDateTime();

    const localHeader = concatUint8Arrays([
      uint32le(0x04034b50),
      uint16le(20),
      uint16le(0x0800),
      uint16le(0),
      uint16le(dosTime),
      uint16le(dosDate),
      uint32le(crc),
      uint32le(data.length),
      uint32le(data.length),
      uint16le(filenameBytes.length),
      uint16le(0),
      filenameBytes,
    ]);
    localParts.push(localHeader, data);

    const centralHeader = concatUint8Arrays([
      uint32le(0x02014b50),
      uint16le(20),
      uint16le(20),
      uint16le(0x0800),
      uint16le(0),
      uint16le(dosTime),
      uint16le(dosDate),
      uint32le(crc),
      uint32le(data.length),
      uint32le(data.length),
      uint16le(filenameBytes.length),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint16le(0),
      uint32le(0),
      uint32le(offset),
      filenameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const endRecord = concatUint8Arrays([
    uint32le(0x06054b50),
    uint16le(0),
    uint16le(0),
    uint16le(entries.length),
    uint16le(entries.length),
    uint32le(centralSize),
    uint32le(centralOffset),
    uint16le(0),
  ]);

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" });
}

function getZipDateTime() {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { dosTime, dosDate };
}

function uint16le(value) {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
}

function uint32le(value) {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

