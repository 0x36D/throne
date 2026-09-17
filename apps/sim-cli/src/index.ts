import { runContradictoryOrdersScenario } from "@throne/scenario-mvp";

const run = await runContradictoryOrdersScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log("\nRuler view before the commander's response:");
console.log(JSON.stringify(run.rulerViewBeforeResponse, null, 2));
console.log("\nRuler view after the commander's response:");
console.log(JSON.stringify(run.rulerViewAfterResponse, null, 2));
console.log("\nDebug truth:");
console.log(JSON.stringify(run.debugTruth, null, 2));
