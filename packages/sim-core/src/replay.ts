import type { DomainEvent, SimulationRecord } from "@throne/shared-types";

export function replay<State>(
  initialState: State,
  records: readonly SimulationRecord[],
  reduce: (state: Readonly<State>, event: DomainEvent) => State,
): State {
  return records.reduce<State>(
    (state, record) => {
      if (record.kind !== "committed") return state;
      return reduce(state, record.event);
    },
    structuredClone(initialState) as State,
  );
}
