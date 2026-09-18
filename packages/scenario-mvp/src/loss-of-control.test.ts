import { describe, expect, it } from "vitest";
import { replay } from "@throne/sim-core";
import {
  assessPracticalControl,
  lossOfControlActorView,
  lossOfControlIds,
  lossOfControlInitialState,
  lossOfControlModel,
  runLossOfControlScenario,
} from "./loss-of-control.ts";

describe("emergent loss of control scenario", () => {
  it("changes practical leadership without changing formal authority", async () => {
    const run = await runLossOfControlScenario(
      "loss-of-control-emergence-test",
    );
    const organization =
      run.debugTruth.organizations[lossOfControlIds.organization];
    const eventTypes = run.records
      .filter((record) => record.kind === "committed")
      .map((record) =>
        record.kind === "committed" ? record.event.eventType : "",
      );

    expect(organization?.formalAuthorityIds).toEqual([lossOfControlIds.ruler]);
    expect(run.state.actors[lossOfControlIds.ruler]?.office).toBe("Sovereign");
    expect(run.controlAfterFirstDecision.leadingActorId).toBe(
      lossOfControlIds.ruler,
    );
    expect(run.controlFinal.leadingActorId).toBe(lossOfControlIds.chancellor);
    expect(
      eventTypes.some((type) => /coup|collapse|loss_of_control/.test(type)),
    ).toBe(false);
    expect(JSON.stringify(run.state)).not.toContain("leadingActorId");
  });

  it("turns a concrete payroll transfer into a stronger funding dependency", async () => {
    const run = await runLossOfControlScenario("loss-of-control-funding-test");
    const relationship =
      run.debugTruth.relationships[lossOfControlIds.fundingRelationship];

    expect(
      run.debugTruth.resourceAccounts[lossOfControlIds.chancellorReserve]
        ?.balance,
    ).toBe(50);
    expect(
      run.debugTruth.resourceAccounts[lossOfControlIds.guardPayroll]?.balance,
    ).toBe(100);
    expect(run.debugTruth.payroll.arrears).toBe(0);
    expect(relationship?.strength).toBe(0.95);
    expect(relationship?.history.map((entry) => entry.strength)).toEqual([
      0.2, 0.95,
    ]);
  });

  it("records obedience moving from the ruler to the chancellor across two decisions", async () => {
    const run = await runLossOfControlScenario(
      "loss-of-control-obedience-test",
    );
    const firstRuler = run.debugTruth.orders[lossOfControlIds.firstRulerOrder];
    const firstChancellor =
      run.debugTruth.orders[lossOfControlIds.firstChancellorOrder];
    const secondRuler =
      run.debugTruth.orders[lossOfControlIds.secondRulerOrder];
    const secondChancellor =
      run.debugTruth.orders[lossOfControlIds.secondChancellorOrder];

    expect(firstRuler?.status).toBe("executed");
    expect(firstChancellor?.status).toBe("ignored");
    expect(secondRuler?.status).toBe("ignored");
    expect(secondChancellor?.status).toBe("executed");
    expect(
      run.debugTruth.obedienceRecords.map((record) => [
        record.issuerId,
        record.obeyed,
      ]),
    ).toEqual([
      [lossOfControlIds.chancellor, false],
      [lossOfControlIds.ruler, true],
      [lossOfControlIds.chancellor, true],
      [lossOfControlIds.ruler, false],
    ]);
    expect(run.debugTruth.units[lossOfControlIds.unit]?.locationId).toBe(
      lossOfControlIds.payOffice,
    );
  });

  it("lets the ruler infer failure only from reports, not control scores", async () => {
    const run = await runLossOfControlScenario(
      "loss-of-control-visibility-test",
    );
    const early = JSON.stringify(run.rulerViewAfterFirstDecision);
    const final = JSON.stringify(run.rulerViewFinal);

    expect(run.rulerViewAfterFirstDecision.knownOutcome).toBe(
      "first_command_obeyed",
    );
    expect(early).not.toContain(lossOfControlIds.firstChancellorOrder);
    expect(early).not.toContain(lossOfControlIds.fundingRelationship);
    expect(run.rulerViewFinal.knownOutcome).toBe("later_command_overruled");
    expect(run.rulerViewFinal.disclosedAlternativeOrderId).toBe(
      lossOfControlIds.secondChancellorOrder,
    );
    expect(final).not.toContain("relationshipSupport");
    expect(final).not.toContain("leadingActorId");
  });

  it("replays the same relationship, obedience, and control evidence", async () => {
    const run = await runLossOfControlScenario("loss-of-control-replay-test");
    const replayed = replay(
      lossOfControlInitialState,
      run.records,
      lossOfControlModel.reduce,
    );

    expect(replayed).toEqual(run.state);
    expect(lossOfControlActorView(replayed, lossOfControlIds.ruler)).toEqual(
      run.rulerViewFinal,
    );
    expect(
      assessPracticalControl(replayed, lossOfControlIds.organization),
    ).toEqual(run.controlFinal);
  });
});
