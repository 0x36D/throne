import type { DecisionPolicy } from "@throne/agent-runtime/policy";
import {
  actorDecisionOutputSchema,
  readJsonObject,
  simTime,
  addSimTime,
  type ActorDecisionInput,
  type ActorDecisionOutput,
  type DecisionEpisode,
  type DomainEvent,
  type Intent,
  type JsonObject,
  type Observation,
  type SimTime,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  type DomainModel,
  type DomainEventDraft,
  type ScheduledEventDraft,
} from "@throne/sim-core";
import { commanderProfile, npcCapabilities } from "./commander-context.ts";
import {
  playerDecisionIds as ids,
  type PlayerChoiceId,
} from "./player-decision.ts";

export type CrisisRound = 1 | 2;
export type CrisisChoice = PlayerChoiceId | "maintain_deployment";
export type CrisisOrder = {
  readonly id: string;
  readonly round: CrisisRound;
  readonly episodeId: string;
  readonly choice: CrisisChoice;
  readonly targetLocationId: string;
  readonly issuedAt: SimTime;
  readonly departedAt?: SimTime;
  readonly receivedAt?: SimTime;
  readonly executedAt?: SimTime;
  readonly reportedAt?: SimTime;
  readonly actualLocationId?: string;
};
export type CrisisDecision = {
  readonly input: ActorDecisionInput;
  readonly output: ActorDecisionOutput;
  readonly targetLocationId: string;
};
export type ContinuousCrisisState = {
  readonly round: CrisisRound;
  readonly phase: "waiting" | "running" | "complete";
  readonly unitLocationId: string;
  readonly threats: Readonly<Record<CrisisRound, string>>;
  readonly outcomes: Readonly<Partial<Record<CrisisRound, boolean>>>;
  readonly orders: readonly CrisisOrder[];
  readonly observations: readonly Observation[];
  readonly episodes: Readonly<Record<string, DecisionEpisode>>;
  readonly intents: readonly Intent[];
  readonly decisions: readonly CrisisDecision[];
};
export type CrisisTimelineItem = {
  readonly id: string;
  readonly time: SimTime;
  readonly kind: "observation" | "decree" | "dispatch";
  readonly sourceId: string;
  readonly payload: JsonObject;
};
export type ContinuousCrisisView = {
  readonly simulationTime: SimTime;
  readonly round: CrisisRound;
  readonly totalRounds: 2;
  readonly decisionEpisodeId: string;
  readonly decisionStatus: "awaiting_player" | "resolved";
  readonly choices: readonly {
    readonly id: CrisisChoice;
    readonly targetLocationId: string;
  }[];
  readonly observations: readonly Observation[];
  readonly timeline: readonly CrisisTimelineItem[];
};
export type ContinuousCrisisRun = {
  readonly state: ContinuousCrisisState;
  readonly records: readonly SimulationRecord[];
  readonly rulerViewFinal: ContinuousCrisisView;
};
export type ContinuousCrisisSession = {
  readonly rulerView: ContinuousCrisisView;
  readonly complete: boolean;
  choose(episodeId: string, choice: CrisisChoice): Promise<void>;
  retry(): Promise<void>;
  result(): Promise<ContinuousCrisisRun>;
};

export const continuousCrisisInitialState: ContinuousCrisisState = {
  round: 1,
  phase: "running",
  unitLocationId: ids.barracks,
  threats: { 1: ids.palace, 2: ids.eastGate },
  outcomes: {},
  orders: [],
  observations: [],
  episodes: {},
  intents: [],
  decisions: [],
};

const episodeId = (round: CrisisRound, actor = "ruler") =>
  `decision:crisis:${actor}:${round}`;
function roundOf(payload: JsonObject): CrisisRound {
  if (payload.round !== 1 && payload.round !== 2)
    throw new Error("Invalid crisis round");
  return payload.round;
}
function text(payload: JsonObject, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value) throw new Error(`Missing ${key}`);
  return value;
}
function orderFor(
  state: ContinuousCrisisState,
  round: CrisisRound,
): CrisisOrder {
  const order = state.orders.find((o) => o.round === round);
  if (!order) throw new Error(`Missing decree for round ${round}`);
  return order;
}
function opening(
  round: CrisisRound,
  actorId: string,
  time: SimTime,
  observations: readonly Observation[],
): DecisionEpisode {
  return {
    id: episodeId(round, actorId === ids.ruler ? "ruler" : "commander"),
    actorId,
    openedAt: time,
    triggerObservationIds: observations.map((o) => o.id),
    status: "open",
    urgency: 0.9,
    provisionalIntents: [],
    revisionCount: 0,
    finalIntentIds: [],
  };
}
function observation(
  actorId: string,
  round: CrisisRound,
  time: SimTime,
  sourceId: string,
  finding: string,
  payload: JsonObject = {},
): Observation {
  return {
    id: `observation:${actorId}:${round}:${finding}`,
    actorId,
    observedAt: time,
    sourceId,
    sourceType:
      finding === "deployment" ? "commander_report" : "delivered_message",
    subjectRefs: [ids.unit],
    payload: { finding, ...payload },
  };
}
function intelligence(
  actorId: string,
  round: CrisisRound,
  time: SimTime,
): Observation[] {
  return round === 1
    ? [
        observation(actorId, round, time, ids.eastScout, "armed_movement", {
          claim:
            "Armed movement outside the East Gate; destination unconfirmed.",
        }),
        observation(
          actorId,
          round,
          time,
          ids.palaceInspector,
          "seals_missing",
          {
            claim:
              "Two palace entry seals are missing; infiltration suspected, not confirmed.",
          },
        ),
      ]
    : [
        observation(
          actorId,
          round,
          time,
          ids.eastScout,
          "east_warehouse_alarm",
          {
            claim:
              "The scout now reports armed men unloading ladders beside the East Gate warehouses. An attack appears imminent; numbers remain uncertain.",
          },
        ),
      ];
}

export function continuousCrisisRulerView(
  state: ContinuousCrisisState,
  time: SimTime,
): ContinuousCrisisView {
  const observations = state.observations.filter(
    (o) => o.actorId === ids.ruler,
  );
  const lastReport = observations
    .filter((o) => o.payload.finding === "deployment")
    .at(-1);
  const lastLocation = lastReport
    ? text(lastReport.payload, "targetLocationId")
    : undefined;
  if (state.round === 2 && !lastLocation)
    throw new Error("Second decree requires a received deployment report");
  const choices: ContinuousCrisisView["choices"] =
    state.round === 1
      ? [
          { id: "hold_imperial_palace", targetLocationId: ids.palace },
          { id: "move_to_east_gate", targetLocationId: ids.eastGate },
        ]
      : [
          { id: "maintain_deployment", targetLocationId: lastLocation! },
          {
            id:
              lastLocation === ids.eastGate
                ? "hold_imperial_palace"
                : "move_to_east_gate",
            targetLocationId:
              lastLocation === ids.eastGate ? ids.palace : ids.eastGate,
          },
        ];
  const timeline: CrisisTimelineItem[] = observations.map((o) => ({
    id: o.id,
    time: o.observedAt,
    kind: "observation",
    sourceId: o.sourceId!,
    payload: o.payload,
  }));
  for (const order of state.orders) {
    const payload = {
      round: order.round,
      orderId: order.id,
      choice: order.choice,
      targetLocationId: order.targetLocationId,
    };
    timeline.push({
      id: `${order.id}:issued`,
      time: order.issuedAt,
      kind: "decree",
      sourceId: ids.ruler,
      payload,
    });
    if (order.departedAt !== undefined)
      timeline.push({
        id: `${order.id}:sent`,
        time: order.departedAt,
        kind: "dispatch",
        sourceId: ids.ruler,
        payload,
      });
  }
  return structuredClone({
    simulationTime: time,
    round: state.round,
    totalRounds: 2,
    decisionEpisodeId: episodeId(state.round),
    decisionStatus: state.phase === "waiting" ? "awaiting_player" : "resolved",
    choices,
    observations,
    timeline: timeline.sort((a, b) => a.time - b.time),
  });
}

export function continuousCommanderInput(
  state: ContinuousCrisisState,
  runId: string,
  language: string,
  time: SimTime,
): ActorDecisionInput {
  const order = orderFor(state, state.round);
  if (order.receivedAt === undefined)
    throw new Error("Commander has not received current decree");
  const profile = commanderProfile();
  return {
    ...profile,
    runId,
    branchId: "main",
    actorId: ids.commander,
    outputLanguage: language,
    availableCapabilities: npcCapabilities,
    decisionEpisodeId: episodeId(state.round, "commander"),
    simulationTime: time,
    observations: state.observations.filter((o) => o.actorId === ids.commander),
    memories: [
      ...profile.memories,
      ...state.decisions.map((decision): JsonObject => ({
        kind: "previous_decision",
        decisionEpisodeId: decision.input.decisionEpisodeId,
        decidedAt: decision.input.simulationTime,
        selectedIntent: readJsonObject(decision.output.selectedIntent),
        justification: decision.output.reasoningSummary ?? null,
      })),
      ...state.orders
        .filter((o) => o.executedAt !== undefined)
        .map((o): JsonObject => ({
          kind: "own_execution",
          orderId: o.id,
          royalTargetLocationId: o.targetLocationId,
          actualLocationId: o.actualLocationId!,
          occurredAt: o.executedAt!,
        })),
    ],
  };
}

export function createContinuousCrisisModel(
  policy: DecisionPolicy,
  runId: string,
  language: string,
): DomainModel<ContinuousCrisisState> {
  return {
    async resolveBatch({ state, time, events }) {
      const committed: DomainEventDraft[] = [];
      const scheduled: ScheduledEventDraft[] = [];
      for (const event of events) {
        const round = roundOf(event.payload);
        const commit = (eventType: string, payload: JsonObject = {}) =>
          committed.push({
            eventType,
            causalEventId: event.id,
            payload: { round, ...payload },
          });
        const later = (eventType: string, delay: number) =>
          scheduled.push({
            eventType,
            scheduledAt: addSimTime(time, delay),
            causalEventId: event.id,
            payload: { round },
          });
        switch (event.eventType) {
          case "court.open":
            commit("court.opened", {
              observations: intelligence(ids.ruler, round, time),
            });
            break;
          case "court.issue": {
            const choice = continuousCrisisRulerView(state, time).choices.find(
              (c) => c.id === event.payload.choice,
            );
            if (state.phase !== "waiting" || state.round !== round || !choice)
              throw new Error("Decree is not available in this episode");
            commit("court.order_issued", {
              choice: choice.id,
              targetLocationId: choice.targetLocationId,
            });
            later("courier.depart", 5);
            break;
          }
          case "courier.depart":
            commit("courier.departed");
            later("courier.arrive", 30);
            break;
          case "courier.arrive": {
            const order = orderFor(state, round);
            const forwarded = state.observations
              .filter(
                (o) =>
                  o.actorId === ids.ruler &&
                  o.observedAt <= order.issuedAt &&
                  o.payload.finding !== "deployment",
              )
              .map((o) => ({
                ...o,
                id: `forwarded:${round}:${o.id}`,
                actorId: ids.commander,
                observedAt: time,
                payload: { ...o.payload, originallyReceivedAt: o.observedAt },
              }));
            commit("courier.arrived", {
              observations: [
                observation(
                  ids.commander,
                  round,
                  time,
                  ids.ruler,
                  "royal_order",
                  {
                    orderId: order.id,
                    command: order.choice,
                    targetLocationId: order.targetLocationId,
                    supersedesOrderId:
                      state.orders.find((o) => o.round < round)?.id ?? null,
                  },
                ),
                observation(
                  ids.commander,
                  round,
                  time,
                  "actor:chancellor",
                  "chancellor_order",
                  {
                    targetLocationId: "location:military-pay-office",
                    claim:
                      round === 1
                        ? "The payroll convoy may be attacked. Protect the pay office so your soldiers receive overdue wages."
                        : "The overdue wages are still at the pay office. Keep or bring your guard here to protect them; I sponsored your appointment and need your support.",
                  },
                ),
                ...forwarded,
              ],
            });
            later("commander.decide", 5);
            break;
          }
          case "commander.decide": {
            const input = continuousCommanderInput(
              state,
              runId,
              language,
              time,
            );
            const output = actorDecisionOutputSchema.parse(
              await policy.decide(structuredClone(input)),
            );
            if (
              !npcCapabilities.some(
                (c) => c === output.selectedIntent.capabilityId,
              ) ||
              Object.keys(output.selectedIntent.parameters).length
            )
              throw new Error("Invalid commander capability or parameters");
            const targetLocationId =
              output.selectedIntent.capabilityId === "obey_ruler"
                ? orderFor(state, round).targetLocationId
                : "location:military-pay-office";
            commit("commander.decided", {
              input,
              output: readJsonObject(output),
              targetLocationId,
            });
            later("guard.execute", 10);
            break;
          }
          case "guard.execute": {
            const decision = state.decisions.find(
              (d) =>
                d.input.decisionEpisodeId === episodeId(round, "commander"),
            );
            if (!decision) throw new Error("No committed commander decision");
            commit("guard.deployed", {
              targetLocationId: decision.targetLocationId,
            });
            commit("crisis.adjudicated", {
              protected: decision.targetLocationId === state.threats[round],
            });
            later("report.arrive", 30);
            break;
          }
          case "report.arrive": {
            const order = orderFor(state, round);
            if (!order.actualLocationId || state.outcomes[round] === undefined)
              throw new Error("Cannot report an unexecuted operation");
            commit("report.delivered", {
              observations: [
                observation(
                  ids.ruler,
                  round,
                  time,
                  ids.commander,
                  "deployment",
                  {
                    round,
                    orderId: order.id,
                    targetLocationId: order.actualLocationId,
                    obeyed: order.actualLocationId === order.targetLocationId,
                  },
                ),
                observation(
                  ids.ruler,
                  round,
                  time,
                  round === 1 ? ids.palaceInspector : ids.eastScout,
                  round === 1 ? "palace_result" : "warehouse_result",
                  { protected: state.outcomes[round]! },
                ),
              ],
            });
            if (round === 1)
              scheduled.push({
                eventType: "court.open",
                scheduledAt: addSimTime(time, 10),
                causalEventId: event.id,
                payload: { round: 2 },
              });
            break;
          }
          default:
            throw new Error(
              `Unknown continuous crisis event: ${event.eventType}`,
            );
        }
      }
      return { events: committed, scheduled };
    },
    reduce: reduceContinuousCrisisState,
  };
}

export function reduceContinuousCrisisState(
  state: ContinuousCrisisState,
  event: DomainEvent,
): ContinuousCrisisState {
  const round = roundOf(event.payload);
  const time = event.occurredAt;
  const updateOrder = (patch: Partial<CrisisOrder>) => {
    const order = orderFor(state, round);
    return {
      ...state,
      orders: state.orders.map((o) =>
        o.id === order.id ? { ...o, ...patch } : o,
      ),
    };
  };
  const receivedObservations = () => {
    if (!Array.isArray(event.payload.observations))
      throw new Error("Missing observations");
    return (
      event.payload.observations as unknown as readonly Observation[]
    ).map((o) => ({ ...o, causalEventId: event.id }));
  };
  switch (event.eventType) {
    case "court.opened": {
      const observations = receivedObservations();
      const episode = opening(round, ids.ruler, time, observations);
      return {
        ...state,
        round,
        phase: "waiting",
        observations: [...state.observations, ...observations],
        episodes: { ...state.episodes, [episode.id]: episode },
      };
    }
    case "court.order_issued": {
      const choice = text(event.payload, "choice") as CrisisChoice;
      if (
        !continuousCrisisRulerView(state, time).choices.some(
          (c) => c.id === choice,
        )
      )
        throw new Error("Invalid decree");
      const targetLocationId = text(event.payload, "targetLocationId");
      const episode = state.episodes[episodeId(round)];
      if (!episode || episode.status !== "open")
        throw new Error("Ruler episode is not open");
      const intent: Intent = {
        id: `intent:ruler:${round}`,
        actorId: ids.ruler,
        createdAt: time,
        goal: choice,
        operationTemplate: "issue_order",
        parameters: { targetLocationId },
        causalDecisionEpisodeId: episode.id,
      };
      return {
        ...state,
        phase: "running",
        orders: [
          ...state.orders,
          {
            id: `order:crisis:${round}`,
            round,
            episodeId: episode.id,
            choice,
            targetLocationId,
            issuedAt: time,
          },
        ],
        intents: [...state.intents, intent],
        episodes: {
          ...state.episodes,
          [episode.id]: {
            ...episode,
            status: "committed",
            finalIntentIds: [intent.id],
          },
        },
      };
    }
    case "courier.departed":
      return updateOrder({ departedAt: time });
    case "courier.arrived": {
      const observations = receivedObservations();
      const episode = opening(round, ids.commander, time, observations);
      return {
        ...updateOrder({ receivedAt: time }),
        observations: [...state.observations, ...observations],
        episodes: { ...state.episodes, [episode.id]: episode },
      };
    }
    case "commander.decided": {
      const input = event.payload.input as unknown as ActorDecisionInput;
      const output = actorDecisionOutputSchema.parse(event.payload.output);
      const episode = state.episodes[episodeId(round, "commander")];
      if (
        !episode ||
        episode.status !== "open" ||
        input?.decisionEpisodeId !== episode.id
      )
        throw new Error("Commander episode is not open");
      const targetLocationId = text(event.payload, "targetLocationId");
      const intent: Intent = {
        id: `intent:commander:${round}`,
        actorId: ids.commander,
        createdAt: time,
        goal: output.selectedIntent.goal,
        operationTemplate: "deploy_guard",
        parameters: { targetLocationId },
        causalDecisionEpisodeId: episode.id,
      };
      return {
        ...state,
        decisions: [...state.decisions, { input, output, targetLocationId }],
        intents: [...state.intents, intent],
        episodes: {
          ...state.episodes,
          [episode.id]: {
            ...episode,
            status: "committed",
            finalIntentIds: [intent.id],
          },
        },
      };
    }
    case "guard.deployed": {
      const targetLocationId = text(event.payload, "targetLocationId");
      return {
        ...updateOrder({
          executedAt: time,
          actualLocationId: targetLocationId,
        }),
        unitLocationId: targetLocationId,
        observations: [
          ...state.observations,
          observation(
            ids.commander,
            round,
            time,
            ids.commander,
            "own_deployment",
            { orderId: orderFor(state, round).id, targetLocationId },
          ),
        ],
      };
    }
    case "crisis.adjudicated":
      if (typeof event.payload.protected !== "boolean")
        throw new Error("Missing crisis result");
      return {
        ...state,
        outcomes: { ...state.outcomes, [round]: event.payload.protected },
      };
    case "report.delivered":
      return {
        ...updateOrder({ reportedAt: time }),
        phase: round === 2 ? "complete" : "running",
        observations: [...state.observations, ...receivedObservations()],
      };
    default:
      throw new Error(`Unhandled continuous crisis event: ${event.eventType}`);
  }
}

export async function startContinuousCrisisSession(options: {
  runId: string;
  outputLanguage: string;
  npcPolicy: DecisionPolicy;
}): Promise<ContinuousCrisisSession> {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    continuousCrisisInitialState,
    createContinuousCrisisModel(
      options.npcPolicy,
      options.runId,
      options.outputLanguage,
    ),
    store,
    options.runId,
  );
  await kernel.schedule({
    eventType: "court.open",
    scheduledAt: simTime(10),
    payload: { round: 1 },
  });
  await kernel.runUntilIdle();
  let busy = false;
  let submitted = false;
  const advance = async (schedule?: () => Promise<unknown>) => {
    if (busy) throw new Error("Crisis is already advancing");
    busy = true;
    try {
      await schedule?.();
      await kernel.runUntilIdle();
    } finally {
      busy = false;
    }
  };
  return {
    get rulerView() {
      return continuousCrisisRulerView(kernel.state, kernel.time);
    },
    get complete() {
      return kernel.state.phase === "complete";
    },
    async choose(id, choice) {
      if (
        busy ||
        kernel.state.phase !== "waiting" ||
        id !== episodeId(kernel.state.round)
      )
        throw new Error("This player episode is not open");
      if (
        !continuousCrisisRulerView(kernel.state, kernel.time).choices.some(
          (c) => c.id === choice,
        )
      )
        throw new Error("Invalid player choice");
      submitted = true;
      await advance(() =>
        kernel.schedule({
          eventType: "court.issue",
          scheduledAt: kernel.time,
          payload: { round: kernel.state.round, choice },
        }),
      );
    },
    async retry() {
      if (!submitted) throw new Error("No submitted decree to retry");
      await advance();
    },
    async result() {
      if (kernel.state.phase !== "complete")
        throw new Error("Crisis has not completed");
      return {
        state: kernel.state,
        records: await store.readAll(),
        rulerViewFinal: continuousCrisisRulerView(kernel.state, kernel.time),
      };
    },
  };
}
