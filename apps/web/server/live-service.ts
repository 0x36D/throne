import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createLivePolicy,
  type LiveCallTrace,
} from "@throne/agent-runtime/live";
import type { DecisionPolicy } from "@throne/agent-runtime/policy";
import { replay } from "@throne/sim-core";
import {
  startContinuousCrisisSession,
  continuousCrisisInitialState,
  reduceContinuousCrisisState,
  playerDecisionInitialState,
  reducePlayerDecisionState,
  type PlayerDecisionRun,
  type ContinuousCrisisRun,
  type ContinuousCrisisSession,
  type CrisisChoice,
} from "@throne/scenario-mvp";
import type { Locale } from "@throne/localization";

type SnapshotBase = {
  id: string;
  status: "waiting" | "running" | "failed" | "complete";
  error?: string;
};
export type LiveSnapshot = SnapshotBase &
  (
    | { version: 1; view: PlayerDecisionRun["rulerViewFinal"] }
    | { version: 2; view: ContinuousCrisisRun["rulerViewFinal"] }
  );
export type SavedLiveRun = {
  id: string;
  locale: Locale;
  calls: LiveCallTrace[];
} & (
  | { version: 1; run: PlayerDecisionRun }
  | { version: 2; run: ContinuousCrisisRun }
);
type Entry = {
  id: string;
  locale: Locale;
  session: ContinuousCrisisSession;
  calls: LiveCallTrace[];
  status: LiveSnapshot["status"];
  submissions: Map<string, CrisisChoice>;
  run?: ContinuousCrisisRun;
  error?: string;
  pending?: Promise<LiveSnapshot>;
};
export type PolicyFactory = (
  onTrace: (trace: LiveCallTrace) => void,
) => DecisionPolicy;

export class LiveService {
  readonly entries = new Map<string, Entry>();
  constructor(
    readonly root: string,
    readonly policyFactory: PolicyFactory = (trace) =>
      createLivePolicy(root, trace),
  ) {}

  async create(locale: Locale): Promise<LiveSnapshot> {
    if (this.entries.size >= 50)
      throw new Error(
        "Local session limit reached; restart the development server",
      );
    const id = randomUUID();
    const calls: LiveCallTrace[] = [];
    const session = await startContinuousCrisisSession({
      runId: id,
      outputLanguage: locale,
      npcPolicy: this.policyFactory((trace) => calls.push(trace)),
    });
    const entry: Entry = {
      id,
      locale,
      session,
      calls,
      status: "waiting",
      submissions: new Map(),
    };
    this.entries.set(id, entry);
    return this.snapshot(entry);
  }

  async get(id: string): Promise<LiveSnapshot> {
    const entry = this.entries.get(id);
    if (entry) return this.snapshot(entry);
    const saved = await this.review(id);
    return saved.version === 1
      ? { id, status: "complete", version: 1, view: saved.run.rulerViewFinal }
      : { id, status: "complete", version: 2, view: saved.run.rulerViewFinal };
  }

  async choose(
    id: string,
    choice: CrisisChoice,
    decisionEpisodeId: string,
  ): Promise<LiveSnapshot> {
    const entry = this.required(id);
    if (
      choice !== "hold_imperial_palace" &&
      choice !== "move_to_east_gate" &&
      choice !== "maintain_deployment"
    )
      throw new Error("Invalid player choice");
    const previous = entry.submissions.get(decisionEpisodeId);
    if (previous && previous !== choice)
      throw new Error("The original decree cannot be changed on retry");
    if (previous) return entry.pending ?? this.snapshot(entry);
    if (
      entry.pending ||
      entry.status !== "waiting" ||
      entry.session.rulerView.decisionEpisodeId !== decisionEpisodeId
    )
      throw new Error("This player episode is not open");
    if (!entry.session.rulerView.choices.some((c) => c.id === choice))
      throw new Error("Invalid player choice for this episode");
    entry.submissions.set(decisionEpisodeId, choice);
    return this.execute(entry, () =>
      entry.session.choose(decisionEpisodeId, choice),
    );
  }

  async retry(id: string): Promise<LiveSnapshot> {
    const entry = this.required(id);
    if (entry.pending) return entry.pending;
    if (entry.status !== "failed")
      throw new Error("Only a failed decision can be retried");
    return this.execute(entry, () => entry.session.retry());
  }

  async review(id: string): Promise<SavedLiveRun> {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid run id");
    const entry = this.entries.get(id);
    if (entry && entry.status !== "complete")
      throw new Error("Review is available after the run completes");
    const saved = JSON.parse(
      await readFile(join(this.root, "runs", `${id}.json`), "utf8"),
    ) as SavedLiveRun;
    if (
      (saved.version !== 1 && saved.version !== 2) ||
      saved.id !== id ||
      !Array.isArray(saved.run?.records)
    )
      throw new Error("Unsupported or damaged run record");
    return saved;
  }

  async replay(id: string) {
    const saved = await this.review(id);
    const state =
      saved.version === 1
        ? replay(
            playerDecisionInitialState,
            saved.run.records,
            reducePlayerDecisionState,
          )
        : replay(
            continuousCrisisInitialState,
            saved.run.records,
            reduceContinuousCrisisState,
          );
    if (JSON.stringify(state) !== JSON.stringify(saved.run.state))
      throw new Error("Replay differs from saved state");
    return {
      id,
      verified: true,
      committedEvents: saved.run.records.filter((r) => r.kind === "committed")
        .length,
    };
  }

  private execute(
    entry: Entry,
    run: () => Promise<void>,
  ): Promise<LiveSnapshot> {
    entry.status = "running";
    delete entry.error;
    entry.pending = (async () => {
      try {
        await run();
        if (!entry.session.complete) {
          entry.status = "waiting";
          return this.snapshot(entry);
        }
        entry.run = await entry.session.result();
        const saved: SavedLiveRun = {
          version: 2,
          id: entry.id,
          locale: entry.locale,
          calls: entry.calls,
          run: entry.run,
        };
        const directory = join(this.root, "runs");
        await mkdir(directory, { recursive: true });
        const path = join(directory, `${entry.id}.json`);
        await writeFile(path + ".tmp", JSON.stringify(saved, null, 2), {
          mode: 0o600,
        });
        await rename(path + ".tmp", path);
        entry.status = "complete";
      } catch (error) {
        entry.status = "failed";
        entry.error = error instanceof Error ? error.message : String(error);
      } finally {
        delete entry.pending;
      }
      return this.snapshot(entry);
    })();
    return entry.pending;
  }

  private required(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error("Unknown live session; start a new run");
    return entry;
  }
  private snapshot(entry: Entry): LiveSnapshot {
    return structuredClone({
      id: entry.id,
      version: 2,
      status: entry.status,
      view:
        entry.status === "complete" && entry.run
          ? entry.run.rulerViewFinal
          : entry.session.rulerView,
      ...(entry.error ? { error: entry.error } : {}),
    });
  }
}
