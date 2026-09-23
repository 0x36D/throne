import {
  addSimTime,
  simTime,
  validateMotivationProfile,
  type DomainEvent,
  type MotivationProfile,
  type SimTime,
  type SimulationRecord,
} from "@throne/shared-types";
import {
  InMemoryEventStore,
  SimulationKernel,
  replay,
  type DomainEventDraft,
  type DomainModel,
  type ScheduledEventDraft,
} from "@throne/sim-core";

export type BureauFaction = "reform" | "restore";

export type Bureaucrat = {
  readonly id: string;
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  readonly faction: BureauFaction | null;
  readonly parentId?: string;
  readonly influence: number;
  readonly ideology: number;
  readonly motivations: MotivationProfile;
  readonly lobbyBias: number;
  readonly quota: number;
  readonly delivered: number;
  readonly claimed: number;
  readonly grafted: number;
};

export type LobbyLogEntry = {
  readonly at: SimTime;
  readonly round: number;
  readonly fromId: string;
  readonly toId: string;
  readonly delta: number;
};

export type BureaucracyState = {
  readonly actors: Readonly<Record<string, Bureaucrat>>;
  readonly ruleValue: "new_law" | "old_law";
  readonly round: number;
  readonly lobbyLog: readonly LobbyLogEntry[];
  readonly ledger: readonly {
    readonly round: number;
    readonly actual: number;
    readonly claimed: number;
  }[];
  readonly timeline: readonly { readonly at: SimTime; readonly text: string }[];
};

export type BureauView = {
  readonly round: number;
  readonly ruleValue: "new_law" | "old_law";
  readonly support: number;
  readonly oppose: number;
  readonly emperorReported: number;
  readonly emperorActual: number;
  readonly reformFalsification: number;
  readonly restoreFalsification: number;
  readonly reformGraft: number;
  readonly restoreGraft: number;
  readonly ministers: readonly {
    readonly id: string;
    readonly name: string;
    readonly faction: BureauFaction | null;
    readonly officers: number;
    readonly delivered: number;
    readonly claimed: number;
    readonly lobbied: number;
  }[];
  readonly timeline: readonly { readonly at: SimTime; readonly text: string }[];
};

export type BureaucracyRun = {
  readonly state: BureaucracyState;
  readonly records: readonly SimulationRecord[];
  readonly views: readonly BureauView[];
};

export const bureauIds = {
  emperor: "actor:emperor",
} as const;

const ministerDefs: readonly {
  readonly id: string;
  readonly name: string;
  readonly faction: BureauFaction;
  readonly ideology: number;
}[] = [
  { id: "actor:wang", name: "Wang", faction: "reform", ideology: 0.9 },
  { id: "actor:lv", name: "Lv", faction: "reform", ideology: 0.6 },
  { id: "actor:zhang", name: "Zhang", faction: "reform", ideology: 0.5 },
  { id: "actor:sima", name: "Sima", faction: "restore", ideology: -0.85 },
  { id: "actor:fan", name: "Fan", faction: "restore", ideology: -0.5 },
];

const OFFICERS_PER_MINISTER = 5;

function profile(start: Partial<MotivationProfile>): MotivationProfile {
  return validateMotivationProfile({
    selfPreservation: 0.5,
    wealth: 0.5,
    officeRetention: 0.5,
    ambition: 0.5,
    loyaltyToRuler: 0.5,
    loyaltyToState: 0.5,
    loyaltyToFamily: 0.5,
    loyaltyToOrganization: 0.5,
    ideologicalCommitment: 0.5,
    regionalAttachment: 0.5,
    reputation: 0.5,
    concernForSubordinates: 0.5,
    riskTolerance: 0.5,
    revenge: 0.5,
    fearOfDisorder: 0.5,
    proceduralLegality: 0.5,
    ...start,
  });
}

export function createBureaucracyInitialState(): BureaucracyState {
  const actors: Record<string, Bureaucrat> = {
    [bureauIds.emperor]: {
      id: bureauIds.emperor,
      name: "The Emperor",
      tier: 1,
      faction: null,
      influence: 0.5,
      ideology: 0,
      motivations: profile({ loyaltyToState: 0.9 }),
      lobbyBias: 0,
      quota: 0,
      delivered: 0,
      claimed: 0,
      grafted: 0,
    },
  };
  for (const minister of ministerDefs) {
    actors[minister.id] = {
      id: minister.id,
      name: minister.name,
      tier: 2,
      faction: minister.faction,
      influence: 1,
      ideology: minister.ideology,
      motivations: profile({ ideologicalCommitment: 0.8 }),
      lobbyBias: 0,
      quota: 0,
      delivered: 0,
      claimed: 0,
      grafted: 0,
    };
    for (let i = 0; i < OFFICERS_PER_MINISTER; i += 1) {
      const id = `${minister.id}:officer${i + 1}`;
      const reform = minister.faction === "reform";
      actors[id] = {
        id,
        name: `${minister.name}##${i + 1}`,
        tier: 3,
        faction: minister.faction,
        parentId: minister.id,
        influence: 0.4,
        ideology: minister.ideology * (0.6 + 0.1 * i),
        motivations: profile({
          wealth: reform ? 0.4 : 0.85,
          ambition: reform ? 0.85 : 0.5,
          proceduralLegality: reform ? 0.35 : 0.25,
        }),
        lobbyBias: 0,
        quota: 0,
        delivered: 0,
        claimed: 0,
        grafted: 0,
      };
    }
  }
  return {
    actors,
    ruleValue: "old_law",
    round: 0,
    lobbyLog: [],
    ledger: [],
    timeline: [],
  };
}

export function deriveGraftRate(actor: Bureaucrat): number {
  const autonomy = actor.faction === "restore" ? 0.25 : 0.05;
  return rounded(
    clamp(
      actor.motivations.wealth * (1 - actor.motivations.proceduralLegality) +
        autonomy,
      0,
      0.6,
    ),
  );
}

export function deriveFalsification(actor: Bureaucrat): number {
  const pressure = actor.faction === "reform" ? 0.4 : 0.1;
  return rounded(
    clamp(
      pressure * (1 - actor.motivations.proceduralLegality) +
        0.2 * actor.motivations.ambition,
      0,
      0.8,
    ),
  );
}

export function createBureaucracyModel(
  maxRounds: number,
  interval: number,
): DomainModel<BureaucracyState> {
  return {
    resolveBatch({ state, time }) {
      const committed: DomainEventDraft[] = [];
      const scheduled: ScheduledEventDraft[] = [];

      for (const minister of ministerDefs) {
        const ally = ministerDefs.find(
          (other) =>
            other.faction === minister.faction && other.id !== minister.id,
        );
        if (!ally) throw new Error(`No lobby ally for ${minister.id}`);
        committed.push({
          eventType: "minister.lobbied",
          actorId: minister.id,
          payload: {
            round: state.round,
            fromId: minister.id,
            toId: ally.id,
            delta: rounded(0.05 * Math.sign(minister.ideology)),
          },
        });
      }

      const tally = supportTally(state);
      committed.push({
        eventType:
          tally.support > tally.oppose ? "rule.endorsed" : "rule.deferred",
        actorId: bureauIds.emperor,
        payload: { support: tally.support, oppose: tally.oppose },
      });
      const nextRule: "new_law" | "old_law" =
        tally.support > tally.oppose ? "new_law" : "old_law";

      const quota = 4;
      let actual = 0;
      let claimed = 0;
      for (const actor of Object.values(state.actors)) {
        if (actor.tier !== 3) continue;
        const graftRate = deriveGraftRate(actor);
        const falsification = deriveFalsification(actor);
        const delivered = rounded(quota * (1 - graftRate));
        const grafted = rounded(quota - delivered);
        const claimedValue = rounded(
          delivered + (quota - delivered) * falsification,
        );
        actual += delivered;
        claimed += claimedValue;
        committed.push({
          eventType: "official.executed",
          actorId: actor.id,
          payload: { officialId: actor.id, quota, delivered, grafted },
        });
        committed.push({
          eventType: "official.reported",
          actorId: actor.id,
          payload: { officialId: actor.id, claimed: claimedValue },
        });
      }
      committed.push({
        eventType: "round.settled",
        actorId: bureauIds.emperor,
        payload: {
          round: state.round,
          actual: rounded(actual),
          claimed: rounded(claimed),
          ruleValue: nextRule,
        },
      });

      if (state.round + 1 < maxRounds) {
        scheduled.push({
          eventType: "court.round",
          scheduledAt: addSimTime(time, interval),
          actorId: bureauIds.emperor,
          payload: {},
        });
      }
      return { events: committed, scheduled };
    },
    reduce: reduceBureaucracyState,
  };
}

export function reduceBureaucracyState(
  state: BureaucracyState,
  event: DomainEvent,
): BureaucracyState {
  switch (event.eventType) {
    case "minister.lobbied": {
      const toId = String(event.payload.toId);
      const target = requiredActor(state, toId);
      return {
        ...state,
        actors: {
          ...state.actors,
          [toId]: {
            ...target,
            lobbyBias: rounded(
              clamp(target.lobbyBias + Number(event.payload.delta), -0.8, 0.8),
            ),
          },
        },
        lobbyLog: [
          ...state.lobbyLog,
          {
            at: event.occurredAt,
            round: Number(event.payload.round),
            fromId: String(event.payload.fromId),
            toId,
            delta: Number(event.payload.delta),
          },
        ],
      };
    }
    case "rule.endorsed":
      return {
        ...state,
        ruleValue: "new_law",
        timeline: [
          ...state.timeline,
          { at: event.occurredAt, text: "New Law endorsed" },
        ],
      };
    case "rule.deferred":
      return {
        ...state,
        timeline: [
          ...state.timeline,
          { at: event.occurredAt, text: "policy deferred" },
        ],
      };
    case "official.executed": {
      const id = String(event.payload.officialId);
      const actor = requiredActor(state, id);
      return {
        ...state,
        actors: {
          ...state.actors,
          [id]: {
            ...actor,
            quota: Number(event.payload.quota),
            delivered: Number(event.payload.delivered),
            grafted: Number(event.payload.grafted),
          },
        },
      };
    }
    case "official.reported": {
      const id = String(event.payload.officialId);
      const actor = requiredActor(state, id);
      return {
        ...state,
        actors: {
          ...state.actors,
          [id]: { ...actor, claimed: Number(event.payload.claimed) },
        },
      };
    }
    case "round.settled": {
      const round = Number(event.payload.round);
      return {
        ...state,
        round: round + 1,
        ledger: [
          ...state.ledger,
          {
            round,
            actual: Number(event.payload.actual),
            claimed: Number(event.payload.claimed),
          },
        ],
        timeline: [
          ...state.timeline,
          {
            at: event.occurredAt,
            text: `round ${round}: actual ${Number(event.payload.actual)} / claimed ${Number(event.payload.claimed)}`,
          },
        ],
      };
    }
    default:
      throw new Error(
        `Unhandled bureaucracy event ${event.eventType} (${event.id})`,
      );
  }
}

export function bureaucracyView(
  state: BureaucracyState,
  time: SimTime,
): BureauView {
  const tally = supportTally(state);
  const officers = Object.values(state.actors).filter((a) => a.tier === 3);
  let emperorActual = 0;
  let emperorReported = 0;
  let reformFalsification = 0;
  let restoreFalsification = 0;
  let reformGraft = 0;
  let restoreGraft = 0;
  for (const officer of officers) {
    emperorActual += officer.delivered;
    emperorReported += officer.claimed;
    const falsified = officer.claimed - officer.delivered;
    if (officer.faction === "reform") {
      reformFalsification += falsified;
      reformGraft += officer.grafted;
    } else {
      restoreFalsification += falsified;
      restoreGraft += officer.grafted;
    }
  }
  const ministers = ministerDefs.map((minister) => {
    const children = Object.values(state.actors).filter(
      (a) => a.parentId === minister.id,
    );
    return {
      id: minister.id,
      name: minister.name,
      faction: minister.faction,
      officers: children.length,
      delivered: rounded(children.reduce((sum, c) => sum + c.delivered, 0)),
      claimed: rounded(children.reduce((sum, c) => sum + c.claimed, 0)),
      lobbied: state.lobbyLog.filter((entry) => entry.fromId === minister.id)
        .length,
    };
  });
  return {
    round: state.round,
    ruleValue: state.ruleValue,
    support: tally.support,
    oppose: tally.oppose,
    emperorReported: rounded(emperorReported),
    emperorActual: rounded(emperorActual),
    reformFalsification: rounded(reformFalsification),
    restoreFalsification: rounded(restoreFalsification),
    reformGraft: rounded(reformGraft),
    restoreGraft: rounded(restoreGraft),
    ministers,
    timeline: state.timeline,
  };
}

export async function runBureaucracyCycle(
  options: { runId?: string; rounds?: number; interval?: number } = {},
): Promise<BureaucracyRun> {
  const runId = options.runId ?? "bureaucracy-cycle-demo";
  const rounds = options.rounds ?? 4;
  const interval = options.interval ?? 20;
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    createBureaucracyInitialState(),
    createBureaucracyModel(rounds, interval),
    store,
    runId,
  );
  await kernel.schedule({
    eventType: "court.round",
    scheduledAt: simTime(0),
    actorId: bureauIds.emperor,
    payload: {},
  });
  const views: BureauView[] = [];
  while (await kernel.step()) {
    views.push(bureaucracyView(kernel.state, kernel.time));
  }
  const records = await store.readAll();
  if (
    JSON.stringify(
      replay(createBureaucracyInitialState(), records, reduceBureaucracyState),
    ) !== JSON.stringify(kernel.state)
  ) {
    throw new Error("Replay differs from live bureaucracy state");
  }
  return { state: kernel.state, records, views };
}

function supportTally(state: BureaucracyState): {
  readonly support: number;
  readonly oppose: number;
} {
  let support = 0;
  let oppose = 0;
  for (const minister of ministerDefs) {
    const actor = requiredActor(state, minister.id);
    const effective = clamp(actor.ideology + actor.lobbyBias, -1, 1);
    if (effective > 0) support += actor.influence * effective;
    else if (effective < 0) oppose += actor.influence * -effective;
  }
  return { support: rounded(support), oppose: rounded(oppose) };
}

function requiredActor(state: BureaucracyState, id: string): Bureaucrat {
  const actor = state.actors[id];
  if (!actor) throw new Error(`Unknown bureaucrat: ${id}`);
  return actor;
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
