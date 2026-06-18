const ICON_PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/></svg>`;
const ICON_CHART = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 17l0 -5"/><path d="M12 17l0 -3"/><path d="M15 17l0 -1"/></svg>`;

function renderEmptyPreview(target, title, hint, icon) {
  target.innerHTML = `<div class="preview-empty"><div class="preview-empty-icon">${icon}</div><div><p class="preview-empty-title">${title}</p><p class="preview-empty-hint">${hint}</p></div></div>`;
}

function attachFilePreview(input, previewElement, key, isMedia = false) {
  input.addEventListener("change", () => {
    const file = input.files[0] || null;
    currentFiles[key] = file;
    currentFileData[key] = null;
    renderPreview(previewElement, file);
    if (file) {
      readFileAsDataUrl(file).then((dataUrl) => {
        if (currentFiles[key] === file) {
          currentFileData[key] = dataUrl;
        }
      }).catch(() => {
        currentFileData[key] = null;
      });
    }
    if (isMedia && file) {
      tryAutoMatchMediaFile(file);
    }
  });
}

function renderPreview(target, file) {
  if (!file) {
    const isMedia = target === elements.mediaPreview;
    renderEmptyPreview(target, isMedia ? "No image selected" : "No figure uploaded", isMedia ? "Select a CSV row to load automatically" : "Upload the original scientific figure", isMedia ? ICON_PHOTO : ICON_CHART);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    target.innerHTML = `
      <button type="button" class="preview-trigger" data-preview-src="${reader.result}" data-preview-caption="${escapeHtml(file.name)}">
        <img src="${reader.result}" alt="${escapeHtml(file.name)}">
      </button>
    `;
  };
  reader.readAsDataURL(file);
}

function renderSavedPreviewNote(target, message) {
  target.innerHTML = `<div class="saved-preview-note">${escapeHtml(message)}</div>`;
}

function renderPreviewFromSource(target, src, caption, emptyText) {
  if (!src) {
    const isMedia = target === elements.mediaPreview;
    renderEmptyPreview(target, emptyText, isMedia ? "Select a CSV row to load automatically" : "Upload the original scientific figure", isMedia ? ICON_PHOTO : ICON_CHART);
    return;
  }
  const safeCaption = escapeHtml(caption || "Preview image");
  target.innerHTML = `
    <button type="button" class="preview-trigger" data-preview-src="${src}" data-preview-caption="${safeCaption}">
      <img src="${src}" alt="${safeCaption}">
    </button>
  `;
}

function renderPreviewFromPath(target, filePath, emptyText) {
  if (!filePath) {
    const isMedia = target === elements.mediaPreview;
    renderEmptyPreview(target, emptyText, isMedia ? "Select a CSV row to load automatically" : "Upload the original scientific figure", isMedia ? ICON_PHOTO : ICON_CHART);
    return;
  }
  const normalizedPath = filePath.replace(/\\/g, "/");
  const sourceUrl = normalizedPath.match(/^[A-Za-z]:\//)
    ? `file://${encodeURI(`/${normalizedPath}`)}`
    : encodeURI(normalizedPath);
  renderPreviewFromSource(target, sourceUrl, extractFilename(filePath), emptyText);
}

function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  updateImportControls();
  const reader = new FileReader();
  reader.onload = () => {
    const parsedRows = parseCsv(reader.result);
    currentImportedSourceGroup = detectSourceGroupFromFilename(file.name || "") || detectSourceGroupFromRows(parsedRows);
    importedRows = parsedRows;
    importedRows = importedRows.map((row, index) => ({
      ...row,
      __sourceGroup: currentImportedSourceGroup,
      __rowIndex: String(index),
      __rowKey: buildRowKey({ ...row, __sourceGroup: currentImportedSourceGroup }, index),
    }));
    populateMediaCsvSelect();
    populateImportedMediaImageFileSelect();
    updateImportControls();
  };
  reader.readAsText(file);
}

function handleMediaImageFilesImport(event) {
  const files = Array.from(event.target.files || [])
    .filter(isImageFile)
    .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
  updateImportControls();
  importedMediaImageFileList = files;
  importedMediaImageFiles = new Map();
  importedMediaImageDataUrls = new Map();
  files.forEach((file) => {
    imageLookupKeysForFile(file).forEach((key) => {
      if (!importedMediaImageFiles.has(key)) {
        importedMediaImageFiles.set(key, file);
      }
    });
  });
  populateImportedMediaImageFileSelect();
  if (currentMediaRow) {
    hydrateMediaPreviewFromImportedFile(currentMediaRow);
  }
  const matchedCount = importedRows.filter((row) => findImportedMediaImageFile(row)).length;
  const suffix = importedRows.length ? ` Matched ${matchedCount} of ${importedRows.length} imported CSV rows.` : "";
  alert(`Imported ${files.length} media image file(s) for export.${suffix}`);
}

function updateImportControls() {
  elements.csvInput.disabled = false;
  elements.mediaImageFilesInput.disabled = false;
  elements.mediaImageFileSelect.disabled = Boolean(importedRows.length) || !importedMediaImageFileList.length;
  updateImportedMediaFileNavigation();
  syncMediaMetadataEditability();
}

function syncMediaMetadataEditability() {
  const hasCsvRow = Boolean(currentMediaRow);
  mediaMetadataFields.forEach((field) => {
    const input = document.getElementById(field);
    const label = input.closest(".field");
    input.readOnly = hasCsvRow;
    label.classList.toggle("readonly", hasCsvRow);
  });
  syncMediaUpdatedDateState();
}

function syncMediaUpdatedDateState() {
  elements.mediaUpdatedDateInput.classList.toggle("empty-value", !elements.mediaUpdatedDateInput.value.trim());
}

function formatDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}-${isoMatch[1]}`;
  }
  const slashIsoMatch = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashIsoMatch) {
    return `${slashIsoMatch[2].padStart(2, "0")}-${slashIsoMatch[3].padStart(2, "0")}-${slashIsoMatch[1]}`;
  }
  const displayMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[1].padStart(2, "0")}-${displayMatch[2].padStart(2, "0")}-${displayMatch[3]}`;
  }
  return raw;
}

function normalizeDateInput(input) {
  input.value = formatDisplayDate(input.value);
  if (input === elements.mediaPublicationDateInput) {
    updateRecordId();
  }
  if (input === elements.mediaUpdatedDateInput) {
    syncMediaUpdatedDateState();
  }
}

function populateImportedMediaImageFileSelect() {
  if (!importedMediaImageFileList.length) {
    elements.mediaImageFileSelect.innerHTML = `<option value="">No media image folder imported</option>`;
    elements.mediaImageFileSelect.disabled = true;
    updateImportedMediaFileNavigation();
    return;
  }
  if (importedRows.length) {
    elements.mediaImageFileSelect.innerHTML = `<option value="">Folder imported; use CSV row selection below</option>`;
    elements.mediaImageFileSelect.disabled = true;
    updateImportedMediaFileNavigation();
    return;
  }
  const options = [`<option value="">Select a media image from folder</option>`];
  importedMediaImageFileList.forEach((file, index) => {
    const label = file.webkitRelativePath || file.name;
    options.push(`<option value="${index}">${escapeHtml(label)}</option>`);
  });
  elements.mediaImageFileSelect.innerHTML = options.join("");
  elements.mediaImageFileSelect.disabled = false;
  updateImportedMediaFileNavigation();
}

async function handleImportedMediaImageSelection() {
  const selectedValue = elements.mediaImageFileSelect.value;
  const selectedIndex = selectedValue === "" ? -1 : Number(selectedValue);
  const file = selectedIndex >= 0 ? importedMediaImageFileList[selectedIndex] : null;
  if (!file) {
    currentFiles.media_image = null;
    currentFileData.media_image = null;
    if (currentMediaRow) {
      renderPreviewFromPath(elements.mediaPreview, currentMediaRow.local_image_path || "", "No media image selected");
      hydrateMediaPreviewFromImportedFile(currentMediaRow);
    } else {
      renderPreview(elements.mediaPreview, null);
    }
    updateImportedMediaFileNavigation();
    return;
  }

  clearCodingStateForMediaRowChange();
  elements.mediaImageFileSelect.value = String(selectedIndex);
  currentMediaRow = null;
  elements.mediaCsvSelect.value = "";
  applyMediaRow(null);
  currentFiles.media_image = file;
  currentFileData.media_image = null;
  renderPreview(elements.mediaPreview, file);
  try {
    currentFileData.media_image = await readFileAsDataUrl(file);
  } catch {
    currentFileData.media_image = null;
  }
  tryAutoMatchMediaFile(file);
  updateImportedMediaFileNavigation();
}

function detectSourceGroupFromFilename(filename) {
  const normalized = (filename || "").toLowerCase();
  if (normalized.includes("bbc")) return "bbc";
  if (normalized.includes("guardian")) return "guardian";
  if (normalized.includes("nytimes") || normalized.includes("new_york_times") || normalized.includes("newyorktimes")) return "nytimes";
  return "";
}

function detectSourceGroupFromRows(rows) {
  const sample = (rows || [])
    .slice(0, 5)
    .map((row) => `${row.newspaper || ""} ${row.media_outlet || ""}`.toLowerCase())
    .join(" ");
  if (sample.includes("bbc")) return "bbc";
  if (sample.includes("guardian")) return "guardian";
  if (sample.includes("new york times") || sample.includes("nytimes")) return "nytimes";
  return "other";
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((value, index) => {
    const trimmed = value.trim();
    return index === 0 ? trimmed.replace(/^\uFEFF/, "") : trimmed;
  });
  return rows.slice(1)
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const record = {};
      headers.forEach((header, headerIndex) => {
        record[header] = (values[headerIndex] || "").trim();
      });
      return record;
    });
}

function recordsToCsv(records, headers) {
  const rows = [headers.join(",")];
  records.forEach((record) => {
    rows.push(headers.map((header) => csvEscape(record[header] ?? "")).join(","));
  });
  return rows.join("\n");
}

function populateMediaCsvSelect() {
  const options = [`<option value="">Select a media image row</option>`];
  getNavigableRows().forEach((row) => {
    const state = getRowState(row);
    const label = [
      row.newspaper || row.media_outlet || "Unknown outlet",
      row.article_title || row.article_id || "Untitled",
      row.image_index ? `img ${row.image_index}` : "",
      state.disposition === "completed" && state.completed_by ? `done:${state.completed_by}` : "",
      state.source_unclear ? "source unclear" : "",
    ].filter(Boolean).join(" | ");
    options.push(`<option value="${row.__rowIndex}">${escapeHtml(label)}</option>`);
  });
  elements.mediaCsvSelect.innerHTML = options.join("");
  elements.mediaCsvSummary.textContent = importedRows.length
    ? `${getNavigableRows().length} active rows available from ${importedRows.length} imported rows.`
    : "No media image row selected.";
  updateNavigationButtons();
}

function handleMediaRowSelection({ resetCoding = false } = {}) {
  const selectedIndex = elements.mediaCsvSelect.value;
  const selectedRow = importedRows.find((row) => row.__rowIndex === selectedIndex) || null;
  const savedRecord = selectedRow ? findSavedRecordForMediaRow(selectedRow) : null;
  if (savedRecord) {
    loadRecordIntoForm(savedRecord.record_id);
    return;
  }
  if (resetCoding) {
    clearCodingStateForMediaRowChange();
  }
  currentMediaRow = selectedRow;
  applyMediaRow(currentMediaRow);
  updateNavigationButtons();
}

function clearCodingStateForMediaRowChange() {
  activeLoadedRecord = null;
  document.getElementById("source_organization").value = "";
  document.getElementById("source_figure_id").value = "";
  document.getElementById("source_figure_url").value = "";
  setCodingConfidence("");
  elements.coderNotesInput.value = "";
  autoResizeTextarea(elements.coderNotesInput);

  currentFiles.media_image = null;
  currentFiles.source_image = null;
  currentFileData.media_image = null;
  currentFileData.source_image = null;
  elements.sourceImageInput.value = "";
  syncFilePickerName(elements.sourceImageInput);
  elements.mediaImageFileSelect.value = "";
  renderPreview(elements.mediaPreview, null);
  renderPreview(elements.sourcePreview, null);

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      restoreFieldSelection(field, "");
      field.extraInputs?.forEach((extraInput) => {
        const input = document.getElementById(extraInput.id);
        if (input) {
          input.value = "";
          clearOptionSpecificExtraInputDraft(input);
        }
      });
    });
  });
  syncAllFieldExtraInputs();
}

function applyMediaRow(row) {
  if (!row) {
    document.getElementById("media_outlet").value = "";
    mediaMetadataFields.forEach((field) => {
      document.getElementById(field).value = "";
    });
    syncMediaArticleLink("");
    syncMediaMetadataEditability();
    elements.mediaCsvSummary.textContent = "No media image row selected.";
    if (!currentFiles.media_image) {
      renderPreview(elements.mediaPreview, null);
    }
    updateRecordId();
    updateNavigationButtons();
    return;
  }

  document.getElementById("media_outlet").value = row.newspaper || row.media_outlet || "";
  document.getElementById("media_article_title").value = row.article_title || "";
  document.getElementById("media_article_url").value = row.article_url || "";
  document.getElementById("media_publication_date").value = formatDisplayDate(row.published_date);
  document.getElementById("media_updated_date").value = formatDisplayDate(row.updated_date);
  syncMediaArticleLink(row.article_url || "");
  syncMediaMetadataEditability();
  const state = getRowState(row);
  const outlet = escapeHtml(row.newspaper || row.media_outlet || "");
  const date = escapeHtml(formatDisplayDate(row.published_date));
  const filename = escapeHtml(extractFilename(row.local_image_path || ""));
  const badges = [
    outlet ? `<span class="summary-badge summary-badge--outlet">${outlet}</span>` : "",
    date ? `<span class="summary-badge">${date}</span>` : "",
    filename ? `<span class="summary-badge">${filename}</span>` : "",
    state.source_unclear ? `<span class="summary-badge summary-badge--warn">Source unclear</span>` : "",
    state.disposition === "completed" ? `<span class="summary-badge summary-badge--done">Done — ${escapeHtml(state.completed_by || "")}</span>` : "",
    state.disposition === "not_important" ? `<span class="summary-badge summary-badge--muted">Not important</span>` : "",
  ].filter(Boolean).join("");
  elements.mediaCsvSummary.innerHTML = `<div class="summary-badges">${badges || "—"}</div>`;
  if (!currentFiles.media_image) {
    renderPreviewFromPath(elements.mediaPreview, row.local_image_path || "", "No media image selected");
    hydrateMediaPreviewFromImportedFile(row);
  }
  updateRecordId();
  updateNavigationButtons();
}

async function hydrateMediaPreviewFromImportedFile(row) {
  if (!row || currentFiles.media_image) return;
  const dataUrl = await getImportedMediaImageDataUrl(row);
  if (!dataUrl || currentMediaRow !== row) return;
  renderPreviewFromSource(
    elements.mediaPreview,
    dataUrl,
    extractFilename(row.local_image_path || "") || "Media adaptation image",
    "No media image selected"
  );
}

function tryAutoMatchMediaFile(file) {
  if (!importedRows.length) return;
  const matchedRow = importedRows.find((row) => {
    const filename = extractFilename(row.local_image_path || "");
    return filename && filename.toLowerCase() === file.name.toLowerCase();
  });
  if (!matchedRow) return;
  elements.mediaCsvSelect.value = matchedRow.__rowIndex;
  currentMediaRow = matchedRow;
  applyMediaRow(matchedRow);
}

function findSavedRecordForMediaRow(row) {
  if (!row) return null;
  const rowPath = row.local_image_path || "";
  const rowUrl = row.image_url || "";
  const rowArticleId = row.article_id || "";
  const rowFilename = extractFilename(rowPath || rowUrl);

  return savedRecords.find((record) => {
    if (rowPath && record.media_csv_local_path === rowPath) return true;
    if (rowUrl && record.media_csv_image_url === rowUrl) return true;
    if (rowFilename && record.media_image_filename === rowFilename) return true;
    return Boolean(rowArticleId && record.media_csv_article_id === rowArticleId && rowFilename && record.media_image_filename === rowFilename);
  }) || null;
}

function moveMediaSelection(direction) {
  const rows = getNavigableRows();
  if (!rows.length) return;
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : rows.length - 1)
    : Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  elements.mediaCsvSelect.value = rows[nextIndex].__rowIndex;
  handleMediaRowSelection({ resetCoding: true });
}

function moveImportedMediaFileSelection(direction) {
  if (importedRows.length || !importedMediaImageFileList.length) return;
  const selectedValue = elements.mediaImageFileSelect.value;
  const currentIndex = selectedValue === "" ? -1 : Number(selectedValue);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : importedMediaImageFileList.length - 1)
    : Math.max(0, Math.min(importedMediaImageFileList.length - 1, currentIndex + direction));
  elements.mediaImageFileSelect.value = String(nextIndex);
  handleImportedMediaImageSelection();
}

function updateNavigationButtons() {
  const rows = getNavigableRows();
  const hasRows = rows.length > 0;
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  elements.prevRowBtn.disabled = !hasRows || currentIndex <= 0;
  elements.nextRowBtn.disabled = !hasRows || currentIndex === -1 || currentIndex >= rows.length - 1;
  elements.saveNextBtn.disabled = false;
  elements.markNotImportantBtn.disabled = !hasRows || currentIndex === -1;
  elements.markSourceUnclearBtn.disabled = !hasRows || currentIndex === -1;
  elements.deleteRowBtn.disabled = !hasRows || currentIndex === -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  elements.mediaRowProgress.textContent = displayIndex > 0 ? `${displayIndex} of ${rows.length}` : `– of ${rows.length}`;
}

function updateImportedMediaFileNavigation() {
  const hasManualFileMode = importedMediaImageFileList.length > 0 && !importedRows.length;
  const selectedValue = elements.mediaImageFileSelect.value || "";
  const currentIndex = selectedValue === "" ? -1 : Number(selectedValue);
  const validCurrentIndex = Number.isInteger(currentIndex)
    && currentIndex >= 0
    && currentIndex < importedMediaImageFileList.length;
  elements.prevMediaFileBtn.disabled = !hasManualFileMode || !validCurrentIndex || currentIndex <= 0;
  elements.nextMediaFileBtn.disabled = !hasManualFileMode
    || (validCurrentIndex && currentIndex >= importedMediaImageFileList.length - 1);
  const displayIndex = validCurrentIndex ? currentIndex + 1 : 0;
  elements.mediaFileProgress.textContent = displayIndex > 0 ? `${displayIndex} of ${importedMediaImageFileList.length}` : `– of ${importedMediaImageFileList.length}`;
}

