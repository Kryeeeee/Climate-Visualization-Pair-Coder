const recordsStorageKey = "source-image-codebook-records-v3";
const coderStorageKey = "source-image-codebook-last-coder";
const rowStateStorageKey = "source-image-codebook-row-state-v1";
const rowStatusGroups = ["bbc", "guardian", "nytimes", "other"];
const codebookSections = [
  {
    key: "information_selection",
    title: "Information selection",
    description:
      "What data, scope, uncertainty, and source information are preserved, reduced, or expanded in the media adaptation.",
    fields: [
      {
        id: "variables_scope",
        label: "Variables scope",
        help: "Whether data variables or measures are removed or added relative to the original, including thematic, spatial, or temporal variables.",
        options: ["same", "reduced", "expanded"],
        extraInputs: [
          { id: "variables_data_added_count", label: "Data variables added", type: "number", placeholder: "0" },
          { id: "variables_data_removed_count", label: "Data variables removed", type: "number", placeholder: "0" },
          { id: "variables_spatial_added_count", label: "Spatial variables added", type: "number", placeholder: "0" },
          { id: "variables_spatial_removed_count", label: "Spatial variables removed", type: "number", placeholder: "0" },
          { id: "variables_temporal_added_count", label: "Temporal variables added", type: "number", placeholder: "0" },
          { id: "variables_temporal_removed_count", label: "Temporal variables removed", type: "number", placeholder: "0" },
        ],
      },
      {
        id: "uncertainty_visibility",
        label: "Uncertainty visibility",
        help: "How visible uncertainty, confidence, ranges, scenarios, or caveats remain in the adapted version.",
        options: ["same", "simplified", "removed", "not_applicable"],
        extraInputs: [
          { id: "uncertainty_changed_type", label: "What uncertainty changed?", type: "textarea", placeholder: "e.g. confidence interval, scenario range, model spread, caveat text", showWhen: ["simplified", "removed"], requiredWhen: ["simplified", "removed"] },
        ],
      },
      {
        id: "source_attribution_visibility",
        label: "Source attribution visibility",
        help: "Whether the scientific source or data provider is visible in the adaptation.",
        options: ["not_visible", "visible"],
        extraInputs: [
          { id: "source_attribution_type", label: "Visible source attribution type", type: "choice", options: ["source_name_only", "full_source_link", "article_text_link"], showWhen: ["visible"], requiredWhen: ["visible"] },
        ],
      },
    ],
  },
  {
    key: "visual_form",
    title: "Visual form",
    description:
      "How the data is visually represented through chart form, layout, mapping, annotations, color, and decoration.",
    fields: [
      {
        id: "chart_type_relation",
        label: "Chart type relation",
        help: "Whether the adaptation keeps the same chart type or modifies it.",
        options: ["same", "modified"],
        extraInputs: [
          { id: "chart_type_from", label: "From chart type", type: "text", placeholder: "e.g. multi-panel line chart", showWhen: ["modified"], requiredWhen: ["modified"] },
          { id: "chart_type_to", label: "To chart type", type: "text", placeholder: "e.g. single line chart", showWhen: ["modified"], requiredWhen: ["modified"] },
        ],
      },
      {
        id: "visual_density_change",
        label: "Visual density",
        help: "Compare clutter, number of marks, and overall information packing.",
        options: ["denser", "similar", "simpler"],
      },
      {
        id: "layout_reordering",
        label: "Layout reordering",
        help: "Whether panels, legends, labels, annotations, or other visual components are rearranged relative to the source figure.",
        options: ["yes", "no"],
      },
      {
        id: "legend",
        label: "Legend",
        help: "Whether the legend is the same, added, removed, changed, or not relevant to this figure.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "legend_description", label: "Describe legend change", type: "textarea", placeholder: "Briefly describe the legend change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "visual_emphasis",
        label: "Visual emphasis",
        help: "Whether highlighting, spotlighting, arrows, contrast, or attention cues are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "visual_emphasis_description", label: "Describe emphasis change", type: "textarea", placeholder: "Briefly describe the emphasis change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "color_function",
        label: "Color function",
        help: "How color use changes in communicative function.",
        options: ["same", "more_categorical", "more_sequential", "more_affective_warning", "more_muted", "not_applicable"],
      },
      {
        id: "visual_mapping",
        label: "Visual mapping",
        help: "Whether mappings between data variables and visual channels are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "visual_mapping_description", label: "Describe mapping change", type: "textarea", placeholder: "Briefly describe the mapping change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "annotations",
        label: "Annotations",
        help: "Whether annotations inside the visualization are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "annotations_description", label: "Describe annotation change", type: "textarea", placeholder: "Briefly describe the annotation change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "external_notes_explanations",
        label: "Notes / explanations outside the visualization",
        help: "Whether explanatory notes outside the chart area are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        extraInputs: [
          { id: "external_notes_explanations_description", label: "Describe notes change", type: "textarea", placeholder: "Briefly describe the note change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "decorations",
        label: "Decorations",
        help: "Whether decorative or illustrative visual elements are the same, added, removed, or not applicable.",
        options: ["same", "added", "removed", "not_applicable"],
      },
      {
        id: "color_palette",
        label: "Color palette",
        help: "Whether the overall palette is the same or changed.",
        options: ["same", "changed", "not_applicable"],
        extraInputs: [
          { id: "color_palette_description", label: "How palette changed", type: "textarea", placeholder: "e.g. neutral blue palette changed to red warning palette", showWhen: ["changed"], requiredWhen: ["changed"] },
        ],
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
        help: "How the media adaptation title frames the intended takeaway.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
      },
      {
        id: "scientific_title_function",
        label: "Scientific title function",
        help: "How the original scientific figure title frames the content.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
      },
      {
        id: "media_subtitle_function",
        label: "Media subtitle function",
        help: "Role of media subtitle, deck, or explanatory text directly attached to the visual.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
      },
      {
        id: "scientific_subtitle_function",
        label: "Scientific subtitle function",
        help: "Role of subtitle, caption, or methodological text attached to the original scientific figure.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
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
  "source_figure_id",
  "source_figure_url",
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
  mediaCsvSummary: document.getElementById("mediaCsvSummary"),
  prevRowBtn: document.getElementById("prevRowBtn"),
  nextRowBtn: document.getElementById("nextRowBtn"),
  markNotImportantBtn: document.getElementById("markNotImportantBtn"),
  markSourceUnclearBtn: document.getElementById("markSourceUnclearBtn"),
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
  lightbox: document.getElementById("imageLightbox"),
  lightboxImage: document.getElementById("lightboxImage"),
  lightboxCaption: document.getElementById("lightboxCaption"),
  lightboxCloseBtn: document.getElementById("lightboxCloseBtn"),
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

function init() {
  savedRecords = loadRecords();
  rowState = normalizeRowState(loadRowState());
  renderCodebook();
  attachFilePreview(elements.sourceImageInput, elements.sourcePreview, "source_image");
  initFilePickerLabels();
  elements.coderNotesInput.addEventListener("input", () => autoResizeTextarea(elements.coderNotesInput));

  elements.csvInput.addEventListener("change", handleCsvImport);
  elements.mediaImageFilesInput.addEventListener("change", handleMediaImageFilesImport);
  elements.mediaImageFileSelect.addEventListener("change", handleImportedMediaImageSelection);
  elements.prevMediaFileBtn.addEventListener("click", () => moveImportedMediaFileSelection(-1));
  elements.nextMediaFileBtn.addEventListener("click", () => moveImportedMediaFileSelection(1));
  elements.rowStatusCsvInput.addEventListener("change", handleRowStatusImport);
  elements.mediaCsvSelect.addEventListener("change", () => handleMediaRowSelection({ resetCoding: true }));
  elements.prevRowBtn.addEventListener("click", () => moveMediaSelection(-1));
  elements.nextRowBtn.addEventListener("click", () => moveMediaSelection(1));
  elements.markNotImportantBtn.addEventListener("click", () => setCurrentRowDisposition("not_important"));
  elements.markSourceUnclearBtn.addEventListener("click", markCurrentRowSourceUnclear);
  elements.deleteRowBtn.addEventListener("click", () => setCurrentRowDisposition("deleted"));
  elements.sourceOrganizationInput.addEventListener("input", updateRecordId);
  elements.sourceFigureInput.addEventListener("input", updateRecordId);
  elements.mediaOutletInput.addEventListener("input", updateRecordId);
  elements.mediaPublicationDateInput.addEventListener("input", updateRecordId);
  elements.mediaPublicationDateInput.addEventListener("blur", () => normalizeDateInput(elements.mediaPublicationDateInput));
  elements.mediaArticleUrlInput.addEventListener("input", () => syncMediaArticleLink(elements.mediaArticleUrlInput.value));
  elements.mediaUpdatedDateInput.addEventListener("input", syncMediaUpdatedDateState);
  elements.mediaUpdatedDateInput.addEventListener("blur", () => normalizeDateInput(elements.mediaUpdatedDateInput));
  elements.coderSelect.addEventListener("change", persistCoder);
  elements.saveNextBtn.addEventListener("click", () => saveCurrentRecord({ moveNextAfterSave: true }));
  elements.exportCsvBtn.addEventListener("click", exportCsv);
  elements.clearFormBtn.addEventListener("click", resetForm);
  elements.clearRecordsBtn.addEventListener("click", clearRecords);
  elements.mediaPreview.addEventListener("click", handlePreviewClick);
  elements.sourcePreview.addEventListener("click", handlePreviewClick);
  elements.lightbox.addEventListener("click", handleLightboxBackdropClick);
  elements.lightboxCloseBtn.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", handleGlobalKeydown);

  initConfidenceChips();
  restoreLastCoder();
  resetForm(true);
  renderSavedRecords();
  updateNavigationButtons();
  updateImportedMediaFileNavigation();
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

