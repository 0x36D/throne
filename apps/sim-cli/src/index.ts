import { bootstrapInitialState, bootstrapModel } from "@throne/scenario-mvp";
import { simTime } from "@throne/shared-types";
import { InMemoryEventStore, SimulationKernel } from "@throne/sim-core";

const store = new InMemoryEventStore();
const kernel = new SimulationKernel(
  bootstrapInitialState,
  bootstrapModel,
  store,
  "bootstrap",
);

await kernel.schedule({
  eventType: "message.depart",
  scheduledAt: simTime(10),
  actorId: "governor",
  targetIds: ["ruler"],
  payload: { messageId: "message-1" },
});

await kernel.runUntilIdle();

const records = await store.readAll();
for (const record of records) {
  if (record.kind === "committed") {
    console.log(
      `[t=${record.event.occurredAt}] ${record.event.eventType} ${JSON.stringify(record.event.payload)}`,
    );
  }
}

console.log(`Final state: ${JSON.stringify(kernel.state, null, 2)}`);
