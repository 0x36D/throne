import { describe, expect, it } from "vitest";
import {
  simTime,
  type ActorDecisionInput,
  type ActorDecisionOutput,
  type DomainEvent,
  type Observation,
} from "@throne/shared-types";
import { InMemoryEventStore, SimulationKernel, replay } from "@throne/sim-core";
import type { DecisionPolicy } from "@throne/agent-runtime/policy";
import {
  continuousCrisisInitialState,
  createContinuousCrisisModel,
  continuousCrisisRulerView,
  continuousCommanderInput,
  reduceContinuousCrisisState,
  startContinuousCrisisSession,
} from "./continuous-crisis.ts";

const output = (capabilityId = "obey_ruler"): ActorDecisionOutput => ({
  selectedIntent: { goal: "protect the guard", capabilityId, parameters: {} },
  reasoningSummary: "A brief private justification.",
});
const obey: DecisionPolicy = {
  async decide() {
    return output();
  },
};

async function fixture(policy = obey) {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    continuousCrisisInitialState,
    createContinuousCrisisModel(policy, "continuous-test", "zh-CN"),
    store,
    "continuous-test",
  );
  await kernel.schedule({
    eventType: "court.open",
    scheduledAt: simTime(10),
    payload: { round: 1 },
  });
  await kernel.runUntilIdle();
  await kernel.schedule({
    eventType: "court.issue",
    scheduledAt: kernel.time,
    payload: { round: 1, choice: "hold_imperial_palace" },
  });
  return { kernel, store };
}

describe("continuous crisis", () => {
  it("rejects concurrent direct submissions before scheduling two decrees", async () => {
    const session = await startContinuousCrisisSession({
      runId: "concurrent",
      outputLanguage: "en",
      npcPolicy: obey,
    });
    const first = session.choose(
      session.rulerView.decisionEpisodeId,
      "hold_imperial_palace",
    );
    await expect(
      session.choose(session.rulerView.decisionEpisodeId, "move_to_east_gate"),
    ).rejects.toThrow("not open");
    await first;
    await session.choose(
      session.rulerView.decisionEpisodeId,
      "maintain_deployment",
    );
    expect((await session.result()).state.orders).toHaveLength(2);
  });
  it("keeps order, action and report separate across both rounds", async () => {
    const inputs: ActorDecisionInput[] = [];
    const { kernel, store } = await fixture({
      async decide(input) {
        inputs.push(input);
        return output();
      },
    });
    await kernel.step();
    expect(kernel.state.unitLocationId).toBe("location:guard-barracks");
    await kernel.step();
    expect(kernel.time).toBe(15);
    expect(kernel.state.orders[0]?.receivedAt).toBeUndefined();
    await kernel.step();
    expect(kernel.time).toBe(45);
    expect(inputs).toHaveLength(0);
    expect(
      JSON.stringify(continuousCrisisRulerView(kernel.state, kernel.time)),
    ).not.toContain("chancellor_order");
    await kernel.step();
    expect(kernel.time).toBe(50);
    expect(kernel.state.unitLocationId).toBe("location:guard-barracks");
    await kernel.step();
    expect(kernel.time).toBe(60);
    expect(kernel.state.outcomes[1]).toBe(true);
    expect(
      continuousCrisisRulerView(kernel.state, kernel.time).observations.some(
        (o) => o.payload.finding === "palace_result",
      ),
    ).toBe(false);
    expect(
      kernel.state.observations
        .filter((o) => o.actorId === "actor:guard-commander")
        .some((o) => o.payload.protected !== undefined),
    ).toBe(false);
    await kernel.runUntilIdle();
    expect(kernel.time).toBe(100);
    const firstOrder = kernel.state.orders[0];
    const secondView = continuousCrisisRulerView(kernel.state, kernel.time);
    expect(secondView.choices[0]).toEqual({
      id: "maintain_deployment",
      targetLocationId: "location:imperial-palace",
    });
    await kernel.schedule({
      eventType: "court.issue",
      scheduledAt: kernel.time,
      payload: { round: 2, choice: "move_to_east_gate" },
    });
    await kernel.step();
    await kernel.step();
    expect(kernel.time).toBe(105);
    expect(kernel.state.unitLocationId).toBe("location:imperial-palace");
    expect(kernel.state.orders[0]).toEqual(firstOrder);
    expect(kernel.state.orders[1]?.receivedAt).toBeUndefined();
    const ruler = continuousCrisisRulerView(kernel.state, kernel.time);
    expect(JSON.stringify(ruler)).not.toContain("justification");
    expect(
      ruler.observations.some((o) => o.payload.finding === "warehouse_result"),
    ).toBe(false);
    await kernel.runUntilIdle();
    expect(
      kernel.state.orders.map((o) => [
        o.issuedAt,
        o.departedAt,
        o.receivedAt,
        o.executedAt,
        o.reportedAt,
      ]),
    ).toEqual([
      [10, 15, 45, 60, 90],
      [100, 105, 135, 150, 180],
    ]);
    expect(kernel.state.unitLocationId).toBe("location:east-gate");
    expect(kernel.state.outcomes).toEqual({ 1: true, 2: true });
    expect(kernel.state.orders[0]).toEqual(firstOrder);
    expect(
      inputs[0]?.observations.some(
        (o) => o.payload.finding === "palace_result",
      ),
    ).toBe(false);
    expect(
      inputs[1]?.observations.find((o) => o.payload.finding === "palace_result")
        ?.observedAt,
    ).toBe(135);
    expect(
      inputs[1]?.memories.find((m) => m.kind === "own_execution")
        ?.actualLocationId,
    ).toBe("location:imperial-palace");
    expect(inputs[0]?.identity).toEqual(inputs[1]?.identity);
    expect(inputs[0]?.relationships).toEqual(inputs[1]?.relationships);
    expect(JSON.stringify(inputs)).not.toContain('"threats"');
    expect(
      replay(
        continuousCrisisInitialState,
        await store.readAll(),
        reduceContinuousCrisisState,
      ),
    ).toEqual(kernel.state);
  });

  it.each(["hold_imperial_palace", "move_to_east_gate"] as const)(
    "retains actual %s history, not a canned prior experience",
    async (choice) => {
      const session = await startContinuousCrisisSession({
        runId: choice,
        outputLanguage: "en",
        npcPolicy: obey,
      });
      await session.choose(session.rulerView.decisionEpisodeId, choice);
      await session.choose(
        session.rulerView.decisionEpisodeId,
        "maintain_deployment",
      );
      const run = await session.result();
      expect(run.state.outcomes).toEqual(
        choice === "hold_imperial_palace"
          ? { 1: true, 2: false }
          : { 1: false, 2: true },
      );
      const past = run.state.decisions[1]!.input.memories.find(
        (m) => m.kind === "own_execution",
      );
      expect(past?.actualLocationId).toBe(
        choice === "hold_imperial_palace"
          ? "location:imperial-palace"
          : "location:east-gate",
      );
      expect(past?.royalTargetLocationId).toBe(past?.actualLocationId);
    },
  );

  it("maintains reported actual deployment even when the first decree was ignored", async () => {
    let calls = 0;
    const session = await startContinuousCrisisSession({
      runId: "disobey",
      outputLanguage: "zh-CN",
      npcPolicy: {
        async decide() {
          return output(++calls === 1 ? "follow_chancellor" : "obey_ruler");
        },
      },
    });
    await session.choose(
      session.rulerView.decisionEpisodeId,
      "hold_imperial_palace",
    );
    expect(session.rulerView.choices[0]?.targetLocationId).toBe(
      "location:military-pay-office",
    );
    await session.choose(
      session.rulerView.decisionEpisodeId,
      "maintain_deployment",
    );
    const run = await session.result();
    expect(run.state.orders.map((o) => o.targetLocationId)).toEqual([
      "location:imperial-palace",
      "location:military-pay-office",
    ]);
    expect(
      run.state.decisions[1]?.input.memories.find(
        (m) => m.kind === "own_execution",
      )?.actualLocationId,
    ).toBe("location:military-pay-office");
  });

  it("delivers changed evidence to later decisions, without revealing the fixed threat", async () => {
    const results: string[] = [];
    for (const report of ["east_warehouse_alarm", "east_clear"]) {
      const { kernel } = await fixture();
      await kernel.runUntilIdle();
      const state = kernel.state;
      const observations = state.observations.map((o): Observation =>
        o.payload.finding === "east_warehouse_alarm"
          ? {
              ...o,
              payload: {
                finding: report,
                claim:
                  report === "east_clear"
                    ? "The scout reports the East Gate is quiet."
                    : o.payload.claim!,
              },
            }
          : o,
      );
      const store = new InMemoryEventStore();
      const policy: DecisionPolicy = {
        async decide(input) {
          expect(JSON.stringify(input)).not.toContain('"threats"');
          return output(
            input.observations.some(
              (o) => o.payload.finding === "east_warehouse_alarm",
            )
              ? "obey_ruler"
              : "follow_chancellor",
          );
        },
      };
      const fork = new SimulationKernel(
        { ...state, observations },
        createContinuousCrisisModel(policy, report, "en"),
        store,
        report,
      );
      await fork.schedule({
        eventType: "court.issue",
        scheduledAt: simTime(100),
        payload: { round: 2, choice: "move_to_east_gate" },
      });
      await fork.runUntilIdle();
      results.push(fork.state.unitLocationId);
    }
    expect(results).toEqual([
      "location:east-gate",
      "location:military-pay-office",
    ]);
  });

  it("lets a history-sensitive policy change its later action when its earlier experience changes", async () => {
    const locations: string[] = [];
    for (const firstAction of ["obey_ruler", "follow_chancellor"]) {
      const policy: DecisionPolicy = {
        async decide(input) {
          const experience = input.memories.find(
            (m) => m.kind === "own_execution",
          );
          return output(
            experience
              ? experience.actualLocationId === "location:military-pay-office"
                ? "follow_chancellor"
                : "obey_ruler"
              : firstAction,
          );
        },
      };
      const session = await startContinuousCrisisSession({
        runId: firstAction,
        outputLanguage: "en",
        npcPolicy: policy,
      });
      await session.choose(
        session.rulerView.decisionEpisodeId,
        "hold_imperial_palace",
      );
      await session.choose(
        session.rulerView.decisionEpisodeId,
        "move_to_east_gate",
      );
      locations.push((await session.result()).state.unitLocationId);
    }
    expect(locations).toEqual([
      "location:east-gate",
      "location:military-pay-office",
    ]);
  });

  it("does not build context before receipt, and rejects unknown events", () => {
    expect(() =>
      continuousCommanderInput(
        continuousCrisisInitialState,
        "test",
        "en",
        simTime(10),
      ),
    ).toThrow();
    expect(() =>
      reduceContinuousCrisisState(continuousCrisisInitialState, {
        id: "bad",
        occurredAt: simTime(10),
        eventType: "unknown",
        payload: { round: 1 },
      } as DomainEvent),
    ).toThrow("Unhandled");
  });
});
