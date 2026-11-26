import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import { clampCount, countStates, downloadRows, formatEta, percentOf } from "./transmission-utils";

import useWidgetAPI from "utils/proxy/use-widget-api";
import withWidgetFields from "utils/widget-fields";

const DEFAULT_FIELDS = ["leech", "download", "seed", "upload"];
const ROW = "text-theme-700 dark:text-theme-200 text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1";

function DownloadRow({ torrent }) {
  const { t } = useTranslation();
  const failed = Number(torrent.error) > 0;
  const percent = percentOf(torrent);
  const eta = formatEta(torrent.eta);
  const size = Number(torrent.totalSize) > 0 ? t("common.bytes", { value: torrent.totalSize }) : "";
  const details = [t("common.byterate", { value: torrent.rateDownload ?? 0 }), eta, size].filter(Boolean).join(" · ");

  return (
    <div className="px-2 py-1">
      <div className="flex justify-between gap-2 leading-tight">
        <span className="whitespace-nowrap overflow-hidden text-ellipsis font-medium" title={torrent.name}>
          {torrent.name ?? ""}
        </span>
        <span className="shrink-0">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 mt-1 rounded-full bg-theme-300/40 dark:bg-theme-900/40 overflow-hidden"
      >
        <div
          className={`h-full rounded-full ${failed ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-0.5 opacity-70">{details}</div>
      {failed && torrent.errorString && <div className="text-red-500">{torrent.errorString}</div>}
    </div>
  );
}

function Downloads({ torrents, count, open }) {
  const { t } = useTranslation();
  const rows = downloadRows(torrents, count);

  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{t("transmission.downloads")}</summary>
      {rows.length === 0 && <div className="px-2 py-1 opacity-70">{t("transmission.no_downloads")}</div>}
      {rows.map((torrent) => (
        <DownloadRow key={torrent.id ?? torrent.name} torrent={torrent} />
      ))}
    </details>
  );
}

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();
  const service = withWidgetFields(configuredService, DEFAULT_FIELDS, 7);
  const { widget } = service;

  const { data: torrentData, error: torrentError } = useWidgetAPI(widget);

  if (torrentError) {
    return <Container service={service} error={torrentError} />;
  }

  if (!torrentData) {
    return (
      <Container service={service}>
        <Block label="transmission.leech" />
        <Block label="transmission.download" />
        <Block label="transmission.seed" />
        <Block label="transmission.upload" />
        <Block label="transmission.queued" />
        <Block label="transmission.paused" />
        <Block label="transmission.errored" />
      </Container>
    );
  }

  const { torrents } = torrentData.arguments;

  const rateDl = torrents.reduce((acc, torrent) => acc + torrent.rateDownload, 0);
  const rateUl = torrents.reduce((acc, torrent) => acc + torrent.rateUpload, 0);
  const completed = torrents.filter((torrent) => torrent.percentDone === 1)?.length || 0;
  const leech = torrents.length - completed || 0;
  const { queued, paused, errored } = countStates(torrents);

  return (
    <>
      <Container service={service}>
        <Block label="transmission.leech" value={t("common.number", { value: leech })} />
        <Block label="transmission.download" value={t("common.byterate", { value: rateDl })} highlightValue={rateDl} />
        <Block label="transmission.seed" value={t("common.number", { value: completed })} />
        <Block label="transmission.upload" value={t("common.byterate", { value: rateUl })} highlightValue={rateUl} />
        <Block label="transmission.queued" value={t("common.number", { value: queued })} />
        <Block label="transmission.paused" value={t("common.number", { value: paused })} />
        <Block label="transmission.errored" value={t("common.number", { value: errored })} />
      </Container>
      {widget.showDownloads && (
        <Downloads
          torrents={torrents}
          count={clampCount(widget.downloadsCount)}
          open={Boolean(widget.expandSections)}
        />
      )}
    </>
  );
}
