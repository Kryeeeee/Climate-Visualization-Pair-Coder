const recordsStorageKey = "source-image-codebook-records-v3";
const priorRecordsStorageKey = "ipcc-image-codebook-records-v2";
const coderStorageKey = "source-image-codebook-last-coder";
const priorCoderStorageKey = "ipcc-image-codebook-last-coder";
const rowStateStorageKey = "source-image-codebook-row-state-v1";
const customFieldsStorageKey = "source-image-codebook-custom-fields-v1";
const rowStatusGroups = ["bbc", "guardian", "nytimes", "other"];

const codebookSections = [
  {
    key: "information_selection",
    title: "Information selection",
    description:
      "How much of the original information space is preserved, reduced, or expanded in the media adaptation.",
    fields: [
      {
        id: "scenario_change",
        label: "Scenario coverage change",
        help: "Whether scenario coverage stays the same, is reduced, or is expanded relative to the original figure.",
        options: ["same", "reduced_partial", "reduced_major", "expanded_partial", "expanded_major", "not_applicable"],
      },
      {
        id: "variable_change",
        label: "Variable coverage change",
        help: "Whether variables or measures are removed or added relative to the original.",
        options: ["same", "reduced", "expanded", "not_applicable"],
      },
      {
        id: "spatial_change",
        label: "Spatial scope change",
        help: "Whether the adaptation narrows or broadens the geographic scope.",
        options: ["same", "reduced_partial", "reduced_major", "expanded", "not_applicable"],
      },
      {
        id: "temporal_change",
        label: "Temporal scope change",
        help: "Whether the adaptation narrows or broadens the time horizon.",
        options: ["same", "reduced_partial", "reduced_major", "expanded", "not_applicable"],
      },
      {
        id: "uncertainty_visibility",
        label: "Uncertainty visibility",
        help: "How visible uncertainty remains in the adapted version.",
        options: ["retained", "simplified", "removed", "not_applicable"],
      },
      {
        id: "source_attribution_visibility",
        label: "Source attribution visibility",
        help: "How clearly the scientific source or data provider is identified in the adaptation.",
        options: ["strong", "moderate", "weak", "absent"],
      },
    ],
  },
  {
    key: "visual_form",
    title: "Visual form",
    description:
      "How the chart form, density, emphasis, and aesthetic presentation change in the adaptation.",
    fields: [
      {
        id: "chart_type_relation",
        label: "Chart type relation",
        help: "Whether the adaptation keeps the same chart type, lightly modifies it, or changes it.",
        options: ["same", "modified", "changed"],
      },
      {
        id: "chart_form_familiarity_shift",
        label: "Chart-form familiarity shift",
        help: "Whether the resulting chart form seems more or less familiar to general audiences.",
        options: ["lower", "similar", "higher", "not_applicable"],
      },
      {
        id: "visual_density_change",
        label: "Visual density change",
        help: "Compare clutter, number of marks, and overall information packing.",
        options: ["denser", "similar", "simpler"],
      },
      {
        id: "legend_dependency_change",
        label: "Legend dependency change",
        help: "Whether viewers must rely on legends more or less to read the figure.",
        options: ["higher", "similar", "lower", "not_applicable"],
      },
      {
        id: "visual_emphasis_added",
        label: "Visual emphasis added",
        help: "Additional highlighting, spotlighting, arrows, contrast, or attention cues.",
        options: ["none", "low", "high"],
      },
      {
        id: "style_shift",
        label: "Style shift",
        help: "Overall aesthetic change relative to the original figure.",
        options: ["none", "more_minimal", "more_editorial", "more_decorative", "more_technical"],
      },
      {
        id: "color_function_shift",
        label: "Color-function shift",
        help: "How color use changes in communicative function.",
        options: ["none", "more_categorical", "more_sequential", "more_affective_warning", "more_muted"],
      },
    ],
  },
  {
    key: "narrative_guidance",
    title: "Narrative guidance",
    description:
      "How much verbal framing and interpretive scaffolding are added in the media adaptation.",
    fields: [
      {
        id: "title_function",
        label: "Title function",
        help: "How the main title frames the intended takeaway.",
        options: ["descriptive", "takeaway", "evaluative", "alarming", "solution_oriented", "absent"],
      },
      {
        id: "subtitle_function",
        label: "Subtitle function",
        help: "Role of subtitle or deck, if present.",
        options: ["none", "description", "explanation", "interpretation", "source_method"],
      },
      {
        id: "annotation_function",
        label: "Annotation function",
        help: "Most salient role of annotations or labels.",
        options: ["none", "label", "explain_threshold", "explain_cause", "call_to_action", "mixed"],
      },
      {
        id: "narrative_frame",
        label: "Narrative frame",
        help: "Dominant framing of the adapted figure.",
        options: ["neutral", "risk_focused", "responsibility_focused", "solution_focused", "conflict_focused"],
      },
    ],
  },
];

const readonlyMetadataFields = [
  "media_article_title",
  "media_article_url",
  "media_publication_date",
];

const metadataFields = [
  "record_id",
  "coder_name",
  "source_organization",
  "source_figure_id",
  "media_outlet",
  ...readonlyMetadataFields,
  "overall_adaptation_intensity",
  "coding_confidence",
  "coder_notes",
];

const elements = {
  sectionRoot: document.getElementById("codebookSections"),
  coderSelect: document.getElementById("coder_name"),
  sourceOrganizationInput: document.getElementById("source_organization"),
  sourceFigureInput: document.getElementById("source_figure_id"),
  coderNotesInput: document.getElementById("coder_notes"),
  mediaOutletInput: document.getElementById("media_outlet"),
  recordIdInput: document.getElementById("record_id"),
  sourcePreview: document.getElementById("sourcePreview"),
  mediaPreview: document.getElementById("mediaPreview"),
  csvInput: document.getElementById("csvInput"),
  rowStatusCsvInput: document.getElementById("rowStatusCsvInput"),
  exportRowStatusBtn: document.getElementById("exportRowStatusBtn"),
  mediaCsvSelect: document.getElementById("mediaCsvSelect"),
  mediaCsvSummary: document.getElementById("mediaCsvSummary"),
  prevRowBtn: document.getElementById("prevRowBtn"),
  nextRowBtn: document.getElementById("nextRowBtn"),
  markNotImportantBtn: document.getElementById("markNotImportantBtn"),
  markSourceUnclearBtn: document.getElementById("markSourceUnclearBtn"),
  deleteRowBtn: document.getElementById("deleteRowBtn"),
  mediaRowProgress: document.getElementById("mediaRowProgress"),
  mediaImageInput: document.getElementById("media_image"),
  sourceImageInput: document.getElementById("source_image"),
  mediaArticleUrlInput: document.getElementById("media_article_url"),
  mediaArticleUrlLink: document.getElementById("mediaArticleUrlLink"),
  saveRecordBtn: document.getElementById("saveRecordBtn"),
  saveNextBtn: document.getElementById("saveNextBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  clearRecordsBtn: document.getElementById("clearRecordsBtn"),
  lightbox: document.getElementById("imageLightbox"),
  lightboxImage: document.getElementById("lightboxImage"),
  lightboxCaption: document.getElementById("lightboxCaption"),
  lightboxCloseBtn: document.getElementById("lightboxCloseBtn"),
  recordCount: document.getElementById("recordCount"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  optionGroupTemplate: document.getElementById("optionGroupTemplate"),
  fieldCardTemplate: document.getElementById("fieldCardTemplate"),
  customFieldTemplate: document.getElementById("customFieldTemplate"),
};

let savedRecords = loadRecords();
let rowState = normalizeRowState(loadRowState());
let importedRows = [];
let currentMediaRow = null;
let activeLoadedRecord = null;
let currentFiles = {
  source_image: null,
  media_image: null,
};
let currentFileData = {
  source_image: null,
  media_image: null,
};
let currentImportedSourceGroup = "other";

init();

function init() {
  hydrateCustomFields();
  renderCodebook();
  attachFilePreview(elements.sourceImageInput, elements.sourcePreview, "source_image");
  attachFilePreview(elements.mediaImageInput, elements.mediaPreview, "media_image", true);
  elements.coderNotesInput.addEventListener("input", () => autoResizeTextarea(elements.coderNotesInput));

  elements.csvInput.addEventListener("change", handleCsvImport);
  elements.rowStatusCsvInput.addEventListener("change", handleRowStatusImport);
  elements.exportRowStatusBtn.addEventListener("click", exportRowStatusCsv);
  elements.mediaCsvSelect.addEventListener("change", handleMediaRowSelection);
  elements.prevRowBtn.addEventListener("click", () => moveMediaSelection(-1));
  elements.nextRowBtn.addEventListener("click", () => moveMediaSelection(1));
  elements.markNotImportantBtn.addEventListener("click", () => setCurrentRowDisposition("not_important"));
  elements.markSourceUnclearBtn.addEventListener("click", markCurrentRowSourceUnclear);
  elements.deleteRowBtn.addEventListener("click", () => setCurrentRowDisposition("deleted"));
  elements.sourceOrganizationInput.addEventListener("input", updateRecordId);
  elements.sourceFigureInput.addEventListener("input", updateRecordId);
  elements.mediaOutletInput.addEventListener("input", updateRecordId);
  elements.coderSelect.addEventListener("change", persistCoder);
  elements.saveRecordBtn.addEventListener("click", saveCurrentRecord);
  elements.saveNextBtn.addEventListener("click", () => saveCurrentRecord({ moveNextAfterSave: true }));
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.clearFormBtn.addEventListener("click", resetForm);
  elements.clearRecordsBtn.addEventListener("click", clearRecords);
  elements.mediaPreview.addEventListener("click", handlePreviewClick);
  elements.sourcePreview.addEventListener("click", handlePreviewClick);
  elements.lightbox.addEventListener("click", handleLightboxBackdropClick);
  elements.lightboxCloseBtn.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", handleGlobalKeydown);

  restoreLastCoder();
  resetForm(true);
  renderSavedRecords();
  updateNavigationButtons();
}

function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function renderCodebook(preservedSelections = null) {
  elements.sectionRoot.innerHTML = "";
  codebookSections.forEach((section) => {
    const fragment = elements.optionGroupTemplate.content.cloneNode(true);
    const sectionNode = fragment.querySelector(".code-section");
    sectionNode.dataset.section = section.key;
    fragment.querySelector(".section-title").textContent = section.title;
    fragment.querySelector(".section-copy").textContent = section.description;
    const fieldGroups = fragment.querySelector(".field-groups");

    section.fields.forEach((field) => {
      const fieldFragment = elements.fieldCardTemplate.content.cloneNode(true);
      const fieldCard = fieldFragment.querySelector(".field-card");
      const fieldHead = fieldFragment.querySelector(".field-card-head");
      const deleteButton = fieldFragment.querySelector(".field-card-delete");
      fieldFragment.querySelector(".field-card-label").textContent = field.custom ? `* ${field.label}` : field.label;
      fieldFragment.querySelector(".field-card-help").textContent = field.help;
      const chipGroup = fieldFragment.querySelector(".chip-group");
      chipGroup.appendChild(makeChip(field.id, "", "Unset"));
      field.options.forEach((option) => chipGroup.appendChild(makeChip(field.id, option, prettifyOption(option))));
      if (field.custom) {
        fieldHead.classList.add("with-delete");
        deleteButton.classList.remove("hidden");
        deleteButton.addEventListener("click", () => deleteCustomField(section.key, field.id));
      }
      fieldGroups.appendChild(fieldFragment);
    });

    const customFieldFragment = elements.customFieldTemplate.content.cloneNode(true);
    const builder = customFieldFragment.querySelector(".custom-field-builder");
    const toggleBtn = customFieldFragment.querySelector(".custom-field-toggle-btn");
    const cancelBtn = customFieldFragment.querySelector(".custom-field-cancel-btn");
    const editor = customFieldFragment.querySelector(".custom-field-editor");
    builder.dataset.sectionKey = section.key;
    toggleBtn.addEventListener("click", () => {
      editor.classList.remove("hidden");
      toggleBtn.classList.add("hidden");
    });
    cancelBtn.addEventListener("click", () => resetCustomFieldBuilder(builder));
    builder.querySelector(".custom-field-add-btn").addEventListener("click", () => addCustomField(section.key, builder));
    fieldGroups.appendChild(customFieldFragment);

    elements.sectionRoot.appendChild(fragment);
  });

  if (preservedSelections) {
    restoreCodebookSelections(preservedSelections);
  }
}

function makeChip(groupName, optionValue, optionLabel) {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-option";
  const inputId = `${groupName}__${optionValue || "unset"}`;
  wrapper.innerHTML = `
    <input type="radio" name="${groupName}" id="${inputId}" value="${optionValue}">
    <label for="${inputId}">${optionLabel}</label>
  `;
  return wrapper;
}

function prettifyOption(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
    target.classList.add("muted");
    target.textContent = target === elements.mediaPreview ? "No media image selected" : "No original scientific image selected";
    return;
  }
  target.classList.remove("muted");
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
  target.classList.remove("muted");
  target.innerHTML = `<div class="saved-preview-note">${escapeHtml(message)}</div>`;
}

function renderPreviewFromSource(target, src, caption, fallbackText) {
  if (!src) {
    target.classList.add("muted");
    target.textContent = fallbackText;
    return;
  }
  target.classList.remove("muted");
  const safeCaption = escapeHtml(caption || "Preview image");
  target.innerHTML = `
    <button type="button" class="preview-trigger" data-preview-src="${src}" data-preview-caption="${safeCaption}">
      <img src="${src}" alt="${safeCaption}">
    </button>
  `;
}

function renderPreviewFromPath(target, filePath, fallbackText) {
  if (!filePath) {
    target.classList.add("muted");
    target.textContent = fallbackText;
    return;
  }
  const normalizedPath = filePath.replace(/\\/g, "/");
  const pathWithLeadingSlash = normalizedPath.match(/^[A-Za-z]:\//) ? `/${normalizedPath}` : normalizedPath;
  const fileUrl = `file://${encodeURI(pathWithLeadingSlash)}`;
  renderPreviewFromSource(target, fileUrl, extractFilename(filePath), fallbackText);
}

function renderPreviewFromDataUrl(target, dataUrl, caption, fallbackText) {
  renderPreviewFromSource(target, dataUrl, caption, fallbackText);
}

function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;
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
  };
  reader.readAsText(file);
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
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1)
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values, index) => {
      const record = { __rowIndex: String(index) };
      headers.forEach((header, headerIndex) => {
        record[header] = (values[headerIndex] || "").trim();
      });
      record.__rowKey = buildRowKey(record, index);
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

function handleMediaRowSelection() {
  const selectedIndex = elements.mediaCsvSelect.value;
  currentMediaRow = importedRows.find((row) => row.__rowIndex === selectedIndex) || null;
  applyMediaRow(currentMediaRow);
  updateNavigationButtons();
}

function applyMediaRow(row) {
  if (!row) {
    document.getElementById("media_outlet").value = "";
    readonlyMetadataFields.forEach((field) => {
      document.getElementById(field).value = "";
    });
    elements.mediaCsvSummary.textContent = importedRows.length
      ? "No media image row selected."
      : "No media image row selected.";
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
  document.getElementById("media_publication_date").value = row.published_date || "";
  syncMediaArticleLink(row.article_url || "");
  const state = getRowState(row);
  const dispositionLine = state.disposition === "completed"
    ? `<strong>Status:</strong> completed by ${escapeHtml(state.completed_by || "unknown")}<br>`
    : state.disposition === "not_important"
      ? `<strong>Status:</strong> marked not important<br>`
      : state.disposition === "deleted"
        ? `<strong>Status:</strong> deleted from queue<br>`
        : "";
  const sourceUnclearLine = state.source_unclear ? "<strong>Source note:</strong> marked source unclear<br>" : "";
  elements.mediaCsvSummary.innerHTML = `
      ${dispositionLine}${sourceUnclearLine}
      <strong>Image file:</strong> ${escapeHtml(extractFilename(row.local_image_path || ""))}
    `;
  if (!currentFiles.media_image) {
    renderPreviewFromPath(elements.mediaPreview, row.local_image_path || "", "No media image selected");
  }
  updateRecordId();
  updateNavigationButtons();
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

function moveMediaSelection(direction) {
  const rows = getNavigableRows();
  if (!rows.length) return;
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : rows.length - 1)
    : Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  elements.mediaCsvSelect.value = rows[nextIndex].__rowIndex;
  handleMediaRowSelection();
}

function updateNavigationButtons() {
  const rows = getNavigableRows();
  const hasRows = rows.length > 0;
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  elements.prevRowBtn.disabled = !hasRows || currentIndex <= 0;
  elements.nextRowBtn.disabled = !hasRows || currentIndex === -1 || currentIndex >= rows.length - 1;
  elements.saveNextBtn.disabled = !hasRows;
  elements.markNotImportantBtn.disabled = !hasRows || currentIndex === -1;
  elements.markSourceUnclearBtn.disabled = !hasRows || currentIndex === -1;
  elements.deleteRowBtn.disabled = !hasRows || currentIndex === -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  elements.mediaRowProgress.textContent = `${displayIndex} / ${rows.length}`;
}

function getFormValue(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function captureCodebookSelections() {
  const selections = {};
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      selections[field.id] = getRadioValue(field.id);
    });
  });
  return selections;
}

function restoreCodebookSelections(selections) {
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      const optionValue = selections[field.id] || "";
      const radio = document.getElementById(`${field.id}__${optionValue || "unset"}`) || document.getElementById(`${field.id}__unset`);
      if (radio) radio.checked = true;
    });
  });
}

function buildRecordId() {
  const sourceOrganization = slugify(getFormValue("source_organization") || "source");
  const figureId = slugify(getFormValue("source_figure_id") || "figure");
  const outlet = slugify(getFormValue("media_outlet") || "outlet");
  const date = (getFormValue("media_publication_date") || "undated").replaceAll("-", "");
  return `${sourceOrganization}__${figureId}__${outlet}__${date}`;
}

function updateRecordId() {
  elements.recordIdInput.value = buildRecordId();
}

function persistCoder() {
  localStorage.setItem(coderStorageKey, elements.coderSelect.value || "");
}

function restoreLastCoder() {
  const lastCoder = localStorage.getItem(coderStorageKey) || localStorage.getItem(priorCoderStorageKey) || "";
  if (lastCoder) {
    elements.coderSelect.value = lastCoder;
  }
}

async function collectRecord() {
  const record = {};
  metadataFields.forEach((field) => {
    record[field] = getFormValue(field);
  });
  record.source_image_filename = currentFiles.source_image ? currentFiles.source_image.name : "";
  if (!record.source_image_filename && activeLoadedRecord?.record_id === record.record_id) {
    record.source_image_filename = activeLoadedRecord.source_image_filename || "";
  }
  record.media_image_filename = currentFiles.media_image
    ? currentFiles.media_image.name
    : extractFilename(currentMediaRow?.local_image_path || "");
  if (!record.media_image_filename && activeLoadedRecord?.record_id === record.record_id) {
    record.media_image_filename = activeLoadedRecord.media_image_filename || "";
  }
  record.media_csv_local_path = currentMediaRow?.local_image_path || "";
  if (!record.media_csv_local_path && activeLoadedRecord?.record_id === record.record_id) {
    record.media_csv_local_path = activeLoadedRecord.media_csv_local_path || "";
  }
  record.media_csv_article_id = currentMediaRow?.article_id || "";
  if (!record.media_csv_article_id && activeLoadedRecord?.record_id === record.record_id) {
    record.media_csv_article_id = activeLoadedRecord.media_csv_article_id || "";
  }
  record.media_csv_image_url = currentMediaRow?.image_url || "";
  if (!record.media_csv_image_url && activeLoadedRecord?.record_id === record.record_id) {
    record.media_csv_image_url = activeLoadedRecord.media_csv_image_url || "";
  }
  record.source_image_data_url = currentFiles.source_image
    ? (currentFileData.source_image || await readFileAsDataUrl(currentFiles.source_image))
    : activeLoadedRecord?.source_image_data_url || "";
  record.media_uploaded_data_url = currentFiles.media_image
    ? (currentFileData.media_image || await readFileAsDataUrl(currentFiles.media_image))
    : activeLoadedRecord?.media_uploaded_data_url || "";
  record.coded_at = new Date().toISOString();

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      record[field.id] = getRadioValue(field.id);
    });
  });
  return record;
}

function validateRecord(record, { forExport = false } = {}) {
  const requiredMessages = [];

  if (!record.coder_name) requiredMessages.push("Select a coder name.");
  if (!record.source_organization) requiredMessages.push("Enter or select a source organization.");
  if (!record.source_figure_id) requiredMessages.push("Enter a source figure ID.");
  if (!record.media_outlet) requiredMessages.push("Select a media image row so the media outlet is filled.");
  if (!record.media_article_title) requiredMessages.push("The selected media row must include a media article title.");
  if (!record.media_article_url) requiredMessages.push("The selected media row must include a media article URL.");
  if (!record.media_publication_date) requiredMessages.push("The selected media row must include a publication date.");
  if (!record.source_image_filename) requiredMessages.push("Upload the original scientific image.");
  if (!record.media_image_filename) requiredMessages.push("Select or upload the media adaptation image.");
  if (!record.overall_adaptation_intensity) requiredMessages.push("Select overall adaptation intensity.");
  if (!record.coding_confidence) requiredMessages.push("Select coding confidence.");

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!record[field.id]) {
        requiredMessages.push(`Code "${field.label}".`);
      }
    });
  });

  if (requiredMessages.length && !forExport) {
    alert(requiredMessages.join("\n"));
  }
  return requiredMessages;
}

async function saveCurrentRecord({ moveNextAfterSave = false } = {}) {
  updateRecordId();
  const record = await collectRecord();
  const validationErrors = validateRecord(record);
  if (validationErrors.length) {
    return;
  }

  const existingIndex = savedRecords.findIndex((item) => item.record_id === record.record_id);
  if (existingIndex >= 0) {
    savedRecords[existingIndex] = record;
  } else {
    savedRecords.push(record);
  }

  persistRecords();
  persistCoder();
  markCurrentRowCompleted(record);
  activeLoadedRecord = { ...record };
  renderSavedRecords();
  if (moveNextAfterSave && importedRows.length) {
    moveToNextAfterSave();
    return;
  }
  alert("Coded pair saved.");
}

function moveToNextAfterSave() {
  const rows = getNavigableRows();
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const canAdvance = currentIndex >= 0 && currentIndex < rows.length - 1;
  const preservedSourceOrganization = getFormValue("source_organization");
  const preservedCoder = getFormValue("coder_name");
  currentFiles.media_image = null;
  currentFileData.media_image = null;
  elements.mediaImageInput.value = "";
  if (canAdvance) {
    elements.mediaCsvSelect.value = rows[currentIndex + 1].__rowIndex;
    handleMediaRowSelection();
  }
  document.getElementById("source_figure_id").value = "";
  document.getElementById("overall_adaptation_intensity").value = "";
  document.getElementById("coding_confidence").value = "";
  elements.coderNotesInput.value = "";
  autoResizeTextarea(elements.coderNotesInput);
  currentFiles.source_image = null;
  currentFileData.source_image = null;
  elements.sourceImageInput.value = "";
  renderPreview(elements.sourcePreview, null);
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      const unsetRadio = document.getElementById(`${field.id}__unset`);
      if (unsetRadio) unsetRadio.checked = true;
    });
  });
  document.getElementById("source_organization").value = preservedSourceOrganization;
  document.getElementById("coder_name").value = preservedCoder;
  updateRecordId();
  alert(canAdvance ? "Coded pair saved. Moved to next media image." : "Coded pair saved. You are already on the last media image.");
}

function renderSavedRecords() {
  elements.recordCount.textContent = String(savedRecords.length);
  elements.recordsTableBody.innerHTML = "";
  if (!savedRecords.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">No saved records yet.</td>`;
    elements.recordsTableBody.appendChild(row);
    return;
  }
  savedRecords.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.record_id)}</td>
      <td>${escapeHtml(record.source_organization)}</td>
      <td>${escapeHtml(record.media_outlet)}</td>
      <td>${escapeHtml(record.source_figure_id)}</td>
      <td>${escapeHtml(record.media_image_filename || "")}</td>
      <td>
        <button class="table-action table-load-action" data-record-id="${record.record_id}" data-action="load">Load / Edit</button>
        <button class="table-action" data-record-id="${record.record_id}" data-action="delete">Delete</button>
      </td>
    `;
    elements.recordsTableBody.appendChild(row);
  });
  elements.recordsTableBody.querySelectorAll(".table-action").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "load") {
        loadRecordIntoForm(button.dataset.recordId);
        return;
      }
      deleteRecord(button.dataset.recordId);
    });
  });
}

function deleteRecord(recordId) {
  savedRecords = savedRecords.filter((record) => record.record_id !== recordId);
  persistRecords();
  renderSavedRecords();
}

function resetForm(initialLoad = false) {
  activeLoadedRecord = null;
  document.getElementById("source_organization").value = "";
  document.getElementById("source_figure_id").value = "";
  document.getElementById("media_outlet").value = "";
  readonlyMetadataFields.forEach((field) => {
    document.getElementById(field).value = "";
  });
  document.getElementById("overall_adaptation_intensity").value = "";
  document.getElementById("coding_confidence").value = "";
  elements.coderNotesInput.value = "";
  autoResizeTextarea(elements.coderNotesInput);

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      const unsetRadio = document.getElementById(`${field.id}__unset`);
      if (unsetRadio) unsetRadio.checked = true;
    });
  });

  currentMediaRow = null;
  elements.mediaCsvSelect.value = "";
  elements.mediaCsvSummary.textContent = importedRows.length
    ? "No media image row selected."
    : "No media image row selected.";

  elements.mediaImageInput.value = "";
  elements.sourceImageInput.value = "";
  currentFiles.media_image = null;
  currentFiles.source_image = null;
  currentFileData.media_image = null;
  currentFileData.source_image = null;
  renderPreview(elements.mediaPreview, null);
  renderPreview(elements.sourcePreview, null);
  syncMediaArticleLink("");

  if (!initialLoad) {
    restoreLastCoder();
  }
  updateRecordId();
  updateNavigationButtons();
}

function clearRecords() {
  if (!savedRecords.length) return;
  if (!confirm("Delete all saved records from this browser?")) return;
  savedRecords = [];
  clearCompletedRowStates();
  persistRecords();
  renderSavedRecords();
}

function loadRecordIntoForm(recordId) {
  const record = savedRecords.find((item) => item.record_id === recordId);
  if (!record) return;

  activeLoadedRecord = { ...record };
  document.getElementById("record_id").value = record.record_id || "";
  document.getElementById("coder_name").value = record.coder_name || "";
  document.getElementById("source_organization").value = record.source_organization || "";
  document.getElementById("source_figure_id").value = record.source_figure_id || "";
  document.getElementById("media_outlet").value = record.media_outlet || "";
  document.getElementById("media_article_title").value = record.media_article_title || "";
  document.getElementById("media_article_url").value = record.media_article_url || "";
  document.getElementById("media_publication_date").value = record.media_publication_date || "";
  document.getElementById("overall_adaptation_intensity").value = record.overall_adaptation_intensity || "";
  document.getElementById("coding_confidence").value = record.coding_confidence || "";
  elements.coderNotesInput.value = record.coder_notes || "";
  autoResizeTextarea(elements.coderNotesInput);
  syncMediaArticleLink(record.media_article_url || "");

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      const optionValue = record[field.id] || "";
      const targetId = `${field.id}__${optionValue || "unset"}`;
      const radio = document.getElementById(targetId) || document.getElementById(`${field.id}__unset`);
      if (radio) radio.checked = true;
    });
  });

  currentFiles.media_image = null;
  currentFiles.source_image = null;
  currentFileData.media_image = null;
  currentFileData.source_image = null;
  elements.mediaImageInput.value = "";
  elements.sourceImageInput.value = "";

  const matchedRow = importedRows.find((row) => {
    return (
      (record.media_csv_article_id && row.article_id === record.media_csv_article_id) ||
      (record.media_csv_local_path && row.local_image_path === record.media_csv_local_path) ||
      (record.media_csv_image_url && row.image_url === record.media_csv_image_url)
    );
  });

  if (matchedRow && getNavigableRows().some((row) => row.__rowIndex === matchedRow.__rowIndex)) {
    elements.mediaCsvSelect.value = matchedRow.__rowIndex;
    currentMediaRow = matchedRow;
    applyMediaRow(matchedRow);
  } else {
    currentMediaRow = null;
    elements.mediaCsvSelect.value = "";
    elements.mediaCsvSummary.innerHTML = `
      <strong>Loaded saved record:</strong> ${escapeHtml(record.record_id)}<br>
      <strong>Title:</strong> ${escapeHtml(record.media_article_title || "")}<br>
      <strong>Saved media image:</strong> ${escapeHtml(record.media_image_filename || "")}
    `;
    if (record.media_csv_local_path) {
      renderPreviewFromPath(elements.mediaPreview, record.media_csv_local_path, "No media image selected");
    } else if (record.media_uploaded_data_url) {
      renderPreviewFromDataUrl(
        elements.mediaPreview,
        record.media_uploaded_data_url,
        record.media_image_filename || "Saved media image",
        "No media image selected"
      );
    } else if (record.media_image_filename) {
      renderSavedPreviewNote(elements.mediaPreview, `Saved media image: ${record.media_image_filename}`);
    } else {
      renderPreview(elements.mediaPreview, null);
    }
  }

  if (record.source_image_data_url) {
    renderPreviewFromDataUrl(
      elements.sourcePreview,
      record.source_image_data_url,
      record.source_image_filename || "Saved original scientific image",
      "No original scientific image selected"
    );
  } else if (record.source_image_filename) {
    renderSavedPreviewNote(
      elements.sourcePreview,
      `Saved original scientific image: ${record.source_image_filename}. Re-upload only if you want to replace it.`
    );
  } else {
    renderPreview(elements.sourcePreview, null);
  }

  updateRecordId();
  updateNavigationButtons();
}

function persistRecords() {
  localStorage.setItem(recordsStorageKey, JSON.stringify(savedRecords));
}

function loadRecords() {
  try {
    const currentRecords = localStorage.getItem(recordsStorageKey);
    if (currentRecords) {
      return JSON.parse(currentRecords);
    }
    return JSON.parse(localStorage.getItem(priorRecordsStorageKey) || "[]");
  } catch {
    return [];
  }
}

function exportCsv() {
  if (!savedRecords.length) {
    alert("There are no saved records to export.");
    return;
  }
  const invalidRecord = savedRecords.find((record) => validateRecord(record, { forExport: true }).length > 0);
  if (invalidRecord) {
    alert(`Cannot export because record "${invalidRecord.record_id}" still has empty required fields.`);
    return;
  }
  const headers = [
    ...metadataFields,
    "source_image_filename",
    "media_image_filename",
    "media_csv_local_path",
    "media_csv_article_id",
    "media_csv_image_url",
    ...codebookSections.flatMap((section) => section.fields.map((field) => field.id)),
    "coded_at",
  ];
  downloadBlob(recordsToCsv(savedRecords, headers), "climate_visualization_coding.csv", "text/csv;charset=utf-8;");
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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
  const alreadyGrouped = rowStatusGroups.some((group) => rawState[group] && typeof rawState[group] === "object");
  if (alreadyGrouped) {
    rowStatusGroups.forEach((group) => {
      grouped[group] = { ...(rawState[group] || {}) };
    });
    return grouped;
  }
  grouped.other = { ...rawState };
  return grouped;
}

function loadCustomFieldConfig() {
  try {
    return JSON.parse(localStorage.getItem(customFieldsStorageKey) || "{}");
  } catch {
    return {};
  }
}

function persistCustomFields() {
  const payload = {};
  codebookSections.forEach((section) => {
    payload[section.key] = section.fields
      .filter((field) => field.custom)
      .map((field) => ({
        id: field.id,
        label: field.label,
        help: field.help,
        options: field.options,
        custom: true,
      }));
  });
  localStorage.setItem(customFieldsStorageKey, JSON.stringify(payload));
}

function hydrateCustomFields() {
  const config = loadCustomFieldConfig();
  codebookSections.forEach((section) => {
    const customFields = config[section.key] || [];
    customFields.forEach((field) => {
      if (!section.fields.some((existingField) => existingField.id === field.id)) {
        section.fields.push(field);
      }
    });
  });
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
  const nextRow = rows.find((row) => row.__rowIndex !== currentMediaRow.__rowIndex) || rows[0];
  elements.mediaCsvSelect.value = nextRow.__rowIndex;
  handleMediaRowSelection();
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

function addCustomField(sectionKey, builder) {
  const preservedSelections = captureCodebookSelections();
  const labelInput = builder.querySelector(".custom-field-label");
  const helpInput = builder.querySelector(".custom-field-help");
  const optionsInput = builder.querySelector(".custom-field-options");
  const label = (labelInput.value || "").trim();
  const help = (helpInput.value || "").trim();
  const options = (optionsInput.value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase().replace(/\s+/g, "_"));

  if (!label || !help || options.length < 2) {
    alert("Add a custom item with a name, a short explanation, and at least two comma-separated categories.");
    return;
  }

  const section = codebookSections.find((entry) => entry.key === sectionKey);
  if (!section) return;

  section.fields.push({
    id: `custom_${sectionKey}_${slugify(label)}_${Date.now()}`,
    label,
    help,
    options,
    custom: true,
  });
  persistCustomFields();
  renderCodebook(preservedSelections);
}

function resetCustomFieldBuilder(builder) {
  const labelInput = builder.querySelector(".custom-field-label");
  const helpInput = builder.querySelector(".custom-field-help");
  const optionsInput = builder.querySelector(".custom-field-options");
  const editor = builder.querySelector(".custom-field-editor");
  const toggleBtn = builder.querySelector(".custom-field-toggle-btn");
  if (labelInput) labelInput.value = "";
  if (helpInput) helpInput.value = "";
  if (optionsInput) optionsInput.value = "";
  if (editor) editor.classList.add("hidden");
  if (toggleBtn) toggleBtn.classList.remove("hidden");
}

function deleteCustomField(sectionKey, fieldId) {
  const preservedSelections = captureCodebookSelections();
  const section = codebookSections.find((entry) => entry.key === sectionKey);
  if (!section) return;
  section.fields = section.fields.filter((field) => field.id !== fieldId);
  persistCustomFields();
  renderCodebook(preservedSelections);
}

function syncMediaArticleLink(url) {
  const normalizedUrl = (url || "").trim();
  elements.mediaArticleUrlLink.href = normalizedUrl || "#";
  elements.mediaArticleUrlLink.textContent = normalizedUrl ? "Open article" : "No link";
  elements.mediaArticleUrlLink.classList.toggle("disabled", !normalizedUrl);
}

function exportRowStatusCsv() {
  const headers = ["row_key", "disposition", "source_unclear", "completed_by", "completed_at", "record_id", "updated_by", "updated_at"];
  downloadBlob(buildRowStatusWorkbookXml(headers), "row_status.xls", "application/vnd.ms-excel");
}

function handleRowStatusImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const filename = (file.name || "").toLowerCase();
    const importedState = filename.endsWith(".csv")
      ? parseLegacyRowStatusCsv(reader.result)
      : parseRowStatusWorkbook(reader.result);
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

function parseLegacyRowStatusCsv(csvText) {
  const grouped = emptyGroupedRowState();
  parseCsv(csvText).forEach((row) => {
    const rowKey = (row.row_key || "").trim();
    if (!rowKey) return;
    const requestedGroup = (row.group || "").trim().toLowerCase();
    const group = rowStatusGroups.includes(requestedGroup) ? requestedGroup : currentImportedSourceGroup;
      grouped[group][rowKey] = {
        disposition: (row.disposition || "").trim() || "active",
        source_unclear: ["true", "1", "yes"].includes((row.source_unclear || "").trim().toLowerCase()),
        completed_by: (row.completed_by || "").trim(),
        completed_at: (row.completed_at || "").trim(),
        record_id: (row.record_id || "").trim(),
      updated_by: (row.updated_by || "").trim(),
      updated_at: (row.updated_at || "").trim(),
    };
  });
  return grouped;
}

function parseRowStatusWorkbook(xmlText) {
  const grouped = emptyGroupedRowState();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const worksheets = Array.from(xml.getElementsByTagNameNS("*", "Worksheet"));
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

function handlePreviewClick(event) {
  const trigger = event.target.closest(".preview-trigger");
  if (!trigger) return;
  openLightbox(trigger.dataset.previewSrc || "", trigger.dataset.previewCaption || "");
}

function openLightbox(src, caption) {
  if (!src) return;
  elements.lightboxImage.src = src;
  elements.lightboxImage.alt = caption || "Expanded image preview";
  elements.lightboxCaption.textContent = caption || "";
  elements.lightbox.classList.remove("hidden");
  elements.lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  elements.lightbox.classList.add("hidden");
  elements.lightbox.setAttribute("aria-hidden", "true");
  elements.lightboxImage.src = "";
  elements.lightboxImage.alt = "";
  elements.lightboxCaption.textContent = "";
}

function handleLightboxBackdropClick(event) {
  if (event.target === elements.lightbox) {
    closeLightbox();
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && !elements.lightbox.classList.contains("hidden")) {
    closeLightbox();
  }
}

function extractFilename(filePath) {
  if (!filePath) return "";
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || "";
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
