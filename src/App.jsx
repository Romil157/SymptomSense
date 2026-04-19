import React, { useState, useEffect } from 'react';
import { Activity, Settings, Settings2, AlertTriangle } from 'lucide-react';
import SymptomSelector from './components/SymptomSelector';
import ResultsPanel from './components/ResultsPanel';
import PatientInfoForm from './components/PatientInfoForm';
import { parseCSV } from './utils/csvParser';
import { scoreSymptoms } from './utils/scoreEngine';
import { errorMessage } from './utils/errors.js';
import { sanitizePatientInfo } from './utils/sanitize.js';

// Disclaimer acceptance persisted across sessions.
// Changing the version string resets acceptance for all users.
const DISCLAIMER_VERSION_KEY = 'symptomsense_disclaimer_v1';

function App() {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState(localStorage.getItem('nvidia_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    () => localStorage.getItem(DISCLAIMER_VERSION_KEY) === 'accepted'
  );

  const [allSymptoms, setAllSymptoms] = useState([]);
  const [dataset, setDataset] = useState([]);
  const [loadingDataset, setLoadingDataset] = useState(true);
  const [datasetError, setDatasetError] = useState(null);

  // Each entry: { name: string, severity: number (1–5), duration: number (days) }
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

  const [results, setResults] = useState([]);
  const [redFlags, setRedFlags] = useState([]);
  const [patientInfo, setPatientInfo] = useState({ age: '', gender: '' });

  // Load dataset on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingDataset(true);
        setDatasetError(null);
        const { dataset: ds, allSymptoms: symptoms } = await parseCSV('/cleaned_dataset.csv');
        setDataset(ds);
        setAllSymptoms(symptoms);
      } catch (err) {
        const msg = errorMessage(err.errorType) ?? err.message ?? 'Failed to load dataset.';
        setDatasetError(msg);
        console.error('[SymptomSense] Dataset load error:', err);
      } finally {
        setLoadingDataset(false);
      }
    };
    loadData();
  }, []);

  // --- Handlers ---

  const acceptDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_VERSION_KEY, 'accepted');
    setDisclaimerAccepted(true);
  };

  const saveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem('nvidia_api_key', apiKey);
    setShowSettings(false);
  };

  const handlePatientInfoComplete = (info) => {
    try {
      // Validate and cast before storing — prevents prompt injection via age/gender
      const sanitized = sanitizePatientInfo(info);
      setPatientInfo(sanitized);
      setStep(2);
    } catch (err) {
      // PatientInfoForm already validates ranges, but sanitize is a second gate.
      console.error('[SymptomSense] Patient info validation failed:', err.message);
    }
  };

  /**
   * Add a new symptom entry with default severity and duration.
   * Prevents duplicates.
   */
  const handleAddSymptom = (name) => {
    if (selectedSymptoms.some(s => s.name === name)) return;
    setSelectedSymptoms(prev => [...prev, { name, severity: 3, duration: 1 }]);
  };

  /**
   * Update the severity or duration of an existing symptom entry.
   */
  const handleUpdateSymptom = (name, field, value) => {
    setSelectedSymptoms(prev =>
      prev.map(s => s.name === name ? { ...s, [field]: value } : s)
    );
  };

  const handleRemoveSymptom = (name) => {
    setSelectedSymptoms(prev => prev.filter(s => s.name !== name));
  };

  /**
   * Run the weighted scoring engine and navigate to results.
   */
  const handleCheckSymptoms = () => {
    const { results: scored, redFlags: flags } = scoreSymptoms(selectedSymptoms, dataset);
    setResults(scored);
    setRedFlags(flags);
    setStep(3);
  };

  const handleStartOver = () => {
    setSelectedSymptoms([]);
    setResults([]);
    setRedFlags([]);
    // Return to symptom selection, keep patient info
    setStep(2);
  };

  const canSubmit = selectedSymptoms.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

      {/* Disclaimer Overlay */}
      {!disclaimerAccepted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="h-7 w-7 text-brandBlue flex-shrink-0" />
              <h2 className="text-xl font-bold text-gray-900">Important Notice</h2>
            </div>
            <div className="text-sm text-gray-700 space-y-3 overflow-y-auto max-h-60 pr-1">
              <p>
                SymptomSense is an educational tool designed to help you understand possible
                conditions based on the symptoms you report. It is not a medical diagnostic device.
              </p>
              <p>
                The predictions made by this system are based on symptom-matching algorithms
                and publicly available health data. They are not reviewed, verified, or endorsed
                by licensed medical professionals.
              </p>
              <p>
                <strong>Do not use SymptomSense to delay seeking medical care.</strong> If you
                believe you are experiencing a medical emergency, call emergency services (112)
                or proceed to the nearest emergency room immediately.
              </p>
              <p>
                By continuing, you confirm that you understand this tool is for informational
                purposes only and you will consult a licensed physician for any health concerns.
              </p>
            </div>
            <div className="mt-6">
              <button
                id="disclaimer-accept"
                onClick={acceptDisclaimer}
                className="w-full py-3 bg-brandBlue text-white font-bold rounded-full hover:bg-blue-700 transition-colors text-sm"
              >
                I Understand — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Navbar */}
      <nav className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-brandBlue">
                <Activity className="h-7 w-7" />
                <span className="font-bold text-xl tracking-tight text-gray-900">SymptomSense</span>
              </div>
              <span className="hidden md:block text-sm text-gray-400 border-l border-gray-200 pl-6">
                Understand your symptoms. Not a replacement for a doctor.
              </span>
            </div>
            <div className="flex items-center">
              <button
                id="settings-toggle"
                onClick={() => setShowSettings(true)}
                className="text-gray-500 hover:text-brandBlue p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="API Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Step Indicator */}
      {disclaimerAccepted && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              {[
                { n: 1, label: 'Patient Profile' },
                { n: 2, label: 'Symptoms' },
                { n: 3, label: 'Results' },
              ].map(({ n, label }) => (
                <div key={n} className="flex items-center gap-2">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      step >= n
                        ? 'bg-brandBlue text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {n}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      step >= n ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                  {n < 3 && <div className="h-px w-8 bg-gray-200" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Settings Modal */}
        {showSettings && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="flex items-center justify-center min-h-screen px-4">
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75"
                onClick={() => setShowSettings(false)}
              />
              <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 z-10">
                <form onSubmit={saveApiKey}>
                  <div className="flex items-center gap-3 mb-2">
                    <Settings2 className="h-5 w-5 text-brandBlue" />
                    <h3 id="settings-modal-title" className="text-lg font-semibold text-gray-900">
                      API Settings
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    SymptomSense uses the <strong>NVIDIA NIM API</strong> with the{' '}
                    <strong>Google Gemma 4 (31B)</strong> model to generate disease explanations.
                    Your key is stored only in your browser and is never sent to our servers.
                    Get a free key at{' '}
                    <a
                      href="https://build.nvidia.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-brandBlue underline"
                    >
                      build.nvidia.com
                    </a>.
                  </p>
                  <input
                    id="api-key-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brandBlue focus:border-brandBlue"
                  />
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-brandBlue rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Key
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="p-8">
            {loadingDataset ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brandBlue" />
                <p className="text-sm text-gray-500">Loading symptom dataset...</p>
              </div>
            ) : datasetError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <p className="font-semibold text-gray-800">Dataset failed to load</p>
                <p className="text-sm text-gray-500 max-w-sm">{datasetError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-6 py-2 bg-brandBlue text-white text-sm font-semibold rounded-full hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                {/* Step 1 — Patient Info */}
                {step === 1 && (
                  <PatientInfoForm onComplete={handlePatientInfoComplete} />
                )}

                {/* Step 2 — Symptom Selection */}
                {step === 2 && (
                  <div>
                    <div className="mb-8 text-center">
                      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                        Select Your Symptoms
                      </h1>
                      <p className="text-gray-500 text-sm">
                        Search and select all symptoms you are currently experiencing. Rate
                        each by severity and how long you have had it.
                      </p>
                    </div>

                    <SymptomSelector
                      allSymptoms={allSymptoms}
                      selectedSymptoms={selectedSymptoms}
                      onAddSymptom={handleAddSymptom}
                      onUpdateSymptom={handleUpdateSymptom}
                      onRemoveSymptom={handleRemoveSymptom}
                    />

                    <div className="mt-10 pt-6 border-t border-gray-100 text-center">
                      <button
                        id="check-symptoms-btn"
                        onClick={handleCheckSymptoms}
                        disabled={!canSubmit}
                        className={`w-full md:w-auto px-10 py-4 rounded-full font-bold text-base shadow-md transition-all ${
                          canSubmit
                            ? 'bg-brandBlue text-white hover:bg-blue-700 hover:scale-105'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Analyze Symptoms
                      </button>
                      {!canSubmit && (
                        <p className="text-xs text-gray-400 mt-2">
                          Select at least one symptom to continue.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3 — Results */}
                {step === 3 && (
                  <ResultsPanel
                    results={results}
                    redFlags={redFlags}
                    apiKey={apiKey}
                    patientInfo={patientInfo}
                    onStartOver={handleStartOver}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-gray-900 text-gray-400 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
          <p className="flex items-center justify-center gap-2 mb-2 font-medium text-gray-300">
            <Activity className="h-4 w-4" /> SymptomSense
          </p>
          <p className="text-xs">
            <strong className="text-gray-300">Disclaimer:</strong> This tool is for informational
            purposes only. It is not a substitute for professional medical advice, diagnosis, or
            treatment. Always consult a qualified physician for any health concerns.
          </p>
          <p className="mt-2 text-xs text-gray-600">
            If you are experiencing a medical emergency, call emergency services immediately.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
