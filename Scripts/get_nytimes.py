from pathlib import Path
import time

from climate_visualization_utils import (
    SEARCH_TERMS,
    SLEEP_SECONDS,
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

# The NYT Article Search API returns 10 docs per page and allows up to 100 pages.
MAX_PAGES = 100

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

            for page in range(MAX_PAGES):
                params = {
                    "q": term,
                    "api-key": API_KEY,
                    "page": page,
                    "begin_date": window["start"].replace("-", ""),
                    "end_date": window["end"].replace("-", ""),
                    "sort": "newest",
                }

                data = safe_get_json(
                    session,
                    BASE_URL,
                    params=params,
                    context=f"NYT {window['slug']} {term} page {page}",
                )
                if not data:
                    break

                docs = data.get("response", {}).get("docs", [])
                if not docs:
                    print(f"[INFO] No docs on page {page} for {term}; stopping pagination.")
                    break

                print(
                    f"[INFO] Window {window['slug']} | term {term} | "
                    f"page {page + 1}/{MAX_PAGES} | docs: {len(docs)}"
                )

                for doc in docs:
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
                        probe_html = safe_get_text(session, article_url, context="NYT HTML preflight")
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
                    if after_image_rows:
                        article_rows_after.append(
                            {
                                **base_article_row,
                                "image_count": len(after_image_rows),
                            }
                        )

                time.sleep(SLEEP_SECONDS)

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
