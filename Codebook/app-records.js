async function collectRecord() {
  const record = {};
  metadataFields.forEach((field) => {
    record[field] = getFormValue(field);
  });
  if (!isIpccSource()) {
    record.source_report_cycle = "";
    record.source_working_group = "";
  }
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
  record.media_selected_data_url = currentFiles.media_image
    ? (currentFileData.media_image || await readFileAsDataUrl(currentFiles.media_image))
    : activeLoadedRecord?.media_selected_data_url || "";
  const importedMediaDataUrl = currentMediaRow ? await getImportedMediaImageDataUrl(currentMediaRow) : "";
  record.media_csv_data_url = record.media_selected_data_url
    ? ""
    : (importedMediaDataUrl || activeLoadedRecord?.media_csv_data_url || "");
  record.coded_at = new Date().toISOString();

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      record[field.id] = getFieldValue(field);
      field.extraInputs?.forEach((extraInput) => {
        record[extraInput.id] = getFormValue(extraInput.id);
      });
    });
  });
  return record;
}

function validateRecord(record) {
  const errors = [];
  const addError = (message, anchor) => errors.push({ message, anchor });

  if (!record.coder_name) addError("Select a coder name.", "coder_name");
  if (!record.source_organization) addError("Enter or select a source organization.", "source_organization");
  if (!record.source_figure_id) addError("Enter a source figure ID.", "source_figure_id");
  if (!record.media_outlet) addError("Enter or select a media outlet.", "media_outlet");
  if (!record.media_article_title) addError("Enter a media article title.", "media_article_title");
  if (!record.media_article_url) addError("Enter a media article URL.", "media_article_url");
  if (!record.media_publication_date) addError("Enter a media publication date.", "media_publication_date");
  if (!record.source_image_filename) addError("Upload the original scientific image.", "source_image");
  if (!record.media_image_filename) addError("Select the media adaptation image.", "mediaCsvSelect");
  if (!record.coding_confidence) addError("Select coding confidence.", "codingConfidenceField");

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!record[field.id]) {
        addError(`Code "${field.label}".`, field.id);
      }
      const selectedValues = String(record[field.id] || "").split("|").filter(Boolean);
      field.extraInputs?.forEach((extraInput) => {
        const requiredWhen = extraInput.requiredWhen || [];
        if (requiredWhen.some((value) => selectedValues.includes(value)) && !record[extraInput.id]) {
          addError(`Complete "${extraInput.label}" for "${field.label}".`, extraInput.id);
        }
      });
    });
  });

  return errors;
}

function validateRecordImages(record) {
  const errors = [];
  if (!record.source_image_data_url) {
    errors.push({ message: "Upload and save the original scientific image.", anchor: "source_image" });
  }
  if (!record.media_selected_data_url && !record.media_csv_data_url) {
    errors.push({ message: "Import the media image files/folder, select this media adaptation image, then save again.", anchor: "mediaCsvSelect" });
  }
  return errors;
}

function resolveValidationTarget(anchor) {
  const fieldCard = document.querySelector(`.field-card[data-field-id="${anchor}"]`);
  if (fieldCard) return fieldCard;
  const element = document.getElementById(anchor);
  if (!element) return null;
  return element.closest(".field, .image-card, .field-card") || element;
}

function applyValidationErrors(errors) {
  document.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
  let firstTarget = null;
  errors.forEach((error) => {
    const target = resolveValidationTarget(error.anchor);
    if (!target) return;
    target.classList.add("invalid");
    if (!firstTarget) firstTarget = target;
  });
  if (firstTarget) {
    firstTarget.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  showToast(
    errors.length === 1
      ? errors[0].message
      : `${errors.length} required items are missing — highlighted in red.`,
    "error"
  );
}

function clearValidationHighlight(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  target.closest(".invalid")?.classList.remove("invalid");
}

async function saveCurrentRecord({ moveNextAfterSave = false } = {}) {
  updateRecordId();
  const record = await collectRecord();
  const validationErrors = validateRecord(record);
  if (validationErrors.length) {
    applyValidationErrors(validationErrors);
    return;
  }
  const imageErrors = validateRecordImages(record);
  if (imageErrors.length) {
    applyValidationErrors(imageErrors);
    return;
  }

  const existingIndex = savedRecords.findIndex((item) => item.record_id === record.record_id);
  if (existingIndex >= 0 && activeLoadedRecord?.record_id !== record.record_id) {
    if (!confirm(`A saved record with this ID already exists:\n${record.record_id}\n\nOverwrite it?`)) {
      return;
    }
  }
  if (existingIndex >= 0) {
    savedRecords[existingIndex] = record;
  } else {
    savedRecords.push(record);
  }

  try {
    await idbPutRecord(record);
  } catch (error) {
    console.error(error);
    showToast("Warning: the record could not be persisted to browser storage. Export soon to avoid losing work.", "error", 8000);
  }
  persistCoder();
  markCurrentRowCompleted(record);
  activeLoadedRecord = { ...record };
  renderSavedRecords();
  markFormClean();
  if (moveNextAfterSave && importedRows.length) {
    moveToNextAfterSave();
    return;
  }
  showToast("Coded pair saved.", "success");
}

function moveToNextAfterSave() {
  activeLoadedRecord = null;
  const rows = getNavigableRows();
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const canAdvance = currentIndex >= 0 && currentIndex < rows.length - 1;
  const preservedCoder = getFormValue("coder_name");
  currentFiles.media_image = null;
  currentFileData.media_image = null;
  elements.mediaImageFileSelect.value = "";
  if (canAdvance) {
    elements.mediaCsvSelect.value = rows[currentIndex + 1].__rowIndex;
    handleMediaRowSelection({ skipDirtyCheck: true });
  }
  document.getElementById("source_figure_id").value = "";
  document.getElementById("source_figure_url").value = "";
  document.getElementById("source_report_cycle").value = "";
  document.getElementById("source_working_group").value = "";
  elements.additionalSourcesInput.value = "";
  autoResizeTextarea(elements.additionalSourcesInput);
  elements.sourceNotesInput.value = "";
  autoResizeTextarea(elements.sourceNotesInput);
  setCodingConfidence("");
  elements.coderNotesInput.value = "";
  autoResizeTextarea(elements.coderNotesInput);
  currentFiles.source_image = null;
  currentFileData.source_image = null;
  elements.sourceImageInput.value = "";
  syncFilePickerName(elements.sourceImageInput);
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
  document.getElementById("source_organization").value = "";
  document.getElementById("coder_name").value = preservedCoder;
  updateRecordId();
  markFormClean();
  showToast(canAdvance ? "Coded pair saved — moved to the next media image." : "Coded pair saved. You are on the last media image.", "success");
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
    const recordValues = [
      record.record_id,
      record.source_organization,
      record.media_outlet,
      record.source_figure_id,
      record.media_image_filename || "",
    ].map((value) => String(value || ""));
    row.innerHTML = `
      ${recordValues.map((value) => `<td class="record-value-cell">${escapeHtml(value)}</td>`).join("")}
      <td class="table-action-cell">
        <button class="table-action table-action--load" data-record-id="${record.record_id}" data-action="load" title="Load / edit this record" aria-label="Load / edit this record"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.3 2.2a1.7 1.7 0 0 1 2.4 2.4L5.6 12.7l-3.2.9.9-3.2 8-8.2z"/></svg></button>
        <button class="table-action table-action--delete" data-record-id="${record.record_id}" data-action="delete" title="Delete this record" aria-label="Delete this record"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="2" y1="4" x2="14" y2="4"/><path d="M6 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4"/><path d="M5 4l.5 9h5l.5-9"/></svg></button>
      </td>
    `;
    row.querySelectorAll(".record-value-cell").forEach((cell, index) => {
      cell.title = recordValues[index];
    });
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

async function deleteRecord(recordId) {
  if (!confirm(`Delete saved record\n${recordId}\nfrom this browser?`)) return;
  savedRecords = savedRecords.filter((record) => record.record_id !== recordId);
  try {
    await idbDeleteRecord(recordId);
  } catch (error) {
    console.error(error);
  }
  renderSavedRecords();
  showToast("Record deleted.", "info");
}

function resetForm(initialLoad = false) {
  if (!initialLoad && !confirmDiscardIfDirty()) return;
  activeLoadedRecord = null;
  document.getElementById("source_organization").value = "";
  document.getElementById("source_report_cycle").value = "";
  document.getElementById("source_working_group").value = "";
  document.getElementById("source_figure_id").value = "";
  document.getElementById("source_figure_url").value = "";
  elements.additionalSourcesInput.value = "";
  autoResizeTextarea(elements.additionalSourcesInput);
  elements.sourceNotesInput.value = "";
  autoResizeTextarea(elements.sourceNotesInput);
  document.getElementById("media_outlet").value = "";
  mediaMetadataFields.forEach((field) => {
    document.getElementById(field).value = "";
  });
  setCodingConfidence("");
  elements.coderNotesInput.value = "";
  autoResizeTextarea(elements.coderNotesInput);

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

  currentMediaRow = null;
  elements.mediaCsvSelect.value = "";

  elements.sourceImageInput.value = "";
  syncFilePickerName(elements.sourceImageInput);
  elements.mediaImageFileSelect.value = "";
  lastManualMediaIndex = "";
  currentFiles.media_image = null;
  currentFiles.source_image = null;
  currentFileData.media_image = null;
  currentFileData.source_image = null;
  renderPreview(elements.mediaPreview, null);
  renderPreview(elements.sourcePreview, null);
  syncMediaArticleLink("");
  syncMediaMetadataEditability();

  if (!initialLoad) {
    restoreLastCoder();
  }
  updateRecordId();
  updateNavigationButtons();
  markFormClean();
}

async function clearRecords() {
  if (!savedRecords.length) return;
  if (!confirm("Delete all saved records from this browser?")) return;
  savedRecords = [];
  clearCompletedRowStates();
  try {
    await idbClearRecords();
  } catch (error) {
    console.error(error);
  }
  renderSavedRecords();
  showToast("All saved records deleted.", "info");
}

function loadRecordIntoForm(recordId, { skipDirtyCheck = false } = {}) {
  const record = savedRecords.find((item) => item.record_id === recordId);
  if (!record) return;
  if (!skipDirtyCheck && !confirmDiscardIfDirty()) return;

  activeLoadedRecord = { ...record };
  document.getElementById("record_id").value = record.record_id || "";
  document.getElementById("coder_name").value = record.coder_name || "";
  document.getElementById("source_organization").value = record.source_organization || "";
  document.getElementById("source_report_cycle").value = record.source_report_cycle || "";
  document.getElementById("source_working_group").value = record.source_working_group || "";
  document.getElementById("source_figure_id").value = record.source_figure_id || "";
  document.getElementById("source_figure_url").value = record.source_figure_url || "";
  elements.additionalSourcesInput.value = record.additional_sources || "";
  autoResizeTextarea(elements.additionalSourcesInput);
  elements.sourceNotesInput.value = record.source_notes || "";
  autoResizeTextarea(elements.sourceNotesInput);
  document.getElementById("media_outlet").value = record.media_outlet || "";
  document.getElementById("media_article_title").value = record.media_article_title || "";
  document.getElementById("media_article_url").value = record.media_article_url || "";
  document.getElementById("media_publication_date").value = formatDateForDisplay(record.media_publication_date);
  document.getElementById("media_updated_date").value = formatDateForDisplay(record.media_updated_date);
  setCodingConfidence(record.coding_confidence || "");
  elements.coderNotesInput.value = record.coder_notes || "";
  autoResizeTextarea(elements.coderNotesInput);
  syncMediaArticleLink(record.media_article_url || "");

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      restoreFieldSelection(field, record[field.id] || "");
      field.extraInputs?.forEach((extraInput) => {
        const input = document.getElementById(extraInput.id);
        if (input) {
          input.value = record[extraInput.id] || "";
          clearOptionSpecificExtraInputDraft(input);
        }
      });
    });
  });
  syncAllFieldExtraInputs();

  currentFiles.media_image = null;
  currentFiles.source_image = null;
  currentFileData.media_image = null;
  currentFileData.source_image = null;
  elements.sourceImageInput.value = "";
  syncFilePickerName(elements.sourceImageInput);

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
    const savedMediaDataUrl = record.media_selected_data_url || record.media_csv_data_url;
    if (savedMediaDataUrl) {
      renderPreviewFromSource(
        elements.mediaPreview,
        savedMediaDataUrl,
        record.media_image_filename || "Saved media image",
        "No media image selected"
      );
    }
  } else {
    currentMediaRow = null;
    syncMediaMetadataEditability();
    elements.mediaCsvSelect.value = "";
    if (record.media_csv_local_path) {
      renderPreviewFromPath(elements.mediaPreview, record.media_csv_local_path, "No media image selected");
    } else if (record.media_selected_data_url) {
      renderPreviewFromSource(
        elements.mediaPreview,
        record.media_selected_data_url,
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
    renderPreviewFromSource(
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
  markFormClean();
}

async function loadRecords() {
  try {
    const records = await idbGetAllRecords();
    const legacyRaw = localStorage.getItem(recordsStorageKey);
    if (legacyRaw) {
      try {
        const legacyRecords = JSON.parse(legacyRaw) || [];
        for (const record of legacyRecords) {
          if (record?.record_id && !records.some((item) => item.record_id === record.record_id)) {
            await idbPutRecord(record);
            records.push(record);
          }
        }
        localStorage.removeItem(recordsStorageKey);
        if (legacyRecords.length) {
          showToast(`Migrated ${legacyRecords.length} saved record(s) to database storage.`, "success");
        }
      } catch (error) {
        console.error(error);
      }
    }
    return records;
  } catch (error) {
    console.error(error);
    showToast("Browser database unavailable — records will not persist. Export frequently.", "error", 8000);
    try {
      return JSON.parse(localStorage.getItem(recordsStorageKey) || "[]");
    } catch {
      return [];
    }
  }
}
