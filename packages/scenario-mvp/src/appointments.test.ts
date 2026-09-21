import { describe, expect, it } from "vitest";
import { InMemoryEventStore, SimulationKernel, replay } from "@throne/sim-core";
import { simTime, type ScheduledEvent } from "@throne/shared-types";
import { deriveFormalAuthority, resolveOfficeBatch } from "./appointments.ts";
import {
  appointmentIds as ids,
  appointmentInitialState,
  appointmentModel,
  appointmentRulerView,
  runAppointmentScenario,
} from "./appointment-scenario.ts";

function fixture() {
  const store = new InMemoryEventStore();
  const kernel = new SimulationKernel(
    appointmentInitialState,
    appointmentModel,
    store,
    "offices-test",
  );
  return { kernel, store };
}

describe("office and appointment rules", () => {
  it("changes formal authority without replacing the person, history, or patronage", async () => {
    const run = await runAppointmentScenario();
    expect(deriveFormalAuthority(run.before, ids.army)).toEqual([ids.general]);
    expect(deriveFormalAuthority(run.afterAppointment, ids.army)).toEqual([
      ids.successor,
    ]);
    expect(run.afterAppointment.actors[ids.general]?.identity).toEqual(
      run.before.actors[ids.general]?.identity,
    );
    expect(run.afterAppointment.actors[ids.general]?.memories).toEqual(
      run.before.actors[ids.general]?.memories,
    );
    expect(run.afterAppointment.relationships).toEqual(
      run.before.relationships,
    );
    expect(run.afterAppointment.actors[ids.general]?.officeHistory).toEqual([
      {
        appointmentId: ids.oldAppointment,
        officeId: ids.military,
        startedAt: 0,
        endedAt: 10,
      },
      { appointmentId: ids.promotion, officeId: ids.chancellor, startedAt: 10 },
    ]);
    expect(run.state.decision?.selectedOrderId).toBe(ids.oldOrder);
    expect(run.state.orders[ids.newOrder]?.status).toBe("ignored");
    expect(run.state.unitLocationId).toBe(ids.payOffice);
  });

  it("changes obedience when the evidence changes, not from the actor's name", async () => {
    const run = await runAppointmentScenario({ oldPersonalSupport: 0.1 });
    expect(run.state.decision?.selectedOrderId).toBe(ids.newOrder);
    expect(run.state.orders[ids.oldOrder]?.status).toBe("ignored");
    expect(run.state.unitLocationId).toBe(ids.palace);
  });

  it("delivers both orders together and reveals the action only through a later report", async () => {
    const run = await runAppointmentScenario();
    expect(run.rulerBeforeReport.reports).toEqual([]);
    expect(JSON.stringify(run.rulerBeforeReport)).not.toContain(
      "relationships",
    );
    expect(JSON.stringify(run.rulerBeforeReport)).not.toContain(ids.payOffice);
    const arrivals = run.records.filter(
      (r) => r.kind === "committed" && r.event.eventType === "order.received",
    );
    expect(
      arrivals.map((r) => r.kind === "committed" && r.event.occurredAt),
    ).toEqual([55, 55]);
    expect(run.state.orders[ids.oldOrder]?.lifecycle.at(-1)?.occurredAt).toBe(
      65,
    );
    expect(run.rulerFinal.reports[0]?.observedAt).toBe(105);
    const reconstructed = replay(
      run.initialState,
      run.records,
      appointmentModel.reduce,
    );
    expect(reconstructed).toEqual(run.state);
    expect(appointmentRulerView(reconstructed)).toEqual(run.rulerFinal);
  });

  it("records an unauthorized appointment, then explicit institutional recognition", async () => {
    const { kernel, store } = fixture();
    await kernel.schedule({
      eventType: "office.appoint",
      actorId: ids.general,
      scheduledAt: simTime(0),
      payload: {
        appointmentId: "usurped",
        officeId: ids.military,
        incumbentId: ids.general,
        basis: "self_claim",
      },
    });
    await kernel.runUntilIdle();
    expect(kernel.state.appointments.usurped?.legality).toBe("irregular");
    expect(deriveFormalAuthority(kernel.state, ids.army)).toEqual([]);
    await kernel.schedule({
      eventType: "office.recognize",
      actorId: ids.ruler,
      scheduledAt: simTime(5),
      payload: { appointmentId: "usurped" },
    });
    await kernel.runUntilIdle();
    expect(deriveFormalAuthority(kernel.state, ids.army)).toEqual([
      ids.general,
    ]);
    expect(kernel.state.appointments.usurped?.legality).toBe("legal");
    expect(
      kernel.state.appointments.usurped?.history.map((h) => h.kind),
    ).toEqual(["appointed", "recognized"]);
    expect(
      replay(
        appointmentInitialState,
        await store.readAll(),
        appointmentModel.reduce,
      ),
    ).toEqual(kernel.state);
  });

  it("does not end an appointment merely because an unauthorized rival removes it", async () => {
    const { kernel } = fixture();
    await kernel.schedule({
      eventType: "office.appoint",
      actorId: ids.ruler,
      scheduledAt: simTime(0),
      payload: {
        appointmentId: "lawful",
        officeId: ids.military,
        incumbentId: ids.successor,
        basis: "decree",
      },
    });
    await kernel.runUntilIdle();
    await kernel.schedule({
      eventType: "office.remove",
      actorId: ids.general,
      scheduledAt: simTime(5),
      payload: { appointmentId: "lawful" },
    });
    await kernel.runUntilIdle();
    expect(kernel.state.appointments.lawful?.endedAt).toBeUndefined();
    expect(kernel.state.appointments.lawful?.history.at(-1)?.kind).toBe(
      "removal_contested",
    );
    expect(deriveFormalAuthority(kernel.state, ids.army)).toEqual([
      ids.successor,
    ]);
  });

  it("keeps simultaneous over-capacity appointments instead of letting the last writer win", async () => {
    const events: ScheduledEvent[] = [ids.general, ids.successor].map(
      (id, i) => ({
        id: `scheduled:${i}`,
        createdAt: simTime(0),
        scheduledAt: simTime(0),
        eventType: "office.appoint",
        actorId: ids.ruler,
        payload: {
          appointmentId: `claim:${id}`,
          officeId: ids.military,
          incumbentId: id,
          basis: "decree",
        },
      }),
    );
    const forward = resolveOfficeBatch(
      appointmentInitialState,
      events,
      simTime(0),
    );
    const reverse = resolveOfficeBatch(
      appointmentInitialState,
      [...events].reverse(),
      simTime(0),
    );
    expect(reverse).toEqual(forward);
    const { kernel, store } = fixture();
    for (const event of events) await kernel.schedule(event);
    await kernel.runUntilIdle();
    expect(
      Object.values(kernel.state.appointments).map((a) => a.legality),
    ).toEqual(["contested", "contested"]);
    expect(deriveFormalAuthority(kernel.state, ids.army)).toEqual(
      [ids.successor, ids.general].sort(),
    );
    expect(
      replay(
        appointmentInitialState,
        await store.readAll(),
        appointmentModel.reduce,
      ),
    ).toEqual(kernel.state);
  });

  it("rejects unknown references atomically instead of inventing an office", async () => {
    const { kernel, store } = fixture();
    await kernel.schedule({
      eventType: "office.appoint",
      actorId: ids.ruler,
      scheduledAt: simTime(0),
      payload: {
        appointmentId: "invalid",
        officeId: "office:missing",
        incumbentId: ids.general,
        basis: "decree",
      },
    });
    await expect(kernel.runUntilIdle()).rejects.toThrow("Unknown office");
    expect(kernel.state).toEqual(appointmentInitialState);
    expect(
      (await store.readAll()).filter((r) => r.kind === "committed"),
    ).toEqual([]);
  });

  it("requires a communication route even for a lawful appointer", async () => {
    const event: ScheduledEvent = {
      id: "blocked",
      createdAt: simTime(0),
      scheduledAt: simTime(0),
      eventType: "office.appoint",
      actorId: ids.ruler,
      payload: {
        appointmentId: "blocked",
        officeId: ids.military,
        incumbentId: ids.general,
        basis: "decree",
      },
    };
    expect(() =>
      resolveOfficeBatch(
        { ...appointmentInitialState, appointmentChannels: {} },
        [event],
        simTime(0),
      ),
    ).toThrow("No appointment communication route");
  });
});
