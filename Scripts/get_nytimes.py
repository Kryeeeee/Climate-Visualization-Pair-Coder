from datetime import datetime, timedelta
from pathlib import Path
import time

from climate_visualization_utils import (
    SEARCH_TERMS,
    download_article_charts,
    ensure_output_dirs,
    get_active_windows,
    make_session,
    safe_get_json,
    safe_get_text,
    sanitize_filename,
    save_outputs,
    truncate_text,
)


API_KEY = "Cj6al24ZR0XctsUl1hYKzAbnWnbLAIkZslF6Genv1wdXv5Zx"
BASE_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json"
NEWSPAPER = "The New York Times"
NEWSPAPER_SLUG = "nytimes"

MAX_PAGES = 30
NYT_MAX_PAGES_PER_SLICE = 8
NYT_SLICE_DAYS = 120
NYT_MAX_ARTICLES_PER_WINDOW_TERM = 80
NYT_PAGE_DELAY_SECONDS = 12.0
NYT_TERM_COOLDOWN_SECONDS = 30.0

ARTICLE_ROOT_SELECTORS = [
    "section[name='articleBody']",
    "section.meteredContent",
    "article",
    "main",
]


SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "output" / NEWSPAPER_SLUG
ARTICLES_CSV, IMAGES_CSV, IMAGE_DIR = ensure_output_dirs(OUTPUT_DIR)
ARTICLES_BEFORE_CSV = OUTPUT_DIR / "articles_before_filter.csv"
ARTICLES_AFTER_CSV = OUTPUT_DIR / "articles_after_filter.csv"
IMAGES_BEFORE_CSV = OUTPUT_DIR / "images_before_filter.csv"
IMAGES_AFTER_CSV = OUTPUT_DIR / "images_after_filter.csv"


def iter_date_slices(start_date, end_date, slice_days):
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    current_end = end_dt

    while current_end >= start_dt:
        current_start = max(start_dt, current_end - timedelta(days=slice_days - 1))
        yield current_start.isoformat(), current_end.isoformat()
        current_end = current_start - timedelta(days=1)


def main():
    session = make_session()
    article_rows_before = []
    article_rows_after = []
    image_rows_before = []
    image_rows_after = []
    seen_article_urls = set()
    seen_image_urls = set()
    html_fetch_supported = None

    for window in get_active_windows():
        for term in SEARCH_TERMS:
            print(f"\n[INFO] Searching NYT for {window['slug']}: {term}")
            collected_count = 0

            for slice_start, slice_end in iter_date_slices(window["start"], window["end"], NYT_SLICE_DAYS):
                if collected_count >= NYT_MAX_ARTICLES_PER_WINDOW_TERM:
                    print(
                        f"[INFO] Reached article cap for NYT {window['slug']} {term}: "
                        f"{collected_count}/{NYT_MAX_ARTICLES_PER_WINDOW_TERM}"
                    )
                    break

                print(f"[INFO] NYT slice {slice_start} to {slice_end}")

                for page in range(NYT_MAX_PAGES_PER_SLICE):
                    if collected_count >= NYT_MAX_ARTICLES_PER_WINDOW_TERM:
                        break

                    params = {
                        "q": term,
                        "api-key": API_KEY,
                        "page": page,
                        "begin_date": slice_start.replace("-", ""),
                        "end_date": slice_end.replace("-", ""),
                        "sort": "newest",
                        "fl": "web_url,pub_date,headline,section_name,_id",
                    }

                    data = safe_get_json(
                        session,
                        BASE_URL,
                        params=params,
                        context=f"NYT {window['slug']} {term} {slice_start}..{slice_end} page {page}",
                        max_attempts=3,
                    )
                    if not data:
                        break

                    docs = data.get("response", {}).get("docs", [])
                    if not docs:
                        print(f"[INFO] No docs on page {page} for slice {slice_start}..{slice_end}; stopping pagination.")
                        break

                    print(
                        f"[INFO] Window {window['slug']} | term {term} | "
                        f"slice {slice_start}..{slice_end} | page {page + 1}/{NYT_MAX_PAGES_PER_SLICE} | "
                        f"docs: {len(docs)} | articles: {collected_count}/{NYT_MAX_ARTICLES_PER_WINDOW_TERM}"
                    )

                    for doc in docs:
                        if collected_count >= NYT_MAX_ARTICLES_PER_WINDOW_TERM:
                            break
                        article_url = (doc.get("web_url") or "").strip()
                        if not article_url or article_url in seen_article_urls:
                            continue

                        seen_article_urls.add(article_url)
                        raw_id = doc.get("_id", "")
                        article_id = sanitize_filename(raw_id.split("/")[-1] if "/" in raw_id else raw_id)
                        pub_date = (doc.get("pub_date") or "")[:10]
                        article_title = truncate_text((doc.get("headline") or {}).get("main", ""), 500)

                        base_article_row = {
                            "article_id": article_id,
                            "newspaper": NEWSPAPER,
                            "ipcc_window": window["slug"],
                            "search_term": term,
                            "title": article_title,
                            "article_url": article_url,
                            "section": truncate_text(doc.get("section_name"), 300),
                            "published_date": pub_date,
                        }

                        if html_fetch_supported is None:
                            probe_html = safe_get_text(
                                session,
                                article_url,
                                context="NYT HTML preflight",
                                max_attempts=1,
                            )
                            html_fetch_supported = bool(probe_html)
                            if not html_fetch_supported:
                                print(
                                    "[ERROR] NYT article pages are blocked by DataDome for plain HTTP requests. "
                                    "Continuing with NYT article metadata only and skipping body-chart extraction."
                                )
                        if html_fetch_supported is False:
                            article_rows_before.append(
                                {
                                    **base_article_row,
                                    "image_count": 0,
                                }
                            )
                            collected_count += 1
                            continue

                        image_results = download_article_charts(
                            session=session,
                            article_url=article_url,
                            article_id=article_id,
                            newspaper=NEWSPAPER,
                            newspaper_slug=NEWSPAPER_SLUG,
                            ipcc_window=window["slug"],
                            published_date=pub_date,
                            search_term=term,
                            article_title=article_title,
                            image_dir=IMAGE_DIR,
                            selectors=ARTICLE_ROOT_SELECTORS,
                            seen_image_urls=seen_image_urls,
                        )
                        before_image_rows = image_results["before_rows"]
                        after_image_rows = image_results["after_rows"]
                        image_rows_before.extend(before_image_rows)
                        image_rows_after.extend(after_image_rows)

                        article_rows_before.append(
                            {
                                **base_article_row,
                                "image_count": len(before_image_rows),
                            }
                        )
                        collected_count += 1
                        if after_image_rows:
                            article_rows_after.append(
                                {
                                    **base_article_row,
                                    "image_count": len(after_image_rows),
                                }
                            )

                    time.sleep(NYT_PAGE_DELAY_SECONDS)

            time.sleep(NYT_TERM_COOLDOWN_SECONDS)

    before_articles_df, before_images_df = save_outputs(
        article_rows_before, image_rows_before, ARTICLES_BEFORE_CSV, IMAGES_BEFORE_CSV
    )
    after_articles_df, after_images_df = save_outputs(
        article_rows_after, image_rows_after, ARTICLES_AFTER_CSV, IMAGES_AFTER_CSV
    )
    after_articles_df.to_csv(ARTICLES_CSV, index=False, encoding="utf-8-sig")
    after_images_df.to_csv(IMAGES_CSV, index=False, encoding="utf-8-sig")

    print(f"\n[COUNT] Before filter | articles: {len(before_articles_df)} | images: {len(before_images_df)}")
    print(f"[COUNT] After filter  | articles: {len(after_articles_df)} | images: {len(after_images_df)}")
    print(f"[DONE] Saved NYT before-filter articles to {ARTICLES_BEFORE_CSV}")
    print(f"[DONE] Saved NYT before-filter images to {IMAGES_BEFORE_CSV}")
    print(f"[DONE] Saved NYT after-filter articles to {ARTICLES_AFTER_CSV}")
    print(f"[DONE] Saved NYT after-filter images to {IMAGES_AFTER_CSV}")


if __name__ == "__main__":
    main()
