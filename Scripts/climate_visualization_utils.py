from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urljoin
import mimetypes
import re
import sys
import time

from bs4 import BeautifulSoup
import pandas as pd
import requests


REQUEST_TIMEOUT = 30
MAX_TEXT_CHARS = 5000
SLEEP_SECONDS = 0.25
ARTICLE_FETCH_DELAY = 1.0
API_PAGE_DELAY_SECONDS = 1.0
NYT_PAGE_DELAY_SECONDS = 3.0
MAX_ARTICLES_PER_WINDOW_TERM = 50
RETRY_STATUS_CODES = {403, 429, 500, 502, 503, 504}
STATIC_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".avif"}
STATIC_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/avif",
}

WINDOWS = [
    {
        "slug": str(year),
        "label": str(year),
        "start": f"{year}-01-01",
        "end": f"{year + 1}-01-01",
    }
    for year in range(2013, 2026)
]

ACTIVE_WINDOW_SLUGS = [window["slug"] for window in WINDOWS]

SEARCH_TERMS = [
    '"climate change"',
    '"global temperature"',
    '"sea level rise"',
    '"carbon budget"',
    '"net zero"',
    '"1.5C"',
    "IPCC",
]

TERM_CAPS = {
    '"climate change"': 200,
    '"net zero"': 100,
    '"sea level rise"': 100,
    '"1.5C"': 100,
    '"global temperature"': 100,
    '"carbon budget"': 100,
    "IPCC": 300,
}


def get_term_cap(term):
    return TERM_CAPS.get(term, MAX_ARTICLES_PER_WINDOW_TERM)


ARTICLE_COLUMNS = [
    "article_id",
    "newspaper",
    "year_window",
    "search_term",
    "title",
    "article_url",
    "section",
    "published_date",
    "updated_date",
    "image_count",
]

IMAGE_COLUMNS = [
    "article_id",
    "newspaper",
    "year_window",
    "search_term",
    "article_title",
    "article_url",
    "published_date",
    "updated_date",
    "image_index",
    "image_url",
    "local_image_path",
    "caption",
    "credit",
]

CHART_KEYWORDS = [
    "chart",
    "graph",
    "graphic",
    "infographic",
    "plot",
    "diagram",
    "timeline",
    "bar chart",
    "line chart",
    "scatter",
    "heatmap",
    "map",
    "source:",
    "data source",
    "visualisation",
    "visualization",
]

PHOTO_KEYWORDS = [
    "photo",
    "photograph",
    "getty",
    "reuters",
    "associated press",
    "ap photo",
    "afp",
    "epa",
    "handout",
    "portrait",
    "headshot",
    "mugshot",
    "screenshot",
    "still image",
]

NYT_MULTIMEDIA_CHART_TERMS = [
    "chart",
    "graph",
    "graphic",
    "graphics",
    "infographic",
    "map",
    "diagram",
    "table",
    "data",
    "visualization",
    "visualisation",
    "tracker",
]

NYT_MULTIMEDIA_PHOTO_TERMS = [
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

IMAGE_URL_ATTRIBUTES = [
    "src",
    "data-src",
    "data-lazy-src",
    "data-image-url",
    "data-media-src",
]

SRCSET_ATTRIBUTES = [
    "srcset",
    "data-srcset",
]

_MONTH_NAMES = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "jun": "06", "jul": "07", "aug": "08", "sep": "09",
    "oct": "10", "nov": "11", "dec": "12",
}
_MONTH_RE = (
    r"january|february|march|april|may|june|july|august|september|"
    r"october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec"
)


def parse_human_readable_date(text):
    if not text:
        return ""
    m = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
    if m:
        return m.group(1)
    m = re.search(rf"\b(\d{{1,2}})\s+({_MONTH_RE})\s+(20\d{{2}})\b", text, flags=re.IGNORECASE)
    if m:
        return f"{m.group(3)}-{_MONTH_NAMES[m.group(2).lower()]}-{m.group(1).zfill(2)}"
    m = re.search(rf"\b({_MONTH_RE})\s+(\d{{1,2}}),?\s+(20\d{{2}})\b", text, flags=re.IGNORECASE)
    if m:
        return f"{m.group(3)}-{_MONTH_NAMES[m.group(1).lower()]}-{m.group(2).zfill(2)}"
    return ""


def truncate_text(value, max_chars=MAX_TEXT_CHARS):
    if value is None:
        return ""
    value = re.sub(r"\s+", " ", str(value)).strip()
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 3].rstrip() + "..."


def sanitize_filename(value):
    value = re.sub(r"[^\w\-]+", "_", str(value).strip(), flags=re.UNICODE)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "item"


def infer_extension_from_url(url):
    suffix = Path(url.split("?")[0]).suffix.lower()
    if suffix in STATIC_IMAGE_EXTENSIONS:
        return suffix
    guessed, _ = mimetypes.guess_type(url)
    if guessed:
        ext = mimetypes.guess_extension(guessed)
        if ext:
            return ext
    return ".jpg"


def is_static_image_url(url):
    suffix = Path(str(url).split("?")[0]).suffix.lower()
    return not suffix or suffix in STATIC_IMAGE_EXTENSIONS


def is_static_image_content_type(content_type):
    if not content_type:
        return True
    normalized = content_type.split(";")[0].strip().lower()
    return normalized in STATIC_IMAGE_MIME_TYPES


def make_session():
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": "https://www.google.com/",
        }
    )
    return session


def get_retry_wait_seconds(response=None, attempt=1):
    if response is not None:
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return max(1.0, min(float(retry_after), 60.0))
            except ValueError:
                pass
        if response.status_code == 429:
            return min(5 * (2 ** (attempt - 1)), 60)
    return min(2 ** (attempt - 1), 16)


def request_with_retries(session, url, params=None, context="request", stream=False, max_attempts=5):
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = session.get(url, params=params, timeout=REQUEST_TIMEOUT, stream=stream)
            if response.status_code in RETRY_STATUS_CODES and attempt < max_attempts:
                wait_seconds = get_retry_wait_seconds(response=response, attempt=attempt)
                print(f"[WARN] {context}: HTTP {response.status_code}, retrying in {wait_seconds}s...")
                response.close()
                time.sleep(wait_seconds)
                continue
            response.raise_for_status()
            return response
        except requests.HTTPError as exc:
            if exc.response is not None and 400 <= exc.response.status_code < 500:
                raise
            last_exc = exc
            if attempt < max_attempts:
                wait_seconds = get_retry_wait_seconds(attempt=attempt)
                print(f"[WARN] {context}: {exc}. Retrying in {wait_seconds}s...")
                time.sleep(wait_seconds)
                continue
            break
        except requests.RequestException as exc:
            last_exc = exc
            if attempt < max_attempts:
                wait_seconds = get_retry_wait_seconds(attempt=attempt)
                print(f"[WARN] {context}: {exc}. Retrying in {wait_seconds}s...")
                time.sleep(wait_seconds)
                continue
            break
    if last_exc is not None:
        raise last_exc
    raise requests.RequestException(f"{context}: request failed after {max_attempts} attempts")


def safe_get_json(session, url, params=None, context="request", max_attempts=5):
    try:
        response = request_with_retries(session, url, params=params, context=context, max_attempts=max_attempts)
        return response.json()
    except requests.RequestException as exc:
        print(f"[ERROR] {context}: {exc}")
        return None
    except ValueError as exc:
        print(f"[ERROR] {context}: invalid JSON response: {exc}")
        return None


def safe_get_text(session, url, context="request", max_attempts=5):
    try:
        response = request_with_retries(session, url, context=context, max_attempts=max_attempts)
        return response.text
    except requests.RequestException as exc:
        print(f"[ERROR] {context}: {exc}")
        return ""


def download_image(session, image_url, destination):
    try:
        response = request_with_retries(session, image_url, context=f"download {image_url}", stream=True)
        if not is_static_image_content_type(response.headers.get("Content-Type", "")):
            print(f"[INFO] Skipping non-static image response {image_url}: {response.headers.get('Content-Type', '')}")
            response.close()
            return False
        with open(destination, "wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    handle.write(chunk)
        return True
    except requests.RequestException as exc:
        print(f"[WARN] Failed to download image {image_url}: {exc}")
        return False


def image_folder_name(newspaper_slug):
    return f"{newspaper_slug}_images"


def requested_year_from_argv(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    for index, arg in enumerate(args):
        value = ""
        if re.fullmatch(r"20\d{2}", arg):
            value = arg
        elif arg.startswith("--year="):
            value = arg.split("=", 1)[1]
        elif arg == "--year" and index + 1 < len(args):
            value = args[index + 1]
        if value:
            if not any(window["slug"] == value for window in WINDOWS):
                valid = ", ".join(window["slug"] for window in WINDOWS)
                raise SystemExit(f"Unsupported year {value}. Valid years: {valid}")
            return value
    return ""


def output_suffix_for_windows(windows):
    return f"_{windows[0]['slug']}" if len(windows) == 1 else ""


def inclusive_api_end_date(window):
    """Convert the internal left-closed/right-open window into API-friendly inclusive end."""
    end_date = datetime.strptime(window["end"], "%Y-%m-%d").date()
    return (end_date - timedelta(days=1)).isoformat()


def ensure_output_dirs(output_dir, output_suffix=""):
    newspaper_slug = output_dir.name
    image_dir = output_dir / image_folder_name(newspaper_slug)
    output_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / f"articles{output_suffix}.csv", output_dir / f"{newspaper_slug}_images{output_suffix}.csv", image_dir


def make_empty_dataframe(columns):
    return pd.DataFrame(columns=columns)


def get_active_windows():
    requested_year = requested_year_from_argv()
    if requested_year:
        return [window for window in WINDOWS if window["slug"] == requested_year]
    active = [window for window in WINDOWS if window["slug"] in ACTIVE_WINDOW_SLUGS]
    return active or WINDOWS


def normalize_date(value):
    if not value:
        return ""
    match = re.search(r"(20\d{2}-\d{2}-\d{2})", str(value))
    return match.group(1) if match else ""


def date_in_window(date_value, window):
    normalized = normalize_date(date_value)
    if not normalized:
        return False
    return window["start"] <= normalized < window["end"]


def match_window_for_date(date_value):
    normalized = normalize_date(date_value)
    if not normalized:
        return None
    for window in get_active_windows():
        if date_in_window(normalized, window):
            return window
    return None


def sort_article_df(article_rows):
    if not article_rows:
        return make_empty_dataframe(ARTICLE_COLUMNS)
    return pd.DataFrame(article_rows)[ARTICLE_COLUMNS].sort_values(
        by=["published_date", "newspaper", "article_id"],
        ascending=[True, True, True],
    )


def sort_image_df(image_rows):
    if not image_rows:
        return make_empty_dataframe(IMAGE_COLUMNS)
    return pd.DataFrame(image_rows)[IMAGE_COLUMNS].sort_values(
        by=["published_date", "newspaper", "article_id", "image_index"],
        ascending=[True, True, True, True],
    )


def save_outputs(article_rows, image_rows, articles_csv, images_csv):
    articles_df = sort_article_df(article_rows)
    images_df = sort_image_df(image_rows)
    articles_df.to_csv(articles_csv, index=False, encoding="utf-8-sig")
    images_df.to_csv(images_csv, index=False, encoding="utf-8-sig")
    return articles_df, images_df


def image_row_text(row):
    return " ".join(
        str(row.get(column, "") or "")
        for column in [
            "image_url",
            "local_image_path",
            "caption",
            "credit",
            "article_title",
            "search_term",
        ]
    ).lower()


def score_image_row(row):
    combined = image_row_text(row)
    positive_terms = sorted({
        term
        for term in set(CHART_KEYWORDS + NYT_MULTIMEDIA_CHART_TERMS)
        if term in combined
    })
    negative_terms = sorted({
        term
        for term in set(PHOTO_KEYWORDS + NYT_MULTIMEDIA_PHOTO_TERMS)
        if term in combined
    })
    has_positive_signal = bool(positive_terms)
    auto_label = "likely_visualization" if has_positive_signal else "broad_candidate"
    return {
        "positive_chart_signal_count": len(positive_terms),
        "positive_chart_signals": "|".join(positive_terms),
        "negative_photo_signal_count": len(negative_terms),
        "negative_photo_signals": "|".join(negative_terms),
        "review_priority": 0 if has_positive_signal else 1,
        "auto_review_label": auto_label,
    }


def build_review_priority_df(image_rows):
    images_df = sort_image_df(image_rows)
    if images_df.empty:
        return images_df.assign(
            positive_chart_signal_count=[],
            positive_chart_signals=[],
            negative_photo_signal_count=[],
            negative_photo_signals=[],
            review_priority=[],
            auto_review_label=[],
        )
    scored_rows = [score_image_row(row) for row in images_df.to_dict("records")]
    scored_df = pd.concat([images_df.reset_index(drop=True), pd.DataFrame(scored_rows)], axis=1)
    return scored_df.sort_values(
        by=[
            "review_priority",
            "positive_chart_signal_count",
            "negative_photo_signal_count",
            "published_date",
            "newspaper",
            "article_id",
            "image_index",
        ],
        ascending=[True, False, True, True, True, True, True],
    )


def keyword_terms_for_matching():
    return [term.replace('"', "").lower() for term in SEARCH_TERMS]


def text_matches_climate_terms(*values):
    haystack = " ".join(truncate_text(value).lower() for value in values if value)
    return any(term in haystack for term in keyword_terms_for_matching())


def pick_best_image_url(tag, article_url):
    for attr in IMAGE_URL_ATTRIBUTES:
        value = tag.get(attr)
        if value:
            return urljoin(article_url, value)

    for attr in SRCSET_ATTRIBUTES:
        srcset = tag.get(attr)
        if not srcset:
            continue
        parts = [part.strip() for part in srcset.split(",") if part.strip()]
        if not parts:
            continue
        best = parts[-1].split()[0]
        if best:
            return urljoin(article_url, best)

    return ""


def collect_text(node):
    if not node:
        return ""
    return truncate_text(node.get_text(" ", strip=True), 600)


def article_roots(soup, selectors):
    for selector in selectors:
        matches = soup.select(selector)
        if matches:
            return matches
    article_tag = soup.find("article")
    if article_tag:
        return [article_tag]
    main_tag = soup.find("main")
    if main_tag:
        return [main_tag]
    return [soup]


def extract_credit(caption_text):
    if not caption_text:
        return ""
    match = re.search(r"(?:credit|source)\s*[:|]\s*(.+)$", caption_text, flags=re.IGNORECASE)
    if match:
        return truncate_text(match.group(1), 300)
    return ""


def candidate_from_figure(image_tag, figure_tag, article_url):
    image_url = pick_best_image_url(image_tag, article_url)
    if not image_url:
        return None

    figcaption = figure_tag.find("figcaption")
    caption = collect_text(figcaption)
    context_text = collect_text(figure_tag)

    return {
        "image_url": image_url,
        "caption": caption,
        "credit": extract_credit(caption),
        "alt_text": truncate_text(image_tag.get("alt", ""), 600),
        "context_text": context_text,
    }


def extra_chart_like_images(root, article_url, known_urls):
    candidates = []
    selectors = [
        "[class*='chart'] img",
        "[class*='graphic'] img",
        "[class*='infographic'] img",
        "[data-component*='chart'] img",
    ]
    for selector in selectors:
        for image_tag in root.select(selector):
            image_url = pick_best_image_url(image_tag, article_url)
            if not image_url or image_url in known_urls:
                continue
            parent = image_tag.parent
            candidates.append(
                {
                    "image_url": image_url,
                    "caption": "",
                    "credit": "",
                    "alt_text": truncate_text(image_tag.get("alt", ""), 600),
                    "context_text": collect_text(parent),
                }
            )
            known_urls.add(image_url)
    return candidates


def extract_image_candidates(html, article_url, selectors, session=None):
    soup = BeautifulSoup(html, "html.parser")
    roots = article_roots(soup, selectors)
    candidates = []
    known_urls = set()

    for root in roots:
        for figure_tag in root.select("figure"):
            for image_tag in figure_tag.select("img"):
                candidate = candidate_from_figure(image_tag, figure_tag, article_url)
                if not candidate:
                    continue
                image_url = candidate["image_url"]
                if image_url in known_urls:
                    continue
                candidates.append(candidate)
                known_urls.add(image_url)

        for candidate in extra_chart_like_images(root, article_url, known_urls):
            candidates.append(candidate)

    return candidates


def candidate_to_image_row(
    candidate,
    article_id,
    newspaper,
    year_window,
    search_term,
    article_title,
    article_url,
    published_date,
    updated_date,
    image_index,
    local_image_path="",
):
    return {
        "article_id": article_id,
        "newspaper": newspaper,
        "year_window": year_window,
        "search_term": search_term,
        "article_title": article_title,
        "article_url": article_url,
        "published_date": published_date,
        "updated_date": updated_date,
        "image_index": image_index,
        "image_url": candidate.get("image_url", ""),
        "local_image_path": local_image_path,
        "caption": candidate.get("caption", ""),
        "credit": candidate.get("credit", ""),
    }


def make_codebook_relative_image_path(newspaper_slug, image_name):
    return str(Path("..") / "Scripts" / "output" / newspaper_slug / image_folder_name(newspaper_slug) / image_name).replace("\\", "/")


def download_candidate_images(
    session,
    candidates,
    article_id,
    newspaper,
    newspaper_slug,
    year_window,
    published_date,
    updated_date,
    search_term,
    article_title,
    article_url,
    image_dir,
    seen_image_urls,
):
    before_rows = []
    after_rows = []
    downloadable_candidates = list(candidates)

    for index, candidate in enumerate(candidates, start=1):
        before_rows.append(
            candidate_to_image_row(
                candidate=candidate,
                article_id=article_id,
                newspaper=newspaper,
                year_window=year_window,
                search_term=search_term,
                article_title=article_title,
                article_url=article_url,
                published_date=published_date,
                updated_date=updated_date,
                image_index=index,
            )
        )

    for index, candidate in enumerate(downloadable_candidates, start=1):
        image_url = candidate["image_url"]
        if not is_static_image_url(image_url):
            continue
        if image_url in seen_image_urls:
            continue

        image_ext = infer_extension_from_url(image_url)
        safe_date = published_date or "undated"
        image_name = f"{newspaper_slug}_{safe_date}_{article_id}_img{index:02d}{image_ext}"
        image_path = image_dir / image_name

        if image_path.exists() or download_image(session, image_url, image_path):
            seen_image_urls.add(image_url)
            after_rows.append(
                candidate_to_image_row(
                    candidate=candidate,
                    article_id=article_id,
                    newspaper=newspaper,
                    year_window=year_window,
                    search_term=search_term,
                    article_title=article_title,
                    article_url=article_url,
                    published_date=published_date,
                    updated_date=updated_date,
                    image_index=index,
                    local_image_path=make_codebook_relative_image_path(newspaper_slug, image_name),
                )
            )

    return {"before_rows": before_rows, "after_rows": after_rows}


def nyt_multimedia_to_candidates(multimedia_items):
    candidates = []
    seen_urls = set()

    if isinstance(multimedia_items, dict):
        if multimedia_items.get("url") or multimedia_items.get("legacy"):
            iterable_items = [multimedia_items]
        else:
            iterable_items = multimedia_items.values()
    else:
        iterable_items = multimedia_items or []

    for item in iterable_items:
        if not isinstance(item, dict):
            continue
        if str(item.get("type", "image")).lower() not in {"image", ""}:
            continue

        image_url = item.get("url", "") or ""
        if not image_url:
            legacy = item.get("legacy") or {}
            for key in ["xlarge", "articleimage", "articleLarge", "jumbo", "superJumbo"]:
                if legacy.get(key):
                    image_url = legacy[key]
                    break
        if not image_url:
            continue

        image_url = image_url if image_url.startswith(("http://", "https://")) else urljoin(
            "https://static01.nyt.com/",
            image_url.lstrip("/"),
        )
        if image_url in seen_urls:
            continue
        seen_urls.add(image_url)

        caption = truncate_text(item.get("caption", ""), 600)
        credit = truncate_text(item.get("copyright") or item.get("credit", ""), 300)
        context_text = truncate_text(
            " ".join(
                filter(
                    None,
                    [
                        item.get("format", ""),
                        item.get("subtype", ""),
                        item.get("crop_name", ""),
                        item.get("slug_name", ""),
                        item.get("caption", ""),
                    ],
                )
            ),
            600,
        )
        candidates.append(
            {
                "image_url": image_url,
                "caption": caption,
                "credit": credit,
                "alt_text": "",
                "context_text": context_text,
            }
        )

    return candidates


def extract_published_date_from_html(html):
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    meta_selectors = [
        ("meta", {"property": "article:published_time"}),
        ("meta", {"name": "article:published_time"}),
        ("meta", {"property": "og:article:published_time"}),
        ("meta", {"name": "date"}),
        ("meta", {"name": "parsely-pub-date"}),
        ("meta", {"itemprop": "datePublished"}),
    ]
    for tag_name, attrs in meta_selectors:
        tag = soup.find(tag_name, attrs=attrs)
        if tag:
            value = tag.get("content") or tag.get("datetime")
            normalized = normalize_date(value)
            if normalized:
                return normalized

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        script_text = script.get_text(" ", strip=True)
        match = re.search(r'"datePublished"\s*:\s*"([^"]+)"', script_text)
        if match:
            normalized = normalize_date(match.group(1))
            if normalized:
                return normalized

    fallback_match = re.search(r'"datePublished"\s*:\s*"([^"]+)"', html)
    if fallback_match:
        normalized = normalize_date(fallback_match.group(1))
        if normalized:
            return normalized

    time_tag = soup.find("time")
    if time_tag:
        normalized = normalize_date(time_tag.get("datetime") or time_tag.get_text(" ", strip=True))
        if normalized:
            return normalized

    return ""


def extract_updated_date_from_html(html, published_date=""):
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    meta_selectors = [
        ("meta", {"property": "article:modified_time"}),
        ("meta", {"name": "article:modified_time"}),
        ("meta", {"property": "og:updated_time"}),
        ("meta", {"name": "lastmod"}),
        ("meta", {"name": "last-modified"}),
        ("meta", {"itemprop": "dateModified"}),
    ]
    for tag_name, attrs in meta_selectors:
        tag = soup.find(tag_name, attrs=attrs)
        if tag:
            value = tag.get("content") or tag.get("datetime")
            normalized = normalize_date(value)
            if normalized:
                candidates.append(normalized)

    for time_tag in soup.find_all("time"):
        for value in [time_tag.get("datetime"), time_tag.get_text(" ", strip=True)]:
            normalized = normalize_date(value) or parse_human_readable_date(value)
            if normalized:
                candidates.append(normalized)

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        script_text = script.get_text(" ", strip=True)
        match = re.search(r'"dateModified"\s*:\s*"([^"]+)"', script_text)
        if match:
            normalized = normalize_date(match.group(1))
            if normalized:
                candidates.append(normalized)

    fallback_match = re.search(r'"dateModified"\s*:\s*"([^"]+)"', html)
    if fallback_match:
        normalized = normalize_date(fallback_match.group(1))
        if normalized:
            candidates.append(normalized)

    visible_match = re.search(r"\bUpdated\b.{0,120}", html, flags=re.IGNORECASE)
    if visible_match:
        normalized = parse_human_readable_date(visible_match.group(0))
        if normalized:
            candidates.append(normalized)

    unique_candidates = sorted(set(candidates))
    normalized_published = normalize_date(published_date)
    if normalized_published:
        later_candidates = [date for date in unique_candidates if date > normalized_published]
        return later_candidates[-1] if later_candidates else ""

    return unique_candidates[-1] if unique_candidates else ""


def download_article_charts(
    session,
    article_url,
    article_id,
    newspaper,
    newspaper_slug,
    year_window,
    published_date,
    updated_date,
    search_term,
    article_title,
    image_dir,
    selectors,
    seen_image_urls,
    article_html="",
):
    html = article_html
    if not html:
        time.sleep(ARTICLE_FETCH_DELAY)
        html = safe_get_text(session, article_url, context=f"{newspaper} article HTML")
    if not html:
        return {"before_rows": [], "after_rows": []}

    all_candidates = extract_image_candidates(html, article_url, selectors, session=session)
    return download_candidate_images(
        session=session,
        candidates=all_candidates,
        article_id=article_id,
        newspaper=newspaper,
        newspaper_slug=newspaper_slug,
        year_window=year_window,
        published_date=published_date,
        updated_date=updated_date,
        search_term=search_term,
        article_title=article_title,
        article_url=article_url,
        image_dir=image_dir,
        seen_image_urls=seen_image_urls,
    )
