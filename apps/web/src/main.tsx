import { StrictMode } from "react";
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

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
