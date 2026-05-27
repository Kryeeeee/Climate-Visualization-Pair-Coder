from pathlib import Path
from urllib.parse import quote
import time

from bs4 import BeautifulSoup

from climate_visualization_utils import (
    ARTICLE_FETCH_DELAY,
    API_PAGE_DELAY_SECONDS,
    SEARCH_TERMS,
    download_article_charts,
    extract_published_date_from_html,
    ensure_output_dirs,
    get_active_windows,
    get_term_cap,
    make_session,
    match_window_for_date,
    parse_human_readable_date,
    sanitize_filename,
    save_outputs,
    safe_get_text,
    sort_article_df,
    sort_image_df,
    truncate_text,
)


BASE_SEARCH_URL = "https://www.bbc.co.uk/search"
NEWSPAPER = "BBC News"
NEWSPAPER_SLUG = "bbc"
MAX_PAGES = 100

ARTICLE_ROOT_SELECTORS = [
    "main",
    "article",
]


SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "output" / NEWSPAPER_SLUG
ARTICLES_CSV, IMAGES_CSV, IMAGE_DIR = ensure_output_dirs(OUTPUT_DIR)
ARTICLES_BEFORE_CSV = OUTPUT_DIR / "articles_before_filter.csv"
IMAGES_BEFORE_CSV = OUTPUT_DIR / "images_before_filter.csv"


def build_search_url(term, page):
    return f"{BASE_SEARCH_URL}?q={quote(term)}&page={page}"


def is_bbc_article_url(url):
    if not url.startswith("https://www.bbc.co.uk/"):
        return False
    blocked_patterns = [
        "/news/topics/",
        "/news/videos/",
        "/sounds/",
        "/programmes/",
        "/sport/",
        "/weather/",
    ]
    if any(pattern in url for pattern in blocked_patterns):
        return False
    return "/news/" in url or "/future/" in url


def extract_search_results(html):
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup
    results = []
    seen_urls = set()

    for anchor in main.select("a[href]"):
        article_url = (anchor.get("href") or "").strip()
        title = " ".join(anchor.get_text(" ", strip=True).split())
        if not article_url or not title:
            continue
        if not is_bbc_article_url(article_url):
            continue
        if article_url in seen_urls:
            continue

        parent_text = " ".join(anchor.parent.get_text(" ", strip=True).split()) if anchor.parent else ""
        results.append(
            {
                "title": title,
                "article_url": article_url,
                "published_date": parse_human_readable_date(parent_text),
            }
        )
        seen_urls.add(article_url)

    return results


def main():
    session = make_session()
    article_rows_before = []
    article_rows_after = []
    image_rows_before = []
    image_rows_after = []
    seen_article_urls = set()
    seen_image_urls = set()

    active_window_slugs = {window["slug"] for window in get_active_windows()}

    for term in SEARCH_TERMS:
        term_cap = get_term_cap(term)
        print(f"\n[INFO] Searching BBC for: {term} (cap: {term_cap}/window)")
        per_window_counts = {slug: 0 for slug in active_window_slugs}

        for page in range(1, MAX_PAGES + 1):
            if all(count >= term_cap for count in per_window_counts.values()):
                print(
                    f"[INFO] Reached article cap for all active BBC windows for {term}: "
                    f"{term_cap} per window-term."
                )
                break
            search_url = build_search_url(term, page)
            html = safe_get_text(session, search_url, context=f"BBC search {term} page {page}")
            if not html:
                break

            search_results = extract_search_results(html)
            if not search_results:
                print(f"[INFO] No results on page {page} for {term}; stopping pagination.")
                break

            counts_text = ", ".join(
                f"{slug}:{count}/{term_cap}"
                for slug, count in sorted(per_window_counts.items())
            )
            print(f"[INFO] Term {term} | page {page}/{MAX_PAGES} | results: {len(search_results)} | {counts_text}")

            for item in search_results:
                article_url = item["article_url"]
                if article_url in seen_article_urls:
                    continue

                article_id = sanitize_filename(article_url.rstrip("/").split("/")[-1] or item["title"])
                time.sleep(ARTICLE_FETCH_DELAY)
                article_html = safe_get_text(session, article_url, context=f"BBC article HTML {article_url}")
                if not article_html:
                    continue
                pub_date = extract_published_date_from_html(article_html) or item["published_date"]
                matched_window = match_window_for_date(pub_date)
                if not matched_window or matched_window["slug"] not in active_window_slugs:
                    continue
                if per_window_counts[matched_window["slug"]] >= term_cap:
                    continue
                seen_article_urls.add(article_url)
                article_title = truncate_text(item["title"], 500)

                image_results = download_article_charts(
                    session=session,
                    article_url=article_url,
                    article_id=article_id,
                    newspaper=NEWSPAPER,
                    newspaper_slug=NEWSPAPER_SLUG,
                    ipcc_window=matched_window["slug"],
                    published_date=pub_date,
                    search_term=term,
                    article_title=article_title,
                    image_dir=IMAGE_DIR,
                    selectors=ARTICLE_ROOT_SELECTORS,
                    seen_image_urls=seen_image_urls,
                    article_html=article_html,
                )
                before_image_rows = image_results["before_rows"]
                after_image_rows = image_results["after_rows"]
                image_rows_before.extend(before_image_rows)
                image_rows_after.extend(after_image_rows)

                base_article_row = {
                    "article_id": article_id,
                    "newspaper": NEWSPAPER,
                    "ipcc_window": matched_window["slug"],
                    "search_term": term,
                    "title": article_title,
                    "article_url": article_url,
                    "section": "BBC search",
                    "published_date": pub_date,
                }

                article_rows_before.append(
                    {
                        **base_article_row,
                        "image_count": len(before_image_rows),
                    }
                )
                per_window_counts[matched_window["slug"]] += 1
                if after_image_rows:
                    article_rows_after.append(
                        {
                            **base_article_row,
                            "image_count": len(after_image_rows),
                        }
                    )

            time.sleep(API_PAGE_DELAY_SECONDS)

    before_articles_df, before_images_df = save_outputs(
        article_rows_before, image_rows_before, ARTICLES_BEFORE_CSV, IMAGES_BEFORE_CSV
    )
    after_articles_df = sort_article_df(article_rows_after)
    after_images_df = sort_image_df(image_rows_after)
    after_articles_df.to_csv(ARTICLES_CSV, index=False, encoding="utf-8-sig")
    after_images_df.to_csv(IMAGES_CSV, index=False, encoding="utf-8-sig")

    print(f"\n[COUNT] Before filter | articles: {len(before_articles_df)} | images: {len(before_images_df)}")
    print(f"[COUNT] After filter  | articles: {len(after_articles_df)} | images: {len(after_images_df)}")
    print(f"[DONE] Saved BBC before-filter articles to {ARTICLES_BEFORE_CSV}")
    print(f"[DONE] Saved BBC before-filter images to {IMAGES_BEFORE_CSV}")
    print(f"[DONE] Saved BBC final articles to {ARTICLES_CSV}")
    print(f"[DONE] Saved BBC final images to {IMAGES_CSV}")


if __name__ == "__main__":
    main()
