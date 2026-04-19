import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check } from 'lucide-react';

/**
 * SymptomSelector
 *
 * Allows the user to search and select symptoms from the dataset.
 * Each selected symptom has an associated severity rating (1–5) and
 * duration (days), which are inputs to the weighted scoring engine.
 *
 * Props:
 *   allSymptoms       string[]        — display-cased symptom list from dataset
 *   selectedSymptoms  SymptomEntry[]  — { name, severity, duration }
 *   onAddSymptom      (name) => void
 *   onUpdateSymptom   (name, field, value) => void
 *   onRemoveSymptom   (name) => void
 */
export default function SymptomSelector({
  allSymptoms,
  selectedSymptoms,
  onAddSymptom,
  onUpdateSymptom,
  onRemoveSymptom,
}) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  const selectedNames = new Set(selectedSymptoms.map(s => s.name));

  const filteredSymptoms = allSymptoms.filter(s =>
    s.toLowerCase().includes(query.toLowerCase()) && !selectedNames.has(s)
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symptom) => {
    onAddSymptom(symptom);
    setQuery('');
  };

  const severityLabels = { 1: 'Mild', 2: 'Mild-Moderate', 3: 'Moderate', 4: 'Moderate-Severe', 5: 'Severe' };

  return (
    <div className="w-full space-y-6">
      {/* Search Input */}
      <div ref={wrapperRef} className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          id="symptom-search"
          type="text"
          className="block w-full pl-10 pr-3 py-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brandBlue focus:border-brandBlue sm:text-base outline-none transition-all"
          placeholder="Type a symptom to search (e.g. Fever, Cough)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          autoComplete="off"
        />

        {isFocused && (query.trim().length > 0 || filteredSymptoms.length > 0) && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            {filteredSymptoms.length === 0 ? (
              <div className="cursor-default select-none relative py-3 pl-3 pr-9 text-gray-500">
                No matching symptoms found.
              </div>
            ) : (
              filteredSymptoms.map((symptom, i) => (
                <div
                  key={i}
                  className="cursor-pointer select-none relative py-3 pl-3 pr-9 border-b border-gray-100 hover:bg-brandLight hover:text-brandBlue transition-colors"
                  onClick={() => handleSelect(symptom)}
                >
                  <span className="font-medium block truncate text-gray-800">{symptom}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Symptom Detail Cards */}
      {selectedSymptoms.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Selected Symptoms — {selectedSymptoms.length} total
          </h4>
          <p className="text-xs text-gray-400">
            Rate the severity and how long you have had each symptom. This improves prediction accuracy.
          </p>

          <div className="space-y-3">
            {selectedSymptoms.map((entry) => (
              <div
                key={entry.name}
                className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
              >
                {/* Symptom header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-semibold text-gray-800 text-sm">{entry.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveSymptom(entry.name)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${entry.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Severity and Duration inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Severity Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-gray-600">
                        Severity
                      </label>
                      <span className="text-xs font-semibold text-brandBlue">
                        {entry.severity} / 5 — {severityLabels[entry.severity]}
                      </span>
                    </div>
                    <input
                      id={`severity-${entry.name.replace(/\s+/g, '-')}`}
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={entry.severity}
                      onChange={(e) =>
                        onUpdateSymptom(entry.name, 'severity', parseInt(e.target.value, 10))
                      }
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-brandBlue"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Mild</span>
                      <span>Severe</span>
                    </div>
                  </div>

                  {/* Duration Input */}
                  <div>
                    <label
                      htmlFor={`duration-${entry.name.replace(/\s+/g, '-')}`}
                      className="text-xs font-medium text-gray-600 block mb-1"
                    >
                      Duration (days)
                    </label>
                    <input
                      id={`duration-${entry.name.replace(/\s+/g, '-')}`}
                      type="number"
                      min="0"
                      max="365"
                      value={entry.duration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onUpdateSymptom(
                          entry.name,
                          'duration',
                          isNaN(val) ? 0 : Math.max(0, Math.min(365, val))
                        );
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brandBlue focus:border-brandBlue outline-none transition-all"
                      placeholder="e.g. 3"
                    />
                    <p className="text-xs text-gray-400 mt-1">Enter 0 if it started today.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedSymptoms.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-400">
            No symptoms selected. Search and select at least one symptom above.
          </p>
        </div>
      )}
    </div>
  );
}
