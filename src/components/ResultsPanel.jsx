import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, AlertCircle, Info, Stethoscope } from 'lucide-react';
import { generateDiseaseExplanation } from '../api/nvidia';
import { errorMessage, ErrorType } from '../utils/errors.js';

/**
 * ResultsPanel
 *
 * Renders the disease prediction results including:
 *   - EmergencyAdvisoryCard (if red-flag symptoms are present)
 *   - Up to 3 DiseaseScoreCards with confidence tier badges
 *   - AI-generated explanation for the top result
 *
 * Props:
 *   results      ScoredDisease[]  — from scoreEngine.js
 *   redFlags     string[]         — symptom names that triggered emergency advisory
 *   apiKey       string
 *   patientInfo  { age, gender }
 *   onStartOver  () => void
 */
export default function ResultsPanel({ results, redFlags, apiKey, patientInfo, onStartOver }) {
  const [explanation, setExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState(null);

  const topResult = results?.[0] ?? null;

  useEffect(() => {
    async function loadExplanation() {
      setLoadingExplanation(true);
      setExplanationError(null);
      setExplanation(null);
      try {
        const text = await generateDiseaseExplanation(apiKey, topResult, patientInfo);
        setExplanation(text);
      } catch (err) {
        // Use structured error type if available; fall back to raw message
        const msg = err.errorType
          ? errorMessage(err.errorType)
          : (err.message ?? 'AI explanation failed.');
        setExplanationError(msg);
      } finally {
        setLoadingExplanation(false);
      }
    }

    if (!topResult) return;
    if (!apiKey) {
      setExplanationError(errorMessage(ErrorType.API_KEY_MISSING));
      return;
    }
    loadExplanation();
  }, [topResult, apiKey, patientInfo]);

  // Confidence tier badge styles
  const tierConfig = {
    High:     { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    Moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    Low:      { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  };

  if (!results || results.length === 0) {
    return (
      <div className="text-center p-10 text-gray-500">
        <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="font-semibold text-gray-700">No conditions matched your symptom profile.</p>
        <p className="text-sm mt-1 text-gray-500">
          This may indicate an unusual symptom combination or insufficient specificity.
          Please consult a physician.
        </p>
        <button
          onClick={onStartOver}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-brandBlue hover:underline"
        >
          <RefreshCw className="h-4 w-4" /> Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Results header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-brandBlue" />
          Likely Conditions
        </h2>
        <button
          onClick={onStartOver}
          className="text-sm font-medium text-gray-500 hover:text-brandBlue flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-brandBlue transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Start Over
        </button>
      </div>

      {/* Emergency Advisory Card */}
      {redFlags && redFlags.length > 0 && (
        <div
          role="alert"
          className="border border-red-300 bg-red-50 rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-800 text-sm">Emergency Advisory</p>
              <p className="text-red-700 text-sm mt-1">
                One or more symptoms you selected may indicate a medical emergency:{' '}
                <span className="font-semibold">{redFlags.join(', ')}</span>.
              </p>
              <p className="text-red-700 text-sm mt-2 font-semibold">
                Call emergency services (112) or proceed to the nearest emergency room immediately.
                Do not wait for prediction results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disease Score Cards */}
      <div className="grid grid-cols-1 gap-5">
        {results.map((res, index) => {
          const isTop = index === 0;
          const tier = tierConfig[res.confidenceTier] ?? tierConfig.Low;

          return (
            <div
              key={`${res.disease}-${index}`}
              className={`border rounded-xl bg-white overflow-hidden ${
                isTop
                  ? 'ring-2 ring-brandBlue shadow-lg'
                  : 'border-gray-200 shadow-sm'
              }`}
            >
              {/* Card Header */}
              <div className={`p-5 flex justify-between items-start ${isTop ? 'bg-brandLight' : 'bg-white'}`}>
                <div>
                  {isTop && (
                    <span className="inline-block text-xs font-semibold text-brandBlue uppercase tracking-wider mb-1">
                      Top Match
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{res.disease}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* Confidence Tier Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tier.bg} ${tier.text} ${tier.border}`}
                    >
                      {res.confidenceTier} Confidence
                    </span>
                    <span className="text-xs text-gray-500">
                      {res.matchedCount} matching symptom{res.matchedCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {/* Normalized Score */}
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="text-2xl font-black text-brandBlue">
                    {Math.round(res.normalizedScore * 100)}%
                  </div>
                  <div className="text-xs text-gray-400 uppercase font-semibold">Score</div>
                </div>
              </div>

              {/* Score Bar */}
              <div className="w-full h-1.5 bg-gray-200">
                <div
                  className="h-1.5 bg-brandBlue transition-all duration-300"
                  style={{ width: `${Math.round(res.normalizedScore * 100)}%` }}
                />
              </div>

              {/* Matched Symptoms (top result only) */}
              {isTop && res.matchedSymptomNames?.length > 0 && (
                <div className="px-5 pt-4 pb-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Matched Symptoms
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {res.matchedSymptomNames.map((s, i) => (
                      <span
                        key={i}
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-brandBlue border border-blue-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Explanation — top result only */}
              {isTop && (
                <div className="p-5 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-brandBlue" />
                    AI-Generated Overview (Gemma 4 via NVIDIA NIM)
                  </h4>

                  {loadingExplanation && (
                    <div className="flex items-center gap-3 py-4 text-gray-500">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brandBlue flex-shrink-0" />
                      <span className="text-sm">Generating explanation...</span>
                    </div>
                  )}

                  {!loadingExplanation && explanationError && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>{explanationError}</p>
                    </div>
                  )}

                  {!loadingExplanation && !explanationError && explanation && (
                    <div className="space-y-3">
                      {explanation.split('\n').map((para, i) =>
                        para.trim() ? (
                          <p key={i} className="text-sm text-gray-700 leading-relaxed">
                            {para}
                          </p>
                        ) : null
                      )}
                      {/* Hardcoded disclaimer appended at component layer — always visible */}
                      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3 mt-3">
                        The above information is AI-generated and is provided for informational
                        context only. It does not constitute a medical diagnosis or treatment
                        recommendation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline per-result disclaimer */}
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        Results are generated by a weighted symptom-matching algorithm and do not constitute a
        medical diagnosis. Confidence scores reflect symptom overlap, not diagnostic certainty.
        Consult a licensed physician for evaluation.
      </p>
    </div>
  );
}
