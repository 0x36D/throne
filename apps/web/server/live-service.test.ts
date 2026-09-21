import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ActorDecisionInput } from "@throne/shared-types";
import { startPlayerDecisionSession } from "@throne/scenario-mvp";
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
        service.choose(
          start.id,
          "hold_imperial_palace",
          "decision:crisis:ruler:1",
        ),
        service.choose(
          start.id,
          "hold_imperial_palace",
          "decision:crisis:ruler:1",
        ),
      ]);
      expect(duplicate).toEqual(finished);
      expect(finished.status).toBe("waiting");
      expect(finished.version).toBe(2);
      if (finished.version !== 2) throw new Error("Expected continuous game");
      expect(finished.view.round).toBe(2);
      expect(
        finished.view.observations.find(
          (o) => o.payload.finding === "palace_result",
        )?.payload.protected,
      ).toBe(capabilityId === "obey_ruler");
      await expect(service.review(start.id)).rejects.toThrow(
        "after the run completes",
      );
      const stale = await service.choose(
        start.id,
        "hold_imperial_palace",
        "decision:crisis:ruler:1",
      );
      expect(stale).toEqual(finished);
      expect(inputs).toHaveLength(1);
      const complete = await service.choose(
        start.id,
        "move_to_east_gate",
        finished.view.decisionEpisodeId,
      );
      expect(complete.status).toBe("complete");
      expect(JSON.stringify(finished)).not.toContain("reasoningSummary");
      expect(JSON.stringify(inputs)).not.toContain("palace_infiltration");
      expect(JSON.stringify(inputs)).not.toContain("palace_secured");
      expect(inputs[0]?.availableCapabilities).toEqual([
        "obey_ruler",
        "follow_chancellor",
      ]);
      const review = await service.review(start.id);
      if (review.version !== 2) throw new Error("Expected v2 record");
      expect(review.run.state.unitLocationId).toBe(
        capabilityId === "obey_ruler"
          ? "location:east-gate"
          : "location:military-pay-office",
      );
      expect(review.run.state.decisions[1]?.input.actorId).toBe(
        "actor:guard-commander",
      );
      expect((await service.replay(start.id)).verified).toBe(true);
      expect(inputs).toHaveLength(2);
      expect(inputs[1]?.memories.some((m) => m.kind === "own_execution")).toBe(
        true,
      );
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
      const failed = await service.choose(
        start.id,
        "hold_imperial_palace",
        "decision:crisis:ruler:1",
      );
      expect(failed.status).toBe("failed");
      expect(failed.error).toBeTruthy();
      expect(failed.view.decisionStatus).toBe("resolved");
      if (failed.version !== 2) throw new Error("Expected continuous game");
      expect(failed.view.timeline.at(-1)?.kind).toBe("dispatch");
      expect(JSON.stringify(failed)).not.toContain("receivedAt");
      expect(
        failed.view.observations.some(
          (o) => o.actorId === "actor:guard-commander",
        ),
      ).toBe(false);
      await expect(service.review(start.id)).rejects.toThrow();
      await expect(
        service.choose(
          start.id,
          "move_to_east_gate",
          "decision:crisis:ruler:1",
        ),
      ).rejects.toThrow("cannot be changed");
      const success = await service.retry(start.id);
      expect(success.status).toBe("waiting");
      await service.choose(
        start.id,
        "move_to_east_gate",
        "decision:crisis:ruler:2",
      );
      const review = await service.review(start.id);
      const count = (type: string) =>
        review.run.records.filter(
          (r) => r.kind === "committed" && r.event.eventType === type,
        ).length;
      expect(count("court.order_issued")).toBe(2);
      expect(count("commander.decided")).toBe(2);
      expect(count("guard.deployed")).toBe(2);
      await service.choose(
        start.id,
        "hold_imperial_palace",
        "decision:crisis:ruler:1",
      );
      expect(calls).toBe(3);
    },
  );

  it("retries the second decision without regenerating the first", async () => {
    const root = await mkdtemp(join(tmpdir(), "throne-second-retry-"));
    const inputs: ActorDecisionInput[] = [];
    const service = new LiveService(root, () => ({
      async decide(input) {
        inputs.push(input);
        if (inputs.length === 2) throw new Error("Second decision failed");
        return {
          selectedIntent: {
            goal: "obey",
            capabilityId: "obey_ruler",
            parameters: {},
          },
        };
      },
    }));
    const start = await service.create("zh-CN");
    await expect(
      service.choose(
        start.id,
        "maintain_deployment",
        "decision:crisis:ruler:1",
      ),
    ).rejects.toThrow("Invalid player choice");
    await service.choose(
      start.id,
      "move_to_east_gate",
      "decision:crisis:ruler:1",
    );
    await expect(
      service.choose(start.id, "hold_imperial_palace", "wrong-episode"),
    ).rejects.toThrow("not open");
    const failed = await service.choose(
      start.id,
      "maintain_deployment",
      "decision:crisis:ruler:2",
    );
    expect(failed.status).toBe("failed");
    expect(
      failed.view.observations.find(
        (o) => o.payload.finding === "palace_result",
      )?.payload.protected,
    ).toBe(false);
    expect(
      failed.view.observations.some(
        (o) => o.payload.finding === "warehouse_result",
      ),
    ).toBe(false);
    await expect(service.review(start.id)).rejects.toThrow();
    expect((await service.retry(start.id)).status).toBe("complete");
    expect(inputs[2]).toEqual(inputs[1]);
    const saved = await service.review(start.id);
    if (saved.version !== 2) throw new Error("Expected v2");
    expect(saved.run.state.orders).toHaveLength(2);
    expect(saved.run.state.decisions).toHaveLength(2);
    expect(saved.run.state.outcomes).toEqual({ 1: false, 2: true });
    expect((await service.replay(start.id)).verified).toBe(true);
  });

  it("still reads and replays version 1 single-round records", async () => {
    const root = await mkdtemp(join(tmpdir(), "throne-legacy-"));
    const id = "11111111-1111-1111-1111-111111111111";
    const session = await startPlayerDecisionSession({
      runId: id,
      npcPolicy: {
        async decide() {
          return {
            selectedIntent: {
              goal: "obey",
              capabilityId: "obey_ruler",
              parameters: {},
            },
          };
        },
      },
    });
    const run = await session.choose("hold_imperial_palace");
    await mkdir(join(root, "runs"));
    await writeFile(
      join(root, "runs", `${id}.json`),
      JSON.stringify({ version: 1, id, locale: "en", calls: [], run }),
    );
    const service = new LiveService(root, () => ({
      decide() {
        throw new Error("Do not call model");
      },
    }));
    expect((await service.get(id)).version).toBe(1);
    expect((await service.replay(id)).verified).toBe(true);
  });
});
