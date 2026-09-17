import {
  contradictoryOrdersIds,
  partialImplementationIds,
  runContradictoryOrdersScenario,
  runPartialImplementationScenario,
  type ContradictoryOrdersActorView,
  type ContradictoryOrdersRun,
  type PartialImplementationActorView,
  type PartialImplementationRun,
} from "@throne/scenario-mvp";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ScenarioKey = "conflict" | "partial";

const modes = [
  {
    name: "Play",
    status: "Third vertical slice",
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
  const [scenario, setScenario] = useState<ScenarioKey>("conflict");
  const [view, setView] = useState<"ruler" | "debug">("ruler");
  const [moment, setMoment] = useState<"before" | "after">("before");

  useEffect(() => {
    void Promise.all([
      runPartialImplementationScenario("web-partial-implementation"),
      runContradictoryOrdersScenario("web-contradictory-orders"),
    ]).then(([partial, conflict]) => {
      setPartialRun(partial);
      setConflictRun(conflict);
    });
  }, []);

  const chooseScenario = (next: ScenarioKey) => {
    setScenario(next);
    setMoment("before");
    setView("ruler");
  };
  const conflict = scenario === "conflict";

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
          className={conflict ? "active" : ""}
          onClick={() => chooseScenario("conflict")}
        >
          <span>Demo C</span>
          Conflicting orders
        </button>
        <button
          className={!conflict ? "active" : ""}
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
            <h2>
              {conflict ? "Conflicting orders" : "Partial implementation"}
            </h2>
          </div>
          <div className="scenario-controls">
            <div className="view-switch" aria-label="Moment in the scenario">
              <button
                className={moment === "before" ? "active" : ""}
                onClick={() => setMoment("before")}
              >
                {conflict ? "Before response" : "Before audit"}
              </button>
              <button
                className={moment === "after" ? "active" : ""}
                onClick={() => setMoment("after")}
              >
                {conflict ? "After response" : "After audit"}
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

        {!partialRun || !conflictRun ? (
          <p className="loading">Running scenario…</p>
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
            {conflict
              ? "Authority is relational."
              : "An order is not an effect."}
          </h2>
        </div>
        {conflict ? (
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
