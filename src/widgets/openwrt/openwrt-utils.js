const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(value) {
  const match = VERSION_RE.exec(String(value ?? ""));
  return match ? match.slice(1).map(Number) : null;
}

const seriesOf = (parts) => `${parts[0]}.${parts[1]}`;

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function computeRate(prev, bytes, at) {
  if (!prev || at <= prev.at || bytes < prev.bytes) return null;
  return Math.round(((bytes - prev.bytes) * 1000) / (at - prev.at));
}

export function wantsField(widget, name) {
  let fields = widget?.fields;
  if (typeof fields === "string") {
    try {
      fields = JSON.parse(fields);
    } catch {
      return false;
    }
  }
  return Array.isArray(fields) && (fields.includes(name) || fields.includes(`openwrt.${name}`));
}

export function updateStatus(current, versions) {
  const unknown = { state: "unknown" };
  const cur = parseVersion(current);
  const list = versions?.versions_list;
  if (!cur || !Array.isArray(list)) return unknown;

  const stable = list.map(parseVersion).filter(Boolean);
  const sameSeries = stable.filter((v) => seriesOf(v) === seriesOf(cur));
  if (sameSeries.length === 0) return unknown;

  const latestPatch = sameSeries.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
  if (compare(latestPatch, cur) > 0) return { state: "patch", latest: latestPatch.join(".") };

  const stableVersion = parseVersion(versions?.stable_version);
  if (stableVersion && compare(stableVersion, cur) > 0 && seriesOf(stableVersion) !== seriesOf(cur)) {
    return { state: "series", latest: stableVersion.join(".") };
  }
  return { state: "uptodate" };
}
