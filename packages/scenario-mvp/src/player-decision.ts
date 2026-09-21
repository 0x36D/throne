import {
  readStringArray as stringArray,
  readJsonObject as objectValue,
} from "@throne/shared-types";
import {
  HumanDecisionPolicy,
  type DecisionPolicy,
} from "@throne/agent-runtime/policy";
import {
  actorDecisionOutputSchema,
  addSimTime,
  simTime,
  type ActorDecisionInput,
  type ActorDecisionOutput,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type Observation,
  type OrderLifecycleEntry,
  type OrderStatus,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainModel,
} from "@throne/sim-core";
import {
  commanderInput,
  npcCapabilities,
  npcEpisodeId,
} from "./commander-context.ts";

export type PlayerChoiceId = "hold_imperial_palace" | "move_to_east_gate";

export type PlayerDecisionEpisode = DecisionEpisode & {
  readonly selectedCapabilityId?: PlayerChoiceId;
};

export type PlayerOrder = {
  readonly id: string;
  readonly issuerId: string;
  readonly recipientId: string;
  readonly unitId: string;
  readonly choiceId: PlayerChoiceId;
  readonly targetLocationId: string;
  readonly status: OrderStatus;
  readonly lifecycle: readonly OrderLifecycleEntry[];
  readonly decisionEpisodeId: string;
};

export type PlayerMessage = {
  readonly id: string;
  readonly kind: "order" | "outcome_report";
  readonly senderId: string;
  readonly recipientId: string;
  readonly orderId: string;
  readonly status: "draft" | "in_transit" | "delivered";
};

export type PlayerUnit = {
  readonly id: string;
  readonly commanderId: string;
  readonly locationId: string;
};

export type PlayerCrisisOutcome = "palace_secured" | "palace_breached";

export type PlayerDecisionState = {
  readonly npcEpisode?: DecisionEpisode;
  readonly npcDecision?: {
    readonly input: ActorDecisionInput;
    readonly output: ActorDecisionOutput;
    readonly targetLocationId: string;
  };
  readonly units: Readonly<Record<string, PlayerUnit>>;
  readonly observations: Readonly<Record<string, Observation>>;
  readonly actorObservationIds: Readonly<Record<string, readonly string[]>>;
  readonly decisionEpisodes: Readonly<Record<string, PlayerDecisionEpisode>>;
  readonly decisionOutputs: Readonly<Record<string, ActorDecisionOutput>>;
  readonly intents: Readonly<Record<string, Intent>>;
  readonly orders: Readonly<Record<string, PlayerOrder>>;
  readonly messages: Readonly<Record<string, PlayerMessage>>;
  readonly crisis: {
    readonly trueThreat: "palace_infiltration";
    readonly outcome?: PlayerCrisisOutcome;
  };
};

export type PlayerDecisionRulerView = {
  readonly simulationTime: number;
  readonly observations: readonly Observation[];
  readonly decisionStatus: "awaiting_player" | "resolved";
  readonly selectedChoiceId?: PlayerChoiceId;
  readonly issuedOrder?: {
    readonly id: string;
    readonly choiceId: PlayerChoiceId;
    readonly status: OrderStatus;
  };
  readonly knownOutcome:
    "awaiting_decision" | "order_in_transit" | PlayerCrisisOutcome;
};

export type PlayerDecisionRun = {
  readonly state: PlayerDecisionState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewBeforeDecision: PlayerDecisionRulerView;
  readonly rulerViewFinal: PlayerDecisionRulerView;
  readonly debugTruth: {
    readonly trueThreat: PlayerDecisionState["crisis"]["trueThreat"];
    readonly outcome: PlayerCrisisOutcome;
    readonly unit: PlayerUnit;
    readonly decisionEpisode: PlayerDecisionEpisode;
    readonly decisionOutput: ActorDecisionOutput;
    readonly intent: Intent;
    readonly order: PlayerOrder;
    readonly messages: readonly PlayerMessage[];
  };
};

export type PlayerDecisionSession = {
  readonly runId: string;
  readonly pausedAt: number;
  readonly input: ActorDecisionInput;
  readonly choiceIds: readonly PlayerChoiceId[];
  readonly rulerView: PlayerDecisionRulerView;
  choose(choiceId: PlayerChoiceId): Promise<PlayerDecisionRun>;
  retry(): Promise<PlayerDecisionRun>;
};

export type PlayerDecisionSessionOptions = {
  readonly npcPolicy?: DecisionPolicy;
  readonly runId?: string;
  readonly outputLanguage?: string;
};

export const playerDecisionIds = {
  ruler: "actor:ruler",
  commander: "actor:guard-commander",
  eastScout: "actor:east-gate-scout",
  palaceInspector: "actor:palace-inspector",
  unit: "unit:palace-guard",
  barracks: "location:guard-barracks",
  eastGate: "location:east-gate",
  palace: "location:imperial-palace",
  decision: "decision:player-east-gate-crisis",
  eastObservation: "observation:player-east-gate-movement",
  palaceObservation: "observation:player-palace-seals-missing",
  outcomeObservation: "observation:player-crisis-outcome",
  intent: "intent:player-crisis-order",
  order: "order:player-crisis-response",
  orderMessage: "message:player-crisis-order",
  reportMessage: "message:player-crisis-report",
} as const;

const ids = playerDecisionIds;
const choiceIds = ["hold_imperial_palace", "move_to_east_gate"] as const;

export const playerDecisionInitialState: PlayerDecisionState = {
  units: {
    [ids.unit]: {
      id: ids.unit,
      commanderId: ids.commander,
      locationId: ids.barracks,
    },
  },
  observations: {},
  actorObservationIds: { [ids.ruler]: [] },
  decisionEpisodes: {},
  decisionOutputs: {},
  intents: {},
  orders: {},
  messages: {},
  crisis: { trueThreat: "palace_infiltration" },
};

const choiceDetails: Record<
  PlayerChoiceId,
  { readonly targetLocationId: string; readonly goal: string }
> = {
  hold_imperial_palace: {
    targetLocationId: ids.palace,
    goal: "hold_imperial_palace",
  },
  move_to_east_gate: {
    targetLocationId: ids.eastGate,
    goal: "move_to_east_gate",
  },
};

export function createPlayerDecisionModel(
  policy: DecisionPolicy,
  runId: string,
  outputLanguage = "zh-CN",
  npcPolicy?: DecisionPolicy,
): DomainModel<PlayerDecisionState> {
  return {
    async resolveBatch({ events, state, time }) {
      const committed = [];
      const scheduled = [];

      for (const event of events) {
        switch (event.eventType) {
          case "crisis.present_to_ruler":
            committed.push(
              observationDraft({
                id: ids.eastObservation,
                actorId: ids.ruler,
                sourceType: "field_report",
                sourceId: ids.eastScout,
                subjectRefs: [ids.eastGate],
                payload: { finding: "armed_movement", confidence: 0.68 },
                cause: event.id,
              }),
              observationDraft({
                id: ids.palaceObservation,
                actorId: ids.ruler,
                sourceType: "internal_report",
                sourceId: ids.palaceInspector,
                subjectRefs: [ids.palace],
                payload: {
                  finding: "official_seals_missing",
                  confidence: 0.64,
                },
                cause: event.id,
              }),
              {
                eventType: "decision.opened",
                actorId: ids.ruler,
                causalEventId: event.id,
                payload: {
                  decisionEpisodeId: ids.decision,
                  triggerObservationIds: [
                    ids.eastObservation,
                    ids.palaceObservation,
                  ],
                  urgency: 0.92,
                },
              },
            );
            break;

          case "decision.resolve_with_policy": {
            const episode = getDecision(state);
            if (episode.status !== "open") {
              throw new Error("Player decision is no longer open");
            }
            const output = actorDecisionOutputSchema.parse(
              await policy.decide(
                playerDecisionInput(state, time, runId, outputLanguage),
              ),
            );
            const choiceId = output.selectedIntent
              .capabilityId as PlayerChoiceId;
            if (!choiceIds.includes(choiceId)) {
              throw new Error(
                `Human selected unavailable capability: ${String(choiceId)}`,
              );
            }
            const details = choiceDetails[choiceId];
            const intent: Intent = {
              id: ids.intent,
              actorId: ids.ruler,
              createdAt: time,
              goal: output.selectedIntent.goal,
              operationTemplate: choiceId,
              parameters: { targetLocationId: details.targetLocationId },
              urgency: 0.92,
              causalDecisionEpisodeId: ids.decision,
            };
            committed.push(
              {
                eventType: "policy.decision_recorded",
                actorId: ids.ruler,
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: {
                  decisionEpisodeId: ids.decision,
                  output: output as unknown as JsonObject,
                },
              },
              {
                eventType: "intent.created",
                actorId: ids.ruler,
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: { intent: intent as unknown as JsonObject },
              },
              {
                eventType: "decision.committed",
                actorId: ids.ruler,
                causalEventId: event.id,
                payload: {
                  decisionEpisodeId: ids.decision,
                  intentId: ids.intent,
                  selectedCapabilityId: choiceId,
                },
              },
              {
                eventType: "order.created",
                actorId: ids.ruler,
                targetIds: [ids.commander, ids.unit],
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: {
                  orderId: ids.order,
                  choiceId,
                  targetLocationId: details.targetLocationId,
                },
              },
              {
                eventType: "message.created",
                actorId: ids.ruler,
                targetIds: [ids.commander],
                causalEventId: event.id,
                payload: {
                  messageId: ids.orderMessage,
                  kind: "order",
                  senderId: ids.ruler,
                  recipientId: ids.commander,
                  orderId: ids.order,
                },
              },
            );
            scheduled.push({
              eventType: "order.depart",
              scheduledAt: addSimTime(time, 5),
              actorId: ids.ruler,
              targetIds: [ids.commander],
              causalEventId: event.id,
              payload: { orderId: ids.order, messageId: ids.orderMessage },
            });
            break;
          }

          case "order.depart":
            committed.push(
              messageStatusDraft(event, "message.departed"),
              orderStatusDraft(event, "sent"),
            );
            scheduled.push({
              eventType: "order.arrive",
              scheduledAt: addSimTime(time, 30),
              actorId: ids.ruler,
              targetIds: [ids.commander],
              causalEventId: event.id,
              payload: { orderId: ids.order, messageId: ids.orderMessage },
            });
            break;

          case "order.arrive":
            committed.push(
              messageStatusDraft(event, "message.arrived"),
              orderStatusDraft(event, "received"),
            );
            if (npcPolicy)
              committed.push({
                eventType: "npc.decision_opened",
                actorId: ids.commander,
                causalEventId: event.id,
                payload: {
                  observations: commanderInput(
                    {
                      ...state,
                      orders: {
                        ...state.orders,
                        [ids.order]: { ...getOrder(state), status: "received" },
                      },
                    },
                    runId,
                    outputLanguage,
                  ).observations as unknown as JsonObject[],
                },
              });
            scheduled.push({
              eventType: npcPolicy ? "npc.resolve" : "operation.execute_order",
              scheduledAt: addSimTime(time, npcPolicy ? 5 : 15),
              actorId: ids.commander,
              targetIds: [ids.unit],
              causalEventId: event.id,
              payload: { orderId: ids.order },
            });
            break;

          case "npc.resolve": {
            if (!npcPolicy) throw new Error("NPC policy missing");
            const input = commanderInput(state, runId, outputLanguage);
            const output = actorDecisionOutputSchema.parse(
              await npcPolicy.decide(input),
            );
            if (
              !npcCapabilities.some(
                (capability) =>
                  capability === output.selectedIntent.capabilityId,
              )
            ) {
              throw new Error("NPC selected unavailable capability");
            }
            if (Object.keys(output.selectedIntent.parameters).length !== 0) {
              throw new Error("NPC capabilities require empty parameters");
            }
            const targetLocationId =
              output.selectedIntent.capabilityId === "obey_ruler"
                ? getOrder(state).targetLocationId
                : "location:military-pay-office";
            committed.push({
              eventType: "npc.decision_recorded",
              actorId: ids.commander,
              causalEventId: event.id,
              causalDecisionEpisodeId: npcEpisodeId,
              payload: {
                input: input as unknown as JsonObject,
                output: output as unknown as JsonObject,
                targetLocationId,
              },
            });
            scheduled.push({
              eventType: "operation.execute_order",
              scheduledAt: addSimTime(time, 10),
              actorId: ids.commander,
              causalEventId: event.id,
              causalDecisionEpisodeId: npcEpisodeId,
              payload: { orderId: ids.order },
            });
            break;
          }
          case "operation.execute_order": {
            const order = getOrder(state);
            const targetLocationId =
              state.npcDecision?.targetLocationId ?? order.targetLocationId;
            const outcome: PlayerCrisisOutcome =
              targetLocationId === ids.palace
                ? "palace_secured"
                : "palace_breached";
            committed.push(
              {
                eventType: "unit.relocated",
                actorId: ids.commander,
                targetIds: [ids.unit],
                causalEventId: event.id,
                causalDecisionEpisodeId: ids.decision,
                payload: {
                  unitId: ids.unit,
                  locationId: targetLocationId,
                },
              },
              orderStatusDraft(
                event,
                targetLocationId === order.targetLocationId
                  ? "executed"
                  : "ignored",
              ),
              {
                eventType: "crisis.resolved",
                actorId: ids.commander,
                causalEventId: event.id,
                payload: { outcome },
              },
              {
                eventType: "message.created",
                actorId: ids.commander,
                targetIds: [ids.ruler],
                causalEventId: event.id,
                payload: {
                  messageId: ids.reportMessage,
                  kind: "outcome_report",
                  senderId: ids.commander,
                  recipientId: ids.ruler,
                  orderId: ids.order,
                },
              },
              {
                eventType: "message.departed",
                actorId: ids.commander,
                targetIds: [ids.ruler],
                causalEventId: event.id,
                payload: { messageId: ids.reportMessage },
              },
            );
            scheduled.push({
              eventType: "report.arrive",
              scheduledAt: addSimTime(time, 30),
              actorId: ids.commander,
              targetIds: [ids.ruler],
              causalEventId: event.id,
              payload: {
                orderId: ids.order,
                messageId: ids.reportMessage,
                outcome,
              },
            });
            break;
          }

          case "report.arrive":
            committed.push(
              messageStatusDraft(event, "message.arrived"),
              orderStatusDraft(
                event,
                getOrder(state).status === "ignored"
                  ? "ignored"
                  : "reported_complete",
              ),
              observationDraft({
                id: ids.outcomeObservation,
                actorId: ids.ruler,
                sourceType: "commander_report",
                sourceId: ids.reportMessage,
                subjectRefs: [ids.order, ids.unit, ids.palace],
                payload: {
                  outcome: String(event.payload.outcome),
                  orderId: ids.order,
                  targetLocationId: state.units[ids.unit]!.locationId,
                  obeyed: getOrder(state).status !== "ignored",
                },
                cause: event.id,
              }),
            );
            break;

          default:
            throw new Error(
              `Unknown player-decision event: ${event.eventType}`,
            );
        }
      }

      return { events: committed, scheduled };
    },

    reduce: reducePlayerDecisionState,

    validate(_before, after) {
      const episode = after.decisionEpisodes[ids.decision];
      if (episode?.status === "committed" && !episode.selectedCapabilityId) {
        throw new Error("Committed player decision requires a choice");
      }
      for (const order of Object.values(after.orders)) {
        if (!choiceIds.includes(order.choiceId)) {
          throw new Error(`${order.id} contains an unavailable choice`);
        }
      }
    },
  };
}

export function reducePlayerDecisionState(
  state: Readonly<PlayerDecisionState>,
  event: DomainEvent,
): PlayerDecisionState {
  switch (event.eventType) {
    case "npc.decision_opened":
      if (!Array.isArray(event.payload.observations))
        throw new Error("Missing NPC observations");
      return {
        ...state,
        observations: {
          ...state.observations,
          ...Object.fromEntries(
            (event.payload.observations as unknown as Observation[]).map(
              (observation) => [observation.id, observation],
            ),
          ),
        },
        actorObservationIds: {
          ...state.actorObservationIds,
          [ids.commander]: [
            "npc:royal-order",
            "npc:chancellor-order",
            "npc:scout-report",
            "npc:palace-warning",
          ],
        },
        npcEpisode: {
          id: npcEpisodeId,
          actorId: ids.commander,
          openedAt: event.occurredAt,
          triggerObservationIds: [
            "npc:royal-order",
            "npc:chancellor-order",
            "npc:scout-report",
            "npc:palace-warning",
          ],
          status: "open",
          urgency: 0.9,
          provisionalIntents: [],
          revisionCount: 0,
          finalIntentIds: [],
        },
      };
    case "npc.decision_recorded":
      if (!state.npcEpisode) throw new Error("Missing open NPC decision");
      return {
        ...state,
        npcEpisode: {
          ...state.npcEpisode,
          status: "committed",
          finalIntentIds: ["intent:npc-deployment"],
        },
        intents: {
          ...state.intents,
          ["intent:npc-deployment"]: {
            id: "intent:npc-deployment",
            actorId: ids.commander,
            createdAt: event.occurredAt,
            goal: actorDecisionOutputSchema.parse(event.payload.output)
              .selectedIntent.goal,
            operationTemplate: "move_unit",
            parameters: {
              targetLocationId: String(event.payload.targetLocationId),
            },
            causalDecisionEpisodeId: npcEpisodeId,
          },
        },
        npcDecision: {
          input: objectValue(
            event.payload.input,
          ) as unknown as ActorDecisionInput,
          output: actorDecisionOutputSchema.parse(event.payload.output),
          targetLocationId: String(event.payload.targetLocationId),
        },
      };
    case "observation.recorded": {
      const observation = observationFromEvent(event);
      const existing = state.actorObservationIds[observation.actorId] ?? [];
      return {
        ...state,
        observations: {
          ...state.observations,
          [observation.id]: observation,
        },
        actorObservationIds: {
          ...state.actorObservationIds,
          [observation.actorId]: [...existing, observation.id],
        },
      };
    }
    case "decision.opened": {
      const episode: PlayerDecisionEpisode = {
        id: String(event.payload.decisionEpisodeId),
        actorId: event.actorId ?? ids.ruler,
        openedAt: event.occurredAt,
        triggerObservationIds: stringArray(event.payload.triggerObservationIds),
        status: "open",
        urgency: Number(event.payload.urgency),
        provisionalIntents: [],
        revisionCount: 0,
        finalIntentIds: [],
      };
      return {
        ...state,
        decisionEpisodes: {
          ...state.decisionEpisodes,
          [episode.id]: episode,
        },
      };
    }
    case "policy.decision_recorded": {
      const output = actorDecisionOutputSchema.parse(event.payload.output);
      return {
        ...state,
        decisionOutputs: {
          ...state.decisionOutputs,
          [String(event.payload.decisionEpisodeId)]: output,
        },
      };
    }
    case "intent.created": {
      const intent = structuredClone(event.payload.intent) as unknown as Intent;
      return {
        ...state,
        intents: { ...state.intents, [intent.id]: intent },
      };
    }
    case "decision.committed": {
      const episode = getDecision(state);
      return {
        ...state,
        decisionEpisodes: {
          ...state.decisionEpisodes,
          [episode.id]: {
            ...episode,
            status: "committed",
            finalIntentIds: [String(event.payload.intentId)],
            selectedCapabilityId: String(
              event.payload.selectedCapabilityId,
            ) as PlayerChoiceId,
          },
        },
      };
    }
    case "order.created": {
      const order: PlayerOrder = {
        id: String(event.payload.orderId),
        issuerId: event.actorId ?? ids.ruler,
        recipientId: ids.commander,
        unitId: ids.unit,
        choiceId: String(event.payload.choiceId) as PlayerChoiceId,
        targetLocationId: String(event.payload.targetLocationId),
        status: "created",
        lifecycle: [lifecycleEntry("created", event)],
        decisionEpisodeId: ids.decision,
      };
      return { ...state, orders: { ...state.orders, [order.id]: order } };
    }
    case "order.status_changed": {
      const order = getOrder(state);
      const status = String(event.payload.status) as OrderStatus;
      return {
        ...state,
        orders: {
          ...state.orders,
          [order.id]: {
            ...order,
            status,
            lifecycle: [...order.lifecycle, lifecycleEntry(status, event)],
          },
        },
      };
    }
    case "message.created": {
      const message: PlayerMessage = {
        id: String(event.payload.messageId),
        kind: String(event.payload.kind) as PlayerMessage["kind"],
        senderId: String(event.payload.senderId),
        recipientId: String(event.payload.recipientId),
        orderId: String(event.payload.orderId),
        status: "draft",
      };
      return {
        ...state,
        messages: { ...state.messages, [message.id]: message },
      };
    }
    case "message.departed":
    case "message.arrived": {
      const messageId = String(event.payload.messageId);
      const message = state.messages[messageId];
      if (!message) throw new Error(`Unknown message: ${messageId}`);
      return {
        ...state,
        messages: {
          ...state.messages,
          [messageId]: {
            ...message,
            status:
              event.eventType === "message.departed"
                ? "in_transit"
                : "delivered",
          },
        },
      };
    }
    case "unit.relocated": {
      const unitId = String(event.payload.unitId);
      const unit = state.units[unitId];
      if (!unit) throw new Error(`Unknown unit: ${unitId}`);
      return {
        ...state,
        units: {
          ...state.units,
          [unitId]: { ...unit, locationId: String(event.payload.locationId) },
        },
      };
    }
    case "crisis.resolved":
      return {
        ...state,
        crisis: {
          ...state.crisis,
          outcome: String(event.payload.outcome) as PlayerCrisisOutcome,
        },
      };
    default:
      throw new Error(
        `Unhandled domain event ${event.eventType} (${event.id})`,
      );
  }
}

export async function startPlayerDecisionSession(
  options: PlayerDecisionSessionOptions = {},
): Promise<PlayerDecisionSession> {
  const runId = options.runId ?? "player-decision-demo";
  const outputLanguage = options.outputLanguage ?? "zh-CN";
  const policy = new HumanDecisionPolicy();
  const model = createPlayerDecisionModel(
    policy,
    runId,
    outputLanguage,
    options.npcPolicy,
  );
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    playerDecisionInitialState,
    model,
    store,
    runId,
  );
  await kernel.schedule({
    eventType: "crisis.present_to_ruler",
    scheduledAt: simTime(10),
    actorId: ids.ruler,
    payload: {},
  });
  await kernel.runUntilIdle();

  const stateBeforeDecision = kernel.state;
  const input = playerDecisionInput(
    stateBeforeDecision,
    kernel.time,
    runId,
    outputLanguage,
  );
  const rulerViewBeforeDecision = playerDecisionRulerView(
    stateBeforeDecision,
    kernel.time,
  );
  let started = false;
  let busy = false;
  let completed: PlayerDecisionRun | undefined;
  async function finish(): Promise<PlayerDecisionRun> {
    if (completed) return completed;
    if (busy) throw new Error("Player decision is already running");
    busy = true;
    try {
      await kernel.runUntilIdle();
      const state = kernel.state;
      const outcome = state.crisis.outcome;
      const unit = state.units[ids.unit];
      const episode = state.decisionEpisodes[ids.decision];
      const output = state.decisionOutputs[ids.decision];
      const intent = state.intents[ids.intent];
      const order = state.orders[ids.order];
      if (!outcome || !unit || !episode || !output || !intent || !order) {
        throw new Error("Player decision scenario did not reach completion");
      }
      completed = {
        state,
        records: await store.readAll(),
        rulerViewBeforeDecision,
        rulerViewFinal: playerDecisionRulerView(state, kernel.time),
        debugTruth: {
          trueThreat: state.crisis.trueThreat,
          outcome,
          unit,
          decisionEpisode: episode,
          decisionOutput: output,
          intent,
          order,
          messages: Object.values(state.messages),
        },
      };
      return completed;
    } finally {
      busy = false;
    }
  }
  return {
    runId,
    pausedAt: kernel.time,
    input,
    choiceIds,
    get rulerView() {
      return playerDecisionRulerView(kernel.state, kernel.time);
    },
    async choose(choiceId) {
      if (started) throw new Error("Player decision already resolved");
      if (!choiceIds.includes(choiceId))
        throw new Error(`Unknown player choice: ${String(choiceId)}`);
      started = true;
      policy.submit(ids.decision, playerChoiceOutput(choiceId));
      await kernel.schedule({
        eventType: "decision.resolve_with_policy",
        scheduledAt: kernel.time,
        actorId: ids.ruler,
        payload: { decisionEpisodeId: ids.decision },
      });
      return finish();
    },
    async retry() {
      if (!started) throw new Error("Submit a player choice before retrying");
      return finish();
    },
  };
}

export async function runPlayerDecisionScenario(
  choiceId: PlayerChoiceId,
  options: PlayerDecisionSessionOptions = {},
): Promise<PlayerDecisionRun> {
  const session = await startPlayerDecisionSession(options);
  return session.choose(choiceId);
}

export function playerDecisionRulerView(
  state: Readonly<PlayerDecisionState>,
  simulationTime: number,
): PlayerDecisionRulerView {
  const observations = (state.actorObservationIds[ids.ruler] ?? [])
    .map((id) => state.observations[id])
    .filter((value): value is Observation => value !== undefined);
  const episode = state.decisionEpisodes[ids.decision];
  const order = state.orders[ids.order];
  const report = state.observations[ids.outcomeObservation];
  const outcome = report?.payload.outcome;
  const knownOutcome =
    outcome === "palace_secured" || outcome === "palace_breached"
      ? outcome
      : order
        ? "order_in_transit"
        : "awaiting_decision";

  return {
    simulationTime,
    observations,
    decisionStatus:
      episode?.status === "committed" ? "resolved" : "awaiting_player",
    ...(episode?.selectedCapabilityId
      ? { selectedChoiceId: episode.selectedCapabilityId }
      : {}),
    ...(order
      ? {
          issuedOrder: {
            id: order.id,
            choiceId: order.choiceId,
            status: report
              ? order.status
              : order.lifecycle.some((entry) => entry.status === "sent")
                ? "sent"
                : "created",
          },
        }
      : {}),
    knownOutcome,
  };
}

function playerDecisionInput(
  state: Readonly<PlayerDecisionState>,
  time: number,
  runId: string,
  outputLanguage: string,
): ActorDecisionInput {
  const view = playerDecisionRulerView(state, time);
  return {
    runId,
    branchId: "main",
    decisionEpisodeId: ids.decision,
    actorId: ids.ruler,
    simulationTime: simTime(time),
    identity: {
      id: ids.ruler,
      displayNameKey: "actor.ruler",
      office: "sovereign",
    },
    officeHistory: [{ officeId: "office:sovereign", startedAt: 0 }],
    observations: view.observations,
    beliefs: [
      {
        subjectRef: "crisis:capital-security",
        predicate: "primary_target",
        candidates: [
          {
            value: ids.eastGate,
            confidence: 0.51,
            supportingObservationIds: [ids.eastObservation],
          },
          {
            value: ids.palace,
            confidence: 0.49,
            supportingObservationIds: [ids.palaceObservation],
          },
        ],
        updatedAt: simTime(time),
      },
    ],
    motivations: { preserveDynasty: 0.95, protectCapital: 0.9 },
    relationships: [
      {
        sourceId: ids.ruler,
        targetId: ids.commander,
        kind: "formal_command",
        strength: 0.9,
      },
    ],
    memories: [],
    availableCapabilities: choiceIds,
    outputLanguage,
  };
}

function playerChoiceOutput(choiceId: PlayerChoiceId): ActorDecisionOutput {
  const details = choiceDetails[choiceId];
  return {
    selectedIntent: {
      goal: details.goal,
      capabilityId: choiceId,
      parameters: { targetLocationId: details.targetLocationId },
    },
    confidence: 1,
  };
}

function observationDraft(input: {
  id: string;
  actorId: string;
  sourceType: string;
  sourceId: string;
  subjectRefs: readonly string[];
  payload: JsonObject;
  cause: string;
}) {
  return {
    eventType: "observation.recorded",
    actorId: input.actorId,
    targetIds: [input.actorId],
    causalEventId: input.cause,
    payload: {
      observationId: input.id,
      actorId: input.actorId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      subjectRefs: input.subjectRefs,
      content: input.payload,
    },
  };
}

function observationFromEvent(event: DomainEvent): Observation {
  return {
    id: String(event.payload.observationId),
    actorId: String(event.payload.actorId),
    observedAt: event.occurredAt,
    sourceType: String(event.payload.sourceType),
    sourceId: String(event.payload.sourceId),
    subjectRefs: stringArray(event.payload.subjectRefs),
    payload: objectValue(event.payload.content),
    ...(event.causalEventId === undefined
      ? {}
      : { causalEventId: event.causalEventId }),
  };
}

function messageStatusDraft(
  event: { readonly id: string; readonly payload: JsonObject },
  eventType: "message.departed" | "message.arrived",
) {
  return {
    eventType,
    causalEventId: event.id,
    payload: { messageId: String(event.payload.messageId) },
  };
}

function orderStatusDraft(
  event: { readonly id: string; readonly payload: JsonObject },
  status: OrderStatus,
) {
  return {
    eventType: "order.status_changed",
    causalEventId: event.id,
    causalDecisionEpisodeId: ids.decision,
    payload: { orderId: ids.order, status },
  };
}

function lifecycleEntry(
  status: OrderStatus,
  event: DomainEvent,
): OrderLifecycleEntry {
  return { status, occurredAt: event.occurredAt, eventId: event.id };
}

function getDecision(state: Readonly<PlayerDecisionState>) {
  const episode = state.decisionEpisodes[ids.decision];
  if (!episode) throw new Error(`Unknown decision: ${ids.decision}`);
  return episode;
}

function getOrder(state: Readonly<PlayerDecisionState>) {
  const order = state.orders[ids.order];
  if (!order) throw new Error(`Unknown order: ${ids.order}`);
  return order;
}
