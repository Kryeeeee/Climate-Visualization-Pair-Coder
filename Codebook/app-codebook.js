function autoResizeTextarea(textarea) {
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

function normalizeImageLookupKey(value) {
  return String(value || "").replace(/\\/g, "/").toLowerCase().trim();
}

function imageLookupKeysForFile(file) {
  return [
    normalizeImageLookupKey(file.name),
    normalizeImageLookupKey(file.webkitRelativePath || ""),
  ].filter(Boolean);
}

function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name || "");
}

function imageLookupKeysForRow(row) {
  const localPath = normalizeImageLookupKey(row?.local_image_path || "");
  const filename = normalizeImageLookupKey(extractFilename(localPath));
  return [filename, localPath].filter(Boolean);
}

function findImportedMediaImageFile(rowOrPath) {
  const keys = typeof rowOrPath === "string"
    ? [normalizeImageLookupKey(extractFilename(rowOrPath)), normalizeImageLookupKey(rowOrPath)].filter(Boolean)
    : imageLookupKeysForRow(rowOrPath);
  for (const key of keys) {
    if (importedMediaImageFiles.has(key)) return importedMediaImageFiles.get(key);
  }
  for (const [key, file] of importedMediaImageFiles.entries()) {
    if (keys.some((lookupKey) => key.endsWith(`/${lookupKey}`) || lookupKey.endsWith(`/${key}`))) {
      return file;
    }
  }
  return null;
}

async function getImportedMediaImageDataUrl(rowOrPath) {
  const file = findImportedMediaImageFile(rowOrPath);
  if (!file) return "";
  const cacheKey = normalizeImageLookupKey(file.webkitRelativePath || file.name);
  if (importedMediaImageDataUrls.has(cacheKey)) {
    return importedMediaImageDataUrls.get(cacheKey);
  }
  const dataUrl = await readFileAsDataUrl(file);
  importedMediaImageDataUrls.set(cacheKey, dataUrl);
  return dataUrl;
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
      const labelNode = fieldFragment.querySelector(".field-card-label");
      labelNode.textContent = field.custom ? `* ${field.label}` : field.label;
      const fieldCopy = fieldFragment.querySelector(".field-card-copy");
      const helpNode = fieldFragment.querySelector(".field-card-help");
      const titleRow = document.createElement("div");
      titleRow.className = "field-card-title-row";
      fieldCopy.insertBefore(titleRow, helpNode);
      titleRow.appendChild(labelNode);
      helpNode.textContent = field.help || "";
      helpNode.classList.toggle("hidden", !field.help);
      const chipGroup = fieldFragment.querySelector(".chip-group");
      const hasNotApplicable = field.options?.includes("not_applicable");
      if (hasNotApplicable) {
        fieldCard.classList.add("has-not-applicable");
      }
      if (hasNotApplicable) {
        titleRow.appendChild(makeNotApplicableControl(field, () => {
          handleNotApplicableChange(field);
          syncFieldExtraInputs(fieldCard, field);
        }));
      }
      chipGroup.appendChild(makeChip(field, "", "Unset"));
      field.options
        .filter((option) => option !== "not_applicable")
        .forEach((option) => chipGroup.appendChild(makeChip(field, option, prettifyOption(option))));
      chipGroup.addEventListener("change", (event) => {
        if (hasNotApplicable) {
          document.getElementById(`${field.id}__not_applicable`).checked = false;
          syncNotApplicableFieldState(field);
        }
        handleChipChange(event, field);
        syncFieldExtraInputs(fieldCard, field);
      });
      if (field.extraInputs?.length) {
        const extraGroup = document.createElement("div");
        extraGroup.className = "field-extra-grid";
        field.extraInputs.forEach((extraInput) => {
          const extraLabel = document.createElement("label");
          extraLabel.className = `field field-extra${extraInput.type === "number" ? " field-extra-number" : ""}`;
          extraLabel.appendChild(makeExtraInputLabel(extraInput));
          extraLabel.appendChild(makeExtraInputControl(field, extraInput));
          extraGroup.appendChild(extraLabel);
        });
        fieldCard.appendChild(extraGroup);
        syncFieldExtraInputs(fieldCard, field);
      }
      fieldGroups.appendChild(fieldFragment);
    });

    elements.sectionRoot.appendChild(fragment);
  });

  if (preservedSelections) {
    restoreCodebookSelections(preservedSelections);
  }
}

function makeChip(field, optionValue, optionLabel) {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-option";
  const inputId = `${field.id}__${optionValue || "unset"}`;
  const inputType = field.multiSelect ? "checkbox" : "radio";
  wrapper.innerHTML = `
    <input type="${inputType}" name="${field.id}" id="${inputId}" value="${optionValue}">
    <label for="${inputId}">${optionLabel}</label>
  `;
  return wrapper;
}

function makeNotApplicableControl(field, onChange) {
  const label = document.createElement("label");
  label.className = "field-not-applicable";
  label.innerHTML = `
    <input id="${field.id}__not_applicable" type="checkbox">
    <span>Not applicable</span>
  `;
  const input = label.querySelector("input");
  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
  return label;
}

function handleNotApplicableChange(field) {
  const notApplicableInput = document.getElementById(`${field.id}__not_applicable`);
  if (notApplicableInput.checked) {
    document.querySelectorAll(`input[name="${field.id}"]`).forEach((input) => {
      input.checked = false;
    });
  } else {
    document.getElementById(`${field.id}__unset`).checked = true;
  }
  syncNotApplicableFieldState(field);
}

function syncNotApplicableFieldState(field) {
  const notApplicableInput = document.getElementById(`${field.id}__not_applicable`);
  if (!notApplicableInput) return;
  notApplicableInput.closest(".field-card").classList.toggle("not-applicable-selected", notApplicableInput.checked);
}

function handleChipChange(event, field) {
  if (!field.multiSelect) return;
  const changedInput = event.target;
  if (!(changedInput instanceof HTMLInputElement) || !changedInput.checked) {
    ensureMultiSelectHasSelection(field);
    return;
  }
  const inputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]`));
  if (changedInput.value === "") {
    inputs.forEach((input) => {
      input.checked = input === changedInput;
    });
    return;
  }
  inputs.forEach((input) => {
    if (input.value === "") {
      input.checked = false;
    }
  });
}

function ensureMultiSelectHasSelection(field) {
  const inputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]`));
  if (!inputs.some((input) => input.checked)) {
    const unsetInput = document.getElementById(`${field.id}__unset`);
    if (unsetInput) unsetInput.checked = true;
  }
}

function makeExtraInputLabel(extraInput) {
  const labelText = document.createElement("span");
  labelText.textContent = extraInput.label;
  return labelText;
}

function makeExtraInputControl(field, extraInput) {
  let control;
  if (extraInput.type === "textarea") {
    control = document.createElement("textarea");
    control.rows = 1;
    control.addEventListener("input", () => autoResizeTextarea(control));
  } else if (extraInput.type === "choice") {
    control = document.createElement("select");
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Select";
    control.appendChild(emptyOption);
    (extraInput.options || []).forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = prettifyOption(optionValue);
      control.appendChild(option);
    });
  } else {
    control = document.createElement("input");
    control.type = extraInput.type || "text";
    if (extraInput.type === "number") {
      control.min = "0";
    }
  }
  control.id = extraInput.id;
  control.placeholder = extraInput.placeholder || "";
  control.dataset.parentField = field.id;
  control.dataset.showWhen = (extraInput.showWhen || []).join("|");
  control.dataset.requiredWhen = (extraInput.requiredWhen || []).join("|");
  return control;
}

function syncFieldExtraInputs(fieldCard, field) {
  const selectedValues = getFieldValues(field);
  const extraGroup = fieldCard.querySelector(".field-extra-grid");
  let hasVisibleExtra = false;
  field.extraInputs?.forEach((extraInput) => {
    const input = fieldCard.querySelector(`#${extraInput.id}`);
    const label = input.closest(".field-extra");
    const showWhen = extraInput.showWhen || [];
    const shouldShow = !showWhen.length || selectedValues.some((value) => showWhen.includes(value));
    const selectedTrigger = selectedValues.find((value) => showWhen.includes(value)) || "";
    syncOptionSpecificExtraInputDraft(input, shouldShow ? selectedTrigger : "");
    hasVisibleExtra = hasVisibleExtra || shouldShow;
    label.classList.toggle("hidden", !shouldShow);
    input.disabled = !shouldShow;
    if (!shouldShow) input.value = "";
    if (shouldShow && input.tagName === "TEXTAREA") autoResizeTextarea(input);
  });
  extraGroup?.classList.toggle("hidden", !hasVisibleExtra);
}

function syncOptionSpecificExtraInputDraft(input, selectedTrigger) {
  const previousTrigger = input.dataset.visibleFor || "";
  if (previousTrigger === selectedTrigger) return;

  const drafts = input.dataset.optionDrafts ? JSON.parse(input.dataset.optionDrafts) : {};
  if (previousTrigger) {
    drafts[previousTrigger] = input.value;
  }

  if (selectedTrigger) {
    if (Object.hasOwn(drafts, selectedTrigger)) {
      input.value = drafts[selectedTrigger];
    } else if (previousTrigger) {
      input.value = "";
    }
    input.dataset.visibleFor = selectedTrigger;
  } else {
    input.dataset.visibleFor = "";
  }
  input.dataset.optionDrafts = JSON.stringify(drafts);
}

function clearOptionSpecificExtraInputDraft(input) {
  input.dataset.visibleFor = "";
  input.dataset.optionDrafts = "";
}

function syncAllFieldExtraInputs() {
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      const input = document.querySelector(`input[name="${field.id}"]`);
      const fieldCard = input?.closest(".field-card");
      if (fieldCard) syncFieldExtraInputs(fieldCard, field);
    });
  });
}

function getCodebookOutputFields() {
  return codebookSections.flatMap((section) => section.fields.flatMap((field) => [
    field.id,
    ...getFieldOutputInputIds(field),
  ]));
}

function getFieldOutputInputIds(field) {
  return (field.extraInputs || []).map((extraInput) => extraInput.id);
}

function getFieldSupplementalInputIds(field) {
  return [];
}

function prettifyOption(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

