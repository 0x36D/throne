import {
  runFalseReportScenario,
  type FalseReportRun,
} from "@throne/scenario-mvp";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const modes = [
  {
    name: "Play",
    status: "First vertical slice",
    description:
      "The player acts as the ruler and sees only reports that reach that role.",
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
  const [run, setRun] = useState<FalseReportRun>();
  const [view, setView] = useState<"ruler" | "debug">("ruler");

  useEffect(() => {
    void runFalseReportScenario("web-false-report").then(setRun);
  }, []);

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

      <section className={`scenario ${view === "debug" ? "debug" : ""}`}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">LIVE VERTICAL SLICE</p>
            <h2>False report</h2>
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

        {!run ? (
          <p className="loading">Running scenario…</p>
        ) : view === "ruler" ? (
          <RulerView run={run} />
        ) : (
          <DebugView run={run} />
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
            The world and its minds remain separate.
          </h2>
        </div>
        <ol>
          <li>Objective world state</li>
          <li>Actor observation and belief</li>
          <li>Decision and structured intent</li>
          <li>Scheduled operation and committed event</li>
        </ol>
      </section>
    </main>
  );
}

function RulerView({ run }: { run: FalseReportRun }) {
  const belief = run.rulerView.beliefs[0];
  return (
    <div className="scenario-grid">
      <div>
        <p className="panel-label">Reports received</p>
        <div className="report-list">
          {run.rulerView.observations.map((observation) => {
            const report = readReport(observation.payload.report);
            return (
              <article className="report" key={observation.id}>
                <div className="card-topline">
                  <span>t = {observation.observedAt}</span>
                  <span>{report.basis.replaceAll("_", " ")}</span>
                </div>
                <strong>{String(report.value)} units</strong>
                <p>Reported grain stock in the Northern Province.</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="belief-panel">
        <p className="panel-label">Current belief</p>
        <h3>Northern grain stock</h3>
        {belief?.candidates.map((candidate) => (
          <div className="candidate" key={String(candidate.value)}>
            <strong>{String(candidate.value)}</strong>
            <span>{Math.round(candidate.confidence * 100)}% confidence</span>
          </div>
        ))}
        <p className="warning">
          {run.rulerView.contradictions.length} unresolved contradiction
          detected. Objective stock remains unavailable in this perspective.
        </p>
      </div>
    </div>
  );
}

function DebugView({ run }: { run: FalseReportRun }) {
  const region = run.debugTruth.regions["region:north"];
  const falseReport = run.debugTruth.reports["report:governor-return"];
  return (
    <div className="debug-panel">
      <p className="debug-banner">
        ADMINISTRATOR VIEW — OBJECTIVE STATE EXPOSED
      </p>
      <div className="truth-number">{region?.grainStock}</div>
      <p>Actual grain units in {region?.name}.</p>
      <div className="debug-comparison">
        <span>Governor claimed</span>
        <strong>{String(falseReport?.claim.value)}</strong>
        <span>Objective discrepancy</span>
        <strong>
          {Number(falseReport?.claim.value) - Number(region?.grainStock)}
        </strong>
      </div>
    </div>
  );
}

function readReport(value: unknown): { basis: string; value: unknown } {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { basis: "unknown source", value: "unknown" };
  }
  const report = value as { basis?: unknown; claim?: { value?: unknown } };
  return {
    basis: typeof report.basis === "string" ? report.basis : "unknown source",
    value: report.claim?.value ?? "unknown",
  };
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
