// Pure helpers for the Jellyfin library sections (links, posters, ratings, user choice).

const LIBRARY_ROUTES = {
  movies: { route: "movies", collectionType: "movies" },
  tvshows: { route: "tv", collectionType: "tvshows" },
  music: { route: "music", collectionType: "music" },
};

export function clampCount(value, fallback = 5) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : fallback;
}

// Base of the Jellyfin web client, built from the service's browser-facing href.
export function webBase(href) {
  if (typeof href !== "string" || href === "" || href === "#") return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/web`;
}

export function libraryUrl(href, view) {
  const base = webBase(href);
  if (!base || !view?.Id) return null;
  const { route, collectionType } = LIBRARY_ROUTES[view.CollectionType] ?? { route: "mixed", collectionType: "mixed" };
  return `${base}/#/${route}?topParentId=${view.Id}&collectionType=${collectionType}`;
}

export function itemUrl(href, item) {
  const base = webBase(href);
  if (!base || !item?.Id) return null;
  return `${base}/#/details?id=${item.Id}${item.ServerId ? `&serverId=${item.ServerId}` : ""}`;
}

// Jellyfin serves images without authentication, so the browser loads them directly.
export function posterUrl(href, item, maxHeight = 360) {
  const base = webBase(href);
  if (!base || !item) return null;
  const root = base.slice(0, -"/web".length);
  const isEpisode = item.Type === "Episode";
  const id = isEpisode ? item.SeriesId : item.Id;
  const tag = isEpisode ? item.SeriesPrimaryImageTag : item.ImageTags?.Primary;
  if (!id || !tag) return null;
  return `${root}/Items/${id}/Images/Primary?maxHeight=${maxHeight}&tag=${encodeURIComponent(tag)}`;
}

export function formatRating(item) {
  const rating = item?.CommunityRating;
  return typeof rating === "number" && rating > 0 ? `★ ${rating.toFixed(1)}` : null;
}

const pad = (n) => String(n).padStart(2, "0");

export function itemTitle(item) {
  if (item?.Type === "Episode") {
    const numbers = `${item.ParentIndexNumber ? `S${pad(item.ParentIndexNumber)}` : ""}${
      item.IndexNumber ? `E${pad(item.IndexNumber)}` : ""
    }`;
    return {
      title: item.SeriesName ?? item.Name,
      subtitle: [numbers, item.Name].filter(Boolean).join(" · ") || null,
    };
  }
  return { title: item?.Name, subtitle: item?.ProductionYear ? String(item.ProductionYear) : null };
}

export function pickUser(users, storedId, configuredName) {
  if (!Array.isArray(users) || users.length === 0) return undefined;
  const wanted = configuredName?.toLowerCase();
  return (
    users.find((u) => u.Id === storedId) ??
    (wanted ? users.find((u) => u.Name?.toLowerCase() === wanted) : undefined) ??
    users[0]
  );
}
