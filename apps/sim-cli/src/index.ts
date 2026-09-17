import { runPartialImplementationScenario } from "@throne/scenario-mvp";

const run = await runPartialImplementationScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log("\nRuler view before the audit:");
console.log(JSON.stringify(run.rulerViewBeforeAudit, null, 2));
console.log("\nRuler view after the audit:");
console.log(JSON.stringify(run.rulerViewAfterAudit, null, 2));
console.log("\nDebug truth:");
console.log(JSON.stringify(run.debugTruth, null, 2));
