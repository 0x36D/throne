import { runFalseReportScenario } from "@throne/scenario-mvp";

const run = await runFalseReportScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log("\nRuler view:");
console.log(JSON.stringify(run.rulerView, null, 2));
console.log("\nDebug truth:");
console.log(JSON.stringify(run.debugTruth, null, 2));
