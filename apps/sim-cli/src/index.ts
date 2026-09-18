import { runLossOfControlScenario } from "@throne/scenario-mvp";
import {
  createTranslator,
  defaultLocale,
  isLocale,
} from "@throne/localization";

const requestedLocale = process.env.THRONE_LOCALE;
const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
const t = createTranslator(locale);

const run = await runLossOfControlScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log(`\n${t("cli.rulerFirst")}`);
console.log(JSON.stringify(run.rulerViewAfterFirstDecision, null, 2));
console.log(`\n${t("cli.rulerFinal")}`);
console.log(JSON.stringify(run.rulerViewFinal, null, 2));
console.log(`\n${t("cli.controlFirst")}`);
console.log(JSON.stringify(run.controlAfterFirstDecision, null, 2));
console.log(`\n${t("cli.controlFinal")}`);
console.log(JSON.stringify(run.controlFinal, null, 2));
console.log(`\n${t("cli.debugTruth")}`);
console.log(JSON.stringify(run.debugTruth, null, 2));
