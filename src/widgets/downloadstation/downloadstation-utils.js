const ACTIVE_STATUSES = ["downloading", "error"];

export function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(20, Math.max(1, Math.trunc(n)));
}

const speedOf = (task) => Number(task?.additional?.transfer?.speed_download) || 0;

export function taskPercent(task) {
  const size = Number(task?.size);
  const downloaded = Number(task?.additional?.transfer?.size_downloaded);
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(downloaded)) return 0;
  return Math.round(Math.min(1, Math.max(0, downloaded / size)) * 1000) / 10;
}

export function taskRows(tasks, count) {
  return (tasks ?? [])
    .filter((task) => ACTIVE_STATUSES.includes(task?.status))
    .sort((a, b) => Number(b.status === "error") - Number(a.status === "error") || speedOf(b) - speedOf(a))
    .slice(0, clampCount(count));
}
