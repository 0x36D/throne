import type { Translator } from "@throne/localization";

export function reportRunError(value: unknown): Error {
  const error = value instanceof Error ? value : new Error(String(value));
  console.error("Simulation failed", error);
  return error;
}

export function RunFailure({
  error,
  t,
  onRestart,
}: {
  error: Error;
  t: Translator;
  onRestart(): void;
}) {
  return (
    <div role="alert" className="play-error">
      <p>{t("play.error")}</p>
      <details>
        <summary>{t("play.errorDetails")}</summary>
        <pre>{error.stack ?? error.message}</pre>
      </details>
      <button className="restart-button" onClick={onRestart}>
        {t("play.restart")}
      </button>
    </div>
  );
}
