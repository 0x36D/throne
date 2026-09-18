import { runDynamicPromotionScenario } from "@throne/scenario-mvp";
import {
  createTranslator,
  defaultLocale,
  isLocale,
} from "@throne/localization";

const requestedLocale = process.env.THRONE_LOCALE;
const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
const t = createTranslator(locale);

const run = await runDynamicPromotionScenario({ outputLanguage: locale });

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log(`\n${t("cli.promotionBefore")}`);
console.log(JSON.stringify(run.actorBeforePromotion, null, 2));
console.log(`\n${t("cli.promotionAfter")}`);
console.log(JSON.stringify(run.actorAfterPromotion, null, 2));
console.log(`\n${t("cli.promotionRuler")}`);
console.log(JSON.stringify(run.rulerViewFinal, null, 2));
console.log(`\n${t("cli.debugTruth")}`);
console.log(JSON.stringify(run.debugTruth, null, 2));
