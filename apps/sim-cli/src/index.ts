import { runDecisionRevisionScenario } from "@throne/scenario-mvp";

const run = await runDecisionRevisionScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log("\nRuler view after the first order departs:");
console.log(JSON.stringify(run.rulerViewAfterFirstOrder, null, 2));
console.log("\nRuler view after issuing the countermand:");
console.log(JSON.stringify(run.rulerViewAfterRevision, null, 2));
console.log("\nRuler view after the commander's confirmation:");
console.log(JSON.stringify(run.rulerViewFinal, null, 2));
console.log("\nDebug truth:");
console.log(JSON.stringify(run.debugTruth, null, 2));
