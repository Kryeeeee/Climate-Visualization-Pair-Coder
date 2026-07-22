const recordsStorageKey = "source-image-codebook-records-v3"; // legacy localStorage key, auto-migrated to IndexedDB
const coderStorageKey = "source-image-codebook-last-coder";
const rowStateStorageKey = "source-image-codebook-row-state-v1";
const rowStatusGroups = ["bbc", "guardian", "nytimes", "other"];

const chartTypeOptions = [
  "line", "multi_line", "bar", "stacked_bar", "area", "stacked_area", "scatter",
  "map", "heatmap", "pictogram", "table", "diagram", "timeline", "combination", "other",
];

const titleFunctionOptionHelp = {
  descriptive: "States what is shown, without a conclusion. e.g. \"Global temperature change, 1850–2023\".",
  explanation: "Explains how or why something happens. e.g. \"How CO2 traps heat\".",
  interpretation: "Draws meaning from the data. e.g. \"Warming is accelerating\".",
  takeaway: "States the single intended conclusion. e.g. \"Last year was the hottest on record\".",
  opinion: "Evaluative or normative stance. e.g. \"We are failing on climate\".",
  alarming: "Emotionally charged threat or urgency language.",
  solution_oriented: "Emphasizes actions, fixes, or pathways forward.",
  not_applicable: "No title / subtitle is present.",
};

const subtitleFunctionOptionHelp = {
  ...titleFunctionOptionHelp,
  source_method: "Describes the data source or method used.",
};

const codebookSections = [
  {
    key: "information_selection",
    title: "Information selection",
    description:
      "What data, scope, uncertainty, and source information are preserved, reduced, or expanded in the media adaptation.",
    fields: [
      {
        id: "data_variables_scope",
        label: "Data variables",
        help: "Compare which measured variables or data series appear in the adaptation versus the source figure.",
        options: ["same", "reduced", "expanded", "reconfigured"],
        optionHelp: {
          same: "The same set of variables / data series. e.g. both show global mean temperature only.",
          reduced: "Series or variables were dropped. e.g. four scenarios in the source, only one in the adaptation.",
          expanded: "Series or variables were added. e.g. observed temperatures overlaid on the projections.",
          reconfigured: "Variables were both added and removed, or recombined into new derived series.",
        },
        extraInputs: [
          { id: "variables_data_added_count", label: "Data variables added", type: "number", placeholder: "0", showWhen: ["expanded", "reconfigured"] },
          { id: "variables_data_removed_count", label: "Data variables removed", type: "number", placeholder: "0", showWhen: ["reduced", "reconfigured"] },
        ],
      },
      {
        id: "spatial_scope",
        label: "Spatial scope",
        help: "Compare the geographic coverage or spatial resolution shown.",
        options: ["same", "reduced", "expanded", "reconfigured", "not_applicable"],
        optionHelp: {
          same: "Identical geographic coverage and resolution.",
          reduced: "Coverage narrowed or resolution coarsened. e.g. a global map cropped to Europe.",
          expanded: "Coverage widened or finer spatial detail added. e.g. city-level detail added.",
          reconfigured: "Region changed or re-projected rather than simply narrowed or widened.",
          not_applicable: "No spatial dimension to compare (e.g. a global-mean time series in both versions).",
        },
        extraInputs: [
          { id: "spatial_scope_details", label: "Spatial scope details", type: "textarea", placeholder: "e.g. global coverage reduced to Europe", showWhen: ["reduced", "expanded", "reconfigured"] },
        ],
      },
      {
        id: "temporal_scope",
        label: "Temporal scope",
        help: "Compare the time range and time resolution shown.",
        options: ["same", "reduced", "expanded", "reconfigured", "not_applicable"],
        optionHelp: {
          same: "Identical time range and resolution.",
          reduced: "Time range shortened or resolution coarsened. e.g. 1850–2100 cut to 2000–2050.",
          expanded: "Time range extended or finer resolution shown. e.g. projections extended with historical data.",
          reconfigured: "Period shifted or restructured rather than simply shortened or extended.",
          not_applicable: "No time dimension in the figure (e.g. a single-date map).",
        },
        extraInputs: [
          { id: "temporal_scope_details", label: "Temporal scope details", type: "textarea", placeholder: "e.g. 1850-2100 reduced to 2000-2050, or monthly data averaged by year", showWhen: ["reduced", "expanded", "reconfigured"] },
        ],
      },
      {
        id: "data_aggregation_transformation",
        label: "Data transformation",
        help: "Whether the adaptation recalculates or re-expresses the source data. Select every transformation that applies; None and N/A exclude the others.",
        multiSelect: true,
        exclusiveOptions: ["none"],
        options: ["none", "averaged", "aggregated", "smoothed", "normalized", "indexed", "other", "not_applicable"],
        optionHelp: {
          none: "Values are re-plotted as-is, without recalculation.",
          averaged: "Values averaged over time or space. e.g. monthly values averaged into annual values.",
          aggregated: "Units combined into larger groups. e.g. countries summed into regions.",
          smoothed: "A rolling mean or fitted trend replaces or overlays raw values.",
          normalized: "Re-expressed relative to a base. e.g. per capita, percent of total.",
          indexed: "Re-based to an index or a different reference baseline. e.g. baseline = 100.",
          other: "Any other recalculation — describe it below.",
          not_applicable: "Cannot compare (e.g. the underlying data is not discernible).",
        },
        extraInputs: [
          { id: "data_aggregation_description", label: "Describe data transformation", type: "textarea", placeholder: "e.g. monthly values averaged into annual values", showWhen: ["averaged", "aggregated", "smoothed", "normalized", "indexed", "other"], requiredWhen: ["averaged", "aggregated", "smoothed", "normalized", "indexed", "other"] },
        ],
      },
      {
        id: "uncertainty_visibility",
        label: "Uncertainty visibility",
        help: "How visible uncertainty, confidence, ranges, scenarios, or caveats remain in the adapted version.",
        options: ["same", "simplified", "removed", "added", "not_applicable"],
        optionHelp: {
          same: "All uncertainty information from the source remains visible.",
          simplified: "Uncertainty still shown but reduced or coarser. e.g. three scenario ranges collapsed into one shaded band.",
          removed: "None of the source's uncertainty information remains.",
          added: "The adaptation adds uncertainty information the source figure did not show.",
          not_applicable: "The source figure contains no uncertainty information.",
        },
      },
      {
        id: "uncertainty_elements",
        label: "Uncertainty elements affected",
        help: "Which uncertainty elements were simplified, removed, or added. Select all that apply. Choose N/A when Uncertainty visibility is Same or N/A.",
        multiSelect: true,
        options: ["confidence_interval", "scenario_range", "model_spread", "error_bars", "caveat_text", "likelihood_language", "other", "not_applicable"],
        optionHelp: {
          confidence_interval: "Shaded bands or numeric confidence / credible intervals.",
          scenario_range: "Ranges across emission scenarios (e.g. SSP / RCP spreads).",
          model_spread: "Variation across models or ensemble members.",
          error_bars: "Discrete error bars or whiskers on points or bars.",
          caveat_text: "Written caveats, footnotes, or limitations.",
          likelihood_language: "IPCC calibrated terms such as \"likely\" or \"virtually certain\".",
          other: "Any other uncertainty element — describe it below.",
          not_applicable: "Uncertainty visibility is Same or Not applicable.",
        },
        extraInputs: [
          { id: "uncertainty_elements_other", label: "Describe other uncertainty element", type: "textarea", placeholder: "Describe the uncertainty element.", showWhen: ["other"], requiredWhen: ["other"] },
        ],
      },
      {
        id: "source_attribution_visibility",
        label: "Source attribution visibility",
        help: "Whether the scientific source or data provider is visible in the adaptation.",
        options: ["not_visible", "visible"],
        optionHelp: {
          not_visible: "No mention of the scientific source anywhere in or directly around the image.",
          visible: "The source or data provider is named in the image, caption, or credit line.",
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
    description:
      "How the data is visually represented through chart form, layout, axes, mapping, annotations, color, and decoration.",
    fields: [
      {
        id: "chart_type_relation",
        label: "Chart type relation",
        options: ["same", "modified"],
        optionHelp: {
          same: "Same basic chart type, even if restyled.",
          modified: "Chart type changed. e.g. multi-panel line chart to a single bar chart.",
        },
        extraInputs: [
          { id: "chart_type_from", label: "From chart type", type: "chartType", options: chartTypeOptions, showWhen: ["modified"], requiredWhen: ["modified"] },
          { id: "chart_type_to", label: "To chart type", type: "chartType", options: chartTypeOptions, showWhen: ["modified"], requiredWhen: ["modified"] },
          { id: "chart_type_change_notes", label: "Chart type change notes", type: "textarea", placeholder: "Optional details, e.g. exact source and adapted chart types.", showWhen: ["modified"] },
        ],
      },
      {
        id: "panel_count",
        label: "Panel count",
        options: ["same", "reduced", "increased"],
        optionHelp: {
          same: "Same number of panels / facets (including single panel in both).",
          reduced: "Panels merged or dropped. e.g. a 4-panel figure reduced to a single panel.",
          increased: "Panels added, or the figure split into a series.",
        },
        extraInputs: [
          { id: "panel_count_source", label: "Panels in source", type: "number", placeholder: "0", showWhen: ["reduced", "increased"] },
          { id: "panel_count_media", label: "Panels in adaptation", type: "number", placeholder: "0", showWhen: ["reduced", "increased"] },
        ],
      },
      {
        id: "visual_density_change",
        label: "Visual density",
        help: "Whether the media adaptation is denser (more marks, labels, or clutter) or simpler than the source figure.",
        options: ["denser", "similar", "simpler"],
        optionHelp: {
          denser: "More marks, series, labels, or annotation than the source.",
          similar: "Roughly the same amount of visual information.",
          simpler: "Fewer marks, series, or labels — visibly decluttered.",
        },
      },
      {
        id: "layout_reordering",
        label: "Layout reordering",
        help: "Whether panels, legends, labels, annotations, or other visual components are rearranged relative to the source figure.",
        options: ["yes", "no"],
        optionHelp: {
          yes: "Components were moved or re-ordered.",
          no: "Spatial arrangement is essentially preserved.",
        },
      },
      {
        id: "axes_scales",
        label: "Axes & scales",
        help: "Changes to axis ranges, baselines, scale types, gridlines, or units.",
        options: ["same", "changed", "not_applicable"],
        optionHelp: {
          same: "Axis ranges, baselines, scale types, and units all preserved.",
          changed: "Any change to axis range (incl. truncation), reference baseline, log / linear scale, units, or gridlines.",
          not_applicable: "No axes in either version (e.g. maps, pictograms).",
        },
        extraInputs: [
          { id: "axes_scales_description", label: "Describe axes / scale change", type: "textarea", placeholder: "e.g. y-axis truncated; anomaly baseline changed from 1850-1900 to 1961-1990; log scale replaced with linear", showWhen: ["changed"], requiredWhen: ["changed"] },
        ],
      },
      {
        id: "legend",
        label: "Legend",
        help: "Whether the legend is the same, added, removed, changed, or not relevant to this figure.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "Legend content and form preserved (or both versions have none).",
          added: "The adaptation adds a legend the source lacks.",
          removed: "The source's legend is dropped (e.g. replaced by direct labels).",
          changed: "Legend present in both, but content, order, or form differs.",
          not_applicable: "A legend is irrelevant to this figure type.",
        },
        extraInputs: [
          { id: "legend_description", label: "Describe legend change", type: "textarea", placeholder: "Briefly describe the legend change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "visual_emphasis",
        label: "Visual emphasis",
        help: "Whether highlighting, spotlighting, arrows, contrast, or attention cues are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "Emphasis cues preserved (or absent in both).",
          added: "New highlighting, arrows, spotlight colors, or callouts.",
          removed: "The source's emphasis cues were dropped.",
          changed: "Emphasis present in both but redirected or restyled.",
          not_applicable: "Emphasis cues are irrelevant to this figure.",
        },
        extraInputs: [
          { id: "visual_emphasis_description", label: "Describe emphasis change", type: "textarea", placeholder: "Briefly describe the emphasis change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "color_function",
        label: "Color function",
        help: "How color's communicative role changes relative to the source figure. Select all that apply; Same and N/A exclude the others.",
        multiSelect: true,
        exclusiveOptions: ["same"],
        options: ["same", "more_categorical", "more_sequential", "more_affective_warning", "more_muted", "not_applicable"],
        optionHelp: {
          same: "Color plays the same communicative role.",
          more_categorical: "Color used more to distinguish discrete categories.",
          more_sequential: "Color used more to encode ordered magnitude.",
          more_affective_warning: "Color shifted toward emotional signaling. e.g. alarm reds, danger gradients.",
          more_muted: "Palette desaturated or softened, reducing emphasis.",
          not_applicable: "Color is not meaningfully used in either version.",
        },
      },
      {
        id: "color_palette",
        label: "Color palette",
        options: ["same", "changed", "not_applicable"],
        optionHelp: {
          same: "Overall palette preserved.",
          changed: "Overall palette differs — describe the shift below.",
          not_applicable: "Color palette is irrelevant (e.g. both monochrome).",
        },
        extraInputs: [
          { id: "color_palette_description", label: "How palette changed", type: "textarea", placeholder: "e.g. neutral blue palette changed to red warning palette", showWhen: ["changed"], requiredWhen: ["changed"] },
        ],
      },
      {
        id: "visual_mapping",
        label: "Visual mapping",
        help: "Whether mappings between data variables and visual channels (position, length, color, size, shape) are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "Variables map to the same visual channels.",
          added: "A new variable-to-channel mapping was introduced.",
          removed: "A mapping from the source was dropped.",
          changed: "A variable is encoded by a different channel. e.g. color scale replaced by bar length.",
          not_applicable: "Mappings cannot be compared for this figure.",
        },
        extraInputs: [
          { id: "visual_mapping_description", label: "Describe mapping change", type: "textarea", placeholder: "Briefly describe the mapping change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "annotations",
        label: "Annotations",
        help: "Whether annotations inside the visualization (in-chart text, markers, reference lines) are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "In-chart annotations preserved (or absent in both).",
          added: "New in-chart labels, notes, markers, or reference lines.",
          removed: "The source's annotations were dropped.",
          changed: "Annotations present in both but reworded, moved, or restyled.",
          not_applicable: "Annotations are irrelevant to this figure.",
        },
        extraInputs: [
          { id: "annotations_description", label: "Describe annotation change", type: "textarea", placeholder: "Briefly describe the annotation change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "external_notes_explanations",
        label: "Notes / explanations outside the visualization",
        help: "Whether explanatory notes outside the chart area are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "Outside notes preserved (or absent in both).",
          added: "New explanatory text added around the chart.",
          removed: "The source's outside notes were dropped.",
          changed: "Outside notes present in both but reworded or restructured.",
          not_applicable: "Outside notes are irrelevant here.",
        },
        extraInputs: [
          { id: "external_notes_explanations_description", label: "Describe notes change", type: "textarea", placeholder: "Briefly describe the note change.", showWhen: ["added", "removed", "changed"], requiredWhen: ["added", "removed", "changed"] },
        ],
      },
      {
        id: "decorations",
        label: "Decorations",
        help: "Whether decorative or illustrative visual elements are the same, added, removed, or changed.",
        options: ["same", "added", "removed", "changed", "not_applicable"],
        optionHelp: {
          same: "Decorative elements preserved (or absent in both).",
          added: "Illustrations, icons, photos, or decorative flourishes added.",
          removed: "The source's decorative elements were dropped.",
          changed: "Decoration present in both but replaced or restyled.",
          not_applicable: "Decoration is irrelevant to this figure.",
        },
        extraInputs: [
          { id: "decorations_description", label: "Describe decoration change", type: "textarea", placeholder: "Briefly describe the decoration change.", showWhen: ["added", "removed", "changed"] },
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
        optionHelp: {
          fewer: "The media title has fewer words than the scientific title.",
          same: "Roughly the same number of words.",
          more: "The media title has more words.",
          not_applicable: "One or both versions have no title.",
        },
      },
      {
        id: "subtitle_word_count_change",
        label: "Subtitle word count",
        options: ["fewer", "same", "more", "not_applicable"],
        optionHelp: {
          fewer: "The media subtitle has fewer words than the scientific subtitle / caption.",
          same: "Roughly the same number of words.",
          more: "The media subtitle has more words.",
          not_applicable: "One or both versions have no subtitle / caption.",
        },
      },
      {
        id: "media_title_function",
        label: "Media title function",
        help: "How the media adaptation title frames the intended takeaway. Select all that apply.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
        optionHelp: titleFunctionOptionHelp,
      },
      {
        id: "scientific_title_function",
        label: "Scientific title function",
        help: "How the original scientific figure title frames the content. Select all that apply.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "not_applicable"],
        optionHelp: titleFunctionOptionHelp,
      },
      {
        id: "media_subtitle_function",
        label: "Media subtitle function",
        help: "Role of media subtitle, deck, or explanatory text directly attached to the visual. Select all that apply.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
        optionHelp: subtitleFunctionOptionHelp,
      },
      {
        id: "scientific_subtitle_function",
        label: "Scientific subtitle function",
        help: "Role of subtitle, caption, or methodological text attached to the original scientific figure. Select all that apply.",
        multiSelect: true,
        options: ["descriptive", "explanation", "interpretation", "takeaway", "opinion", "alarming", "solution_oriented", "source_method", "not_applicable"],
        optionHelp: subtitleFunctionOptionHelp,
      },
      {
        id: "message_fidelity",
        label: "Main message fidelity",
        help: "Does the adaptation's main takeaway match the source figure's main message? Choose the dominant relation.",
        options: ["consistent", "narrowed", "amplified", "reframed"],
        optionHelp: {
          consistent: "Same core claim as the source figure.",
          narrowed: "Keeps only a subset or single aspect of the source's message.",
          amplified: "Same direction, but a stronger or more dramatic claim.",
          reframed: "Different emphasis or conclusion than the source figure.",
        },
        extraInputs: [
          { id: "message_fidelity_description", label: "Describe message shift", type: "textarea", placeholder: "e.g. source shows scenario ranges; adaptation claims a single worst-case outcome", showWhen: ["narrowed", "amplified", "reframed"], requiredWhen: ["narrowed", "amplified", "reframed"] },
        ],
      },
      {
        id: "narrative_frame",
        label: "Narrative frame",
        help: "Dominant framing of the adapted figure. Choose the single dominant frame; if two seem equally strong, choose the one the title supports and note the tie in coder notes.",
        options: ["neutral", "risk_focused", "responsibility_focused", "solution_focused", "conflict_focused", "other"],
        optionHelp: {
          neutral: "Presents data without evaluative framing.",
          risk_focused: "Emphasizes threats, damages, or danger.",
          responsibility_focused: "Emphasizes causes, blame, or the duty of actors.",
          solution_focused: "Emphasizes solutions, progress, or pathways.",
          conflict_focused: "Emphasizes disagreement or political conflict.",
          other: "A clear frame not listed — describe it below.",
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
  "source_notes",
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
  sourceNotesInput: document.getElementById("source_notes"),
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
  elements.sourceNotesInput.addEventListener("input", () => autoResizeTextarea(elements.sourceNotesInput));

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
