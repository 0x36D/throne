import {
  contradictoryOrdersIds,
  decisionRevisionIds,
  lossOfControlIds,
  partialImplementationIds,
  runContradictoryOrdersScenario,
  runDecisionRevisionScenario,
  runLossOfControlScenario,
  runPartialImplementationScenario,
  type ContradictoryOrdersActorView,
  type ContradictoryOrdersRun,
  type DecisionRevisionActorView,
  type DecisionRevisionRun,
  type LossOfControlActorView,
  type LossOfControlRun,
  type PartialImplementationActorView,
  type PartialImplementationRun,
} from "@throne/scenario-mvp";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ScenarioKey = "control" | "revision" | "conflict" | "partial";

const modes = [
  {
    name: "Play",
    status: "Fifth vertical slice",
    description:
      "The player rules through orders and reports, never through direct access to objective state.",
  },
  {
    name: "Observe",
    status: "Designed",
    description:
      "Every persistent actor is autonomous; the completed run can be inspected.",
  },
  {
    name: "Batch",
    status: "Designed",
    description:
      "Run the same scenario repeatedly and compare distributions and causal traces.",
  },
];

function App() {
  const [partialRun, setPartialRun] = useState<PartialImplementationRun>();
  const [conflictRun, setConflictRun] = useState<ContradictoryOrdersRun>();
  const [revisionRun, setRevisionRun] = useState<DecisionRevisionRun>();
  const [controlRun, setControlRun] = useState<LossOfControlRun>();
  const [scenario, setScenario] = useState<ScenarioKey>("control");
  const [view, setView] = useState<"ruler" | "debug">("ruler");
  const [moment, setMoment] = useState<"before" | "after">("before");

  useEffect(() => {
    void Promise.all([
      runPartialImplementationScenario("web-partial-implementation"),
      runContradictoryOrdersScenario("web-contradictory-orders"),
      runDecisionRevisionScenario("web-decision-revision"),
      runLossOfControlScenario("web-loss-of-control"),
    ]).then(([partial, conflict, revision, control]) => {
      setPartialRun(partial);
      setConflictRun(conflict);
      setRevisionRun(revision);
      setControlRun(control);
    });
  }, []);

  const chooseScenario = (next: ScenarioKey) => {
    setScenario(next);
    setMoment("before");
    setView("ruler");
  };
  const control = scenario === "control";
  const revision = scenario === "revision";
  const conflict = scenario === "conflict";
  const scenarioTitle = control
    ? "Emergent loss of control"
    : revision
      ? "Decision revision"
      : conflict
        ? "Conflicting orders"
        : "Partial implementation";
  const momentLabels = control
    ? ["Command obeyed", "Control lost"]
    : revision
      ? ["First order", "After reversal"]
      : conflict
        ? ["Before response", "After response"]
        : ["Before audit", "After audit"];

  return (
    <main>
      <header>
        <p className="eyebrow">POLITICAL SIMULATION ENGINE</p>
        <h1>Throne</h1>
        <p className="lede">
          Political order is not a state variable. It is the unstable result of
          information, relationships, resources, and decisions made in time.
        </p>
      </header>

      <nav className="scenario-picker" aria-label="Vertical slice">
        <button
          className={control ? "active" : ""}
          onClick={() => chooseScenario("control")}
        >
          <span>Demo E</span>
          Loss of control
        </button>
        <button
          className={revision ? "active" : ""}
          onClick={() => chooseScenario("revision")}
        >
          <span>Demo D</span>
          Decision revision
        </button>
        <button
          className={conflict ? "active" : ""}
          onClick={() => chooseScenario("conflict")}
        >
          <span>Demo C</span>
          Conflicting orders
        </button>
        <button
          className={!control && !revision && !conflict ? "active" : ""}
          onClick={() => chooseScenario("partial")}
        >
          <span>Demo B</span>
          Partial implementation
        </button>
      </nav>

      <section className={`scenario ${view === "debug" ? "debug" : ""}`}>
        <div className="section-heading scenario-heading">
          <div>
            <p className="eyebrow">LIVE VERTICAL SLICE</p>
            <h2>{scenarioTitle}</h2>
          </div>
          <div className="scenario-controls">
            <div className="view-switch" aria-label="Moment in the scenario">
              <button
                className={moment === "before" ? "active" : ""}
                onClick={() => setMoment("before")}
              >
                {momentLabels[0]}
              </button>
              <button
                className={moment === "after" ? "active" : ""}
                onClick={() => setMoment("after")}
              >
                {momentLabels[1]}
              </button>
            </div>
            <div className="view-switch" aria-label="Simulation perspective">
              <button
                className={view === "ruler" ? "active" : ""}
                onClick={() => setView("ruler")}
              >
                Ruler view
              </button>
              <button
                className={view === "debug" ? "active" : ""}
                onClick={() => setView("debug")}
              >
                Debug truth
              </button>
            </div>
          </div>
        </div>

        {!partialRun || !conflictRun || !revisionRun || !controlRun ? (
          <p className="loading">Running scenario…</p>
        ) : control ? (
          view === "ruler" ? (
            <ControlRulerView
              view={
                moment === "before"
                  ? controlRun.rulerViewAfterFirstDecision
                  : controlRun.rulerViewFinal
              }
            />
          ) : (
            <ControlDebugView run={controlRun} moment={moment} />
          )
        ) : revision ? (
          view === "ruler" ? (
            <RevisionRulerView
              view={
                moment === "before"
                  ? revisionRun.rulerViewAfterFirstOrder
                  : revisionRun.rulerViewFinal
              }
            />
          ) : (
            <RevisionDebugView run={revisionRun} moment={moment} />
          )
        ) : conflict ? (
          view === "ruler" ? (
            <ConflictRulerView
              view={
                moment === "before"
                  ? conflictRun.rulerViewBeforeResponse
                  : conflictRun.rulerViewAfterResponse
              }
            />
          ) : (
            <ConflictDebugView run={conflictRun} moment={moment} />
          )
        ) : view === "ruler" ? (
          <PartialRulerView
            view={
              moment === "before"
                ? partialRun.rulerViewBeforeAudit
                : partialRun.rulerViewAfterAudit
            }
          />
        ) : (
          <PartialDebugView run={partialRun} moment={moment} />
        )}
      </section>

      <section aria-labelledby="modes-heading">
        <div className="section-heading">
          <h2 id="modes-heading">Runtime modes</h2>
          <span>Architecture scaffold</span>
        </div>
        <div className="mode-grid">
          {modes.map((mode) => (
            <article key={mode.name}>
              <div className="card-topline">
                <h3>{mode.name}</h3>
                <span>{mode.status}</span>
              </div>
              <p>{mode.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="boundary" aria-labelledby="boundary-heading">
        <div>
          <p className="eyebrow">CURRENT BOUNDARY</p>
          <h2 id="boundary-heading">
            {control
              ? "Office and control are different facts."
              : revision
                ? "A new decision does not erase the old one."
                : conflict
                  ? "Authority is relational."
                  : "An order is not an effect."}
          </h2>
        </div>
        {control ? (
          <ol>
            <li>Formal sovereignty never changes</li>
            <li>Material support changes a relationship</li>
            <li>Repeated decisions create obedience history</li>
            <li>Practical control is derived, never triggered</li>
          </ol>
        ) : revision ? (
          <ol>
            <li>New evidence reopens a committed decision</li>
            <li>The revised order travels independently</li>
            <li>A faster courier overtakes the first</li>
            <li>Both intentions remain in history</li>
          </ol>
        ) : conflict ? (
          <ol>
            <li>Messages arrive in simulation time</li>
            <li>Simultaneous orders enter one decision</li>
            <li>Relationships and beliefs shape intent</li>
            <li>The operation changes the world</li>
          </ol>
        ) : (
          <ol>
            <li>Order travels through the world</li>
            <li>Subordinate acknowledges it</li>
            <li>Capacity limits actual implementation</li>
            <li>A report may conceal the result</li>
          </ol>
        )}
      </section>
    </main>
  );
}

function ControlRulerView({ view }: { view: LossOfControlActorView }) {
  const overruled = view.knownOutcome === "later_command_overruled";
  return (
    <div className="control-layout">
      <div className="control-command-panel">
        <div className="formal-seal">
          <span>Formal authority</span>
          <strong>The Ruler</strong>
          <small>{view.organization.name} remains legally subordinate.</small>
        </div>
        <p className="panel-label">Royal orders</p>
        <div className="control-orders">
          {view.issuedOrders.map((order) => (
            <article
              className={`control-order ${order.round === 2 ? "latest" : ""}`}
              key={order.id}
            >
              <div className="card-topline">
                <span>Command {order.round}</span>
                <span>
                  {humanize(order.targetLocationId.split(":")[1] ?? "")}
                </span>
              </div>
              <h3>Hold the Imperial Palace</h3>
              <p>
                {order.round === 1
                  ? "The guard confirms the command and remains at the palace."
                  : "The same formal authority now produces a different response."}
              </p>
            </article>
          ))}
        </div>
        <div className="status-banner conflict-status">
          <span>Known outcome</span>
          <strong className={overruled ? "danger-text" : "success-text"}>
            {humanize(view.knownOutcome)}
          </strong>
        </div>
        <p className="fog-note">
          {overruled
            ? "Commander Zhao reports following Chancellor Wei's competing instruction. The ruler can see disobedience, but not the private weights that produced it."
            : "The first command was obeyed. Nothing in the formal record warns that another patron is becoming more important to the guard."}
        </p>
      </div>

      <div className="document-panel">
        <p className="panel-label">Commander reports</p>
        <div className="document-list">
          {view.observations.map((observation, index) => {
            const refused = index > 0;
            return (
              <article
                className={`document ${refused ? "refusal" : ""}`}
                key={observation.id}
              >
                <div className="card-topline">
                  <span>t = {observation.observedAt}</span>
                  <span>Commander Zhao</span>
                </div>
                <h3>
                  {refused ? "Royal order not followed" : "Command obeyed"}
                </h3>
                <p>
                  {refused
                    ? "The Imperial Guard moved to protect the Military Pay Office under the chancellor's instruction."
                    : "The Imperial Guard remains at the palace in accordance with the royal command."}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ControlDebugView({
  run,
  moment,
}: {
  run: LossOfControlRun;
  moment: "before" | "after";
}) {
  const assessment =
    moment === "before" ? run.controlAfterFirstDecision : run.controlFinal;
  const episodeId =
    moment === "before"
      ? lossOfControlIds.firstDecision
      : lossOfControlIds.secondDecision;
  const episode = run.debugTruth.decisionEpisodes[episodeId];
  const funding =
    run.debugTruth.relationships[lossOfControlIds.fundingRelationship];
  const visibleObedience = run.debugTruth.obedienceRecords.filter((record) => {
    const order = run.debugTruth.orders[record.orderId];
    return moment === "after" || order?.round === 1;
  });
  const leaderName =
    assessment.leadingActorId === lossOfControlIds.ruler
      ? "The Ruler"
      : "Chancellor Wei";

  return (
    <div className="debug-panel control-debug">
      <p className="debug-banner">
        ADMINISTRATOR VIEW — FORMAL AND PRACTICAL POWER SEPARATED
      </p>
      <div className="authority-comparison">
        <article>
          <span>Formal authority</span>
          <h3>The Ruler</h3>
          <p>Unchanged in both rounds · sole recognized sovereign</p>
        </article>
        <div className="not-equal">≠</div>
        <article className={moment === "after" ? "shifted" : ""}>
          <span>Derived practical lead</span>
          <h3>{leaderName}</h3>
          <p>Computed from current relationships and latest obedience</p>
        </article>
      </div>

      <div className="control-evidence-grid">
        <div>
          <p className="panel-label">Control evidence</p>
          <div className="candidate-control-list">
            {assessment.candidates.map((candidate) => (
              <div key={candidate.actorId}>
                <span>
                  {candidate.actorId === lossOfControlIds.ruler
                    ? "The Ruler"
                    : "Chancellor Wei"}
                </span>
                <strong>{candidate.score.toFixed(3)}</strong>
                <small>
                  relations {candidate.relationshipSupport.toFixed(3)} · latest{" "}
                  {humanize(candidate.latestObedience)}
                </small>
              </div>
            ))}
          </div>
        </div>
        <div className="payroll-card">
          <p className="panel-label">Material dependency</p>
          <span>Chancellor funding relationship</span>
          <strong>
            {moment === "before"
              ? funding?.history[0]?.strength.toFixed(2)
              : funding?.strength.toFixed(2)}
          </strong>
          <p>
            {moment === "before"
              ? "The guard payroll still carries 100 in arrears."
              : "At t=100 the chancellor paid all 100 in arrears from his reserve."}
          </p>
        </div>
      </div>

      <div className="control-decision-grid">
        {episode?.evaluations.map((evaluation) => {
          const selected = episode.selectedOrderId === evaluation.orderId;
          const chancellor = evaluation.orderId.includes("chancellor");
          return (
            <article
              className={`score-card ${selected ? "selected" : ""}`}
              key={evaluation.orderId}
            >
              <div className="card-topline">
                <span>{chancellor ? "Chancellor Wei" : "The Ruler"}</span>
                <strong>{evaluation.total.toFixed(3)}</strong>
              </div>
              <h3>{selected ? "Selected" : "Rejected"}</h3>
              <div className="factor-list">
                {evaluation.factors.map((factor) => (
                  <div key={`${evaluation.orderId}:${factor.kind}`}>
                    <span>{factor.label}</span>
                    <strong>{factor.score.toFixed(3)}</strong>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="obedience-history">
        <p className="panel-label">Objective obedience history</p>
        {visibleObedience.map((record) => (
          <span
            className={record.obeyed ? "obeyed" : "refused"}
            key={record.id}
          >
            round {run.debugTruth.orders[record.orderId]?.round} ·{" "}
            {record.issuerId === lossOfControlIds.ruler
              ? "ruler"
              : "chancellor"}{" "}
            · {record.obeyed ? "obeyed" : "not obeyed"}
          </span>
        ))}
      </div>
      <p className="debug-caption">
        {moment === "before"
          ? "Formal command, legal recognition, personal loyalty, and the first act of obedience still make the ruler the practical leader."
          : "No control flag changed. A concrete payment changed one relationship; the next decision and act of obedience changed the derived result."}
      </p>
    </div>
  );
}

function RevisionRulerView({ view }: { view: DecisionRevisionActorView }) {
  const confirmed = view.knownOutcome === "revision_confirmed";
  return (
    <div className="revision-layout">
      <div className="revision-command-panel">
        <p className="panel-label">Decision record</p>
        <div className="revision-orders">
          {view.issuedOrders.map((order) => (
            <article
              className={`revision-order ${order.revision > 0 ? "current" : "superseded"}`}
              key={order.id}
            >
              <div className="card-topline">
                <span>Revision {order.revision}</span>
                <span>t = {order.issuedAt}</span>
              </div>
              <h3>
                {order.objective === "hold_imperial_palace"
                  ? "Hold the Imperial Palace"
                  : "Move to the East Gate"}
              </h3>
              <p>
                {order.revision > 0
                  ? "New intelligence reverses the earlier deployment. A faster courier carries the countermand."
                  : "The first report prompts an immediate deployment of the Palace Guard."}
              </p>
              <span className="order-reference">{order.id}</span>
            </article>
          ))}
        </div>
        <div className="status-banner conflict-status">
          <span>Known outcome</span>
          <strong className={confirmed ? "success-text" : "pending-text"}>
            {humanize(view.knownOutcome)}
          </strong>
        </div>
        <p className="fog-note">
          {confirmed
            ? "The commander confirms that the later instruction took effect. The ruler learns the result only after both couriers have reached the guard."
            : "Issuing a countermand does not retrieve the first messenger. The ruler cannot see which order will arrive first."}
        </p>
      </div>

      <div className="document-panel">
        <p className="panel-label">Intelligence and replies</p>
        <div className="document-list">
          {view.observations.map((observation) => {
            const correcting =
              observation.id === decisionRevisionIds.correctingObservation;
            const report = observation.sourceType === "revision_report";
            return (
              <article
                className={`document ${correcting ? "urgent-document" : ""}`}
                key={observation.id}
              >
                <div className="card-topline">
                  <span>t = {observation.observedAt}</span>
                  <span>{humanize(observation.sourceType)}</span>
                </div>
                <h3>
                  {report
                    ? "Countermand confirmed"
                    : correcting
                      ? "The East Gate is a decoy"
                      : "Armed movement at the East Gate"}
                </h3>
                <p>
                  {report
                    ? "Commander Zhao reports that the Palace Guard held the palace and ignored the late-arriving original order."
                    : correcting
                      ? "Independent intelligence warns that conspirators are approaching the palace."
                      : "A field report warns of armed movement outside the eastern gate."}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevisionDebugView({
  run,
  moment,
}: {
  run: DecisionRevisionRun;
  moment: "before" | "after";
}) {
  const first = run.debugTruth.orders[decisionRevisionIds.firstOrder];
  const revised = run.debugTruth.orders[decisionRevisionIds.revisedOrder];
  const unit = run.debugTruth.units[decisionRevisionIds.unit];
  const episode = run.debugTruth.decisionEpisodes[decisionRevisionIds.decision];
  const firstArrival = first?.lifecycle.find(
    (entry) => entry.status === "received",
  )?.occurredAt;
  const revisedArrival = revised?.lifecycle.find(
    (entry) => entry.status === "received",
  )?.occurredAt;

  return (
    <div className="debug-panel revision-debug">
      <p className="debug-banner">ADMINISTRATOR VIEW — BOTH COURIERS EXPOSED</p>
      <div className="courier-race">
        <article className="courier-card late">
          <div className="card-topline">
            <span>Original order</span>
            <strong>arrives t={firstArrival}</strong>
          </div>
          <h3>Move east</h3>
          <p>Departed t=20 · travel time 100 · ignored as revision 0</p>
        </article>
        <div className="overtake-mark" aria-label="overtaken by">
          ← overtaken by
        </div>
        <article className="courier-card winner">
          <div className="card-topline">
            <span>Countermand</span>
            <strong>arrives t={revisedArrival}</strong>
          </div>
          <h3>Hold palace</h3>
          <p>Departed t=50 · travel time 40 · executed as revision 1</p>
        </article>
      </div>
      <div className="revision-truth-grid">
        <div>
          <p className="panel-label">Decision history</p>
          <div className="truth-number">
            {episode?.finalIntentIds.length ?? 0}
          </div>
          <p>committed intentions retained in one decision episode</p>
        </div>
        <div className="selected-action">
          <span>Effective order</span>
          <strong>{humanize(unit?.acceptedOrderId ?? "unknown")}</strong>
          <span>Objective unit location</span>
          <strong>
            {humanize(unit?.locationId.split(":")[1] ?? "unknown")}
          </strong>
        </div>
      </div>
      <div className="revision-lifecycles">
        {[first, revised].map((order) => (
          <div key={order?.id}>
            <p className="panel-label">Revision {order?.revision}</p>
            <div className="compact-lifecycle">
              {order?.lifecycle.map((entry) => (
                <span key={entry.eventId}>
                  t={entry.occurredAt} {humanize(entry.status)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="debug-caption">
        {moment === "before"
          ? "At the ruler's first snapshot, only the original instruction exists. Debug truth shows how later events will coexist with it rather than overwrite it."
          : "The countermand arrived thirty time units earlier. When the original order finally reached the guard, its lower revision made it stale—not nonexistent."}
      </p>
    </div>
  );
}

function ConflictRulerView({ view }: { view: ContradictoryOrdersActorView }) {
  const order = view.issuedOrders[0];
  const overruled = view.knownOutcome === "order_overruled";
  return (
    <div className="order-layout conflict-layout">
      <div className="command-panel">
        <p className="panel-label">Royal command</p>
        <h3>Hold the Imperial Palace</h3>
        <p className="command-copy">
          Commander Zhao is ordered to move the Palace Guard from its barracks
          and secure the sovereign's residence.
        </p>
        <div className="status-banner conflict-status">
          <span>Known outcome</span>
          <strong className={overruled ? "danger-text" : "pending-text"}>
            {humanize(view.knownOutcome)}
          </strong>
        </div>
        <p className="fog-note">
          {overruled
            ? "The commander's reply discloses a competing command from Chancellor Wei. The ruler still cannot see the commander's private deliberation."
            : "The order is in the world. Silence does not reveal whether it is delayed, intercepted, obeyed, or contested."}
        </p>
        <p className="order-reference">{order?.id}</p>
      </div>

      <div className="document-panel">
        <p className="panel-label">Messages received</p>
        {view.observations.length === 0 ? (
          <div className="silence-card">
            <span>NO REPLY</span>
            <h3>The court waits.</h3>
            <p>
              Nothing in the ruler's current information confirms that the
              Palace Guard even received the order.
            </p>
          </div>
        ) : (
          <div className="document-list">
            {view.observations.map((observation) => (
              <article className="document refusal" key={observation.id}>
                <div className="card-topline">
                  <span>t = {observation.observedAt}</span>
                  <span>Commander Zhao</span>
                </div>
                <h3>Palace order not followed</h3>
                <p>
                  The Palace Guard has moved to secure the capital granary under
                  Chancellor Wei's competing instruction.
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictDebugView({
  run,
  moment,
}: {
  run: ContradictoryOrdersRun;
  moment: "before" | "after";
}) {
  const episode =
    run.debugTruth.decisionEpisodes[contradictoryOrdersIds.decision];
  const unit = run.debugTruth.units[contradictoryOrdersIds.unit];
  const evaluations = episode?.evaluations ?? [];
  return (
    <div className="debug-panel conflict-debug">
      <p className="debug-banner">
        ADMINISTRATOR VIEW — COMMANDER DELIBERATION EXPOSED
      </p>
      <div className="decision-summary">
        <div>
          <p className="panel-label">Orders received together</p>
          <div className="truth-number">2</div>
          <p>
            Both messages arrived at t=120 and triggered one decision episode.
          </p>
        </div>
        <div className="selected-action">
          <span>Selected operation</span>
          <strong>Secure the capital granary</strong>
          <span>Objective unit location</span>
          <strong>
            {humanize(unit?.locationId.split(":")[1] ?? "unknown")}
          </strong>
        </div>
      </div>
      <div className="score-grid">
        {evaluations.map((evaluation, index) => {
          const chancellor =
            evaluation.orderId === contradictoryOrdersIds.chancellorOrder;
          return (
            <article
              className={`score-card ${index === 0 ? "selected" : ""}`}
              key={evaluation.orderId}
            >
              <div className="card-topline">
                <span>{chancellor ? "Chancellor Wei" : "The Ruler"}</span>
                <strong>{evaluation.total.toFixed(3)}</strong>
              </div>
              <h3>{chancellor ? "Secure granary" : "Hold palace"}</h3>
              <div className="factor-list">
                {evaluation.factors.map((factor) => (
                  <div key={`${evaluation.orderId}:${factor.kind}`}>
                    <span>{factor.label}</span>
                    <strong>{factor.score.toFixed(3)}</strong>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <p className="debug-caption">
        {moment === "before"
          ? "The ruler is still waiting, but the commander has already received both commands. Debug truth may reveal facts unavailable to the player."
          : "Formal sovereignty remained with the ruler. Funding, appointment influence, threat beliefs, and practical access produced a different act of obedience."}
      </p>
    </div>
  );
}

function PartialRulerView({ view }: { view: PartialImplementationActorView }) {
  const completed = view.order.reportedFulfilledAmount ?? 0;
  const verified = view.order.verifiedFulfilledAmount;
  return (
    <div className="order-layout">
      <div className="command-panel">
        <p className="panel-label">Royal command</p>
        <h3>Send grain to the capital</h3>
        <p className="command-copy">
          Governor Ren is ordered to transfer provisions from the Northern
          Provincial Granary to the Capital Relief Granary.
        </p>
        <div className="order-metrics">
          <div>
            <span>Ordered</span>
            <strong>{view.order.requestedAmount}</strong>
          </div>
          <div>
            <span>{verified === undefined ? "Reported" : "Audit found"}</span>
            <strong>{verified ?? completed}</strong>
          </div>
        </div>
        <div
          className={`status-banner ${verified === undefined ? "success" : "warning"}`}
        >
          <span>Known status</span>
          <strong>{humanize(view.order.knownStatus)}</strong>
        </div>
        <p className="fog-note">
          {verified === undefined
            ? "No objective ledger is available to the ruler. The completion figure comes from the governor's own return."
            : `The independent audit contradicts the earlier return by ${completed - verified} units.`}
        </p>
      </div>

      <div className="document-panel">
        <p className="panel-label">Documents received</p>
        <div className="document-list">
          {view.observations.map((observation) => {
            const report = readOrderReport(observation.payload.report);
            return (
              <article className="document" key={observation.id}>
                <div className="card-topline">
                  <span>t = {observation.observedAt}</span>
                  <span>
                    {humanize(report?.basis ?? observation.sourceType)}
                  </span>
                </div>
                <h3>
                  {observation.sourceType === "acknowledgement"
                    ? "Order acknowledged"
                    : report?.basis === "independent_audit"
                      ? `${report.amount} units verified`
                      : `${report?.amount ?? "—"} units complete`}
                </h3>
                <p>
                  {observation.sourceType === "acknowledgement"
                    ? "The Northern Governor confirms receipt of the command."
                    : report?.basis === "independent_audit"
                      ? "Inspector Lin reports the amount that actually reached the capital ledger."
                      : "Governor Ren reports that the royal command has been fulfilled in full."}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PartialDebugView({
  run,
  moment,
}: {
  run: PartialImplementationRun;
  moment: "before" | "after";
}) {
  const order = run.debugTruth.orders[partialImplementationIds.order];
  const northern =
    run.debugTruth.accounts[partialImplementationIds.northernGranary];
  const capital =
    run.debugTruth.accounts[partialImplementationIds.capitalGranary];
  return (
    <div className="debug-panel order-debug">
      <p className="debug-banner">
        ADMINISTRATOR VIEW — OBJECTIVE STATE EXPOSED
      </p>
      <div className="debug-order-grid">
        <div>
          <p className="panel-label">Actually transferred</p>
          <div className="truth-number">{order?.fulfilledAmount}</div>
          <p>
            of {order?.requestedAmount} ordered units. The governor's capacity
            limited execution before either report reached the ruler.
          </p>
        </div>
        <div className="ledger">
          <p className="panel-label">Objective ledger</p>
          <div>
            <span>{northern?.name}</span>
            <strong>{northern?.balance}</strong>
          </div>
          <div>
            <span>{capital?.name}</span>
            <strong>{capital?.balance}</strong>
          </div>
          <div>
            <span>Falsely reported</span>
            <strong>{order?.reportedFulfilledAmount}</strong>
          </div>
        </div>
      </div>
      <div className="lifecycle">
        <p className="panel-label">Order lifecycle</p>
        <div className="lifecycle-track">
          {order?.lifecycle.map((entry) => (
            <div key={entry.eventId}>
              <span>t={entry.occurredAt}</span>
              <strong>{humanize(entry.status)}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="debug-caption">
        {moment === "before"
          ? "At this moment the ruler has accepted the completion return; the partial transfer already exists in objective state."
          : "The audit changes the ruler's knowledge. It does not retroactively change what happened."}
      </p>
    </div>
  );
}

function readOrderReport(
  value: unknown,
): { basis: string; amount: number } | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  const report = value as {
    basis?: unknown;
    claimedFulfilledAmount?: unknown;
  };
  if (
    typeof report.basis !== "string" ||
    typeof report.claimedFulfilledAmount !== "number"
  ) {
    return undefined;
  }
  return { basis: report.basis, amount: report.claimedFulfilledAmount };
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
