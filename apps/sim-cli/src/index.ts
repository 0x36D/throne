import { runLossOfControlScenario } from "@throne/scenario-mvp";

const run = await runLossOfControlScenario();

for (const record of run.records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log("\nRuler view after the first command is obeyed:");
console.log(JSON.stringify(run.rulerViewAfterFirstDecision, null, 2));
console.log("\nRuler view after the later command is overruled:");
console.log(JSON.stringify(run.rulerViewFinal, null, 2));
console.log("\nDerived practical control after the first decision:");
console.log(JSON.stringify(run.controlAfterFirstDecision, null, 2));
console.log("\nDerived practical control at the end:");
console.log(JSON.stringify(run.controlFinal, null, 2));
console.log("\nDebug truth:");
console.log(JSON.stringify(run.debugTruth, null, 2));
