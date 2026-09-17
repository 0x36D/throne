declare const simTimeBrand: unique symbol;

export type SimTime = number & { readonly [simTimeBrand]: "SimTime" };

export function simTime(value: number): SimTime {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `Simulation time must be a non-negative safe integer; received ${value}`,
    );
  }

  return value as SimTime;
}

export function addSimTime(time: SimTime, delta: number): SimTime {
  return simTime(time + delta);
}
