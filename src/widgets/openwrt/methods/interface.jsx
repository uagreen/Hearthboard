import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";

import useWidgetAPI from "utils/proxy/use-widget-api";
import withWidgetFields from "utils/widget-fields";

const DEFAULT_FIELDS = ["widget.status", "bytesTx", "bytesRx"];
const DASH = "—";

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();
  const service = withWidgetFields(configuredService, DEFAULT_FIELDS, 5);
  const { data, error } = useWidgetAPI(service.widget);

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data) {
    return null;
  }

  const { up, bytesTx, bytesRx, rxRate, txRate } = data;
  const rate = (value) => (value === null || value === undefined ? DASH : t("common.byterate", { value }));

  return (
    <Container service={service}>
      <Block label="widget.status" value={up ? t("openwrt.up") : t("openwrt.down")} />
      <Block label="openwrt.bytesTx" value={t("common.bytes", { value: bytesTx })} highlightValue={bytesTx} />
      <Block label="openwrt.bytesRx" value={t("common.bytes", { value: bytesRx })} highlightValue={bytesRx} />
      <Block label="openwrt.rxRate" value={rate(rxRate)} highlightValue={rxRate} />
      <Block label="openwrt.txRate" value={rate(txRate)} highlightValue={txRate} />
    </Container>
  );
}
