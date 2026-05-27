from pathlib import Path
from urllib.parse import urljoin
import mimetypes
import re
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
    "ipcc_window",
    "search_term",
    "title",
    "article_url",
    "section",
    "published_date",
    "image_count",
]

IMAGE_COLUMNS = [
    "article_id",
    "newspaper",
    "ipcc_window",
    "search_term",
    "article_title",
    "article_url",
    "published_date",
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
    "datawrapper",
    "flourish",
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
    "interactive",
    "map",
    "diagram",
    "table",
    "data",
    "visualization",
    "visualisation",
    "tracker",
]

NYT_MULTIMEDIA_DATA_TERMS = [
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
    "source:",
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

EMBED_PROVIDERS = [
    {
        "name": "datawrapper",
        "pattern": re.compile(r"https?://datawrapper\.dwcdn\.net/([A-Za-z0-9]+)/(\d+)/?"),
        "embed_url": lambda m: f"https://datawrapper.dwcdn.net/{m.group(1)}/{m.group(2)}/",
        "context": "datawrapper chart",
    },
    {
        "name": "flourish",
        "pattern": re.compile(r"https?://flo\.uri\.sh/visualisation/(\d+)"),
        "embed_url": lambda m: f"https://flo.uri.sh/visualisation/{m.group(1)}/embed",
        "context": "flourish visualization",
    },
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
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
        return suffix
    guessed, _ = mimetypes.guess_type(url)
    if guessed:
        ext = mimetypes.guess_extension(guessed)
        if ext:
            return ext
    return ".jpg"


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


def ensure_output_dirs(output_dir):
    newspaper_slug = output_dir.name
    image_dir = output_dir / image_folder_name(newspaper_slug)
    output_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)
    return output_dir / "articles.csv", output_dir / f"{newspaper_slug}_images.csv", image_dir


def make_empty_dataframe(columns):
    return pd.DataFrame(columns=columns)


def get_active_windows():
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


def score_chart_candidate(candidate):
    combined = " ".join(
        [
            candidate.get("image_url", ""),
            candidate.get("caption", ""),
            candidate.get("credit", ""),
            candidate.get("alt_text", ""),
            candidate.get("context_text", ""),
        ]
    ).lower()

    positive_hits = sorted({term for term in CHART_KEYWORDS if term in combined})
    negative_hits = sorted({term for term in PHOTO_KEYWORDS if term in combined})
    score = len(positive_hits) - (2 * len(negative_hits))
    return score, positive_hits, negative_hits


def is_chart_candidate(candidate):
    score, positive_hits, negative_hits = score_chart_candidate(candidate)
    return score >= 1, score, positive_hits, negative_hits


def _resolve_embed_image_url(session, embed_url):
    """Fetch an embed page and extract its og:image or first <img> as the static image URL."""
    try:
        response = request_with_retries(session, embed_url, context=f"embed {embed_url}")
        soup = BeautifulSoup(response.text, "html.parser")
        for attr in ("og:image", "twitter:image"):
            tag = soup.find("meta", property=attr) or soup.find("meta", attrs={"name": attr})
            if tag and tag.get("content"):
                return tag["content"].strip()
        img = soup.find("img")
        if img:
            src = img.get("src") or img.get("data-src") or ""
            if src:
                return urljoin(embed_url, src)
    except requests.RequestException:
        pass
    return ""


def extract_embedded_chart_candidates(session, html, article_url, known_urls):
    """Detect Datawrapper/Flourish iframes, fetch their pages, and return real image candidates."""
    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    for tag in soup.find_all(["iframe", "div", "figure"]):
        src = next(
            (tag.get(attr) for attr in ("src", "data-src", "data-url") if tag.get(attr)),
            "",
        )
        if not src:
            continue
        for provider in EMBED_PROVIDERS:
            m = provider["pattern"].search(src)
            if not m:
                continue
            embed_url = provider["embed_url"](m)
            image_url = _resolve_embed_image_url(session, embed_url)
            if not image_url or image_url in known_urls:
                break
            known_urls.add(image_url)
            parent = tag.parent
            figcaption = parent.find("figcaption") if parent else None
            caption = collect_text(figcaption) if figcaption else ""
            candidates.append({
                "image_url": image_url,
                "caption": caption,
                "credit": "",
                "alt_text": provider["context"],
                "context_text": provider["context"],
            })
            break
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

    if session is not None:
        for candidate in extract_embedded_chart_candidates(session, html, article_url, known_urls):
            candidates.append(candidate)

    return candidates


def filter_chart_candidates(candidates):
    kept = []
    for candidate in candidates:
        keep, _, _, _ = is_chart_candidate(candidate)
        if keep:
            kept.append(candidate)
    return kept


def text_for_candidate_matching(candidate):
    return " ".join(
        [
            candidate.get("image_url", ""),
            candidate.get("caption", ""),
            candidate.get("credit", ""),
            candidate.get("alt_text", ""),
            candidate.get("context_text", ""),
        ]
    ).lower()


def is_nyt_multimedia_chart_candidate(candidate):
    combined = text_for_candidate_matching(candidate)
    chart_hits = sorted({term for term in NYT_MULTIMEDIA_CHART_TERMS if term in combined})
    data_hits = sorted({term for term in NYT_MULTIMEDIA_DATA_TERMS if term in combined})
    photo_hits = sorted({term for term in NYT_MULTIMEDIA_PHOTO_TERMS if term in combined})
    has_quantitative_signal = bool(
        re.search(r"(%|°|\bppm\b|\b\d+(?:\.\d+)?\s?(?:c|f|percent|degrees?)\b)", combined)
    )

    if photo_hits and not chart_hits:
        return False, chart_hits, data_hits, photo_hits
    if chart_hits:
        return True, chart_hits, data_hits, photo_hits
    if data_hits and has_quantitative_signal and not photo_hits:
        return True, chart_hits, data_hits, photo_hits
    return False, chart_hits, data_hits, photo_hits


def filter_nyt_multimedia_chart_candidates(candidates):
    kept = []
    for candidate in candidates:
        keep, _, _, _ = is_nyt_multimedia_chart_candidate(candidate)
        if keep:
            kept.append(candidate)
    return kept


def candidate_to_image_row(
    candidate,
    article_id,
    newspaper,
    ipcc_window,
    search_term,
    article_title,
    article_url,
    published_date,
    image_index,
    local_image_path="",
):
    return {
        "article_id": article_id,
        "newspaper": newspaper,
        "ipcc_window": ipcc_window,
        "search_term": search_term,
        "article_title": article_title,
        "article_url": article_url,
        "published_date": published_date,
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
    ipcc_window,
    published_date,
    search_term,
    article_title,
    article_url,
    image_dir,
    seen_image_urls,
    require_chart_match=True,
    candidate_filter=None,
):
    before_rows = []
    after_rows = []
    if candidate_filter:
        downloadable_candidates = candidate_filter(candidates)
    elif require_chart_match:
        downloadable_candidates = filter_chart_candidates(candidates)
    else:
        downloadable_candidates = list(candidates)

    for index, candidate in enumerate(candidates, start=1):
        before_rows.append(
            candidate_to_image_row(
                candidate=candidate,
                article_id=article_id,
                newspaper=newspaper,
                ipcc_window=ipcc_window,
                search_term=search_term,
                article_title=article_title,
                article_url=article_url,
                published_date=published_date,
                image_index=index,
            )
        )

    for index, candidate in enumerate(downloadable_candidates, start=1):
        image_url = candidate["image_url"]
        if image_url in seen_image_urls:
            continue
        seen_image_urls.add(image_url)

        image_ext = infer_extension_from_url(image_url)
        safe_date = published_date or "undated"
        image_name = f"{newspaper_slug}_{safe_date}_{article_id}_img{index:02d}{image_ext}"
        image_path = image_dir / image_name

        if image_path.exists() or download_image(session, image_url, image_path):
            after_rows.append(
                candidate_to_image_row(
                    candidate=candidate,
                    article_id=article_id,
                    newspaper=newspaper,
                    ipcc_window=ipcc_window,
                    search_term=search_term,
                    article_title=article_title,
                    article_url=article_url,
                    published_date=published_date,
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

    time_tag = soup.find("time")
    if time_tag:
        normalized = normalize_date(time_tag.get("datetime") or time_tag.get_text(" ", strip=True))
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
        return normalize_date(fallback_match.group(1))

    return ""


def download_article_charts(
    session,
    article_url,
    article_id,
    newspaper,
    newspaper_slug,
    ipcc_window,
    published_date,
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

    before_rows = []
    after_rows = []
    all_candidates = extract_image_candidates(html, article_url, selectors, session=session)
    return download_candidate_images(
        session=session,
        candidates=all_candidates,
        article_id=article_id,
        newspaper=newspaper,
        newspaper_slug=newspaper_slug,
        ipcc_window=ipcc_window,
        published_date=published_date,
        search_term=search_term,
        article_title=article_title,
        article_url=article_url,
        image_dir=image_dir,
        seen_image_urls=seen_image_urls,
    )
