from datetime import datetime, timedelta
from pathlib import Path
import time

import requests

from climate_visualization_utils import (
    SEARCH_TERMS,
    download_candidate_images,
    ensure_output_dirs,
    filter_nyt_multimedia_chart_candidates,
    get_active_windows,
    make_session,
    nyt_multimedia_to_candidates,
    sanitize_filename,
    save_outputs,
    truncate_text,
)


API_KEY = "Cj6al24ZR0XctsUl1hYKzAbnWnbLAIkZslF6Genv1wdXv5Zx"
BASE_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json"
NEWSPAPER = "The New York Times"
NEWSPAPER_SLUG = "nytimes"

NYT_MAX_PAGES_PER_SLICE = 5
NYT_SLICE_DAYS = 365
NYT_MAX_ARTICLES_PER_WINDOW_TERM = 80
NYT_REQUEST_INTERVAL_SECONDS = 15.0
NYT_RATE_LIMIT_COOLDOWN_SECONDS = 90.0
NYT_MAX_RATE_LIMIT_RETRIES = 3
NYT_MAX_CONSECUTIVE_RATE_LIMITS = 2
NYT_MAX_REQUESTS_PER_RUN = 450
NYT_TERM_COOLDOWN_SECONDS = 45.0

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


def count_raw_multimedia(raw_multimedia):
    if isinstance(raw_multimedia, dict):
        return 1 if raw_multimedia.get("url") or raw_multimedia.get("legacy") else len(raw_multimedia)
    if isinstance(raw_multimedia, (list, tuple)):
        return len(raw_multimedia)
    return 0


def get_retry_after_seconds(response):
    retry_after = response.headers.get("Retry-After")
    if not retry_after:
        return NYT_RATE_LIMIT_COOLDOWN_SECONDS
    try:
        return max(NYT_RATE_LIMIT_COOLDOWN_SECONDS, float(retry_after))
    except ValueError:
        return NYT_RATE_LIMIT_COOLDOWN_SECONDS


class NYTApiClient:
    def __init__(self, session):
        self.session = session
        self.last_request_at = 0.0
        self.request_count = 0
        self.consecutive_rate_limits = 0

    def wait_for_slot(self):
        elapsed = time.monotonic() - self.last_request_at
        wait_seconds = NYT_REQUEST_INTERVAL_SECONDS - elapsed
        if wait_seconds > 0:
            print(f"[INFO] NYT API throttle: waiting {wait_seconds:.1f}s before next request")
            time.sleep(wait_seconds)

    def get_json(self, params, context):
        if self.request_count >= NYT_MAX_REQUESTS_PER_RUN:
            print(
                f"[WARN] Reached NYT request cap for this run "
                f"({NYT_MAX_REQUESTS_PER_RUN}). Saving partial results."
            )
            return None, "request_cap"

        for attempt in range(1, NYT_MAX_RATE_LIMIT_RETRIES + 1):
            self.wait_for_slot()
            self.last_request_at = time.monotonic()
            self.request_count += 1

            try:
                response = self.session.get(BASE_URL, params=params, timeout=30)
                if response.status_code == 429:
                    self.consecutive_rate_limits += 1
                    wait_seconds = get_retry_after_seconds(response)
                    response.close()
                    print(
                        f"[WARN] {context}: HTTP 429 Too Many Requests. "
                        f"Cooling down for {wait_seconds:.0f}s "
                        f"(attempt {attempt}/{NYT_MAX_RATE_LIMIT_RETRIES}, "
                        f"consecutive 429s: {self.consecutive_rate_limits})."
                    )
                    if self.consecutive_rate_limits >= NYT_MAX_CONSECUTIVE_RATE_LIMITS:
                        print(
                            "[WARN] NYT API is still rate-limited after consecutive 429 responses. "
                            "Stopping NYT collection now to avoid burning more quota."
                        )
                        return None, "rate_limited_stop"
                    time.sleep(wait_seconds)
                    continue

                response.raise_for_status()
                self.consecutive_rate_limits = 0
                return response.json(), "ok"
            except requests.RequestException as exc:
                print(f"[ERROR] {context}: {exc}")
                return None, "error"
            except ValueError as exc:
                print(f"[ERROR] {context}: invalid JSON response: {exc}")
                return None, "error"

        print(f"[WARN] {context}: exceeded NYT rate-limit retry budget. Saving partial results.")
        return None, "rate_limited_stop"


def main():
    session = make_session()
    nyt_api = NYTApiClient(session)
    article_rows_before = []
    article_rows_after = []
    image_rows_before = []
    image_rows_after = []
    seen_article_urls = set()
    seen_image_urls = set()
    stop_due_to_rate_limit = False

    for window in get_active_windows():
        if stop_due_to_rate_limit:
            break
        for term in SEARCH_TERMS:
            if stop_due_to_rate_limit:
                break
            print(f"\n[INFO] Searching NYT for {window['slug']}: {term}")
            collected_count = 0

            for slice_start, slice_end in iter_date_slices(window["start"], window["end"], NYT_SLICE_DAYS):
                if stop_due_to_rate_limit:
                    break
                if collected_count >= NYT_MAX_ARTICLES_PER_WINDOW_TERM:
                    print(
                        f"[INFO] Reached article cap for NYT {window['slug']} {term}: "
                        f"{collected_count}/{NYT_MAX_ARTICLES_PER_WINDOW_TERM}"
                    )
                    break

                print(f"[INFO] NYT slice {slice_start} to {slice_end}")

                for page in range(NYT_MAX_PAGES_PER_SLICE):
                    if stop_due_to_rate_limit:
                        break
                    if collected_count >= NYT_MAX_ARTICLES_PER_WINDOW_TERM:
                        break

                    params = {
                        "q": term,
                        "api-key": API_KEY,
                        "page": page,
                        "begin_date": slice_start.replace("-", ""),
                        "end_date": slice_end.replace("-", ""),
                        "sort": "newest",
                        "fl": "web_url,pub_date,headline,section_name,_id,multimedia",
                    }

                    data, status = nyt_api.get_json(
                        params=params,
                        context=f"NYT {window['slug']} {term} {slice_start}..{slice_end} page {page}",
                    )
                    if status in {"rate_limited_stop", "request_cap"}:
                        stop_due_to_rate_limit = True
                        break
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

                        raw_multimedia = doc.get("multimedia", [])
                        multimedia_candidates = nyt_multimedia_to_candidates(raw_multimedia)
                        filtered_multimedia_candidates = filter_nyt_multimedia_chart_candidates(multimedia_candidates)
                        image_results = download_candidate_images(
                            session=session,
                            candidates=multimedia_candidates,
                            article_id=article_id,
                            newspaper=NEWSPAPER,
                            newspaper_slug=NEWSPAPER_SLUG,
                            ipcc_window=window["slug"],
                            published_date=pub_date,
                            search_term=term,
                            article_title=article_title,
                            article_url=article_url,
                            image_dir=IMAGE_DIR,
                            seen_image_urls=seen_image_urls,
                            candidate_filter=filter_nyt_multimedia_chart_candidates,
                        )
                        before_image_rows = image_results["before_rows"]
                        after_image_rows = image_results["after_rows"]
                        print(
                            f"[INFO] NYT API multimedia | raw: {count_raw_multimedia(raw_multimedia)} | "
                            f"candidates: {len(before_image_rows)} | chart-like: {len(filtered_multimedia_candidates)} | "
                            f"downloaded: {len(after_image_rows)} | "
                            f"article: {article_id}"
                        )
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

            if not stop_due_to_rate_limit:
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
