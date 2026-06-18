function getFormValue(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function setCodingConfidence(value) {
  const hidden = document.getElementById("coding_confidence");
  if (hidden) hidden.value = value;
  document.querySelectorAll('input[name="coding_confidence_chip"]').forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function initConfidenceChips() {
  document.querySelectorAll('input[name="coding_confidence_chip"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const hidden = document.getElementById("coding_confidence");
      if (hidden) hidden.value = radio.value;
    });
  });
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function getFieldValue(field) {
  if (document.getElementById(`${field.id}__not_applicable`)?.checked) {
    return "not_applicable";
  }
  if (!field.multiSelect) {
    return getRadioValue(field.id);
  }
  return getFieldValues(field).filter(Boolean).join("|");
}

function getFieldValues(field) {
  const checkedInputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]:checked`));
  return checkedInputs.map((input) => input.value);
}

function captureCodebookSelections() {
  const selections = {};
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      selections[field.id] = getFieldValue(field);
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        selections[inputId] = getFormValue(inputId);
      });
      field.extraInputs?.forEach((extraInput) => {
        selections[extraInput.id] = getFormValue(extraInput.id);
      });
    });
  });
  return selections;
}

function restoreCodebookSelections(selections) {
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      restoreFieldSelection(field, selections[field.id] || "");
      getFieldSupplementalInputIds(field).forEach((inputId) => {
        const input = document.getElementById(inputId);
        if (input) input.value = selections[inputId] || "";
      });
      field.extraInputs?.forEach((extraInput) => {
        const input = document.getElementById(extraInput.id);
        if (input) input.value = selections[extraInput.id] || "";
      });
    });
  });
  syncAllFieldExtraInputs();
}

function restoreFieldSelection(field, value) {
  const notApplicableInput = document.getElementById(`${field.id}__not_applicable`);
  if (notApplicableInput) {
    notApplicableInput.checked = value === "not_applicable";
  }
  const values = String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const inputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]`));
  inputs.forEach((input) => {
    input.checked = false;
  });
  if (value === "not_applicable") {
    syncNotApplicableFieldState(field);
    return;
  }
  if (!values.length) {
    const unsetInput = document.getElementById(`${field.id}__unset`);
    if (unsetInput) unsetInput.checked = true;
    syncNotApplicableFieldState(field);
    return;
  }
  values.forEach((optionValue) => {
    const input = document.getElementById(`${field.id}__${optionValue || "unset"}`);
    if (input) input.checked = true;
  });
  if (field.multiSelect) ensureMultiSelectHasSelection(field);
  syncNotApplicableFieldState(field);
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
  const lastCoder = localStorage.getItem(coderStorageKey) || "";
  if (lastCoder) {
    elements.coderSelect.value = lastCoder;
  }
}

