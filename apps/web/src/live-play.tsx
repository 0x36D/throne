import { useEffect, useState } from "react";
import type { Locale, Translator } from "@throne/localization";
import type { PlayerChoiceId } from "@throne/scenario-mvp";
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
    const timer = setInterval(() => {
      void request<LiveSnapshot>("/" + snapshot.id)
        .then(setSnapshot)
        .catch((e: Error) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
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
  const choose = (choice: PlayerChoiceId) =>
    perform(async () => {
      if (!snapshot) return;
      setSnapshot({ ...snapshot, status: "running" });
      setSnapshot(
        await request<LiveSnapshot>(`/${snapshot.id}/choice`, { choice }),
      );
    });
  const retry = () =>
    perform(async () => {
      if (!snapshot) return;
      setSnapshot({ ...snapshot, status: "running" });
      setSnapshot(await request<LiveSnapshot>(`/${snapshot.id}/retry`, {}));
    });
  const pending = busy || snapshot?.status === "running";
  const report = snapshot?.view.observations.find(
    (o) => o.sourceType === "commander_report",
  );
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
          {snapshot.status === "waiting" ? (
            <div className="playable-layout">
              <div className="document-list">
                <article className="document">
                  <h3>{t("play.eastReportTitle")}</h3>
                  <p>{t("play.eastReportCopy")}</p>
                </article>
                <article className="document">
                  <h3>{t("play.palaceReportTitle")}</h3>
                  <p>{t("play.palaceReportCopy")}</p>
                </article>
              </div>
              <div className="player-choice-grid">
                <button
                  disabled={pending}
                  onClick={() => void choose("hold_imperial_palace")}
                >
                  <span>{t("play.holdTitle")}</span>
                  <small>{t("play.holdCopy")}</small>
                  <strong>{t("play.issue")}</strong>
                </button>
                <button
                  disabled={pending}
                  onClick={() => void choose("move_to_east_gate")}
                >
                  <span>{t("play.eastTitle")}</span>
                  <small>{t("play.eastCopy")}</small>
                  <strong>{t("play.issue")}</strong>
                </button>
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
              <p>{review.run.state.npcDecision?.output.reasoningSummary}</p>
              <p className="panel-label">
                {t("live.saved")} runs/{snapshot.id}.json
              </p>
              <details>
                <summary>{t("live.context")}</summary>
                <pre>
                  {JSON.stringify(review.run.state.npcDecision?.input, null, 2)}
                </pre>
              </details>
              <details>
                <summary>{t("live.record")}</summary>
                <pre>
                  {JSON.stringify(
                    {
                      decision: review.run.state.npcDecision?.output,
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
