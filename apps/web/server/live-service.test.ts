import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActorDecisionInput } from "@throne/shared-types";
import { LiveService } from "./live-service.ts";

describe("live NPC sessions", () => {
  it.each(["obey_ruler", "follow_chancellor"])(
    "executes %s and replays without another policy call",
    async (capabilityId) => {
      const root = await mkdtemp(join(tmpdir(), "throne-live-test-"));
      const inputs: ActorDecisionInput[] = [];
      const service = new LiveService(root, () => ({
        async decide(input) {
          inputs.push(input);
          return {
            selectedIntent: {
              goal: "protect my unit",
              capabilityId,
              parameters: {},
            },
            reasoningSummary: "The available evidence favors this deployment.",
          };
        },
      }));
      const start = await service.create("zh-CN");
      expect(start.status).toBe("waiting");
      await expect(service.review(start.id)).rejects.toThrow(
        "after the run completes",
      );
      const [finished, duplicate] = await Promise.all([
        service.choose(start.id, "hold_imperial_palace"),
        service.choose(start.id, "hold_imperial_palace"),
      ]);
      expect(duplicate).toEqual(finished);
      expect(finished.status).toBe("complete");
      expect(finished.view.knownOutcome).toBe(
        capabilityId === "obey_ruler" ? "palace_secured" : "palace_breached",
      );
      expect(JSON.stringify(finished)).not.toContain("reasoningSummary");
      expect(JSON.stringify(inputs)).not.toContain("palace_infiltration");
      expect(JSON.stringify(inputs)).not.toContain("palace_secured");
      expect(inputs[0]?.availableCapabilities).toEqual([
        "obey_ruler",
        "follow_chancellor",
      ]);
      const review = await service.review(start.id);
      expect(review.run.state.units["unit:palace-guard"]?.locationId).toBe(
        capabilityId === "obey_ruler"
          ? "location:imperial-palace"
          : "location:military-pay-office",
      );
      expect(review.run.state.npcDecision?.input.actorId).toBe(
        "actor:guard-commander",
      );
      expect((await service.replay(start.id)).verified).toBe(true);
      expect(inputs).toHaveLength(1);
      const reopened = new LiveService(root, () => ({
        decide() {
          throw new Error("Replay must never call model");
        },
      }));
      expect((await reopened.replay(start.id)).verified).toBe(true);
      expect((await reopened.get(start.id)).status).toBe("complete");
      expect(
        await readFile(join(root, "runs", start.id + ".json"), "utf8"),
      ).not.toContain("reasoning_content");
    },
  );

  it.each(["network", "unavailable", "parameters"])(
    "pauses on %s failure and retries without repeating the decree",
    async (failure) => {
      const root = await mkdtemp(join(tmpdir(), "throne-live-retry-"));
      let calls = 0;
      const service = new LiveService(root, () => ({
        async decide() {
          calls++;
          if (calls === 1) {
            if (failure === "network") throw new Error("Provider timed out");
            return {
              selectedIntent: {
                goal: "invalid",
                capabilityId:
                  failure === "unavailable" ? "rewrite_world" : "obey_ruler",
                parameters: failure === "parameters" ? { troops: 9999 } : {},
              },
            };
          }
          return {
            selectedIntent: {
              goal: "obey",
              capabilityId: "obey_ruler",
              parameters: {},
            },
          };
        },
      }));
      const start = await service.create("en");
      const failed = await service.choose(start.id, "hold_imperial_palace");
      expect(failed.status).toBe("failed");
      expect(failed.error).toBeTruthy();
      expect(failed.view.decisionStatus).toBe("resolved");
      expect(failed.view.issuedOrder?.status).toBe("sent");
      expect(
        failed.view.observations.some(
          (o) => o.actorId === "actor:guard-commander",
        ),
      ).toBe(false);
      await expect(service.review(start.id)).rejects.toThrow();
      await expect(
        service.choose(start.id, "move_to_east_gate"),
      ).rejects.toThrow("cannot be changed");
      const success = await service.retry(start.id);
      expect(success.status).toBe("complete");
      const review = await service.review(start.id);
      const count = (type: string) =>
        review.run.records.filter(
          (r) => r.kind === "committed" && r.event.eventType === type,
        ).length;
      expect(count("order.created")).toBe(1);
      expect(count("npc.decision_recorded")).toBe(1);
      expect(count("unit.relocated")).toBe(1);
      await service.choose(start.id, "hold_imperial_palace");
      expect(calls).toBe(2);
    },
  );
});
