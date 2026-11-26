const STATUS_STOPPED = 0;
const STATUS_DOWNLOAD_WAIT = 3;
const STATUS_DOWNLOADING = 4;
const STATUS_SEED_WAIT = 5;

const hasError = (torrent) => Number(torrent?.error) > 0;

export function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

export function percentOf(torrent) {
  const n = Number(torrent?.percentDone);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(1, Math.max(0, n)) * 1000) / 10;
}

export function formatEta(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function countStates(torrents) {
  const counts = { queued: 0, paused: 0, errored: 0 };
  for (const torrent of torrents ?? []) {
    if (torrent.status === STATUS_DOWNLOAD_WAIT || torrent.status === STATUS_SEED_WAIT) counts.queued += 1;
    if (torrent.status === STATUS_STOPPED) counts.paused += 1;
    if (hasError(torrent)) counts.errored += 1;
  }
  return counts;
}

export function downloadRows(torrents, count) {
  return (torrents ?? [])
    .filter((torrent) => torrent.status === STATUS_DOWNLOADING || (hasError(torrent) && !(torrent.percentDone >= 1)))
    .sort((a, b) => Number(hasError(b)) - Number(hasError(a)) || (b.rateDownload ?? 0) - (a.rateDownload ?? 0))
    .slice(0, clampCount(count));
}
