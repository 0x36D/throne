import { describe, expect, it } from "vitest";
import { simTime, type ActorDecisionInput } from "@throne/shared-types";
import { HumanDecisionPolicy, HumanDecisionRequiredError } from "./policy.ts";

const input: ActorDecisionInput = {
  runId: "human-policy-test",
  branchId: "main",
  decisionEpisodeId: "decision:test",
  actorId: "actor:ruler",
  simulationTime: simTime(10),
  identity: { id: "actor:ruler" },
  officeHistory: [],
  observations: [],
  beliefs: [],
  motivations: {},
  relationships: [],
  memories: [],
  availableCapabilities: ["hold_palace"],
};

describe("HumanDecisionPolicy", () => {
  it("requires a submitted human choice", async () => {
    const policy = new HumanDecisionPolicy();

    await expect(policy.decide(input)).rejects.toBeInstanceOf(
      HumanDecisionRequiredError,
    );
  });

  it("validates, clones, and consumes a submitted choice", async () => {
    const policy = new HumanDecisionPolicy();
    const output = {
      selectedIntent: {
        goal: "hold_imperial_palace",
        capabilityId: "hold_imperial_palace",
        parameters: { targetLocationId: "location:imperial-palace" },
      },
    };

    policy.submit(input.decisionEpisodeId, output);
    output.selectedIntent.goal = "mutated_after_submit";

    expect(await policy.decide(input)).toMatchObject({
      selectedIntent: { goal: "hold_imperial_palace" },
    });
    await expect(policy.decide(input)).rejects.toBeInstanceOf(
      HumanDecisionRequiredError,
    );
  });

  it("rejects accidental double submission", () => {
    const policy = new HumanDecisionPolicy();
    const output = {
      selectedIntent: {
        goal: "hold_imperial_palace",
        capabilityId: "hold_imperial_palace",
        parameters: {},
      },
    };

    policy.submit(input.decisionEpisodeId, output);
    expect(() => policy.submit(input.decisionEpisodeId, output)).toThrow(
      "already submitted",
    );
  });
});
