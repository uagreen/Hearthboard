import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import ProgressRow from "components/services/widget/progress-row";
import { useTranslation } from "next-i18next/pages";

import { clampCount, taskPercent, taskRows } from "./downloadstation-utils";

import useWidgetAPI from "utils/proxy/use-widget-api";

const ROW = "text-theme-700 dark:text-theme-200 text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1";

function Downloads({ tasks, count, open }) {
  const { t } = useTranslation();
  const rows = taskRows(tasks, count);

  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{t("downloadstation.downloads")}</summary>
      {rows.length === 0 && <div className="px-2 py-1 opacity-70">{t("downloadstation.no_downloads")}</div>}
      {rows.map((task) => (
        <ProgressRow
          key={task.id ?? task.title}
          title={task.title}
          percent={taskPercent(task)}
          details={t("common.byterate", { value: task.additional?.transfer?.speed_download ?? 0 })}
          error={task.status === "error"}
          errorText={t("downloadstation.error")}
        />
      ))}
    </details>
  );
}

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;
  const { data: listData, error: listError } = useWidgetAPI(widget, "list");

  if (listError) {
    return <Container service={service} error={listError} />;
  }

  const tasks = listData?.data?.tasks;
  if (!tasks) {
    return (
      <Container service={service}>
        <Block label="downloadstation.leech" />
        <Block label="downloadstation.download" />
        <Block label="downloadstation.seed" />
        <Block label="downloadstation.upload" />
      </Container>
    );
  }

  const rateDl = tasks.reduce((acc, task) => acc + (task?.additional?.transfer?.speed_download ?? 0), 0);
  const rateUl = tasks.reduce((acc, task) => acc + (task?.additional?.transfer?.speed_upload ?? 0), 0);
  const completed = tasks.filter((task) => task?.additional?.transfer?.size_downloaded === task?.size)?.length || 0;
  const leech = tasks.length - completed || 0;

  return (
    <>
      <Container service={service}>
        <Block label="downloadstation.leech" value={t("common.number", { value: leech })} />
        <Block
          label="downloadstation.download"
          value={t("common.byterate", { value: rateDl })}
          highlightValue={rateDl}
        />
        <Block label="downloadstation.seed" value={t("common.number", { value: completed })} />
        <Block label="downloadstation.upload" value={t("common.byterate", { value: rateUl })} highlightValue={rateUl} />
      </Container>
      {widget.showDownloads && (
        <Downloads tasks={tasks} count={clampCount(widget.downloadsCount)} open={Boolean(widget.expandSections)} />
      )}
    </>
  );
}
