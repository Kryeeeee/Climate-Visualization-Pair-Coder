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
  elements.lightbox.classList.remove("hidden");
  elements.lightbox.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  elements.lightbox.classList.add("hidden");
  elements.lightbox.setAttribute("aria-hidden", "true");
  elements.lightboxImage.src = "";
  elements.lightboxImage.alt = "";
  elements.lightboxCaption.textContent = "";
}

function handleLightboxBackdropClick(event) {
  if (event.target === elements.lightbox) {
    closeLightbox();
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && !elements.lightbox.classList.contains("hidden")) {
    closeLightbox();
  }
}

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
