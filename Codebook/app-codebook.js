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
      fieldFragment.querySelector(".field-card-label").textContent = field.custom ? `* ${field.label}` : field.label;
      const helpNode = fieldFragment.querySelector(".field-card-help");
      helpNode.textContent = field.help || "";
      helpNode.classList.toggle("hidden", !field.help);
      const chipGroup = fieldFragment.querySelector(".chip-group");
      if (field.kind === "word_count") {
        fieldCard.classList.add("word-count-card");
        const fieldCopy = fieldFragment.querySelector(".field-card-copy");
        fieldCopy.appendChild(makeWordCountNotApplicable(field));
        chipGroup.remove();
        fieldCard.appendChild(makeWordCountControl(field));
      } else {
        chipGroup.appendChild(makeChip(field, "", "Unset"));
        field.options.forEach((option) => chipGroup.appendChild(makeChip(field, option, prettifyOption(option))));
        chipGroup.addEventListener("change", (event) => {
          handleChipChange(event, field);
          syncFieldExtraInputs(fieldCard, field);
        });
      }
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

function makeWordCountControl(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "word-count-control";
  wrapper.innerHTML = `
    <input id="${field.id}" type="hidden" value="">
    <div class="word-count-grid">
      <label class="field field-extra-number">
        <span>${escapeHtml(field.sourceCountLabel)}</span>
        <input id="${field.sourceCountId}" type="number" min="0" step="1" placeholder="0">
      </label>
      <label class="field field-extra-number">
        <span>${escapeHtml(field.mediaCountLabel)}</span>
        <input id="${field.mediaCountId}" type="number" min="0" step="1" placeholder="0">
      </label>
      <output id="${field.id}__result" class="word-count-result">Unset</output>
    </div>
  `;
  const sourceInput = wrapper.querySelector(`#${field.sourceCountId}`);
  const mediaInput = wrapper.querySelector(`#${field.mediaCountId}`);
  [sourceInput, mediaInput].forEach((input) => {
    input.addEventListener("input", () => updateWordCountField(field));
    input.addEventListener("change", () => updateWordCountField(field));
  });
  return wrapper;
}

function makeWordCountNotApplicable(field) {
  const label = document.createElement("label");
  label.className = "word-count-na";
  label.innerHTML = `
    <input id="${field.id}__not_applicable" type="checkbox">
    <span>Not applicable</span>
  `;
  const input = label.querySelector("input");
  input.addEventListener("input", () => updateWordCountField(field));
  input.addEventListener("change", () => updateWordCountField(field));
  return label;
}

function updateWordCountField(field) {
  const valueInput = document.getElementById(field.id);
  const sourceInput = document.getElementById(field.sourceCountId);
  const mediaInput = document.getElementById(field.mediaCountId);
  const notApplicableInput = document.getElementById(`${field.id}__not_applicable`);
  const resultOutput = document.getElementById(`${field.id}__result`);
  if (notApplicableInput.checked) {
    valueInput.value = "not_applicable";
    sourceInput.value = "";
    mediaInput.value = "";
    sourceInput.disabled = true;
    mediaInput.disabled = true;
  } else {
    sourceInput.disabled = false;
    mediaInput.disabled = false;
    const sourceCount = Number(sourceInput.value);
    const mediaCount = Number(mediaInput.value);
    if (sourceInput.value === "" || mediaInput.value === "") {
      valueInput.value = "";
    } else if (mediaCount < sourceCount) {
      valueInput.value = "fewer_words";
    } else if (mediaCount > sourceCount) {
      valueInput.value = "more_words";
    } else {
      valueInput.value = "similar_words";
    }
  }
  if (resultOutput) {
    resultOutput.textContent = valueInput.value ? prettifyOption(valueInput.value) : "Unset";
  }
}

function updateAllWordCountFields() {
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.kind === "word_count") updateWordCountField(field);
    });
  });
}

function handleChipChange(event, field) {
  if (!field.multiSelect) return;
  const changedInput = event.target;
  if (!(changedInput instanceof HTMLInputElement) || !changedInput.checked) {
    ensureMultiSelectHasSelection(field);
    return;
  }
  const inputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]`));
  if (changedInput.value === "" || changedInput.value === "absent") {
    inputs.forEach((input) => {
      input.checked = input === changedInput;
    });
    return;
  }
  inputs.forEach((input) => {
    if (input.value === "" || input.value === "absent") {
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
  if (field.kind === "word_count") {
    return [field.sourceCountId, field.mediaCountId];
  }
  return (field.extraInputs || []).map((extraInput) => extraInput.id);
}

function getFieldSupplementalInputIds(field) {
  if (field.kind === "word_count") {
    return [field.sourceCountId, field.mediaCountId];
  }
  return [];
}

function prettifyOption(value) {
  if (value === "similar_words") return "Same Words";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

