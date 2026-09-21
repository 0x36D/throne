import { useEffect, useState } from "react";
import type { Locale, Translator } from "@throne/localization";
import type { CrisisChoice, CrisisTimelineItem } from "@throne/scenario-mvp";
import type { LiveSnapshot, SavedLiveRun } from "../server/live-service.ts";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/live" + path, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Throne-Client": "local",
          },
          body: JSON.stringify(body),
        }),
  });
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
  return value;
}

export function LivePlay({ locale, t }: { locale: Locale; t: Translator }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>();
  const [review, setReview] = useState<SavedLiveRun>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const id = sessionStorage.getItem("throne.liveRun");
    if (id)
      void request<LiveSnapshot>("/" + id)
        .then(setSnapshot)
        .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (snapshot?.status !== "running") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void request<LiveSnapshot>("/" + snapshot.id)
        .then((next) => {
          if (!cancelled) setSnapshot(next);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [snapshot?.id, snapshot?.status]);

  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const start = () =>
    perform(async () => {
      const next = await request<LiveSnapshot>("", { locale });
      setSnapshot(next);
      setReview(undefined);
      setVerified(false);
      sessionStorage.setItem("throne.liveRun", next.id);
    });
  const choose = (choice: CrisisChoice) =>
    perform(async () => {
      if (!snapshot || snapshot.version !== 2) return;
      setSnapshot({ ...snapshot, status: "running" });
      setSnapshot(
        await request<LiveSnapshot>(`/${snapshot.id}/choice`, {
          choice,
          decisionEpisodeId: snapshot.view.decisionEpisodeId,
        }),
      );
    });
  const retry = () =>
    perform(async () => {
      if (!snapshot) return;
      setSnapshot({ ...snapshot, status: "running" });
      setSnapshot(await request<LiveSnapshot>(`/${snapshot.id}/retry`, {}));
    });
  const pending = busy || snapshot?.status === "running";
  const report = snapshot?.view.observations
    .filter((o) => o.sourceType === "commander_report")
    .at(-1);
  return (
    <div className="live-play">
      <p className="command-copy">{t("live.intro")}</p>
      {error || snapshot?.error ? (
        <div role="alert" className="play-error">
          <p>{error ?? snapshot?.error}</p>
        </div>
      ) : null}
      {!snapshot || snapshot.status === "complete" || (error && !pending) ? (
        <button
          className="restart-button"
          disabled={pending}
          onClick={() => void start()}
        >
          {t(snapshot ? "live.new" : "live.start")}
        </button>
      ) : null}
      {snapshot ? (
        <>
          <p className="panel-label">
            {t("live.status")} · {t(`live.${snapshot.status}`)}
          </p>
          {snapshot.version === 2 ? (
            <section className="live-timeline" aria-label={t("live.timeline")}>
              <h3>{t("live.timeline")}</h3>
              <ol className="document-list">
                {snapshot.view.timeline.map((item) => (
                  <li className="document" key={item.id}>
                    <p className="panel-label">
                      {t("common.time", { time: item.time })} ·{" "}
                      {sourceName(item.sourceId, t)}
                    </p>
                    <p>{timelineText(item, t)}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {snapshot.status === "waiting" && snapshot.version === 2 ? (
            <div className="playable-layout">
              <div>
                <h3>{t("live.round", { round: snapshot.view.round })}</h3>
                <p>
                  {t(
                    snapshot.view.round === 1
                      ? "live.firstDecision"
                      : "live.secondDecision",
                  )}
                </p>
              </div>
              <div className="player-choice-grid">
                {snapshot.view.choices.map((choice) => (
                  <button
                    key={choice.id}
                    disabled={pending}
                    onClick={() => void choose(choice.id)}
                  >
                    <span>
                      {t(
                        choice.id === "maintain_deployment"
                          ? "live.maintain"
                          : choice.id === "hold_imperial_palace"
                            ? "play.holdTitle"
                            : "play.eastTitle",
                      )}
                    </span>
                    <small>
                      {t("live.orderTarget", {
                        location: locationName(choice.targetLocationId, t),
                      })}
                    </small>
                    <strong>{t("play.issue")}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {snapshot.status === "running" ? (
            <p role="status">{t("live.wait")}</p>
          ) : null}
          {snapshot.status === "failed" ? (
            <button
              className="restart-button"
              disabled={pending}
              onClick={() => void retry()}
            >
              {t("live.retry")}
            </button>
          ) : null}
          {snapshot.status === "complete" && report ? (
            <article className="document live-result">
              <p className="panel-label">
                {t("common.time", { time: report.observedAt })}
              </p>
              {snapshot.version === 1 ? (
                <>
                  <h3>
                    {t(report.payload.obeyed ? "live.obeyed" : "live.refused")}
                  </h3>
                  <p>
                    {t(
                      snapshot.view.knownOutcome === "palace_secured"
                        ? "play.securedTitle"
                        : "play.breachedTitle",
                    )}
                  </p>
                </>
              ) : (
                <h3>{t("live.finished")}</h3>
              )}
              <p>
                {t("live.deployment")}{" "}
                {String(report.payload.targetLocationId) ===
                "location:military-pay-office"
                  ? t("token.military-pay-office")
                  : String(report.payload.targetLocationId) ===
                      "location:imperial-palace"
                    ? t("token.imperial-palace")
                    : t("token.east-gate")}
              </p>
              <button
                className="restart-button"
                disabled={pending}
                onClick={() =>
                  void perform(async () =>
                    setReview(
                      await request<SavedLiveRun>(`/${snapshot.id}/review`),
                    ),
                  )
                }
              >
                {t("live.review")}
              </button>
              <button
                className="restart-button"
                disabled={pending}
                onClick={() =>
                  void perform(async () => {
                    const result = await request<{ verified: boolean }>(
                      `/${snapshot.id}/replay`,
                    );
                    setVerified(result.verified);
                  })
                }
              >
                {t("live.replay")}
              </button>
              {verified ? <p role="status">{t("live.verified")}</p> : null}
            </article>
          ) : null}
          {review ? (
            <div className="debug-panel">
              <p className="debug-banner">{t("live.reviewTitle")}</p>
              {(review.version === 2
                ? review.run.state.decisions
                : review.run.state.npcDecision
                  ? [review.run.state.npcDecision]
                  : []
              ).map((decision, index) => (
                <section key={decision.input.decisionEpisodeId}>
                  <h3>{t("live.decisionNumber", { round: index + 1 })}</h3>
                  <p>
                    {decision.output.reasoningSummary ?? t("live.noSummary")}
                  </p>
                  <details>
                    <summary>{t("live.context")}</summary>
                    <pre>{JSON.stringify(decision.input, null, 2)}</pre>
                  </details>
                  <details>
                    <summary>{t("live.record")}</summary>
                    <pre>{JSON.stringify(decision.output, null, 2)}</pre>
                  </details>
                </section>
              ))}
              <p className="panel-label">
                {t("live.saved")} runs/{snapshot.id}.json
              </p>
              <details>
                <summary>{t("live.record")}</summary>
                <pre>
                  {JSON.stringify(
                    {
                      calls: review.calls,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function locationName(id: string, t: Translator): string {
  switch (id) {
    case "location:imperial-palace":
      return t("token.imperial-palace");
    case "location:east-gate":
      return t("token.east-gate");
    case "location:military-pay-office":
      return t("token.military-pay-office");
    default:
      return id;
  }
}
function sourceName(id: string, t: Translator): string {
  switch (id) {
    case "actor:ruler":
      return t("live.sourceRuler");
    case "actor:guard-commander":
      return t("live.sourceCommander");
    case "actor:east-gate-scout":
      return t("live.sourceScout");
    case "actor:palace-inspector":
      return t("live.sourceInspector");
    default:
      return id;
  }
}
function timelineText(item: CrisisTimelineItem, t: Translator): string {
  if (item.kind !== "observation")
    return t(item.kind === "decree" ? "live.decreeIssued" : "live.decreeSent", {
      round: Number(item.payload.round),
      location: locationName(String(item.payload.targetLocationId), t),
    });
  switch (item.payload.finding) {
    case "armed_movement":
      return t("live.initialEast");
    case "seals_missing":
      return t("live.initialPalace");
    case "east_warehouse_alarm":
      return t("live.eastAlarm");
    case "deployment":
      return `${t(item.payload.obeyed ? "live.obeyed" : "live.refused")} ${t("live.deployment")} ${locationName(String(item.payload.targetLocationId), t)}`;
    case "palace_result":
      return t(
        item.payload.protected ? "play.securedTitle" : "play.breachedTitle",
      );
    case "warehouse_result":
      return t(
        item.payload.protected
          ? "live.warehouseProtected"
          : "live.warehouseLost",
      );
    default:
      return JSON.stringify(item.payload);
  }
}
