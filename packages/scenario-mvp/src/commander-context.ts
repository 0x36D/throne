import {
  simTime,
  type ActorDecisionInput,
  type Observation,
} from "@throne/shared-types";
import type { PlayerDecisionState } from "./player-decision.ts";
import { playerDecisionIds as ids } from "./player-decision.ts";

export const npcEpisodeId = "decision:commander-competing-orders";
export const npcCapabilities = ["obey_ruler", "follow_chancellor"] as const;

export function commanderInput(
  state: PlayerDecisionState,
  runId: string,
  outputLanguage: string,
): ActorDecisionInput {
  const order = state.orders[ids.order];
  if (!order || order.status !== "received")
    throw new Error("Commander has not received the royal order");
  const observation = (
    id: string,
    sourceId: string,
    payload: Observation["payload"],
  ): Observation => ({
    id,
    actorId: ids.commander,
    observedAt: simTime(45),
    sourceType: "delivered_message",
    sourceId,
    subjectRefs: [ids.unit],
    payload,
  });
  return {
    runId,
    branchId: "main",
    decisionEpisodeId: npcEpisodeId,
    actorId: ids.commander,
    simulationTime: simTime(50),
    identity: {
      id: ids.commander,
      name: "赵统领 / Commander Zhao",
      role: "Imperial Guard commander",
    },
    officeHistory: [{ officeId: "office:guard-commander", startedAt: 0 }],
    observations: [
      observation("npc:royal-order", ids.ruler, {
        command: order.choiceId,
        targetLocationId: order.targetLocationId,
      }),
      observation("npc:chancellor-order", "actor:chancellor", {
        command: "protect_military_pay_office",
        targetLocationId: "location:military-pay-office",
        claim:
          "The payroll convoy may be attacked. Secure the pay office so the guard receives overdue wages.",
      }),
      observation("npc:scout-report", ids.eastScout, {
        claim: "Armed movement outside the East Gate; destination unconfirmed.",
      }),
      observation("npc:palace-warning", ids.palaceInspector, {
        claim:
          "Two palace entry seals are missing; infiltration is suspected, not confirmed.",
      }),
    ],
    beliefs: [],
    motivations: {
      protectRuler: 0.8,
      preserveUnit: 0.9,
      avoidPunishment: 0.85,
      maintainPatronSupport: 0.65,
    },
    relationships: [
      { sourceId: ids.ruler, kind: "formal_command", strength: 1 },
      { sourceId: ids.ruler, kind: "personal_loyalty", strength: 0.55 },
      { sourceId: "actor:chancellor", kind: "funding", strength: 0.85 },
      { sourceId: "actor:chancellor", kind: "appointment", strength: 0.7 },
    ],
    memories: [
      {
        experience:
          "The chancellor secured the commander's appointment and previously paid delayed wages.",
      },
    ],
    availableCapabilities: npcCapabilities,
    outputLanguage,
  };
}
