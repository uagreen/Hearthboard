import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ProgressRow from "components/services/widget/progress-row";
import { useTranslation } from "next-i18next/pages";

import {
  connectionCount,
  diskRows,
  healthIssues,
  networkTotal,
  updateState,
  volumeRows,
  wantsField,
} from "./diskstation-utils";

import useWidgetAPI from "utils/proxy/use-widget-api";
import withWidgetFields from "utils/widget-fields";

const DEFAULT_FIELDS = ["uptime", "volumeAvailable", "resources.cpu", "resources.mem"];
const DASH = "—";
const ROW = "text-theme-700 dark:text-theme-200 text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1";

function Volumes({ storage, open }) {
  const { t } = useTranslation();
  const rows = volumeRows(storage);

  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{t("diskstation.volumes")}</summary>
      {storage?.data && rows.length === 0 && <div className="px-2 py-1 opacity-70">{t("diskstation.no_volumes")}</div>}
      {rows.map((volume) => (
        <ProgressRow
          key={volume.id}
          title={volume.id}
          percent={volume.percent}
          details={[
            `${t("common.bbytes", { value: volume.used })} / ${t("common.bbytes", { value: volume.total })}`,
            volume.status,
          ]
            .filter(Boolean)
            .join(" · ")}
          error={volume.status !== undefined && volume.status !== "normal"}
          errorText={volume.status}
        />
      ))}
    </details>
  );
}

function Disks({ storage, open }) {
  const { t } = useTranslation();
  const rows = diskRows(storage);

  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{t("diskstation.disks")}</summary>
      {storage?.data && rows.length === 0 && <div className="px-2 py-1 opacity-70">{t("diskstation.no_disks")}</div>}
      {rows.map((disk) => {
        const bad = [disk.status, disk.smart].some((value) => value !== undefined && value !== "normal");
        return (
          <div key={disk.id} className="flex justify-between gap-2 px-2 py-1">
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              {[disk.name, disk.model].filter(Boolean).join(" · ")}
            </span>
            <span className={`shrink-0 ${bad ? "text-red-500" : "opacity-70"}`}>
              {[disk.temp === null ? null : `${disk.temp}°C`, bad ? [disk.status, disk.smart].join("/") : null]
                .filter(Boolean)
                .join(" · ") || DASH}
            </span>
          </div>
        );
      })}
    </details>
  );
}

function updateText(t, update) {
  switch (update.state) {
    case "uptodate":
      return t("diskstation.up_to_date");
    case "available":
      return t("diskstation.update_available", { version: update.version ?? "" });
    default:
      return t("diskstation.update_unknown");
  }
}

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();
  const service = withWidgetFields(configuredService, DEFAULT_FIELDS, 11);
  const { widget } = service;

  const needStorage = Boolean(widget.showVolumes || widget.showDisks) || wantsField(widget, "diskHealth");
  const needUpgrade = wantsField(widget, "update");
  const needConnections = wantsField(widget, "users");

  const { data: infoData, error: infoError } = useWidgetAPI(widget, "system_info");
  const { data: storageData, error: storageError } = useWidgetAPI(widget, "system_storage");
  const { data: utilizationData, error: utilizationError } = useWidgetAPI(widget, "utilization");
  // optional requests: an error here only turns the matching value into a dash
  const { data: detailedStorage } = useWidgetAPI(widget, needStorage ? "storage_info" : "");
  const { data: upgradeData } = useWidgetAPI(widget, needUpgrade ? "upgrade" : "");
  const { data: connectionsData } = useWidgetAPI(widget, needConnections ? "connections" : "");

  if (storageError || infoError || utilizationError) {
    return <Container service={service} error={storageError ?? infoError ?? utilizationError} />;
  }

  if (!storageData || !infoData || !utilizationData) {
    return (
      <Container service={service}>
        <Block label="diskstation.uptime" />
        <Block label="diskstation.volumeAvailable" />
        <Block label="resources.cpu" />
        <Block label="resources.mem" />
        <Block label="diskstation.temperature" />
        <Block label="diskstation.firmware" />
        <Block label="diskstation.update" />
        <Block label="diskstation.diskHealth" />
        <Block label="diskstation.networkDown" />
        <Block label="diskstation.networkUp" />
        <Block label="diskstation.users" />
      </Container>
    );
  }

  // uptime info
  const [hour] = infoData.data.up_time.split(":");
  const days = Math.floor(hour / 24);
  const uptime = `${t("common.number", { value: days })} ${t("diskstation.days")}`;

  // storage info
  const volume = widget.volume
    ? storageData.data.vol_info?.find((vol) => vol.name === widget.volume)
    : storageData.data.vol_info?.[0];
  const usedBytes = parseFloat(volume?.used_size);
  const totalBytes = parseFloat(volume?.total_size);
  const freeBytes = totalBytes - usedBytes;

  // utilization info
  const { cpu, memory } = utilizationData.data;
  const cpuLoad = parseFloat(cpu.user_load) + parseFloat(cpu.system_load);
  const memoryUsage = memory.real_usage
    ? parseFloat(memory.real_usage)
    : 100 - (100 * (parseFloat(memory.avail_real) + parseFloat(memory.cached))) / parseFloat(memory.total_real);

  // optional values
  const temp = infoData.data.sys_temp;
  const firmware = infoData.data.firmware_ver;
  const network = networkTotal(utilizationData);
  const issues = healthIssues(detailedStorage);
  const users = connectionCount(connectionsData);
  const update = needUpgrade && upgradeData ? updateText(t, updateState(upgradeData)) : DASH;
  const health =
    issues === null
      ? DASH
      : issues === 0
        ? t("diskstation.health_ok")
        : t("diskstation.health_issues", { count: issues });

  return (
    <>
      <Container service={service}>
        <Block label="diskstation.uptime" value={uptime} />
        <Block
          label="diskstation.volumeAvailable"
          value={t("common.bbytes", { value: freeBytes, maximumFractionDigits: 1 })}
        />
        <Block label="resources.cpu" value={t("common.percent", { value: cpuLoad })} />
        <Block label="resources.mem" value={t("common.percent", { value: memoryUsage })} />
        <Block
          label="diskstation.temperature"
          value={temp === undefined || temp === null ? DASH : `${t("common.number", { value: temp })}°C`}
        />
        <Block label="diskstation.firmware" value={firmware ?? DASH} />
        <Block label="diskstation.update" value={update} />
        <Block label="diskstation.diskHealth" value={health} />
        <Block
          label="diskstation.networkDown"
          value={network ? t("common.byterate", { value: network.down }) : DASH}
          highlightValue={network?.down}
        />
        <Block
          label="diskstation.networkUp"
          value={network ? t("common.byterate", { value: network.up }) : DASH}
          highlightValue={network?.up}
        />
        <Block label="diskstation.users" value={users ?? DASH} />
      </Container>
      {widget.showVolumes && <Volumes storage={detailedStorage} open={Boolean(widget.expandSections)} />}
      {widget.showDisks && <Disks storage={detailedStorage} open={Boolean(widget.expandSections)} />}
    </>
  );
}
