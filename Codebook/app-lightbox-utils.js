function handlePreviewClick(event) {
  const trigger = event.target.closest(".preview-trigger");
  if (!trigger) return;
  openLightbox(trigger.dataset.previewSrc || "", trigger.dataset.previewCaption || "");
}

function openLightbox(src, caption) {
  if (!src) return;
  elements.lightboxImage.src = src;
  elements.lightboxImage.alt = caption || "Expanded image preview";
  elements.lightboxCaption.textContent = caption || "";
  elements.lightboxFigureB.classList.add("hidden");
  elements.lightbox.classList.remove("compare");
  elements.lightbox.classList.remove("hidden");
  elements.lightbox.setAttribute("aria-hidden", "false");
}

function openCompareLightbox() {
  const mediaImg = elements.mediaPreview.querySelector(".preview-trigger img");
  const sourceImg = elements.sourcePreview.querySelector(".preview-trigger img");
  if (!mediaImg || !sourceImg) {
    showToast("Load both the media adaptation and the original figure to compare them side by side.", "info");
    return;
  }
  elements.lightboxImage.src = mediaImg.src;
  elements.lightboxImage.alt = mediaImg.alt || "Media adaptation";
  elements.lightboxCaption.textContent = `Media adaptation — ${mediaImg.alt || ""}`;
  elements.lightboxImageB.src = sourceImg.src;
  elements.lightboxImageB.alt = sourceImg.alt || "Original scientific figure";
  elements.lightboxCaptionB.textContent = `Original figure — ${sourceImg.alt || ""}`;
  elements.lightboxFigureB.classList.remove("hidden");
  elements.lightbox.classList.add("compare");
  elements.lightbox.classList.remove("hidden");
  elements.lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  elements.lightbox.classList.add("hidden");
  elements.lightbox.classList.remove("compare");
  elements.lightbox.setAttribute("aria-hidden", "true");
  elements.lightboxImage.src = "";
  elements.lightboxImage.alt = "";
  elements.lightboxCaption.textContent = "";
  elements.lightboxImageB.src = "";
  elements.lightboxImageB.alt = "";
  elements.lightboxCaptionB.textContent = "";
  elements.lightboxFigureB.classList.add("hidden");
}

function handleLightboxBackdropClick(event) {
  if (event.target === elements.lightbox) {
    closeLightbox();
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && !elements.lightbox.classList.contains("hidden")) {
    closeLightbox();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCurrentRecord({ moveNextAfterSave: true });
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable)) return;
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    if (getNavigableRows().length) {
      moveMediaSelection(direction);
    } else if (importedMediaImageFileList.length) {
      moveImportedMediaFileSelection(direction);
    } else {
      return;
    }
    event.preventDefault();
  }
}

/* ─── toasts ─── */

function showToast(message, type = "info", duration) {
  const root = elements.toastRoot;
  if (!root) {
    alert(message);
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  root.appendChild(toast);
  const lifetime = duration || (type === "error" ? 6000 : 3200);
  setTimeout(() => {
    toast.classList.add("toast--leaving");
    setTimeout(() => toast.remove(), 250);
  }, lifetime);
}

/* ─── small shared utils ─── */

function extractFilename(filePath) {
  if (!filePath) return "";
  const segments = filePath.split(/[\\/]/);
  return segments[segments.length - 1] || "";
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
