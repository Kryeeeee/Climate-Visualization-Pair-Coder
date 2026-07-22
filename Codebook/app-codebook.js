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

const specialValueChips = new Set(["not_applicable", "unclear"]);
const unclearOptionHelp = "Cannot be determined from the available images / context — explain in coder notes.";

/* Micro-icons prefixed to change-direction chip labels. Keyed by option value;
   icons always accompany the text label, never replace it. */
const optionChipIcons = {
  same: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="1.5" y1="3.6" x2="8.5" y2="3.6"/><line x1="1.5" y1="6.4" x2="8.5" y2="6.4"/></svg>`,
  similar: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="1.5" y1="3.6" x2="8.5" y2="3.6"/><line x1="1.5" y1="6.4" x2="8.5" y2="6.4"/></svg>`,
  added: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="1.5" x2="5" y2="8.5"/><line x1="1.5" y1="5" x2="8.5" y2="5"/></svg>`,
  removed: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="1.5" y1="5" x2="8.5" y2="5"/></svg>`,
  changed: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M1.5 5.6c1.2-2.2 2.4-2.2 3.5 0s2.3 2.2 3.5 0"/></svg>`,
  fewer: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="1.5" x2="5" y2="8.5"/><polyline points="2 5.5 5 8.5 8 5.5"/></svg>`,
  more: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="8.5" x2="5" y2="1.5"/><polyline points="2 4.5 5 1.5 8 4.5"/></svg>`,
  reduced: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="1.5" x2="5" y2="8.5"/><polyline points="2 5.5 5 8.5 8 5.5"/></svg>`,
  expanded: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="8.5" x2="5" y2="1.5"/><polyline points="2 4.5 5 1.5 8 4.5"/></svg>`,
  increased: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="8.5" x2="5" y2="1.5"/><polyline points="2 4.5 5 1.5 8 4.5"/></svg>`,
  reconfigured: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 3h2l4 4h1.5"/><path d="M1.5 7h2l4-4h1.5"/><polyline points="7.6 1.6 9 3 7.6 4.4"/><polyline points="7.6 5.6 9 7 7.6 8.4"/></svg>`,
  denser: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="1"/><circle cx="5" cy="2" r="1"/><circle cx="8" cy="2" r="1"/><circle cx="2" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="8" cy="5" r="1"/><circle cx="2" cy="8" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/></svg>`,
  simpler: `<svg class="chip-icon" width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7.5" r="1"/><circle cx="5" cy="3" r="1"/><circle cx="7.5" cy="7.5" r="1"/></svg>`,
};

const sectionIcons = {
  information_selection: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h12l-4.6 5.4V13l-2.8-1.6V8.4L2 3z"/></svg>`,
  visual_form: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8a6.2 6.2 0 1 0 0 12.4c.9 0 1.3-.6 1.1-1.3-.2-.8-.1-1.5.8-1.7l2.5-.4c1.2-.2 1.8-1 1.8-2.2C14.2 4.4 11.4 1.8 8 1.8z"/><circle cx="5" cy="6" r=".8" fill="currentColor" stroke="none"/><circle cx="8.4" cy="4.6" r=".8" fill="currentColor" stroke="none"/><circle cx="11" cy="7" r=".8" fill="currentColor" stroke="none"/></svg>`,
  narrative_guidance: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M3 3.5A2.5 2.5 0 0 1 5.5 6c0 2.6-1.4 4.6-3.5 5.6l-.6-1c1.2-.7 2-1.6 2.3-2.7A2.5 2.5 0 1 1 3 3.5zm7 0A2.5 2.5 0 0 1 12.5 6c0 2.6-1.4 4.6-3.5 5.6l-.6-1c1.2-.7 2-1.6 2.3-2.7A2.5 2.5 0 1 1 10 3.5z"/></svg>`,
};

const chartTypeIcons = {
  line: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 15 7 8 12 11 18 4"/></svg>`,
  multi_line: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 16 7 9 12 12 18 5"/><polyline points="2 11 7 4 12 7 18 2" opacity="0.45"/></svg>`,
  bar: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="10" width="3.6" height="8" rx="0.8"/><rect x="8.2" y="5" width="3.6" height="13" rx="0.8"/><rect x="13.4" y="8" width="3.6" height="10" rx="0.8"/></svg>`,
  stacked_bar: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="11" width="3.6" height="7" rx="0.8"/><rect x="3" y="7" width="3.6" height="3.2" rx="0.8" opacity="0.45"/><rect x="8.2" y="9" width="3.6" height="9" rx="0.8"/><rect x="8.2" y="4" width="3.6" height="4.2" rx="0.8" opacity="0.45"/><rect x="13.4" y="12" width="3.6" height="6" rx="0.8"/><rect x="13.4" y="8.5" width="3.6" height="2.7" rx="0.8" opacity="0.45"/></svg>`,
  area: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 16 7 8l5 3 6-7v12H2z" fill="currentColor" opacity="0.3" stroke="none"/><polyline points="2 16 7 8 12 11 18 4" stroke-linecap="round"/></svg>`,
  stacked_area: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 17 7 12l5 2 6-5v8H2z" opacity="0.35"/><path d="M2 13 7 7l5 2 6-6v7l-6 4-5-2-5 4z" opacity="0.7"/></svg>`,
  scatter: `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4" cy="14" r="1.6"/><circle cx="8" cy="9" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="15" cy="5" r="1.6"/><circle cx="17" cy="9" r="1.6" opacity="0.55"/></svg>`,
  map: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5 7.5 3l5 2L17 3.5v11L12.5 17l-5-2L3 16.5v-11z"/><path d="M7.5 3v12M12.5 5v12" opacity="0.5"/></svg>`,
  heatmap: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="4.2" height="4.2" rx="0.8"/><rect x="7.9" y="3" width="4.2" height="4.2" rx="0.8" opacity="0.55"/><rect x="12.8" y="3" width="4.2" height="4.2" rx="0.8" opacity="0.25"/><rect x="3" y="7.9" width="4.2" height="4.2" rx="0.8" opacity="0.4"/><rect x="7.9" y="7.9" width="4.2" height="4.2" rx="0.8"/><rect x="12.8" y="7.9" width="4.2" height="4.2" rx="0.8" opacity="0.65"/><rect x="3" y="12.8" width="4.2" height="4.2" rx="0.8" opacity="0.2"/><rect x="7.9" y="12.8" width="4.2" height="4.2" rx="0.8" opacity="0.5"/><rect x="12.8" y="12.8" width="4.2" height="4.2" rx="0.8"/></svg>`,
  pictogram: `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="6" cy="4.5" r="2"/><path d="M3.5 8h5A1.5 1.5 0 0 1 10 9.5V13H8.5v4h-5v-4H2V9.5A1.5 1.5 0 0 1 3.5 8z"/><circle cx="14.5" cy="4.5" r="2" opacity="0.45"/><path d="M12 8h5a1.5 1.5 0 0 1 1.5 1.5V13H17v4h-5v-4h-1.5V9.5A1.5 1.5 0 0 1 12 8z" opacity="0.45"/></svg>`,
  table: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><line x1="2.5" y1="8" x2="17.5" y2="8"/><line x1="2.5" y1="12.2" x2="17.5" y2="12.2"/><line x1="8.5" y1="3.5" x2="8.5" y2="16.5"/></svg>`,
  diagram: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="4" r="2.2"/><circle cx="4.5" cy="15" r="2.2"/><circle cx="15.5" cy="15" r="2.2"/><line x1="8.9" y1="6" x2="5.6" y2="13"/><line x1="11.1" y1="6" x2="14.4" y2="13"/></svg>`,
  timeline: `<svg viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="10" x2="18" y2="10" fill="none"/><circle cx="5" cy="10" r="1.7" stroke="none"/><circle cx="10" cy="10" r="1.7" stroke="none"/><circle cx="15" cy="10" r="1.7" stroke="none"/></svg>`,
  combination: `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="10" width="3.4" height="8" rx="0.8" opacity="0.45"/><rect x="8.3" y="7" width="3.4" height="11" rx="0.8" opacity="0.45"/><rect x="13.6" y="11" width="3.4" height="7" rx="0.8" opacity="0.45"/><polyline points="3 8 9 4 16 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  other: `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="15.5" cy="10" r="1.6"/></svg>`,
};

function renderCodebook() {
  elements.sectionRoot.innerHTML = "";
  codebookSections.forEach((section) => {
    const fragment = elements.optionGroupTemplate.content.cloneNode(true);
    const sectionNode = fragment.querySelector(".code-section");
    sectionNode.dataset.section = section.key;
    const titleNode = fragment.querySelector(".section-title");
    titleNode.textContent = section.title;
    if (sectionIcons[section.key]) {
      const iconWrap = document.createElement("span");
      iconWrap.className = "section-icon";
      iconWrap.innerHTML = sectionIcons[section.key];
      titleNode.prepend(iconWrap);
    }
    const progressBadge = document.createElement("span");
    progressBadge.className = "section-progress";
    progressBadge.dataset.sectionKey = section.key;
    progressBadge.textContent = `0 / ${section.fields.length}`;
    titleNode.appendChild(progressBadge);
    fragment.querySelector(".section-copy").textContent = section.description;
    const fieldGroups = fragment.querySelector(".field-groups");

    section.fields.forEach((field) => {
      const fieldFragment = elements.fieldCardTemplate.content.cloneNode(true);
      const fieldCard = fieldFragment.querySelector(".field-card");
      fieldCard.dataset.fieldId = field.id;
      const labelNode = fieldFragment.querySelector(".field-card-label");
      labelNode.textContent = field.label;
      const helpNode = fieldFragment.querySelector(".field-card-help");
      if (field.help || field.optionHelp) {
        labelNode.classList.add("has-info");
        labelNode.tabIndex = 0;
        const popover = document.createElement("div");
        popover.className = "field-info-popover";
        if (field.help) {
          const helpText = document.createElement("p");
          helpText.className = "field-info-help";
          helpText.textContent = field.help;
          popover.appendChild(helpText);
        }
        if (field.optionHelp) {
          popover.appendChild(buildOptionDefinitions(field));
        }
        helpNode.replaceWith(popover);
        labelNode.addEventListener("pointerenter", () => positionFieldInfoPopover(labelNode, popover));
        labelNode.addEventListener("focus", () => positionFieldInfoPopover(labelNode, popover));
      } else {
        helpNode.remove();
      }
      const chipGroup = fieldFragment.querySelector(".chip-group");
      const renderOptions = field.options.slice();
      if (!renderOptions.includes("unclear")) renderOptions.push("unclear");
      renderOptions.forEach((option) => {
        const help = option === "unclear"
          ? unclearOptionHelp
          : field.optionHelp?.[option] || "";
        chipGroup.appendChild(makeChip(field, option, chipLabelForOption(option), help));
      });
      chipGroup.addEventListener("change", (event) => {
        applyChipExclusivity(event, field);
        syncFieldSelectionStyling(fieldCard, field);
        syncFieldExtraInputs(fieldCard, field);
        updateSectionProgress(section);
      });
      if (field.extraInputs?.length) {
        const extraGroup = document.createElement("div");
        extraGroup.className = "field-extra-grid";
        field.extraInputs.forEach((extraInput) => {
          const extraLabel = document.createElement("label");
          extraLabel.className = `field field-extra${extraInput.type === "number" ? " field-extra-number" : ""}${extraInput.type === "chartType" ? " field-extra-wide" : ""}`;
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
  buildSectionRail();
}

/* ─── section rail: jump dots + scroll-spy on the sheet's left edge ─── */

function railTokenPrefixForSection(section) {
  return section.key.split("_")[0];
}

function buildSectionRail() {
  const rail = document.getElementById("sectionRail");
  if (!rail) return;
  rail.innerHTML = `<div class="rail-dots"></div>`;
  const wrap = rail.querySelector(".rail-dots");
  codebookSections.forEach((section) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "rail-dot";
    dot.dataset.sectionKey = section.key;
    dot.style.setProperty("--dot-color", `var(--section-${railTokenPrefixForSection(section)}-accent)`);
    dot.title = `${section.title} · 0 / ${section.fields.length}`;
    dot.setAttribute("aria-label", `Jump to ${section.title}`);
    dot.addEventListener("click", () => {
      document.querySelector(`.code-section[data-section="${section.key}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(dot);
  });
  updateActiveRailDot();
}

function updateActiveRailDot() {
  const container = document.querySelector(".right-column");
  const dots = document.querySelectorAll(".rail-dot");
  if (!container || !dots.length) return;
  const containerRect = container.getBoundingClientRect();
  const probe = containerRect.top + containerRect.height * 0.35;
  let activeKey = codebookSections[0]?.key || "";
  codebookSections.forEach((section) => {
    const node = document.querySelector(`.code-section[data-section="${section.key}"]`);
    if (node && node.getBoundingClientRect().top <= probe) {
      activeKey = section.key;
    }
  });
  dots.forEach((dot) => dot.classList.toggle("active", dot.dataset.sectionKey === activeKey));
}

// Flip the popover above the label when there is not enough room below it in
// the viewport, so it is never clipped by the scroll container's bottom edge.
function positionFieldInfoPopover(labelNode, popover) {
  const labelRect = labelNode.getBoundingClientRect();
  const popoverHeight = popover.offsetHeight;
  const spaceBelow = window.innerHeight - labelRect.bottom;
  const openAbove = spaceBelow < popoverHeight + 24 && labelRect.top > popoverHeight + 24;
  popover.classList.toggle("above", openAbove);
}

function buildOptionDefinitions(field) {
  const list = document.createElement("dl");
  list.className = "option-defs-list";
  field.options.forEach((option) => {
    const definition = field.optionHelp?.[option];
    if (!definition) return;
    const term = document.createElement("dt");
    term.textContent = chipLabelForOption(option);
    const description = document.createElement("dd");
    description.textContent = definition;
    list.appendChild(term);
    list.appendChild(description);
  });
  const unclearTerm = document.createElement("dt");
  unclearTerm.textContent = "Unclear";
  const unclearDescription = document.createElement("dd");
  unclearDescription.textContent = unclearOptionHelp;
  list.appendChild(unclearTerm);
  list.appendChild(unclearDescription);
  return list;
}

function chipLabelForOption(value) {
  if (value === "not_applicable") return "N/A";
  return prettifyOption(value);
}

function makeChip(field, optionValue, optionLabel, optionHelp) {
  const wrapper = document.createElement("div");
  wrapper.className = "chip-option";
  if (specialValueChips.has(optionValue)) wrapper.classList.add("chip-muted");
  const inputId = `${field.id}__${optionValue}`;
  const inputType = field.multiSelect ? "checkbox" : "radio";
  const icon = optionChipIcons[optionValue] || "";
  wrapper.innerHTML = `
    <input type="${inputType}" name="${field.id}" id="${inputId}" value="${optionValue}">
    <label for="${inputId}"${optionHelp ? ` title="${escapeHtml(optionHelp)}"` : ""}>${icon}${optionLabel}</label>
  `;
  if (!field.multiSelect) {
    const input = wrapper.querySelector("input");
    wrapper.addEventListener("pointerdown", () => {
      wrapper.dataset.wasChecked = input.checked ? "1" : "";
    });
    input.addEventListener("click", () => {
      if (wrapper.dataset.wasChecked === "1") {
        input.checked = false;
        wrapper.dataset.wasChecked = "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  return wrapper;
}

function getExclusiveOptions(field) {
  return new Set(["not_applicable", "unclear", ...(field.exclusiveOptions || [])]);
}

function applyChipExclusivity(event, field) {
  if (!field.multiSelect) return;
  const changedInput = event.target;
  if (!(changedInput instanceof HTMLInputElement) || !changedInput.checked) return;
  const exclusives = getExclusiveOptions(field);
  const inputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]`));
  if (exclusives.has(changedInput.value)) {
    inputs.forEach((input) => {
      if (input !== changedInput) input.checked = false;
    });
    return;
  }
  inputs.forEach((input) => {
    if (exclusives.has(input.value)) input.checked = false;
  });
}

function syncFieldSelectionStyling(fieldCard, field) {
  const value = getFieldValue(field);
  fieldCard.classList.toggle("not-applicable-selected", value === "not_applicable" || value === "unclear");
}

function updateSectionProgress(section) {
  const badge = document.querySelector(`.section-progress[data-section-key="${section.key}"]`);
  if (!badge) return;
  const coded = section.fields.filter((field) => getFieldValue(field) !== "").length;
  badge.textContent = `${coded} / ${section.fields.length}`;
  badge.classList.toggle("complete", coded === section.fields.length);
  const dot = document.querySelector(`.rail-dot[data-section-key="${section.key}"]`);
  if (dot) {
    dot.classList.toggle("complete", coded === section.fields.length);
    dot.title = `${section.title} · ${coded} / ${section.fields.length}`;
  }
}

function makeExtraInputLabel(extraInput) {
  const labelText = document.createElement("span");
  labelText.textContent = extraInput.label;
  return labelText;
}

function makeChartTypePicker(field, extraInput) {
  const wrapper = document.createElement("div");
  wrapper.className = "chart-type-picker";
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.id = extraInput.id;
  hidden.dataset.parentField = field.id;
  hidden.dataset.showWhen = (extraInput.showWhen || []).join("|");
  hidden.dataset.requiredWhen = (extraInput.requiredWhen || []).join("|");
  wrapper.appendChild(hidden);
  const grid = document.createElement("div");
  grid.className = "chart-type-grid";
  (extraInput.options || []).forEach((optionValue) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-type-option";
    button.dataset.value = optionValue;
    button.title = prettifyOption(optionValue);
    button.innerHTML = `<span class="chart-type-icon">${chartTypeIcons[optionValue] || chartTypeIcons.other}</span><span class="chart-type-label">${prettifyOption(optionValue)}</span>`;
    button.addEventListener("click", () => {
      hidden.value = hidden.value === optionValue ? "" : optionValue;
      syncChartTypePickerUi(hidden);
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    });
    grid.appendChild(button);
  });
  wrapper.appendChild(grid);
  return { wrapper, hidden };
}

function syncChartTypePickerUi(hiddenInput) {
  const wrapper = hiddenInput.closest(".chart-type-picker");
  if (!wrapper) return;
  wrapper.querySelectorAll(".chart-type-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === hiddenInput.value && hiddenInput.value !== "");
  });
}

function makeExtraInputControl(field, extraInput) {
  if (extraInput.type === "chartType") {
    return makeChartTypePicker(field, extraInput).wrapper;
  }
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
    if (extraInput.type === "chartType") syncChartTypePickerUi(input);
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
      const fieldCard = document.querySelector(`.field-card[data-field-id="${field.id}"]`);
      if (!fieldCard) return;
      syncFieldSelectionStyling(fieldCard, field);
      syncFieldExtraInputs(fieldCard, field);
    });
    updateSectionProgress(section);
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

function prettifyOption(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
