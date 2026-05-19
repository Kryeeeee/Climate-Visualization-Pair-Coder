from pathlib import Path
import time

from climate_visualization_utils import (
    API_PAGE_DELAY_SECONDS,
    MAX_ARTICLES_PER_WINDOW_TERM,
    SEARCH_TERMS,
    download_article_charts,
    ensure_output_dirs,
    get_active_windows,
    make_session,
    safe_get_json,
    sanitize_filename,
    save_outputs,
    truncate_text,
)


API_KEY = "e0dab491-dee2-4fc1-af60-955bd66596cc"
BASE_URL = "https://content.guardianapis.com/search"
NEWSPAPER = "The Guardian"
NEWSPAPER_SLUG = "guardian"

PAGE_SIZE = 50
MAX_PAGES = 50

ARTICLE_ROOT_SELECTORS = [
    "div[itemprop='articleBody']",
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

    for window in get_active_windows():
        for term in SEARCH_TERMS:
            print(f"\n[INFO] Searching Guardian for {window['slug']}: {term}")
            current_page = 1
            total_pages = 1
            collected_count = 0

            while (
                current_page <= total_pages
                and current_page <= MAX_PAGES
                and collected_count < MAX_ARTICLES_PER_WINDOW_TERM
            ):
                params = {
                    "q": term,
                    "api-key": API_KEY,
                    "page-size": PAGE_SIZE,
                    "page": current_page,
                    "from-date": window["start"],
                    "to-date": window["end"],
                    "show-fields": "headline,trailText,byline,firstPublicationDate",
                    "order-by": "newest",
                }

                data = safe_get_json(
                    session,
                    BASE_URL,
                    params=params,
                    context=f"Guardian {window['slug']} {term} page {current_page}",
                )
                if not data:
                    break

                response = data.get("response", {})
                results = response.get("results", [])
                total_pages = min(response.get("pages", 1), MAX_PAGES)

                if not results:
                    print(f"[INFO] No results on page {current_page} for {term}; stopping pagination.")
                    break

                print(
                    f"[INFO] Window {window['slug']} | term {term} | "
                    f"page {current_page}/{total_pages} | results: {len(results)} | "
                    f"articles: {collected_count}/{MAX_ARTICLES_PER_WINDOW_TERM}"
                )

                for article in results:
                    if collected_count >= MAX_ARTICLES_PER_WINDOW_TERM:
                        break
                    article_url = (article.get("webUrl") or "").strip()
                    if not article_url or article_url in seen_article_urls:
                        continue

                    seen_article_urls.add(article_url)
                    fields = article.get("fields", {})
                    article_id = sanitize_filename(article.get("id", ""))
                    pub_date = (article.get("webPublicationDate") or "")[:10]
                    article_title = truncate_text(fields.get("headline"), 500)

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

                    base_article_row = {
                        "article_id": article_id,
                        "newspaper": NEWSPAPER,
                        "ipcc_window": window["slug"],
                        "search_term": term,
                        "title": article_title,
                        "article_url": article_url,
                        "section": truncate_text(article.get("sectionName"), 300),
                        "published_date": pub_date,
                    }

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

                current_page += 1
                time.sleep(API_PAGE_DELAY_SECONDS)

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
    print(f"[DONE] Saved Guardian before-filter articles to {ARTICLES_BEFORE_CSV}")
    print(f"[DONE] Saved Guardian before-filter images to {IMAGES_BEFORE_CSV}")
    print(f"[DONE] Saved Guardian after-filter articles to {ARTICLES_AFTER_CSV}")
    print(f"[DONE] Saved Guardian after-filter images to {IMAGES_AFTER_CSV}")


if __name__ == "__main__":
    main()
