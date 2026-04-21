import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  RefreshCcw,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatPercent } from '../lib/formatters';
import { getAiInsights } from '../services/analysisService';

const confidenceStyles = {
  High: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200',
  Moderate:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200',
  Low: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

export default function ResultsPanel({
  analysis,
  patient,
  token,
  onStartOver,
  onUnauthorized,
}) {
  const [insightState, setInsightState] = useState({
    loading: false,
    error: null,
    payload: null,
  });

  const topResult = analysis?.results?.[0] || null;

  useEffect(() => {
    if (!topResult || !token) {
      return undefined;
    }

    const controller = new AbortController();

    async function loadInsight() {
      setInsightState({
        loading: true,
        error: null,
        payload: null,
      });

      try {
        const payload = await getAiInsights(
          {
            patient,
            result: {
              disease: topResult.disease,
              confidence: topResult.confidence,
              confidenceLabel: topResult.confidenceLabel,
              matchedSymptoms: topResult.matchedSymptoms,
              whySuggested: topResult.explainability.whySuggested,
            },
            redFlags: analysis.redFlags.map((entry) => ({
              symptom: entry.symptom,
              reason: entry.reason,
            })),
          },
          token,
          controller.signal
        );

        setInsightState({
          loading: false,
          error: null,
          payload,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error.status === 401) {
          onUnauthorized();
          return;
        }

        setInsightState({
          loading: false,
          error: error.message,
          payload: null,
        });
      }
    }

    loadInsight();

    return () => controller.abort();
  }, [analysis.redFlags, onUnauthorized, patient, token, topResult]);

  if (!analysis?.results?.length) {
    return (
      <div className="space-y-6 rounded-3xl border border-slate-200/80 bg-white/80 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <Activity className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            No conditions were ranked for the submitted symptoms.
          </h2>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            Review the selected symptoms, add more clinically specific detail where appropriate, and
            rerun the analysis. Software output must not replace formal medical evaluation.
          </p>
        </div>
        <button type="button" onClick={onStartOver} className="secondary-button">
          <RefreshCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
            Analysis Results
          </p>
          <h2 className="mt-2 flex items-center gap-3 text-2xl font-bold text-brandInk dark:text-white">
            <Stethoscope className="h-6 w-6 text-brandBlue dark:text-cyan-300" />
            Ranked Conditions and Evidence
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Strategy: <span className="font-semibold">{analysis.summary.modelStrategy}</span>
            {analysis.cached ? ' and served from cache.' : ' with a fresh backend evaluation.'}
          </p>
        </div>

        <button type="button" onClick={onStartOver} className="secondary-button">
          <RefreshCcw className="h-4 w-4" />
          Start Over
        </button>
      </div>

      {analysis.redFlags.length > 0 ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-500/40 dark:bg-red-950/40">
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-1 h-6 w-6 text-red-600 dark:text-red-300" />
            <div>
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-200">
                Emergency Advisory
              </h3>
              <p className="mt-2 text-sm leading-7 text-red-700 dark:text-red-200">
                One or more selected symptoms triggered urgent review rules. Treat the symptoms
                below as escalation signals rather than waiting on software ranking alone.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-red-700 dark:text-red-200">
                {analysis.redFlags.map((flag) => (
                  <li key={flag.code} className="rounded-2xl border border-red-200/70 bg-white/60 px-4 py-3 dark:border-red-500/30 dark:bg-red-950/20">
                    <span className="font-semibold">{flag.symptom}:</span> {flag.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6">
        {analysis.results.map((result, index) => (
          <article
            key={`${result.disease}-${index}`}
            className={`overflow-hidden rounded-3xl border bg-white/85 shadow-sm dark:bg-slate-950/60 ${
              index === 0
                ? 'border-brandBlue/40 ring-1 ring-brandBlue/20 dark:border-cyan-400/30'
                : 'border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  {index === 0 ? (
                    <span className="inline-flex rounded-full bg-brandBlue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brandBlue dark:bg-cyan-500/10 dark:text-cyan-200">
                      Top Match
                    </span>
                  ) : null}
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {result.disease}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {result.explainability.whySuggested}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-4xl font-black tracking-tight text-brandBlue dark:text-cyan-300">
                    {formatPercent(result.confidence)}
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${confidenceStyles[result.confidenceLabel]}`}
                  >
                    {result.confidenceLabel} Confidence
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <div>
                  <p className="label-text">Matched Symptoms</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.matchedSymptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-full border border-brandBlue/20 bg-brandBlue/10 px-3 py-1 text-xs font-semibold text-brandBlue dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label-text">Top Contributors</p>
                  <div className="mt-3 space-y-3">
                    {result.explainability.topContributors.map((item) => (
                      <div
                        key={`${result.disease}-${item.symptom}`}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.label}
                          </p>
                          <span className="text-xs font-semibold text-brandBlue dark:text-cyan-300">
                            {formatPercent(item.shareOfEvidence)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                          Severity {item.severity}/5, duration {item.durationDays} days, weight{' '}
                          {item.weight.toFixed(1)}, multiplier {item.durationMultiplier.toFixed(1)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                  <p className="label-text">Coverage Metrics</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-950/60">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Input Coverage
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {formatPercent(result.coverage.inputCoverage)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-950/60">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Disease Coverage
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {formatPercent(result.coverage.diseaseCoverage)}
                      </p>
                    </div>
                  </div>
                </div>

                {result.explainability.missingReportedSymptoms.length > 0 ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-950/30">
                    <p className="label-text text-amber-700 dark:text-amber-200">
                      Reported Symptoms Not Used for This Match
                    </p>
                    <p className="mt-3 text-sm leading-7 text-amber-700 dark:text-amber-200">
                      {result.explainability.missingReportedSymptoms.join(', ')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 text-brandBlue dark:text-cyan-300" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            AI Clinical Communication Layer
          </h3>
        </div>

        {insightState.loading ? (
          <div className="mt-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brandBlue border-t-transparent" />
            Generating a server-side educational insight for the top-ranked condition...
          </div>
        ) : insightState.error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
            {insightState.error}
          </div>
        ) : insightState.payload ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <span className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                Provider {insightState.payload.provider}
              </span>
              <span className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                Model {insightState.payload.model}
              </span>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/70">
              {insightState.payload.insight.split('\n').map((paragraph, index) =>
                paragraph.trim() ? (
                  <p
                    key={index}
                    className="mb-4 text-sm leading-7 text-slate-700 last:mb-0 dark:text-slate-200"
                  >
                    {paragraph}
                  </p>
                ) : null
              )}
            </div>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              AI-generated text is informational only and must not be treated as a diagnosis,
              treatment plan, or emergency triage instruction.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
            AI insight is not yet available for the current result.
          </div>
        )}
      </section>

      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 text-amber-500 dark:text-amber-300" />
          <p>
            SymptomSense ranks conditions by symptom overlap and weighted evidence. It is not a
            clinically validated diagnostic device and must be used only as an informational aid by
            qualified adults.
          </p>
        </div>
      </div>
    </div>
  );
}
