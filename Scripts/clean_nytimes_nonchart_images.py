from datetime import datetime
from pathlib import Path
import shutil

import pandas as pd

from filter_nytimes_images import score_row, safe_to_csv, resolve_local_image_path


SCRIPT_DIR = Path(__file__).resolve().parent
NYT_OUTPUT_DIR = SCRIPT_DIR / "output" / "nytimes"

CANDIDATE_CSV = NYT_OUTPUT_DIR / "nytimes_images.csv"
REJECTED_CSV = NYT_OUTPUT_DIR / "nytimes_images_chart_rejected.csv"
ARTICLES_CSV = NYT_OUTPUT_DIR / "articles.csv"
IMAGES_BEFORE_CSV = NYT_OUTPUT_DIR / "images_before_filter.csv"
REPORT_CSV = NYT_OUTPUT_DIR / "nytimes_image_filter_report.csv"
REMOVED_MANIFEST_CSV = NYT_OUTPUT_DIR / "nytimes_removed_nonchart_images.csv"

FILTER_COLUMNS = ["filter_score", "filter_decision", "filter_reasons"]
IMAGE_KEY_COLUMNS = ["article_id", "image_url", "local_image_path"]


def read_csv_if_exists(path):
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, encoding="utf-8-sig")


def backup_csvs(paths, backup_dir):
    backup_dir.mkdir(parents=True, exist_ok=True)
    for path in paths:
        if path.exists():
            shutil.copy2(path, backup_dir / path.name)


def normalize_for_merge(df):
    for column in IMAGE_KEY_COLUMNS:
        if column not in df.columns:
            df[column] = ""
        df[column] = df[column].fillna("").astype(str)
    return df


def deduplicate_image_rows(df):
    df = normalize_for_merge(df.copy())
    sort_columns = [column for column in ["published_date", "article_id", "image_index"] if column in df.columns]
    if sort_columns:
        df = df.sort_values(sort_columns, kind="stable")
    return df.drop_duplicates(subset=IMAGE_KEY_COLUMNS, keep="first").reset_index(drop=True)


def rescore_rows(df):
    clean_df = df.drop(columns=[column for column in FILTER_COLUMNS if column in df.columns]).copy()
    scored = pd.concat([clean_df, clean_df.apply(score_row, axis=1)], axis=1)
    return scored


def move_rejected_images(rejected, backup_dir):
    backup_dir.mkdir(parents=True, exist_ok=True)
    moved_rows = []
    missing_count = 0

    for _, row in rejected.iterrows():
        image_path = resolve_local_image_path(row.get("local_image_path", ""))
        if not image_path or not image_path.exists() or not image_path.is_file():
            missing_count += 1
            continue

        destination = backup_dir / image_path.name
        suffix_counter = 1
        while destination.exists():
            destination = backup_dir / f"{image_path.stem}_{suffix_counter}{image_path.suffix}"
            suffix_counter += 1

        shutil.move(str(image_path), str(destination))
        moved_rows.append(
            {
                "article_id": row.get("article_id", ""),
                "image_url": row.get("image_url", ""),
                "original_path": str(image_path),
                "backup_path": str(destination),
                "filter_score": row.get("filter_score", ""),
                "filter_reasons": row.get("filter_reasons", ""),
            }
        )

    return moved_rows, missing_count


def update_articles_csv(candidates):
    articles_df = read_csv_if_exists(ARTICLES_CSV)
    if articles_df.empty or "article_id" not in articles_df.columns:
        return 0, 0

    counts = candidates.groupby("article_id").size().to_dict()
    before_rows = len(articles_df)
    articles_df = articles_df[articles_df["article_id"].isin(counts)].copy()
    articles_df["image_count"] = articles_df["article_id"].map(counts).fillna(0).astype(int)
    safe_to_csv(articles_df, ARTICLES_CSV)
    return before_rows, len(articles_df)


def update_images_before_filter(scored):
    before_df = read_csv_if_exists(IMAGES_BEFORE_CSV)
    if before_df.empty or "image_url" not in before_df.columns:
        return 0, 0

    kept_urls = set(scored.loc[scored["filter_decision"].isin(["keep", "review"]), "image_url"].fillna("").astype(str))
    before_rows = len(before_df)
    before_df = before_df[before_df["image_url"].fillna("").astype(str).isin(kept_urls)].copy()
    safe_to_csv(before_df, IMAGES_BEFORE_CSV)
    return before_rows, len(before_df)


def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = NYT_OUTPUT_DIR / f"csv_backups_before_nonchart_cleanup_{timestamp}"
    removed_image_dir = NYT_OUTPUT_DIR / f"removed_nonchart_images_{timestamp}"

    backup_csvs(
        [CANDIDATE_CSV, REJECTED_CSV, ARTICLES_CSV, IMAGES_BEFORE_CSV, REPORT_CSV, REMOVED_MANIFEST_CSV],
        backup_dir,
    )

    candidate_df = read_csv_if_exists(CANDIDATE_CSV)
    rejected_df = read_csv_if_exists(REJECTED_CSV)
    combined = deduplicate_image_rows(pd.concat([candidate_df, rejected_df], ignore_index=True))
    scored = rescore_rows(combined)

    candidates = scored[scored["filter_decision"].isin(["keep", "review"])].copy()
    rejected = scored[scored["filter_decision"] == "reject"].copy()

    moved_rows, missing_count = move_rejected_images(rejected, removed_image_dir)
    safe_to_csv(candidates, CANDIDATE_CSV)
    safe_to_csv(rejected, REJECTED_CSV)
    safe_to_csv(pd.DataFrame(moved_rows), REMOVED_MANIFEST_CSV)

    articles_before, articles_after = update_articles_csv(candidates)
    before_filter_rows_before, before_filter_rows_after = update_images_before_filter(scored)

    report_rows = [
        {"metric": "csv_backup_dir", "value": str(backup_dir)},
        {"metric": "removed_image_dir", "value": str(removed_image_dir)},
        {"metric": "input_rows", "value": len(combined)},
        {"metric": "candidate_rows", "value": len(candidates)},
        {"metric": "rejected_rows", "value": len(rejected)},
        {"metric": "moved_rejected_image_files", "value": len(moved_rows)},
        {"metric": "missing_rejected_image_files", "value": missing_count},
        {"metric": "articles_rows_before", "value": articles_before},
        {"metric": "articles_rows_after", "value": articles_after},
        {"metric": "images_before_filter_rows_before", "value": before_filter_rows_before},
        {"metric": "images_before_filter_rows_after", "value": before_filter_rows_after},
    ]
    safe_to_csv(pd.DataFrame(report_rows), REPORT_CSV)

    print(f"[DONE] CSV backups saved to {backup_dir}")
    print(f"[DONE] Rejected non-chart images moved to {removed_image_dir}")
    print(
        f"[COUNT] input={len(combined)} candidates={len(candidates)} "
        f"rejected={len(rejected)} moved={len(moved_rows)} missing={missing_count}"
    )
    print(f"[CSV] {CANDIDATE_CSV.name}: {len(candidates)} rows")
    print(f"[CSV] {REJECTED_CSV.name}: {len(rejected)} rows")
    print(f"[CSV] {ARTICLES_CSV.name}: {articles_before} -> {articles_after} rows")
    print(f"[CSV] {IMAGES_BEFORE_CSV.name}: {before_filter_rows_before} -> {before_filter_rows_after} rows")
    print(f"[DONE] Report saved to {REPORT_CSV}")
    print(f"[DONE] Moved-image manifest saved to {REMOVED_MANIFEST_CSV}")


if __name__ == "__main__":
    main()
