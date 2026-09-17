import { describe, expect, it } from "vitest";
import { parseDecisionResponse } from "./deepseek-harness.ts";

describe("parseDecisionResponse", () => {
  it("accepts a fenced, schema-valid decision", () => {
    const decision = parseDecisionResponse(`\`\`\`json
      {
        "reasoningSummary": "The report should be verified before committing troops.",
        "selectedIntent": {
          "goal": "Verify the provincial report",
          "capabilityId": "request-independent-report",
          "parameters": { "regionId": "north" }
        },
        "confidence": 0.7,
        "requestedInformation": ["An independent grain estimate"]
      }
    \`\`\``);

    expect(decision.selectedIntent.goal).toBe("Verify the provincial report");
    expect(decision.confidence).toBe(0.7);
  });

  it("rejects prose without a structured decision", () => {
    expect(() => parseDecisionResponse("I would investigate first.")).toThrow(
      "returned no JSON decision object",
    );
  });
});
