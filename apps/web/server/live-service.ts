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
  startPlayerDecisionSession,
  playerDecisionInitialState,
  reducePlayerDecisionState,
  type PlayerChoiceId,
  type PlayerDecisionRun,
  type PlayerDecisionSession,
} from "@throne/scenario-mvp";
import type { Locale } from "@throne/localization";

export type LiveSnapshot = {
  id: string;
  status: "waiting" | "running" | "failed" | "complete";
  view: PlayerDecisionSession["rulerView"];
  error?: string;
};
export type SavedLiveRun = {
  version: 1;
  id: string;
  locale: Locale;
  calls: LiveCallTrace[];
  run: PlayerDecisionRun;
};
type Entry = {
  id: string;
  locale: Locale;
  session: PlayerDecisionSession;
  calls: LiveCallTrace[];
  status: LiveSnapshot["status"];
  choice?: PlayerChoiceId;
  run?: PlayerDecisionRun;
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
    const session = await startPlayerDecisionSession({
      runId: id,
      outputLanguage: locale,
      npcPolicy: this.policyFactory((trace) => calls.push(trace)),
    });
    const entry: Entry = { id, locale, session, calls, status: "waiting" };
    this.entries.set(id, entry);
    return this.snapshot(entry);
  }

  get(id: string): LiveSnapshot {
    return this.snapshot(this.required(id));
  }

  async choose(id: string, choice: PlayerChoiceId): Promise<LiveSnapshot> {
    const entry = this.required(id);
    if (choice !== "hold_imperial_palace" && choice !== "move_to_east_gate")
      throw new Error("Invalid player choice");
    if (entry.choice && entry.choice !== choice)
      throw new Error("The original decree cannot be changed on retry");
    if (entry.pending) return entry.pending;
    if (entry.status === "complete") return this.snapshot(entry);
    if (entry.status === "failed")
      throw new Error("Use retry to resume the paused decision");
    entry.choice = choice;
    return this.execute(entry, () => entry.session.choose(choice));
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
      saved.version !== 1 ||
      saved.id !== id ||
      !Array.isArray(saved.run?.records)
    )
      throw new Error("Unsupported or damaged run record");
    return saved;
  }

  async replay(id: string) {
    const saved = await this.review(id);
    const state = replay(
      playerDecisionInitialState,
      saved.run.records,
      reducePlayerDecisionState,
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
    run: () => Promise<PlayerDecisionRun>,
  ): Promise<LiveSnapshot> {
    entry.status = "running";
    delete entry.error;
    entry.pending = (async () => {
      try {
        entry.run = await run();
        const saved: SavedLiveRun = {
          version: 1,
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
      status: entry.status,
      view:
        entry.status === "complete" && entry.run
          ? entry.run.rulerViewFinal
          : entry.session.rulerView,
      ...(entry.error ? { error: entry.error } : {}),
    });
  }
}
