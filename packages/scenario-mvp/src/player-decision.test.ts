import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  playerDecisionIds,
  playerDecisionInitialState,
  playerDecisionRulerView,
  reducePlayerDecisionState,
  runPlayerDecisionScenario,
  startPlayerDecisionSession,
  type PlayerChoiceId,
} from "./player-decision.ts";

describe("interactive player decision scenario", () => {
  it("pauses with only ruler-visible evidence and no order", async () => {
    const session = await startPlayerDecisionSession({
      runId: "player-pause-test",
      outputLanguage: "zh-CN",
    });

    expect(session.pausedAt).toBe(10);
    expect(session.rulerView.decisionStatus).toBe("awaiting_player");
    expect(session.rulerView.knownOutcome).toBe("awaiting_decision");
    expect(session.rulerView.observations).toHaveLength(2);
    expect(session.choiceIds).toEqual([
      "hold_imperial_palace",
      "move_to_east_gate",
    ]);
    expect(session.input.availableCapabilities).toEqual(session.choiceIds);
    expect(session.input.outputLanguage).toBe("zh-CN");
    expect(
      JSON.stringify(session.rulerView).includes("palace_infiltration"),
    ).toBe(false);
  });

  it.each<{
    choice: PlayerChoiceId;
    location: string;
    outcome: string;
  }>([
    {
      choice: "hold_imperial_palace",
      location: playerDecisionIds.palace,
      outcome: "palace_secured",
    },
    {
      choice: "move_to_east_gate",
      location: playerDecisionIds.eastGate,
      outcome: "palace_breached",
    },
  ])(
    "turns the human choice $choice into a delayed world result",
    async ({ choice, location, outcome }) => {
      const run = await runPlayerDecisionScenario(choice, {
        runId: `player-result-${choice}`,
      });

      expect(run.debugTruth.decisionEpisode.selectedCapabilityId).toBe(choice);
      expect(run.debugTruth.decisionOutput.selectedIntent.capabilityId).toBe(
        choice,
      );
      expect(run.debugTruth.intent.operationTemplate).toBe(choice);
      expect(run.debugTruth.unit.locationId).toBe(location);
      expect(run.debugTruth.outcome).toBe(outcome);
      expect(run.rulerViewFinal.knownOutcome).toBe(outcome);
      expect(run.rulerViewFinal.issuedOrder?.status).toBe("reported_complete");
      expect(
        run.debugTruth.order.lifecycle.map((entry) => [
          entry.status,
          entry.occurredAt,
        ]),
      ).toEqual([
        ["created", 10],
        ["sent", 15],
        ["received", 45],
        ["executed", 60],
        ["reported_complete", 90],
      ]);
    },
  );

  it("records the human output before creating an order", async () => {
    const run = await runPlayerDecisionScenario("hold_imperial_palace", {
      runId: "player-recording-test",
    });
    const committedTypes = run.records
      .filter((record) => record.kind === "committed")
      .map((record) => record.event.eventType);

    expect(committedTypes.indexOf("policy.decision_recorded")).toBeLessThan(
      committedTypes.indexOf("order.created"),
    );
    expect(committedTypes).toContain("message.departed");
    expect(committedTypes).toContain("message.arrived");
    expect(committedTypes).toContain("unit.relocated");
  });

  it("replays the completed run without another human choice", async () => {
    const run = await runPlayerDecisionScenario("move_to_east_gate", {
      runId: "player-replay-test",
    });
    const replayed = replay(
      playerDecisionInitialState,
      run.records,
      reducePlayerDecisionState,
    );

    expect(replayed).toEqual(run.state);
    expect(playerDecisionRulerView(replayed, 90)).toEqual(run.rulerViewFinal);
  });

  it("accepts exactly one choice per paused session", async () => {
    const session = await startPlayerDecisionSession({
      runId: "player-single-choice-test",
    });

    await session.choose("hold_imperial_palace");
    await expect(session.choose("move_to_east_gate")).rejects.toThrow(
      "already resolved",
    );
  });
});
