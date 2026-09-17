export class DeterministicIdFactory {
  #counter = 0;

  constructor(readonly prefix: string) {}

  next(kind: "domain" | "scheduled"): string {
    const id = `${this.prefix}:${kind}:${this.#counter.toString().padStart(8, "0")}`;
    this.#counter += 1;
    return id;
  }
}
