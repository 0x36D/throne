import { z } from "zod";
import type { JsonObject } from "./json.ts";

const objectSchema = z.record(z.string(), z.json());
const stringsSchema = z.array(z.string());

export function readJsonObject(value: unknown): JsonObject {
  return objectSchema.parse(value);
}

export function readStringArray(value: unknown): string[] {
  return stringsSchema.parse(value);
}
