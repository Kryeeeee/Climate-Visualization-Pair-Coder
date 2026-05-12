const recordsStorageKey = "source-image-codebook-records-v3";
const priorRecordsStorageKey = "ipcc-image-codebook-records-v2";
const coderStorageKey = "source-image-codebook-last-coder";
const priorCoderStorageKey = "ipcc-image-codebook-last-coder";

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
  "media_outlet",
  "media_article_title",
  "media_article_url",
  "media_publication_date",
];

const metadataFields = [
  "record_id",
  "coder_name",
  "source_organization",
  "source_figure_id",
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
  recordIdInput: document.getElementById("record_id"),
  sourcePreview: document.getElementById("sourcePreview"),
  mediaPreview: document.getElementById("mediaPreview"),
  csvInput: document.getElementById("csvInput"),
  mediaCsvSelect: document.getElementById("mediaCsvSelect"),
  mediaCsvSummary: document.getElementById("mediaCsvSummary"),
  prevRowBtn: document.getElementById("prevRowBtn"),
  nextRowBtn: document.getElementById("nextRowBtn"),
  mediaRowProgress: document.getElementById("mediaRowProgress"),
  mediaImageInput: document.getElementById("media_image"),
  sourceImageInput: document.getElementById("source_image"),
  saveRecordBtn: document.getElementById("saveRecordBtn"),
  saveNextBtn: document.getElementById("saveNextBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  clearRecordsBtn: document.getElementById("clearRecordsBtn"),
  recordCount: document.getElementById("recordCount"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  optionGroupTemplate: document.getElementById("optionGroupTemplate"),
  fieldCardTemplate: document.getElementById("fieldCardTemplate"),
};

let savedRecords = loadRecords();
let importedRows = [];
let currentMediaRow = null;
let currentFiles = {
  source_image: null,
  media_image: null,
};

init();

function init() {
  renderCodebook();
  attachFilePreview(elements.sourceImageInput, elements.sourcePreview, "source_image");
  attachFilePreview(elements.mediaImageInput, elements.mediaPreview, "media_image", true);

  elements.csvInput.addEventListener("change", handleCsvImport);
  elements.mediaCsvSelect.addEventListener("change", handleMediaRowSelection);
  elements.prevRowBtn.addEventListener("click", () => moveMediaSelection(-1));
  elements.nextRowBtn.addEventListener("click", () => moveMediaSelection(1));
  elements.sourceOrganizationInput.addEventListener("input", updateRecordId);
  elements.sourceFigureInput.addEventListener("input", updateRecordId);
  elements.coderSelect.addEventListener("change", persistCoder);
  elements.saveRecordBtn.addEventListener("click", saveCurrentRecord);
  elements.saveNextBtn.addEventListener("click", () => saveCurrentRecord({ moveNextAfterSave: true }));
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.clearFormBtn.addEventListener("click", resetForm);
  elements.clearRecordsBtn.addEventListener("click", clearRecords);

  restoreLastCoder();
  resetForm(true);
  renderSavedRecords();
  updateNavigationButtons();
}

function renderCodebook() {
  codebookSections.forEach((section) => {
    const fragment = elements.optionGroupTemplate.content.cloneNode(true);
    const sectionNode = fragment.querySelector(".code-section");
    sectionNode.dataset.section = section.key;
    fragment.querySelector(".section-title").textContent = section.title;
    fragment.querySelector(".section-copy").textContent = section.description;
    const fieldGroups = fragment.querySelector(".field-groups");

    section.fields.forEach((field) => {
      const fieldFragment = elements.fieldCardTemplate.content.cloneNode(true);
      fieldFragment.querySelector(".field-card-label").textContent = field.label;
      fieldFragment.querySelector(".field-card-help").textContent = field.help;
      const chipGroup = fieldFragment.querySelector(".chip-group");
      chipGroup.appendChild(makeChip(field.id, "", "Unset"));
      field.options.forEach((option) => chipGroup.appendChild(makeChip(field.id, option, prettifyOption(option))));
      fieldGroups.appendChild(fieldFragment);
    });

    elements.sectionRoot.appendChild(fragment);
  });
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
    renderPreview(previewElement, file);
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
    target.innerHTML = `<img src="${reader.result}" alt="${escapeHtml(file.name)}">`;
  };
  reader.readAsDataURL(file);
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
  target.classList.remove("muted");
  target.innerHTML = `<img src="${fileUrl}" alt="${escapeHtml(extractFilename(filePath))}">`;
}

function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importedRows = parseCsv(reader.result);
    populateMediaCsvSelect();
  };
  reader.readAsText(file);
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
      return record;
    });
}

function populateMediaCsvSelect() {
  const options = [`<option value="">Select a media image row</option>`];
  importedRows.forEach((row) => {
    const label = [
      row.newspaper || row.media_outlet || "Unknown outlet",
      row.article_title || row.article_id || "Untitled",
      row.image_index ? `img ${row.image_index}` : "",
    ].filter(Boolean).join(" | ");
    options.push(`<option value="${row.__rowIndex}">${escapeHtml(label)}</option>`);
  });
  elements.mediaCsvSelect.innerHTML = options.join("");
  elements.mediaCsvSummary.textContent = importedRows.length
    ? `${importedRows.length} rows imported. Select one to auto-fill metadata.`
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

  document.getElementById("media_outlet").value = row.newspaper || "";
  document.getElementById("media_article_title").value = row.article_title || "";
  document.getElementById("media_article_url").value = row.article_url || "";
  document.getElementById("media_publication_date").value = row.published_date || "";
  elements.mediaCsvSummary.innerHTML = `
    <strong>Selected row:</strong> ${escapeHtml(row.newspaper || "")}<br>
    <strong>Title:</strong> ${escapeHtml(row.article_title || "")}<br>
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
  if (!importedRows.length) return;
  const currentIndex = importedRows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : importedRows.length - 1)
    : Math.max(0, Math.min(importedRows.length - 1, currentIndex + direction));
  elements.mediaCsvSelect.value = importedRows[nextIndex].__rowIndex;
  handleMediaRowSelection();
}

function updateNavigationButtons() {
  const hasRows = importedRows.length > 0;
  const currentIndex = importedRows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  elements.prevRowBtn.disabled = !hasRows || currentIndex <= 0;
  elements.nextRowBtn.disabled = !hasRows || currentIndex === -1 || currentIndex >= importedRows.length - 1;
  elements.saveNextBtn.disabled = !hasRows;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  elements.mediaRowProgress.textContent = `${displayIndex} / ${importedRows.length}`;
}

function getFormValue(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
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

function collectRecord() {
  const record = {};
  metadataFields.forEach((field) => {
    record[field] = getFormValue(field);
  });
  record.source_image_filename = currentFiles.source_image ? currentFiles.source_image.name : "";
  record.media_image_filename = currentFiles.media_image
    ? currentFiles.media_image.name
    : extractFilename(currentMediaRow?.local_image_path || "");
  record.media_csv_local_path = currentMediaRow?.local_image_path || "";
  record.media_csv_article_id = currentMediaRow?.article_id || "";
  record.media_csv_image_url = currentMediaRow?.image_url || "";
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

function saveCurrentRecord({ moveNextAfterSave = false } = {}) {
  updateRecordId();
  const record = collectRecord();
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
  renderSavedRecords();
  if (moveNextAfterSave && importedRows.length) {
    moveToNextAfterSave();
    return;
  }
  alert("Coded pair saved.");
}

function moveToNextAfterSave() {
  const currentIndex = importedRows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const canAdvance = currentIndex >= 0 && currentIndex < importedRows.length - 1;
  const preservedSourceOrganization = getFormValue("source_organization");
  const preservedCoder = getFormValue("coder_name");
  if (canAdvance) {
    elements.mediaCsvSelect.value = importedRows[currentIndex + 1].__rowIndex;
    handleMediaRowSelection();
  }
  document.getElementById("source_figure_id").value = "";
  document.getElementById("overall_adaptation_intensity").value = "";
  document.getElementById("coding_confidence").value = "";
  document.getElementById("coder_notes").value = "";
  currentFiles.source_image = null;
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
      <td><button class="table-action" data-record-id="${record.record_id}">Delete</button></td>
    `;
    elements.recordsTableBody.appendChild(row);
  });
  elements.recordsTableBody.querySelectorAll(".table-action").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.recordId));
  });
}

function deleteRecord(recordId) {
  savedRecords = savedRecords.filter((record) => record.record_id !== recordId);
  persistRecords();
  renderSavedRecords();
}

function resetForm(initialLoad = false) {
  document.getElementById("source_organization").value = "";
  document.getElementById("source_figure_id").value = "";
  readonlyMetadataFields.forEach((field) => {
    document.getElementById(field).value = "";
  });
  document.getElementById("overall_adaptation_intensity").value = "";
  document.getElementById("coding_confidence").value = "";
  document.getElementById("coder_notes").value = "";

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
  renderPreview(elements.mediaPreview, null);
  renderPreview(elements.sourcePreview, null);

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
  persistRecords();
  renderSavedRecords();
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
  const rows = [headers.join(",")];
  savedRecords.forEach((record) => {
    rows.push(headers.map((header) => csvEscape(record[header] ?? "")).join(","));
  });
  downloadBlob(rows.join("\n"), "climate_visualization_coding.csv", "text/csv;charset=utf-8;");
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
