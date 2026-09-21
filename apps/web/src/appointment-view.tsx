import {
  appointmentIds as ids,
  deriveFormalAuthority,
  type AppointmentRun,
} from "@throne/scenario-mvp";
import { translateToken, type Translator } from "@throne/localization";

export function AppointmentView({
  run,
  view,
  moment,
  t,
}: {
  run: AppointmentRun;
  view: "ruler" | "debug";
  moment: "before" | "after";
  t: Translator;
}) {
  const after = moment === "after";
  const state = after ? run.state : run.afterAppointment;
  const name = (id: string) => {
    if (id === ids.general) return t("appointment.general");
    if (id === ids.successor) return t("appointment.successor");
    if (id === ids.ruler) return t("common.ruler");
    throw new Error(`Unknown appointment actor label: ${id}`);
  };
  const officeName = (id: string) => {
    if (id === ids.military) return t("appointment.military");
    if (id === ids.chancellor) return t("appointment.chancellor");
    throw new Error(`Unknown office label: ${id}`);
  };
  const rulerView = after ? run.rulerFinal : run.rulerBeforeReport;
  const report = rulerView.reports[0];
  if (view === "ruler") {
    return (
      <div className="order-layout">
        <div className="command-panel">
          <p className="panel-label">{t("appointment.decree")}</p>
          <h3>{t("appointment.rulerTitle")}</h3>
          <p className="command-copy">{t("appointment.rulerCopy")}</p>
          <div className="document-list">
            {rulerView.appointments
              .filter((a) => !a.ended)
              .map((a) => (
                <article className="document" key={a.id}>
                  <span>{t("common.time", { time: 10 })}</span>
                  <h3>{name(a.incumbentId)}</h3>
                  <p>{officeName(a.officeId)}</p>
                </article>
              ))}
          </div>
          <p className="fog-note">{t("appointment.fog")}</p>
        </div>
        <div className="document-panel">
          <p className="panel-label">{t("appointment.reports")}</p>
          {report ? (
            <article className="document urgent-document">
              <span>{t("common.time", { time: report.observedAt })}</span>
              <h3>{t("appointment.replyTitle")}</h3>
              <p>
                {t("appointment.reply", {
                  actor: name(String(report.payload.issuerId)),
                })}
              </p>
              <p>
                {t("appointment.replyLocation", {
                  location: translateToken(
                    t,
                    String(report.payload.targetLocationId).replace(
                      "location:",
                      "",
                    ),
                  ),
                })}
              </p>
            </article>
          ) : (
            <div className="silence-card">
              <span>{t("common.time", { time: 10 })}</span>
              <h3>{t("appointment.waiting")}</h3>
              <p>{t("appointment.waitingCopy")}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="debug-panel">
      <p className="debug-banner">{t("appointment.debug")}</p>
      <div className="authority-comparison">
        <article>
          <span>{t("common.formalAuthority")}</span>
          <h3>
            {deriveFormalAuthority(state, ids.army).map(name).join(" / ")}
          </h3>
          <p>{t("appointment.formalCopy")}</p>
        </article>
        <div className="not-equal">≠</div>
        <article className="shifted">
          <span>{t("appointment.personalNetwork")}</span>
          <h3>{name(ids.general)}</h3>
          <p>{t("appointment.personalCopy")}</p>
        </article>
      </div>
      <div className="appointment-history">
        <p className="panel-label">{t("appointment.history")}</p>
        <table>
          <thead>
            <tr>
              <th>{t("appointment.person")}</th>
              <th>{t("appointment.office")}</th>
              <th>{t("appointment.tenure")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(state.appointments).map((a) => (
              <tr key={a.id}>
                <td>{name(a.incumbentId)}</td>
                <td>{officeName(a.officeId)}</td>
                <td>
                  {a.startedAt} → {a.endedAt ?? t("appointment.active")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="playable-record-grid">
        <div>
          <p className="panel-label">{t("appointment.relationships")}</p>
          <div className="ledger">
            {state.relationships.map((r) => (
              <div key={r.id}>
                <span>{translateToken(t, r.kind)}</span>
                <strong>{r.strength.toFixed(2)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="panel-label">{t("appointment.obedience")}</p>
          {after ? (
            <div className="document-list">
              {Object.values(state.orders).map((order) => {
                const evaluation = state.decision?.evaluations?.find(
                  (e) => e.orderId === order.id,
                );
                return (
                  <article className="document" key={order.id}>
                    <h3>
                      {name(order.issuerId)} · {translateToken(t, order.status)}
                    </h3>
                    {evaluation ? (
                      <p>
                        {t("appointment.score", {
                          formal: evaluation.formal.toFixed(2),
                          personal: evaluation.personal.toFixed(2),
                        })}
                      </p>
                    ) : null}
                    <div className="compact-lifecycle">
                      {order.lifecycle.map((entry) => (
                        <span key={entry.eventId}>
                          {entry.occurredAt} · {translateToken(t, entry.status)}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="command-copy">{t("appointment.noOrders")}</p>
          )}
        </div>
      </div>
      <p className="debug-caption">{t("appointment.caption")}</p>
    </div>
  );
}
