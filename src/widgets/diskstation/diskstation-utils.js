const isBad = (value) => value !== undefined && value !== null && value !== "normal";

export function wantsField(widget, name) {
  let fields = widget?.fields;
  if (typeof fields === "string") {
    try {
      fields = JSON.parse(fields);
    } catch {
      return false;
    }
  }
  return Array.isArray(fields) && (fields.includes(name) || fields.includes(`diskstation.${name}`));
}

export function volumeRows(storage) {
  const volumes = storage?.data?.volumes;
  if (!Array.isArray(volumes)) return [];
  return volumes.map((volume) => {
    const total = Number(volume?.size?.total) || 0;
    const used = Number(volume?.size?.used) || 0;
    const percent = total > 0 ? Math.round(Math.min(1, Math.max(0, used / total)) * 1000) / 10 : 0;
    return { id: volume.id, percent, used, total, status: volume.status };
  });
}

export function diskRows(storage) {
  const disks = storage?.data?.disks;
  if (!Array.isArray(disks)) return [];
  return disks.map((disk) => ({
    id: disk.id,
    name: disk.name ?? disk.id,
    model: disk.model,
    temp:
      Number.isFinite(Number(disk.temp)) && disk.temp !== null && disk.temp !== undefined ? Number(disk.temp) : null,
    status: disk.status,
    smart: disk.smart_status,
  }));
}

export function healthIssues(storage) {
  const disks = storage?.data?.disks;
  const volumes = storage?.data?.volumes;
  if (!Array.isArray(disks) && !Array.isArray(volumes)) return null;
  const badDisks = (disks ?? []).filter((disk) => isBad(disk.status) || isBad(disk.smart_status)).length;
  const badVolumes = (volumes ?? []).filter((volume) => isBad(volume.status)).length;
  return badDisks + badVolumes;
}

export function networkTotal(utilization) {
  const total = utilization?.data?.network?.find((entry) => entry.device === "total");
  if (!total) return null;
  return { down: Number(total.rx) || 0, up: Number(total.tx) || 0 };
}

export function updateState(upgrade) {
  const info = upgrade?.data?.update ?? upgrade?.data;
  if (info?.available === true) return { state: "available", version: info.version };
  if (info?.available === false) return { state: "uptodate" };
  return { state: "unknown" };
}

export function connectionCount(connections) {
  const data = connections?.data;
  if (typeof data?.total === "number") return data.total;
  if (Array.isArray(data?.items)) return data.items.length;
  return null;
}
