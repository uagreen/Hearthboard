import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";
import withWidgetFields from "utils/widget-fields";

const DEFAULT_FIELDS = ["uptime", "cpuLoad"];
const DASH = "—";

function updateText(t, update) {
  switch (update?.state) {
    case "uptodate":
      return t("openwrt.up_to_date");
    case "patch":
      return t("openwrt.update_patch", { version: update.latest });
    case "series":
      return t("openwrt.update_series", { version: update.latest });
    case "unknown":
      return t("openwrt.update_unknown");
    default:
      return DASH;
  }
}

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();
  const service = withWidgetFields(configuredService, DEFAULT_FIELDS, 4);
  const { data, error } = useWidgetAPI(service.widget);

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return null;
  }

  const { uptime, cpuLoad, clients, update } = data;

  return (
    <Container service={service}>
      <Block label="openwrt.uptime" value={t("common.duration", { value: uptime })} />
      <Block label="openwrt.cpuLoad" value={cpuLoad} />
      <Block label="openwrt.clients" value={clients ?? DASH} />
      <Block label="openwrt.update" value={updateText(t, update)} />
    </Container>
  );
}
