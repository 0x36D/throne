import type {
  ActorDecisionInput,
  ActorDecisionOutput,
} from "@throne/shared-types";

export interface DecisionPolicy {
  decide(input: ActorDecisionInput): Promise<ActorDecisionOutput>;
}

export class CallbackDecisionPolicy implements DecisionPolicy {
  constructor(
    readonly callback: (
      input: ActorDecisionInput,
    ) => Promise<ActorDecisionOutput>,
  ) {}

  decide(input: ActorDecisionInput): Promise<ActorDecisionOutput> {
    return this.callback(input);
  }
}

export class RecordedDecisionPolicy implements DecisionPolicy {
  readonly #decisions: ReadonlyMap<string, ActorDecisionOutput>;

  constructor(decisions: ReadonlyMap<string, ActorDecisionOutput>) {
    this.#decisions = decisions;
  }

  async decide(input: ActorDecisionInput): Promise<ActorDecisionOutput> {
    const decision = this.#decisions.get(input.decisionEpisodeId);
    if (!decision) {
      throw new Error(
        `No recorded decision for episode ${input.decisionEpisodeId}`,
      );
    }
    return structuredClone(decision) as ActorDecisionOutput;
  }
}

export type HarnessDecisionRunner = (
  input: ActorDecisionInput,
) => Promise<ActorDecisionOutput>;

export class HarnessDecisionPolicy implements DecisionPolicy {
  constructor(readonly runner: HarnessDecisionRunner) {}

  decide(input: ActorDecisionInput): Promise<ActorDecisionOutput> {
    return this.runner(input);
  }
}
