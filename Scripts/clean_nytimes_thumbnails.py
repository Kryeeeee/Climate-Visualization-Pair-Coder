from datetime import datetime
from pathlib import Path
import shutil
import re

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
NYT_OUTPUT_DIR = SCRIPT_DIR / "output" / "nytimes"
IMAGE_DIR = NYT_OUTPUT_DIR / "nytimes_images"

THUMBNAIL_PATTERN = re.compile(
    r"(?:thumbstandard|thumblarge|thumbnail|smallthumb|blogsmallthumb|thumb)",
    flags=re.IGNORECASE,
)


def is_thumbnail_url(value):
    if pd.isna(value):
        return False
    return bool(THUMBNAIL_PATTERN.search(str(value)))


def resolve_local_image_path(value):
    if pd.isna(value) or not str(value).strip():
        return None

    path = Path(str(value).strip())
    if path.is_absolute():
        return path

    candidates = [
        (SCRIPT_DIR / path).resolve(),
        (SCRIPT_DIR.parent / path).resolve(),
        (SCRIPT_DIR.parent / "Codebook" / path).resolve(),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def safe_to_csv(df, path):
    df.to_csv(path, index=False, encoding="utf-8-sig")


def main():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_backup_dir = NYT_OUTPUT_DIR / f"csv_backups_before_thumbnail_cleanup_{timestamp}"
    image_backup_dir = NYT_OUTPUT_DIR / f"removed_thumbnail_images_{timestamp}"
    csv_backup_dir.mkdir(parents=True, exist_ok=True)
    image_backup_dir.mkdir(parents=True, exist_ok=True)

    csv_paths = sorted(path for path in NYT_OUTPUT_DIR.glob("*.csv") if path.name != "nytimes_thumbnail_cleanup_report.csv")
    rows_removed_by_csv = []
    thumbnail_image_paths = set()

    for csv_path in csv_paths:
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig")
        except Exception as exc:
            rows_removed_by_csv.append(
                {
                    "file": csv_path.name,
                    "before_rows": "",
                    "removed_rows": "",
                    "after_rows": "",
                    "note": f"read_error:{type(exc).__name__}",
                }
            )
            continue

        if "image_url" not in df.columns:
            rows_removed_by_csv.append(
                {
                    "file": csv_path.name,
                    "before_rows": len(df),
                    "removed_rows": 0,
                    "after_rows": len(df),
                    "note": "no image_url column",
                }
            )
            continue

        thumbnail_mask = df["image_url"].apply(is_thumbnail_url)
        removed_rows = int(thumbnail_mask.sum())
        if removed_rows:
            shutil.copy2(csv_path, csv_backup_dir / csv_path.name)
            if "local_image_path" in df.columns:
                for value in df.loc[thumbnail_mask, "local_image_path"]:
                    local_path = resolve_local_image_path(value)
                    if local_path and local_path.exists() and local_path.is_file():
                        thumbnail_image_paths.add(local_path)

            cleaned = df.loc[~thumbnail_mask].copy()
            safe_to_csv(cleaned, csv_path)
        else:
            cleaned = df

        rows_removed_by_csv.append(
            {
                "file": csv_path.name,
                "before_rows": len(df),
                "removed_rows": removed_rows,
                "after_rows": len(cleaned),
                "note": "",
            }
        )

    moved_images = 0
    missing_images = 0
    moved_image_rows = []
    for image_path in sorted(thumbnail_image_paths):
        if not image_path.exists():
            missing_images += 1
            continue

        destination = image_backup_dir / image_path.name
        suffix_counter = 1
        while destination.exists():
            destination = image_backup_dir / f"{image_path.stem}_{suffix_counter}{image_path.suffix}"
            suffix_counter += 1

        shutil.move(str(image_path), str(destination))
        moved_images += 1
        moved_image_rows.append(
            {
                "original_path": str(image_path),
                "backup_path": str(destination),
            }
        )

    report_rows = [
        {"metric": "csv_backup_dir", "value": str(csv_backup_dir)},
        {"metric": "image_backup_dir", "value": str(image_backup_dir)},
        {"metric": "thumbnail_image_files_moved", "value": moved_images},
        {"metric": "thumbnail_image_files_missing", "value": missing_images},
    ]
    for row in rows_removed_by_csv:
        report_rows.append({"metric": f"csv:{row['file']}:before_rows", "value": row["before_rows"]})
        report_rows.append({"metric": f"csv:{row['file']}:removed_rows", "value": row["removed_rows"]})
        report_rows.append({"metric": f"csv:{row['file']}:after_rows", "value": row["after_rows"]})
        if row["note"]:
            report_rows.append({"metric": f"csv:{row['file']}:note", "value": row["note"]})

    report_path = NYT_OUTPUT_DIR / "nytimes_thumbnail_cleanup_report.csv"
    pd.DataFrame(report_rows).to_csv(report_path, index=False, encoding="utf-8-sig")

    moved_manifest_path = NYT_OUTPUT_DIR / "nytimes_removed_thumbnail_images.csv"
    pd.DataFrame(moved_image_rows).to_csv(moved_manifest_path, index=False, encoding="utf-8-sig")

    print(f"[DONE] CSV backups saved to {csv_backup_dir}")
    print(f"[DONE] Removed thumbnail images moved to {image_backup_dir}")
    print(f"[COUNT] moved_images={moved_images} missing_images={missing_images}")
    for row in rows_removed_by_csv:
        print(
            f"[CSV] {row['file']} | before={row['before_rows']} | "
            f"removed={row['removed_rows']} | after={row['after_rows']}"
        )
    print(f"[DONE] Cleanup report saved to {report_path}")
    print(f"[DONE] Moved-image manifest saved to {moved_manifest_path}")


if __name__ == "__main__":
    main()
