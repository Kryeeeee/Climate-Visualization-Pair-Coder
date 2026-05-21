from collections import Counter
from datetime import datetime
from pathlib import Path
import re

from PIL import Image, ImageStat
import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
NYT_OUTPUT_DIR = SCRIPT_DIR / "output" / "nytimes"

INPUT_CANDIDATES = [
    NYT_OUTPUT_DIR / "nytimes_images.csv",
    NYT_OUTPUT_DIR / "images.csv",
    NYT_OUTPUT_DIR / "images_after_filter.csv",
]

FILTERED_CSV = NYT_OUTPUT_DIR / "nytimes_images_chart_filtered.csv"
REVIEW_CSV = NYT_OUTPUT_DIR / "nytimes_images_chart_review.csv"
CANDIDATES_CSV = NYT_OUTPUT_DIR / "nytimes_images_chart_candidates.csv"
REJECTED_CSV = NYT_OUTPUT_DIR / "nytimes_images_chart_rejected.csv"
REPORT_CSV = NYT_OUTPUT_DIR / "nytimes_image_filter_report.csv"

STRONG_CHART_TERMS = [
    "chart",
    "graph",
    "graphic",
    "graphics",
    "infographic",
    "interactive",
    "map",
    "diagram",
    "table",
    "visualization",
    "visualisation",
    "tracker",
]

DATA_TERMS = [
    "temperature",
    "warming",
    "emissions",
    "carbon dioxide",
    "co2",
    "sea level",
    "greenhouse gas",
    "climate model",
    "scenario",
    "projection",
    "record",
    "ppm",
    "degrees",
    "percent",
    "source:",
]

PHOTO_TERMS = [
    "photo",
    "photograph",
    "getty",
    "reuters",
    "associated press",
    "ap photo",
    "afp",
    "epa",
    "portrait",
    "headshot",
    "slideshow",
    "video",
]

THUMBNAIL_TERMS = [
    "thumbstandard",
    "thumblarge",
    "thumbnail",
    "blogsmallthumb",
]


def find_input_csv():
    for path in INPUT_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Could not find a NYT image CSV. Expected one of: "
        + ", ".join(str(path) for path in INPUT_CANDIDATES)
    )


def normalize_text(*values):
    return " ".join(str(value) for value in values if pd.notna(value)).lower()


def contains_term(text, term):
    if re.search(r"[a-z0-9]", term):
        escaped = re.escape(term).replace(r"\ ", r"\s+")
        return bool(re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text))
    return term in text


def term_hits(text, terms):
    return sorted({term for term in terms if contains_term(text, term)})


def has_quantitative_signal(text):
    return bool(re.search(r"(%|°|\bppm\b|\b\d+(?:\.\d+)?\s?(?:c|f|percent|degrees?)\b)", text))


def resolve_local_image_path(value):
    if pd.isna(value) or not str(value).strip():
        return None

    path = Path(str(value).strip())
    if path.is_absolute():
        return path

    candidates = [
        (SCRIPT_DIR / path).resolve(),
        (PROJECT_DIR / path).resolve(),
        (PROJECT_DIR / "Codebook" / path).resolve(),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def image_heuristics(path):
    if not path or not path.exists():
        return 0.0, ["image_missing"]

    reasons = []
    score = 0.0

    try:
        with Image.open(path) as image:
            image = image.convert("RGB")
            width, height = image.size
            if width < 260 or height < 150:
                score -= 1.5
                reasons.append("small_image")

            ratio = width / max(height, 1)
            if ratio > 2.6 or ratio < 0.35:
                score -= 0.5
                reasons.append("extreme_aspect_ratio")

            sample = image.copy()
            sample.thumbnail((180, 180))
            pixels = list(sample.getdata())
            pixel_count = max(len(pixels), 1)
            light_fraction = sum(1 for r, g, b in pixels if r > 235 and g > 235 and b > 235) / pixel_count
            dark_fraction = sum(1 for r, g, b in pixels if r < 70 and g < 70 and b < 70) / pixel_count
            unique_fraction = len(set(pixels)) / pixel_count
            channel_std = sum(ImageStat.Stat(sample).stddev) / 3

            if light_fraction > 0.35 and 0.005 <= dark_fraction <= 0.22:
                score += 1.5
                reasons.append("chart_like_light_background")
            if light_fraction > 0.55:
                score += 0.5
                reasons.append("large_white_space")
            if unique_fraction > 0.55 and light_fraction < 0.25 and channel_std > 45:
                score -= 2.0
                reasons.append("photo_like_color_variation")
            if dark_fraction > 0.35 and unique_fraction > 0.35:
                score -= 1.0
                reasons.append("photo_like_dark_texture")
    except Exception as exc:
        score -= 0.5
        reasons.append(f"image_read_error:{type(exc).__name__}")

    return score, reasons


def score_row(row):
    metadata_text = normalize_text(
        row.get("image_url", ""),
        row.get("local_image_path", ""),
        row.get("caption", ""),
        row.get("credit", ""),
        row.get("article_title", ""),
        row.get("search_term", ""),
    )
    image_url_text = normalize_text(row.get("image_url", ""), row.get("local_image_path", ""))
    caption_text = normalize_text(row.get("caption", ""), row.get("credit", ""))
    title_text = normalize_text(row.get("article_title", ""), row.get("search_term", ""))

    score = 0.0
    reasons = []

    url_chart_hits = term_hits(image_url_text, STRONG_CHART_TERMS)
    caption_chart_hits = term_hits(caption_text, STRONG_CHART_TERMS)
    title_chart_hits = term_hits(title_text, STRONG_CHART_TERMS)
    data_hits = term_hits(metadata_text, DATA_TERMS)
    photo_hits = term_hits(metadata_text, PHOTO_TERMS)
    thumbnail_hits = term_hits(image_url_text, THUMBNAIL_TERMS)

    if url_chart_hits or caption_chart_hits:
        score += 4.0
        reasons.append("strong_chart_metadata:" + "|".join(url_chart_hits + caption_chart_hits))
    if title_chart_hits:
        score += 1.5
        reasons.append("chart_article_title:" + "|".join(title_chart_hits))
    if data_hits:
        score += min(2.5, len(data_hits) * 0.7)
        reasons.append("climate_data_terms:" + "|".join(data_hits))
    if has_quantitative_signal(metadata_text):
        score += 1.0
        reasons.append("quantitative_signal")
    if photo_hits and not (url_chart_hits or caption_chart_hits):
        score -= 4.0
        reasons.append("photo_metadata:" + "|".join(photo_hits))
    if thumbnail_hits:
        score -= 1.0
        reasons.append("thumbnail_variant:" + "|".join(thumbnail_hits))

    image_score, image_reasons = image_heuristics(resolve_local_image_path(row.get("local_image_path", "")))
    score += image_score
    reasons.extend(image_reasons)

    if score >= 4.0:
        decision = "keep"
    elif score >= 2.0:
        decision = "review"
    else:
        decision = "reject"

    return pd.Series(
        {
            "filter_score": round(score, 2),
            "filter_decision": decision,
            "filter_reasons": "; ".join(reasons),
        }
    )


def safe_to_csv(df, path):
    try:
        df.to_csv(path, index=False, encoding="utf-8-sig")
        return path
    except PermissionError:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        fallback = path.with_name(f"{path.stem}_{timestamp}{path.suffix}")
        df.to_csv(fallback, index=False, encoding="utf-8-sig")
        print(f"[WARN] Could not write {path}. It may be open in another app. Wrote {fallback} instead.")
        return fallback


def main():
    input_csv = find_input_csv()
    df = pd.read_csv(input_csv, encoding="utf-8-sig")
    scored = pd.concat([df, df.apply(score_row, axis=1)], axis=1)

    filtered = scored[scored["filter_decision"] == "keep"].copy()
    review = scored[scored["filter_decision"] == "review"].copy()
    candidates = scored[scored["filter_decision"].isin(["keep", "review"])].copy()
    rejected = scored[scored["filter_decision"] == "reject"].copy()

    filtered_csv = safe_to_csv(filtered, FILTERED_CSV)
    review_csv = safe_to_csv(review, REVIEW_CSV)
    candidates_csv = safe_to_csv(candidates, CANDIDATES_CSV)
    rejected_csv = safe_to_csv(rejected, REJECTED_CSV)

    reason_counter = Counter()
    for reasons in scored["filter_reasons"].fillna(""):
        for reason in str(reasons).split("; "):
            if reason:
                reason_counter[reason.split(":")[0]] += 1

    report_rows = [
        {"metric": "input_csv", "value": str(input_csv)},
        {"metric": "total_rows", "value": len(scored)},
        {"metric": "keep_rows", "value": len(filtered)},
        {"metric": "review_rows", "value": len(review)},
        {"metric": "candidate_rows", "value": len(candidates)},
        {"metric": "reject_rows", "value": len(rejected)},
    ]
    report_rows.extend(
        {"metric": f"reason:{reason}", "value": count}
        for reason, count in reason_counter.most_common()
    )
    report_csv = safe_to_csv(pd.DataFrame(report_rows), REPORT_CSV)

    print(f"[DONE] Input: {input_csv}")
    print(
        f"[COUNT] total={len(scored)} keep={len(filtered)} "
        f"review={len(review)} candidates={len(candidates)} reject={len(rejected)}"
    )
    print(f"[DONE] Saved high-confidence chart candidates to {filtered_csv}")
    print(f"[DONE] Saved review candidates to {review_csv}")
    print(f"[DONE] Saved combined chart candidates to {candidates_csv}")
    print(f"[DONE] Saved rejected rows to {rejected_csv}")
    print(f"[DONE] Saved filter report to {report_csv}")


if __name__ == "__main__":
    main()
