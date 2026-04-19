/**
 * csvParser.js
 *
 * Loads and parses the cleaned disease dataset CSV.
 *
 * Includes:
 *   - An 8-second timeout to prevent infinite spinner on network failure.
 *   - Post-parse integrity validation to detect corrupt or empty files.
 *
 * Returns:
 *   - dataset: Array<{ disease: string, symptoms: string[] }> — lowercase, normalized
 *   - allSymptoms: string[] — display-cased, sorted, for the SymptomSelector UI
 */

import Papa from 'papaparse';
import { createError, ErrorType } from './errors.js';

const DATASET_LOAD_TIMEOUT_MS = 8000;
const MIN_DISEASE_RECORDS = 10;
const MIN_DISTINCT_SYMPTOMS = 50;

/**
 * Validates that the parsed dataset meets minimum integrity requirements.
 * Throws a structured error if the dataset is critically undersized.
 *
 * @param {Array<{disease: string, symptoms: string[]}>} dataset
 * @param {string[]} allSymptoms
 */
function validateDataset(dataset, allSymptoms) {
  if (dataset.length < MIN_DISEASE_RECORDS) {
    throw createError(
      ErrorType.DATASET_INVALID,
      `Dataset contains only ${dataset.length} records. Minimum required: ${MIN_DISEASE_RECORDS}.`
    );
  }
  if (allSymptoms.length < MIN_DISTINCT_SYMPTOMS) {
    throw createError(
      ErrorType.DATASET_INVALID,
      `Dataset contains only ${allSymptoms.length} distinct symptoms. Minimum required: ${MIN_DISTINCT_SYMPTOMS}.`
    );
  }

  // Log empty records in development — these are data quality warnings, not fatal errors
  if (import.meta.env.DEV) {
    const emptyRecords = dataset.filter(r => r.symptoms.length === 0);
    if (emptyRecords.length > 0) {
      console.warn(
        `[SymptomSense] Dataset integrity: ${emptyRecords.length} disease record(s) have no symptoms.`,
        emptyRecords.map(r => r.disease)
      );
    }
  }
}

/**
 * Core CSV parsing logic, wrapped in a Promise for compatibility with the timeout race.
 *
 * @param {string} csvFilePath
 * @returns {Promise<{ dataset: Array, allSymptoms: string[] }>}
 */
function parseCSVCore(csvFilePath) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvFilePath, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rawData = results.data;
          const allSymptomsSet = new Set();

          const dataset = rawData.map(row => {
            const symptoms = [];
            Object.keys(row).forEach(key => {
              if (
                key !== 'Disease' &&
                row[key] &&
                typeof row[key] === 'string' &&
                row[key].trim() !== ''
              ) {
                const normalized = row[key].trim().replace(/_/g, ' ').toLowerCase();
                if (normalized) {
                  symptoms.push(normalized);
                  allSymptomsSet.add(
                    normalized.charAt(0).toUpperCase() + normalized.slice(1)
                  );
                }
              }
            });
            return {
              disease: row.Disease || 'Unknown Condition',
              symptoms,
            };
          });

          const allSymptoms = Array.from(allSymptomsSet).sort();
          validateDataset(dataset, allSymptoms);

          resolve({ dataset, allSymptoms });
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => {
        reject(createError(ErrorType.DATASET_LOAD_FAILED, err.message ?? 'PapaParse error.'));
      },
    });
  });
}

/**
 * Loads the disease dataset with a timeout guard.
 *
 * If the CSV does not load within DATASET_LOAD_TIMEOUT_MS, the Promise
 * rejects with a DATASET_TIMEOUT error so the UI can render a recovery state.
 *
 * @param {string} csvFilePath
 * @returns {Promise<{ dataset: Array, allSymptoms: string[] }>}
 */
export async function parseCSV(csvFilePath) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(createError(ErrorType.DATASET_TIMEOUT, 'Dataset load timed out after 8 seconds.')),
      DATASET_LOAD_TIMEOUT_MS
    )
  );

  return Promise.race([parseCSVCore(csvFilePath), timeoutPromise]);
}
