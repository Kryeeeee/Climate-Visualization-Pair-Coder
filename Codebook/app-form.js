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
    const wrapper = radio.closest(".chip-option");
    wrapper.addEventListener("pointerdown", () => {
      wrapper.dataset.wasChecked = radio.checked ? "1" : "";
    });
    radio.addEventListener("click", () => {
      if (wrapper.dataset.wasChecked === "1") {
        radio.checked = false;
        wrapper.dataset.wasChecked = "";
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    radio.addEventListener("change", () => {
      const hidden = document.getElementById("coding_confidence");
      if (hidden) hidden.value = getRadioValue("coding_confidence_chip");
    });
  });
}

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function getFieldValue(field) {
  if (!field.multiSelect) {
    return getRadioValue(field.id);
  }
  return getFieldValues(field).filter(Boolean).join("|");
}

function getFieldValues(field) {
  const checkedInputs = Array.from(document.querySelectorAll(`input[name="${field.id}"]:checked`));
  return checkedInputs.map((input) => input.value);
}

function restoreFieldSelection(field, value) {
  const values = String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  document.querySelectorAll(`input[name="${field.id}"]`).forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

/* ─── dirty-state tracking ─── */

function collectFormSnapshot() {
  const data = {};
  metadataFields.forEach((fieldId) => {
    if (fieldId === "record_id" || fieldId === "coder_name") return;
    data[fieldId] = getFormValue(fieldId);
  });
  codebookSections.forEach((section) => {
    section.fields.forEach((field) => {
      data[field.id] = getFieldValue(field);
      field.extraInputs?.forEach((extraInput) => {
        data[extraInput.id] = getFormValue(extraInput.id);
      });
    });
  });
  data.__source_image = currentFiles.source_image?.name || "";
  return JSON.stringify(data);
}

function markFormClean() {
  formCleanSnapshot = collectFormSnapshot();
  updateSaveStatus();
}

function updateSaveStatus() {
  const chip = document.getElementById("saveStatusChip");
  const label = document.getElementById("saveStatusLabel");
  if (!chip || !label) return;
  const dirty = isFormDirty();
  chip.dataset.state = dirty ? "dirty" : "clean";
  label.textContent = dirty ? "Unsaved changes" : "Saved";
}

function isFormDirty() {
  return collectFormSnapshot() !== formCleanSnapshot;
}

function confirmDiscardIfDirty() {
  if (!isFormDirty()) return true;
  return confirm("You have unsaved coding on this pair. Discard the changes?");
}

/* ─── record id ─── */

function buildRecordId() {
  const sourceOrganization = slugify(getFormValue("source_organization") || "source");
  const figureId = slugify(getFormValue("source_figure_id") || "figure");
  const outlet = slugify(getFormValue("media_outlet") || "outlet");
  const date = (getFormValue("media_publication_date") || "undated").replaceAll("-", "");
  const mediaFilename = extractFilename(currentMediaRow?.local_image_path || currentFiles.media_image?.name || "");
  const imagePart = mediaFilename ? `__${slugify(mediaFilename)}` : "";
  return `${sourceOrganization}__${figureId}__${outlet}__${date}${imagePart}`;
}

function updateRecordId() {
  elements.recordIdInput.value = buildRecordId();
  syncIpccFieldsVisibility();
}

function isIpccSource() {
  return /ipcc/i.test(getFormValue("source_organization"));
}

// The IPCC report/working-group fields only make sense for IPCC figures, so
// they stay hidden for every other source organization. Values are kept while
// hidden (typing "IP" mid-word must not wipe them) and blanked at save time.
function syncIpccFieldsVisibility() {
  const show = isIpccSource();
  elements.ipccReportField?.classList.toggle("hidden", !show);
  elements.ipccWorkingGroupField?.classList.toggle("hidden", !show);
}

function generateSourceFigureId() {
  const sourceOrganization = slugify(getFormValue("source_organization") || "source");
  const outlet = slugify(getFormValue("media_outlet") || "outlet");
  const date = (getFormValue("media_publication_date") || "undated").replaceAll("-", "");
  const filename = slugify(extractFilename(currentMediaRow?.local_image_path || currentFiles.media_image?.name || "figure"));
  elements.sourceFigureInput.value = `${sourceOrganization}_${outlet}_${date}_${filename}`;
  updateRecordId();
}

function initComboboxes() {
  document.querySelectorAll(".combobox").forEach((container) => {
    const input = container.querySelector("input");
    const toggle = container.querySelector(".combobox-arrow");
    const list = container.querySelector(".combobox-dropdown");
    const options = (container.dataset.options || "").split("|").filter(Boolean);
    let activeIndex = -1;

    function buildList(filter) {
      const lower = (filter || "").trim().toLowerCase();
      const filtered = lower ? options.filter((o) => o.toLowerCase().includes(lower)) : options;
      list.innerHTML = "";
      activeIndex = -1;
      filtered.forEach((opt) => {
        const li = document.createElement("li");
        li.textContent = opt;
        li.dataset.value = opt;
        li.setAttribute("role", "option");
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = opt;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          closeList();
        });
        list.appendChild(li);
      });
      list.hidden = !filtered.length;
    }

    function openList() {
      if (input.disabled) return;
      buildList(input.value);
    }

    function closeList() {
      list.hidden = true;
      activeIndex = -1;
    }

    function setActive(index) {
      const items = Array.from(list.querySelectorAll("li"));
      activeIndex = Math.max(-1, Math.min(index, items.length - 1));
      items.forEach((li, i) => li.classList.toggle("is-active", i === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("focus", openList);
    input.addEventListener("input", () => buildList(input.value));
    input.addEventListener("blur", () => setTimeout(closeList, 150));
    input.addEventListener("keydown", (e) => {
      if (list.hidden) { if (e.key === "ArrowDown") openList(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const items = Array.from(list.querySelectorAll("li"));
        if (items[activeIndex]) {
          input.value = items[activeIndex].dataset.value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        closeList();
      } else if (e.key === "Escape") {
        closeList();
      }
    });

    toggle.addEventListener("mousedown", (e) => e.preventDefault());
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (input.disabled) return;
      if (!list.hidden) { closeList(); input.focus(); return; }
      openList();
      input.focus();
    });
  });
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
