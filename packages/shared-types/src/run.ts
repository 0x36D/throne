import type { JsonObject } from "./json.ts";

export type RunManifest = {
  readonly runId: string;
  readonly branchId: string;
  readonly parentRunId?: string;
  readonly branchPointEventId?: string;
  readonly scenarioVersion: string;
  readonly engineVersion: string;
  readonly seed: string;
  readonly actorPolicies: Readonly<Record<string, JsonObject>>;
  readonly modelConfigurations: Readonly<Record<string, JsonObject>>;
  readonly promptVersions: Readonly<Record<string, string>>;
  readonly startedAt: string;
  readonly completedAt?: string;
};
