const recordsStorageKey = "source-image-codebook-records-v3"; // legacy localStorage key, auto-migrated to IndexedDB
const coderStorageKey = "source-image-codebook-last-coder";
const rowStateStorageKey = "source-image-codebook-row-state-v1";
const rowStatusGroups = ["bbc", "guardian", "nytimes", "other"];

const chartTypeOptions = [
  "line", "multi_line", "bar", "stacked_bar", "area", "stacked_area", "scatter",
  "map", "heatmap", "pictogram", "table", "diagram", "timeline", "combination", "other",
];

const titleFunctionOptionHelp = {
  descriptive: "States what is shown (\"Global temperature, 1850\u20132023\").",
  explanation: "Explains how or why (\"How CO2 traps heat\").",
  interpretation: "Draws meaning (\"Warming is accelerating\").",
  takeaway: "States the conclusion (\"Hottest year on record\").",
  opinion: "Evaluative stance (\"We are failing on climate\").",
  alarming: "Threat or urgency language.",
  solution_oriented: "Emphasizes actions or pathways.",
};

const subtitleFunctionOptionHelp = {
  ...titleFunctionOptionHelp,
  source_method: "Names the data source or method.",
};

const codebookSections = [
  {
    key: "information_selection",
    title: "Information selection",
    description: "Which information keeps in adaptation?",
    fields: [
      {
        id: "data_variables_scope",
        label: "Data variables",
        help: "Compare which data series appear in both versions.",
        options: ["same", "reduced", "expanded", "reconfigured"],
        optionHelp: {
          reconfigured: "Added and removed, or recombined.",
        },
        extraInputs: [
          { id: "variables_data_added_count", label: "Data variables added", type: "number", placeholder: "0", showWhen: ["expanded", "reconfigured"] },
          { id: "variables_data_removed_count", label: "Data variables removed", type: "number", placeholder: "0", showWhen: ["reduced", "reconfigured"] },
        ],
      },
      {
        id: "spatial_scope",
        label: "Spatial scope",
        help: "Geographic coverage and resolution (region, extent, detail).",
        options: ["same", "reduced", "expanded", "reconfigured", "not_applicable"],
        optionHelp: {
          reconfigured: "Region changed or re-projected.",
        },
        extraInputs: [
          { id: "spatial_scope_details", label: "Spatial scope details", type: "textarea", placeholder: "e.g. global coverage reduced to Europe", showWhen: ["reduced", "expanded", "reconfigured"] },
        ],
      },
      {
        id: "temporal_scope",
        label: "Temporal scope",
        help: "Time range and resolution (period covered, time steps).",
        options: ["same", "reduced", "expanded", "reconfigured", "not_applicable"],
        optionHelp: {
          reconfigured: "Period shifted or restructured.",
        },
        extraInputs: [
          { id: "temporal_scope_details", label: "Temporal scope details", type: "textarea", placeholder: "e.g. 1850-2100 reduced to 2000-2050, or monthly data averaged by year", showWhen: ["reduced", "expanded", "reconfigured"] },
        ],
      },
      {
        id: "data_aggregation_transformation",
        label: "Data transformation",
        help: "How the adaptation recalculates source values.",
        multiSelect: true,
        options: ["averaged", "aggregated", "smoothed", "normalized", "indexed", "other", "not_applicable"],
        optionHelp: {
          averaged: "Averaged (monthly → annual).",
          aggregated: "Grouped (countries → regions).",
          smoothed: "Rolling mean or fitted trend.",
          normalized: "Relative to a base (per capita, %).",
          indexed: "Re-based (baseline = 100).",
          not_applicable: "No recalculation, or not discernible.",
        },
        extraInputs: [
          { id: "data_aggregation_description", label: "Describe data transformation", type: "textarea", placeholder: "e.g. monthly values averaged into annual values", showWhen: ["averaged", "aggregated", "smoothed", "normalized", "indexed", "other"], requiredWhen: ["averaged", "aggregated", "smoothed", "normalized", "indexed", "other"] },
        ],
      },
      {
        id: "uncertainty_visibility",
        label: "Uncertainty visibility",
        help: "How visible uncertainty (ranges / scenarios / caveats) remains.",
        options: ["same", "simplified", "removed", "added", "not_applicable"],
        optionHelp: {
          simplified: "Shown but coarser (3 ranges → 1 band).",
        },
      },
      {
        id: "uncertainty_elements",
        label: "Uncertainty elements affected",
        multiSelect: true,
        showWhenField: { fieldId: "uncertainty_visibility", values: ["simplified", "removed", "added"] },
        options: ["confidence_interval", "scenario_range", "model_spread", "error_bars", "caveat_text", "likelihood_language", "other", "not_applicable"],
        optionHelp: {
          confidence_interval: "Shaded bands or numeric intervals.",
          scenario_range: "SSP / RCP scenario spreads.",
          model_spread: "Across models or ensemble members.",
          error_bars: "Error bars or whiskers.",
          caveat_text: "Written caveats or footnotes.",
          likelihood_language: "IPCC terms (\"likely\", \"virtually certain\").",
        },
        extraInputs: [
          { id: "uncertainty_elements_other", label: "Describe other uncertainty element", type: "textarea", placeholder: "Describe the uncertainty element.", showWhen: ["other"], requiredWhen: ["other"] },
        ],
      },
      {
        id: "source_attribution_visibility",
        label: "Source attribution visibility",
        options: ["not_visible", "visible"],
        optionHelp: {
          not_visible: "No source named in the image or context.",
        },
        extraInputs: [
          { id: "source_attribution_type", label: "Visible source attribution type", type: "choice", options: ["source_name_only", "full_source_link", "article_text_link"], showWhen: ["visible"], requiredWhen: ["visible"] },
        ],
      },
    ],
  },
  {
    key: "visual_form",
    title: "Visual form",
    description: "How the data is visually re-presented?",
    fields: [
      {
        id: "chart_type_relation",
        label: "Chart type relation",
        options: ["same", "modified"],
        extraInputs: [
          { id: "chart_type_from", label: "From chart type", type: "chartType", options: chartTypeOptions, showWhen: ["modified"], requiredWhen: ["modified"] },
          { id: "chart_type_to", label: "To chart type", type: "chartType", options: chartTypeOptions, showWhen: ["modified"], requiredWhen: ["modified"] },
          { id: "chart_type_change_notes", label: "Chart type change notes", type: "textarea", placeholder: "Optional details, e.g. exact source and adapted chart types.", showWhen: ["modified"] },
        ],
      },
      {
        id: "panel_count",
        label: "Panel count",
        help: "Panels are separate sub-plots (facets) within one figure.",
        options: ["same", "reduced", "increased"],
        extraInputs: [
          { id: "panel_count_source", label: "Panels in source", type: "number", placeholder: "0", showWhen: ["reduced", "increased"] },
          { id: "panel_count_media", label: "Panels in adaptation", type: "number", placeholder: "0", showWhen: ["reduced", "increased"] },
        ],
      },
      {
        id: "visual_density_change",
        label: "Visual density",
        options: ["denser", "similar", "simpler"],
        optionHelp: {
          denser: "More marks / labels / annotation.",
          simpler: "Visibly decluttered.",
        },
      },
      {
        id: "layout_reordering",
        label: "Layout reordering",
        help: "Whether panels / legends / labels / annotations are re-arranged relative to the source.",
        options: ["yes", "no"],
      },
      {
        id: "axes_scales",
        label: "Axes & scales",
        help: "Axis ranges, reference baselines, scale types (linear / log), units.",
        options: ["same", "changed", "not_applicable"],
        optionHelp: {
          changed: "Range / baseline / scale type / units differ (incl. truncation).",
        },
        extraInputs: [
          { id: "axes_scales_description", label: "Describe axes / scale change", type: "textarea", placeholder: "e.g. y-axis truncated; anomaly baseline changed from 1850-1900 to 1961-1990; log scale replaced with linear", showWhen: ["changed"], requiredWhen: ["changed"] },
        ],
      },
      {
        id: "legend",
        label: "Legend",
        help: "The key mapping colors / symbols to data series.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "legend_description", label: "Describe legend change", type: "textarea", placeholder: "Briefly describe the legend change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "visual_emphasis",
        label: "Visual emphasis",
        help: "Highlighting / arrows / spotlights / contrast cues.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "visual_emphasis_description", label: "Describe emphasis change", type: "textarea", placeholder: "Briefly describe the emphasis change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "color_function",
        label: "Color function",
        help: "Color's communicative role.",
        multiSelect: true,
        exclusiveOptions: ["same"],
        options: ["same", "more_categorical", "more_sequential", "more_affective_warning", "more_muted", "not_applicable"],
        optionHelp: {
          more_categorical: "More discrete-category coding.",
          more_sequential: "More ordered-magnitude coding.",
          more_affective_warning: "More emotional signaling (alarm reds).",
          more_muted: "Desaturated, softened.",
        },
      },
      {
        id: "color_palette",
        label: "Color palette",
        options: ["same", "changed", "not_applicable"],
        extraInputs: [
          { id: "color_palette_description", label: "How palette changed", type: "textarea", placeholder: "e.g. neutral blue palette changed to red warning palette", showWhen: ["changed"], requiredWhen: ["changed"] },
        ],
      },
      {
        id: "visual_mapping",
        label: "Visual mapping",
        help: "How variables map to channels (position / length / color / size).",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          changed: "Different channel (color scale → bar length).",
        },
        extraInputs: [
          { id: "visual_mapping_description", label: "Describe mapping change", type: "textarea", placeholder: "Briefly describe the mapping change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "annotations",
        label: "Annotations",
        help: "In-chart text / markers / reference lines.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "annotations_description", label: "Describe annotation change", type: "textarea", placeholder: "Briefly describe the annotation change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "external_notes_explanations",
        label: "Notes outside the dataviz",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "external_notes_explanations_description", label: "Describe notes change", type: "textarea", placeholder: "Briefly describe the note change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "decorations",
        label: "Decorations",
        help: "Illustrative, non-data elements.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "decorations_description", label: "Describe decoration change", type: "textarea", placeholder: "Briefly describe the decoration change.", showWhen: ["added", "removed", "changed"] },
        ],
      },
    ],
  },
  {
    key: "narrative_guidance",
    title: "Narrative guidance",
    description: "How much verbal framing is added?",
    fields: [
      {
        id: "title_word_count_change",
        label: "Title word count",
        options: ["fewer", "same", "more", "not_applicable"],
      },
      {
        id: "subtitle_word_count_change",
        label: "Subtitle word count",
        options: ["fewer", "same", "more", "not_applicable"],
      },
      {
        id: "media_title_function",
        label: "Media title function",
        help: "How the adaptation's title frames the takeaway.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
        optionHelp: titleFunctionOptionHelp,
      },
      {
        id: "scientific_title_function",
        label: "Scientific title function",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
        optionHelp: titleFunctionOptionHelp,
      },
      {
        id: "media_subtitle_function",
        label: "Media subtitle function",
        help: "Subtitle / deck / text attached to the visual.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
        optionHelp: subtitleFunctionOptionHelp,
      },
      {
        id: "scientific_subtitle_function",
        label: "Scientific subtitle function",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
        optionHelp: subtitleFunctionOptionHelp,
      },
      {
        id: "message_fidelity",
        label: "Main message fidelity",
        help: "The dominant relation to the source figure's takeaway.",
        options: ["consistent", "narrowed", "amplified", "reframed"],
        optionHelp: {
          narrowed: "Only a subset survives.",
          amplified: "Stronger, more dramatic claim.",
          reframed: "Different emphasis or conclusion.",
        },
        extraInputs: [
          { id: "message_fidelity_description", label: "Describe message shift", type: "textarea", placeholder: "e.g. source shows scenario ranges; adaptation claims a single worst-case outcome", showWhen: ["narrowed", "amplified", "reframed"], requiredWhen: ["narrowed", "amplified", "reframed"] },
        ],
      },
      {
        id: "narrative_frame",
        label: "Narrative frame",
        help: "Pick the single dominant frame; on a tie, follow the title and note it.",
        options: ["neutral", "risk_focused", "responsibility_focused", "solution_focused", "conflict_focused", "other"],
        optionHelp: {
          neutral: "No evaluative framing.",
          risk_focused: "Threats, damages, danger.",
          responsibility_focused: "Causes, blame, duty.",
          solution_focused: "Solutions, progress, pathways.",
          conflict_focused: "Disagreement, political conflict.",
        },
        extraInputs: [
          { id: "narrative_frame_other", label: "Describe other frame", type: "textarea", placeholder: "Describe the dominant frame.", showWhen: ["other"], requiredWhen: ["other"] },
        ],
      },
    ],
  },
];

const mediaMetadataFields = [
  "media_article_title",
  "media_article_url",
  "media_publication_date",
  "media_updated_date",
];

const metadataFields = [
  "record_id",
  "coder_name",
  "source_organization",
  "source_report_cycle",
  "source_working_group",
  "source_figure_id",
  "source_figure_url",
  "additional_sources",
  "media_outlet",
  ...mediaMetadataFields,
  "coding_confidence",
  "coder_notes",
];

const elements = {
  sectionRoot: document.getElementById("codebookSections"),
  coderSelect: document.getElementById("coder_name"),
  sourceOrganizationInput: document.getElementById("source_organization"),
  sourceFigureInput: document.getElementById("source_figure_id"),
  additionalSourcesInput: document.getElementById("additional_sources"),
  generateSourceFigureIdBtn: document.getElementById("generateSourceFigureIdBtn"),
  coderNotesInput: document.getElementById("coder_notes"),
  mediaOutletInput: document.getElementById("media_outlet"),
  recordIdInput: document.getElementById("record_id"),
  sourcePreview: document.getElementById("sourcePreview"),
  mediaPreview: document.getElementById("mediaPreview"),
  csvInput: document.getElementById("csvInput"),
  mediaImageFilesInput: document.getElementById("mediaImageFilesInput"),
  mediaImageFileSelect: document.getElementById("mediaImageFileSelect"),
  prevMediaFileBtn: document.getElementById("prevMediaFileBtn"),
  nextMediaFileBtn: document.getElementById("nextMediaFileBtn"),
  mediaFileProgress: document.getElementById("mediaFileProgress"),
  rowStatusCsvInput: document.getElementById("rowStatusCsvInput"),
  mediaCsvSelect: document.getElementById("mediaCsvSelect"),
  prevRowBtn: document.getElementById("prevRowBtn"),
  nextRowBtn: document.getElementById("nextRowBtn"),
  markNotImportantBtn: document.getElementById("markNotImportantBtn"),
  markSourceUnclearBtn: document.getElementById("markSourceUnclearBtn"),
  undoRowStatusBtn: document.getElementById("undoRowStatusBtn"),
  deleteRowBtn: document.getElementById("deleteRowBtn"),
  mediaRowProgress: document.getElementById("mediaRowProgress"),
  sourceImageInput: document.getElementById("source_image"),
  mediaArticleUrlInput: document.getElementById("media_article_url"),
  mediaArticleUrlLink: document.getElementById("mediaArticleUrlLink"),
  mediaPublicationDateInput: document.getElementById("media_publication_date"),
  mediaUpdatedDateInput: document.getElementById("media_updated_date"),
  saveNextBtn: document.getElementById("saveNextBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  clearFormBtn: document.getElementById("clearFormBtn"),
  clearRecordsBtn: document.getElementById("clearRecordsBtn"),
  compareBtn: document.getElementById("compareBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  ipccReportField: document.getElementById("ipccReportField"),
  ipccWorkingGroupField: document.getElementById("ipccWorkingGroupField"),
  importGroupToggle: document.getElementById("importGroupToggle"),
  importGroupBody: document.getElementById("importGroupBody"),
  manualMediaRow: document.getElementById("manualMediaRow"),
  lightbox: document.getElementById("imageLightbox"),
  lightboxImage: document.getElementById("lightboxImage"),
  lightboxCaption: document.getElementById("lightboxCaption"),
  lightboxFigureB: document.getElementById("lightboxFigureB"),
  lightboxImageB: document.getElementById("lightboxImageB"),
  lightboxCaptionB: document.getElementById("lightboxCaptionB"),
  lightboxCloseBtn: document.getElementById("lightboxCloseBtn"),
  toastRoot: document.getElementById("toastRoot"),
  recordCount: document.getElementById("recordCount"),
  recordsTableBody: document.getElementById("recordsTableBody"),
  optionGroupTemplate: document.getElementById("optionGroupTemplate"),
  fieldCardTemplate: document.getElementById("fieldCardTemplate"),
};

let savedRecords = [];
let rowState = {};
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
let importedMediaImageFiles = new Map();
let importedMediaImageDataUrls = new Map();
let importedMediaImageFileList = [];
let currentImportedSourceGroup = "other";
let lastRowDispositionChange = null;
let formCleanSnapshot = "";
let lastManualMediaIndex = "";

async function init() {
  rowState = normalizeRowState(loadRowState());
  renderCodebook();
  attachFilePreview(elements.sourceImageInput, elements.sourcePreview, "source_image");
  initFilePickerLabels();
  elements.coderNotesInput.addEventListener("input", () => autoResizeTextarea(elements.coderNotesInput));
  elements.additionalSourcesInput.addEventListener("input", () => autoResizeTextarea(elements.additionalSourcesInput));

  elements.csvInput.addEventListener("change", handleCsvImport);
  elements.mediaImageFilesInput.addEventListener("change", handleMediaImageFilesImport);
  elements.mediaImageFileSelect.addEventListener("change", () => handleImportedMediaImageSelection());
  elements.prevMediaFileBtn.addEventListener("click", () => moveImportedMediaFileSelection(-1));
  elements.nextMediaFileBtn.addEventListener("click", () => moveImportedMediaFileSelection(1));
  elements.rowStatusCsvInput.addEventListener("change", handleRowStatusImport);
  elements.mediaCsvSelect.addEventListener("change", () => handleMediaRowSelection({ resetCoding: true }));
  elements.prevRowBtn.addEventListener("click", () => moveMediaSelection(-1));
  elements.nextRowBtn.addEventListener("click", () => moveMediaSelection(1));
  elements.markNotImportantBtn.addEventListener("click", () => setCurrentRowDisposition("not_important"));
  elements.markSourceUnclearBtn.addEventListener("click", markCurrentRowSourceUnclear);
  elements.undoRowStatusBtn.addEventListener("click", undoLastRowDisposition);
  elements.deleteRowBtn.addEventListener("click", () => setCurrentRowDisposition("deleted"));
  elements.generateSourceFigureIdBtn.addEventListener("click", generateSourceFigureId);
  elements.sourceOrganizationInput.addEventListener("input", updateRecordId);
  elements.sourceFigureInput.addEventListener("input", updateRecordId);
  elements.mediaOutletInput.addEventListener("input", updateRecordId);
  elements.mediaPublicationDateInput.addEventListener("input", updateRecordId);
  elements.mediaPublicationDateInput.addEventListener("blur", () => {
    elements.mediaPublicationDateInput.value = formatDateForDisplay(elements.mediaPublicationDateInput.value);
    updateRecordId();
  });
  elements.mediaArticleUrlInput.addEventListener("input", () => syncMediaArticleLink(elements.mediaArticleUrlInput.value));
  elements.mediaUpdatedDateInput.addEventListener("input", syncMediaUpdatedDateState);
  elements.mediaUpdatedDateInput.addEventListener("blur", () => {
    elements.mediaUpdatedDateInput.value = formatDateForDisplay(elements.mediaUpdatedDateInput.value);
    syncMediaUpdatedDateState();
  });
  elements.coderSelect.addEventListener("change", persistCoder);
  elements.saveNextBtn.addEventListener("click", () => saveCurrentRecord({ moveNextAfterSave: true }));
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.clearFormBtn.addEventListener("click", () => resetForm());
  elements.clearRecordsBtn.addEventListener("click", clearRecords);
  elements.compareBtn.addEventListener("click", openCompareLightbox);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.importGroupToggle.addEventListener("click", toggleImportGroup);
  elements.mediaPreview.addEventListener("click", handlePreviewClick);
  elements.sourcePreview.addEventListener("click", handlePreviewClick);
  elements.lightbox.addEventListener("click", handleLightboxBackdropClick);
  elements.lightboxCloseBtn.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", handleGlobalKeydown);
  document.querySelector(".right-column")?.addEventListener("scroll", () => {
    requestAnimationFrame(updateActiveRailDot);
  }, { passive: true });
  document.addEventListener("input", clearValidationHighlight, true);
  document.addEventListener("change", clearValidationHighlight, true);
  document.addEventListener("input", updateSaveStatus, true);
  document.addEventListener("change", updateSaveStatus, true);
  window.addEventListener("beforeunload", (event) => {
    if (isFormDirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  initConfidenceChips();
  initComboboxes();
  restoreLastCoder();
  resetForm(true);
  updateNavigationButtons();
  updateImportedMediaFileNavigation();
  updateImportControls();

  savedRecords = await loadRecords();
  renderSavedRecords();
  markFormClean();
}

function setImportGroupCollapsed(collapsed) {
  elements.importGroupBody.classList.toggle("collapsed", collapsed);
  elements.importGroupToggle.classList.toggle("collapsed", collapsed);
  elements.importGroupToggle.setAttribute("aria-expanded", String(!collapsed));
}

function toggleImportGroup() {
  setImportGroupCollapsed(!elements.importGroupBody.classList.contains("collapsed"));
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("codebook-theme", nextTheme);
}

function initFilePickerLabels() {
  [
    elements.sourceImageInput,
    elements.csvInput,
    elements.mediaImageFilesInput,
    elements.rowStatusCsvInput,
  ].forEach((input) => {
    input.addEventListener("change", () => syncFilePickerName(input));
    syncFilePickerName(input);
  });
}

function syncFilePickerName(input) {
  const label = input.closest(".file-picker").querySelector(".file-picker-name");
  const fileCount = input.files.length;
  if (!fileCount) {
    label.textContent = "No file selected";
  } else if (fileCount === 1) {
    label.textContent = input.files[0].name;
  } else {
    label.textContent = `${fileCount} files`;
  }
}
