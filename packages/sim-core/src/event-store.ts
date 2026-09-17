import type { SimulationRecord } from "@throne/shared-types";

export interface EventStore {
  append(records: readonly SimulationRecord[]): Promise<void>;
  readAll(): Promise<readonly SimulationRecord[]>;
}

export class InMemoryEventStore implements EventStore {
  readonly #records: SimulationRecord[] = [];

  async append(records: readonly SimulationRecord[]): Promise<void> {
    const snapshot = structuredClone(records) as SimulationRecord[];
    this.#records.push(...snapshot);
  }

  async readAll(): Promise<readonly SimulationRecord[]> {
    return structuredClone(this.#records) as SimulationRecord[];
  }
}
