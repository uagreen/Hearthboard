// Pure helpers for the inpxlibrary widget (links, shelf lookup, status text).

const STAT_KEYS = {
  books: "totalBooks",
  authors: "totalAuthors",
  series: "totalSeries",
  genres: "totalGenres",
  languages: "totalLanguages",
};

export function clampCount(value, fallback = 10) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : fallback;
}

// The browser-facing address of the library (the service `href`), without a trailing slash.
export function baseUrl(href) {
  if (typeof href !== "string" || href === "" || href === "#") return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function bookUrl(href, id) {
  const base = baseUrl(href);
  return base && id !== undefined && id !== null && id !== "" ? `${base}/book/${id}` : null;
}

export function coverUrl(href, id) {
  const base = baseUrl(href);
  return base && id !== undefined && id !== null && id !== "" ? `${base}/api/books/${id}/cover-thumb` : null;
}

export function findShelf(shelves, name) {
  if (!Array.isArray(shelves) || typeof name !== "string" || name.trim() === "") return undefined;
  const wanted = name.trim().toLowerCase();
  return shelves.find(
    (shelf) =>
      String(shelf?.name ?? "")
        .trim()
        .toLowerCase() === wanted,
  );
}

export function indexingLine(status) {
  if (!status) return null;
  if (status.active) {
    return {
      kind: "indexing",
      done: Number(status.processedArchives) || 0,
      total: Number(status.totalArchives) || 0,
    };
  }
  return status.indexedAt ? { kind: "updated", at: status.indexedAt } : null;
}

export function statValue(stats, field) {
  const value = stats?.[STAT_KEYS[field]];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function authorsText(book) {
  return typeof book?.authors === "string" ? book.authors.trim() : "";
}
