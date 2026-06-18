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
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        record[inputId] = getFormValue(inputId);
      });
      field.extraInputs?.forEach((extraInput) => {
        record[extraInput.id] = getFormValue(extraInput.id);
      });
    });
  });
  return record;
}

function validateRecord(record) {
  const requiredMessages = [];

  if (!record.coder_name) requiredMessages.push("Select a coder name.");
  if (!record.source_organization) requiredMessages.push("Enter or select a source organization.");
  if (!record.source_figure_id) requiredMessages.push("Enter a source figure ID.");
  if (!record.media_outlet) requiredMessages.push("Enter or select a media outlet.");
  if (!record.media_article_title) requiredMessages.push("Enter a media article title.");
  if (!record.media_article_url) requiredMessages.push("Enter a media article URL.");
  if (!record.media_publication_date) requiredMessages.push("Enter a media publication date.");
  if (!record.source_image_filename) requiredMessages.push("Upload the original scientific image.");
  if (!record.media_image_filename) requiredMessages.push("Select the media adaptation image.");
  if (!record.coding_confidence) requiredMessages.push("Select coding confidence.");

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!record[field.id]) {
        requiredMessages.push(`Code "${field.label}".`);
      }
      field.extraInputs?.forEach((extraInput) => {
        const selectedValue = record[field.id] || "";
        const requiredWhen = extraInput.requiredWhen || [];
        if (requiredWhen.includes(selectedValue) && !record[extraInput.id]) {
          requiredMessages.push(`Complete "${extraInput.label}" for "${field.label}".`);
        }
      });
    });
  });

  return requiredMessages;
}

function validateRecordImages(record) {
  const requiredMessages = [];
  if (!record.source_image_data_url) {
    requiredMessages.push("Upload and save the original scientific image.");
  }
  if (!record.media_selected_data_url && !record.media_csv_data_url) {
    requiredMessages.push("Import the media image files/folder, select this media adaptation image, then save again.");
  }
  return requiredMessages;
}

async function saveCurrentRecord({ moveNextAfterSave = false } = {}) {
  updateRecordId();
  const record = await collectRecord();
  const validationErrors = validateRecord(record);
  if (validationErrors.length) {
    alert(validationErrors.join("\n"));
    return;
  }
  const imageErrors = validateRecordImages(record);
  if (imageErrors.length) {
    alert(imageErrors.join("\n"));
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
  activeLoadedRecord = null;
  const rows = getNavigableRows();
  const currentIndex = rows.findIndex((row) => row.__rowIndex === elements.mediaCsvSelect.value);
  const canAdvance = currentIndex >= 0 && currentIndex < rows.length - 1;
  const preservedCoder = getFormValue("coder_name");
  const preservedMediaOutlet = getFormValue("media_outlet");
  currentFiles.media_image = null;
  currentFileData.media_image = null;
  if (elements.mediaImageFileSelect) {
    elements.mediaImageFileSelect.value = "";
  }
  if (canAdvance) {
    elements.mediaCsvSelect.value = rows[currentIndex + 1].__rowIndex;
    handleMediaRowSelection();
  }
  document.getElementById("source_figure_id").value = "";
  document.getElementById("source_figure_url").value = "";
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
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.value = "";
      });
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
  document.getElementById("media_outlet").value = preservedMediaOutlet;
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
  document.getElementById("source_figure_url").value = "";
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
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.value = "";
      });
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
  elements.mediaCsvSummary.textContent = importedRows.length
    ? "No media image row selected."
    : "No media image row selected.";

  elements.sourceImageInput.value = "";
  syncFilePickerName(elements.sourceImageInput);
  if (elements.mediaImageFileSelect) {
    elements.mediaImageFileSelect.value = "";
  }
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
  document.getElementById("source_figure_url").value = record.source_figure_url || "";
  document.getElementById("media_outlet").value = record.media_outlet || "";
  document.getElementById("media_article_title").value = record.media_article_title || "";
  document.getElementById("media_article_url").value = record.media_article_url || "";
  document.getElementById("media_publication_date").value = formatDisplayDate(record.media_publication_date);
  document.getElementById("media_updated_date").value = formatDisplayDate(record.media_updated_date);
  setCodingConfidence(record.coding_confidence || "");
  elements.coderNotesInput.value = record.coder_notes || "";
  autoResizeTextarea(elements.coderNotesInput);
  syncMediaArticleLink(record.media_article_url || "");
  syncMediaMetadataEditability();

  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      restoreFieldSelection(field, record[field.id] || "");
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.value = record[inputId] || "";
      });
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
    } else if (record.media_selected_data_url) {
      renderPreviewFromDataUrl(
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
    return JSON.parse(localStorage.getItem(recordsStorageKey) || "[]");
  } catch {
    return [];
  }
}

