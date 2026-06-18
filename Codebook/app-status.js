function buildRowKey(row, fallbackIndex = 0) {
  return [
    row.__sourceGroup || "other",
    row.newspaper || row.media_outlet || "outlet",
    row.article_id || row.article_url || "article",
    row.image_index || fallbackIndex,
    extractFilename(row.local_image_path || row.image_url || ""),
  ].join("__");
}

function loadRowState() {
  try {
    return JSON.parse(localStorage.getItem(rowStateStorageKey) || "{}");
  } catch {
    return emptyGroupedRowState();
  }
}

function persistRowState() {
  localStorage.setItem(rowStateStorageKey, JSON.stringify(rowState));
}

function emptyGroupedRowState() {
  return rowStatusGroups.reduce((accumulator, group) => {
    accumulator[group] = {};
    return accumulator;
  }, {});
}

function normalizeRowState(rawState) {
  const grouped = emptyGroupedRowState();
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    return grouped;
  }
  rowStatusGroups.forEach((group) => {
    grouped[group] = rawState[group] && typeof rawState[group] === "object" ? { ...rawState[group] } : {};
  });
  return grouped;
}

function getRowState(row) {
  if (!row?.__rowKey) return {};
  const group = row.__sourceGroup || "other";
  return rowState[group]?.[row.__rowKey] || {};
}

function getNavigableRows() {
  return importedRows.filter((row) => {
    const disposition = getRowState(row).disposition || "active";
    return disposition !== "not_important" && disposition !== "deleted";
  });
}

function markCurrentRowCompleted(record) {
  const group = currentMediaRow?.__sourceGroup || "other";
  const rowKey = currentMediaRow?.__rowKey || `manual__${record.record_id}`;
  rowState[group][rowKey] = {
    ...(rowState[group][rowKey] || {}),
    disposition: "completed",
    completed_by: record.coder_name,
    completed_at: record.coded_at,
    record_id: record.record_id,
    updated_by: record.coder_name,
    updated_at: record.coded_at,
  };
  persistRowState();
  populateMediaCsvSelect();
  if (currentMediaRow && getNavigableRows().some((row) => row.__rowIndex === currentMediaRow.__rowIndex)) {
    elements.mediaCsvSelect.value = currentMediaRow.__rowIndex;
  }
}

function markCurrentRowSourceUnclear() {
  if (!currentMediaRow?.__rowKey) return;
  const group = currentMediaRow.__sourceGroup || "other";
  rowState[group][currentMediaRow.__rowKey] = {
    ...(rowState[group][currentMediaRow.__rowKey] || {}),
    source_unclear: true,
    updated_by: getFormValue("coder_name"),
    updated_at: new Date().toISOString(),
  };
  persistRowState();
  populateMediaCsvSelect();
  elements.mediaCsvSelect.value = currentMediaRow.__rowIndex;
  handleMediaRowSelection();
}

function setCurrentRowDisposition(disposition) {
  if (!currentMediaRow?.__rowKey) return;
  if (disposition === "deleted" && !confirm("Delete this media row from the current coding queue?")) {
    return;
  }
  const currentRowIndex = currentMediaRow.__rowIndex;
  const rowsBefore = getNavigableRows();
  const currentPosition = rowsBefore.findIndex((row) => row.__rowIndex === currentRowIndex);
  const group = currentMediaRow.__sourceGroup || "other";
  rowState[group][currentMediaRow.__rowKey] = {
    ...(rowState[group][currentMediaRow.__rowKey] || {}),
    disposition,
    completed_by: disposition === "completed" ? (rowState[group][currentMediaRow.__rowKey]?.completed_by || "") : "",
    completed_at: disposition === "completed" ? (rowState[group][currentMediaRow.__rowKey]?.completed_at || "") : "",
    record_id: disposition === "completed" ? (rowState[group][currentMediaRow.__rowKey]?.record_id || "") : "",
    updated_by: getFormValue("coder_name"),
    updated_at: new Date().toISOString(),
  };
  persistRowState();
  const rows = getNavigableRows();
  populateMediaCsvSelect();
  if (!rows.length) {
    currentMediaRow = null;
    elements.mediaCsvSelect.value = "";
    applyMediaRow(null);
    return;
  }
  const nextIndex = currentPosition === -1
    ? 0
    : Math.min(currentPosition, rows.length - 1);
  const nextRow = rows[nextIndex] || rows[0];
  elements.mediaCsvSelect.value = nextRow.__rowIndex;
  handleMediaRowSelection({ resetCoding: true });
}

function clearCompletedRowStates() {
  rowStatusGroups.forEach((group) => {
    Object.keys(rowState[group] || {}).forEach((rowKey) => {
      if ((rowState[group][rowKey] || {}).disposition === "completed") {
        delete rowState[group][rowKey];
      }
    });
  });
  persistRowState();
}

function syncMediaArticleLink(url) {
  const normalizedUrl = (url || "").trim();
  elements.mediaArticleUrlLink.href = normalizedUrl || "#";
  elements.mediaArticleUrlLink.textContent = normalizedUrl ? "Open article" : "No link";
  elements.mediaArticleUrlLink.classList.toggle("disabled", !normalizedUrl);
}

function getRowStatusHeaders() {
  return ["row_key", "disposition", "source_unclear", "completed_by", "completed_at", "record_id", "updated_by", "updated_at"];
}

function handleRowStatusImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const importedState = parseRowStatusWorkbook(reader.result);
    if (!importedState) {
      alert("Could not import status file. Please use the exported status.xls file.");
      event.target.value = "";
      syncFilePickerName(event.target);
      return;
    }
    rowStatusGroups.forEach((group) => {
      rowState[group] = {
        ...(rowState[group] || {}),
        ...(importedState[group] || {}),
      };
    });
    persistRowState();
    populateMediaCsvSelect();
    if (currentMediaRow) {
      const rowStillVisible = getNavigableRows().some((row) => row.__rowIndex === currentMediaRow.__rowIndex);
      if (rowStillVisible) {
        elements.mediaCsvSelect.value = currentMediaRow.__rowIndex;
        handleMediaRowSelection();
      } else {
        currentMediaRow = null;
        elements.mediaCsvSelect.value = "";
        applyMediaRow(null);
      }
    }
    alert("Row status file imported.");
  };
  reader.readAsText(file);
}

function buildRowStatusWorkbookXml(headers) {
  const worksheetXml = rowStatusGroups.map((group) => {
    const rows = Object.entries(rowState[group] || {}).map(([rowKey, state]) => ({
      row_key: rowKey,
      disposition: state.disposition || "",
      source_unclear: state.source_unclear ? "true" : "",
      completed_by: state.completed_by || "",
      completed_at: state.completed_at || "",
      record_id: state.record_id || "",
      updated_by: state.updated_by || "",
      updated_at: state.updated_at || "",
    }));
    const tableRows = [
      `<Row>${headers.map((header) => makeSpreadsheetCell(header)).join("")}</Row>`,
      ...rows.map((row) => `<Row>${headers.map((header) => makeSpreadsheetCell(row[header] || "")).join("")}</Row>`),
    ].join("");
    return `<Worksheet ss:Name="${escapeXml(group)}"><Table>${tableRows}</Table></Worksheet>`;
  }).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">${worksheetXml}</Workbook>`;
}

function makeSpreadsheetCell(value) {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function parseRowStatusWorkbook(xmlText) {
  const grouped = emptyGroupedRowState();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const worksheets = Array.from(xml.getElementsByTagNameNS("*", "Worksheet"));
  if (!worksheets.length || xml.getElementsByTagName("parsererror").length) {
    return null;
  }
  worksheets.forEach((worksheet) => {
    const groupName = (
      worksheet.getAttribute("ss:Name")
      || worksheet.getAttribute("Name")
      || worksheet.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Name")
      || ""
    ).trim().toLowerCase();
    if (!rowStatusGroups.includes(groupName)) return;
    const rows = Array.from(worksheet.getElementsByTagNameNS("*", "Row"));
    if (!rows.length) return;
    const headers = extractSpreadsheetRowValues(rows[0]);
    rows.slice(1).forEach((rowNode) => {
      const values = extractSpreadsheetRowValues(rowNode);
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = values[index] || "";
      });
      const rowKey = (rowObject.row_key || "").trim();
      if (!rowKey) return;
        grouped[groupName][rowKey] = {
          disposition: (rowObject.disposition || "").trim() || "active",
          source_unclear: ["true", "1", "yes"].includes((rowObject.source_unclear || "").trim().toLowerCase()),
          completed_by: (rowObject.completed_by || "").trim(),
          completed_at: (rowObject.completed_at || "").trim(),
          record_id: (rowObject.record_id || "").trim(),
        updated_by: (rowObject.updated_by || "").trim(),
        updated_at: (rowObject.updated_at || "").trim(),
      };
    });
  });
  return grouped;
}

function extractSpreadsheetRowValues(rowNode) {
  const cells = Array.from(rowNode.getElementsByTagNameNS("*", "Cell"));
  return cells.map((cell) => {
    const dataNode = cell.getElementsByTagNameNS("*", "Data")[0];
    return dataNode?.textContent || "";
  });
}

