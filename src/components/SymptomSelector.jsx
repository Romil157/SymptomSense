import { CheckCircle2, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useRef, useState } from 'react';

const severityLabels = {
  1: 'Mild',
  2: 'Mild-Moderate',
  3: 'Moderate',
  4: 'Moderate-Severe',
  5: 'Severe',
};

export default function SymptomSelector({
  catalog,
  selectedSymptoms,
  onAddSymptom,
  onUpdateSymptom,
  onRemoveSymptom,
  validationError,
}) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const deferredQuery = useDeferredValue(query);
  const selectedNames = new Set(selectedSymptoms.map((symptom) => symptom.name));

  const filteredSymptoms = catalog
    .filter(
      (symptom) =>
        symptom.label.toLowerCase().includes(deferredQuery.toLowerCase()) &&
        !selectedNames.has(symptom.name)
    )
    .slice(0, 8);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(symptom) {
    onAddSymptom(symptom);
    setQuery('');
    setIsFocused(false);
  }

  return (
    <div className="space-y-8">
      <div ref={wrapperRef} className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          id="symptom-search"
          type="text"
          className="input-shell pl-12"
          placeholder="Search symptoms such as chest pain, cough, or dizziness"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          autoComplete="off"
        />

        {isFocused && query.trim().length > 0 ? (
          <div className="absolute z-20 mt-3 w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            {filteredSymptoms.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">
                No matching symptoms were found in the backend catalog.
              </div>
            ) : (
              filteredSymptoms.map((symptom) => (
                <button
                  key={symptom.name}
                  type="button"
                  className="flex w-full items-center justify-between border-b border-slate-200/70 px-5 py-4 text-left text-sm transition hover:bg-brandLight dark:border-slate-800 dark:hover:bg-slate-900"
                  onClick={() => handleSelect(symptom)}
                >
                  <span className="font-medium text-slate-900 dark:text-white">{symptom.label}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    weight {symptom.weight.toFixed(1)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {validationError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
          {validationError}
        </div>
      ) : null}

      {selectedSymptoms.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          Select at least one symptom to begin deterministic triage.
        </div>
      ) : (
        <div className="space-y-4">
          {selectedSymptoms.map((symptom) => (
            <article
              key={symptom.name}
              className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-brandBlue dark:text-cyan-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {symptom.label}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Severity {symptom.severity}/5 and duration {symptom.durationDays} days
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Remove ${symptom.label}`}
                  onClick={() => onRemoveSymptom(symptom.name)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="label-text">Severity</label>
                    <span className="text-xs font-semibold text-brandBlue dark:text-cyan-200">
                      {severityLabels[symptom.severity]}
                    </span>
                  </div>
                  <input
                    id={`severity-${symptom.name}`}
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={symptom.severity}
                    className="h-2 w-full cursor-pointer accent-brandBlue"
                    onChange={(event) =>
                      onUpdateSymptom(symptom.name, 'severity', Number(event.target.value))
                    }
                  />
                </div>

                <div>
                  <label className="label-text" htmlFor={`duration-${symptom.name}`}>
                    Duration in Days
                  </label>
                  <input
                    id={`duration-${symptom.name}`}
                    type="number"
                    min="0"
                    max="365"
                    className="input-shell mt-2"
                    value={symptom.durationDays}
                    onChange={(event) =>
                      onUpdateSymptom(
                        symptom.name,
                        'durationDays',
                        Math.max(0, Math.min(365, Number(event.target.value) || 0))
                      )
                    }
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
