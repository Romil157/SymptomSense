import fs from 'node:fs/promises';
import Papa from 'papaparse';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { buildDiseaseLookup, buildDiseaseMap, buildSymptomCatalog } from '../../domain/scoring/diseaseMap.js';
import { AppError } from '../../utils/AppError.js';

let datasetSnapshotPromise = null;

async function readDatasetFile() {
  try {
    return await fs.readFile(config.datasetPath, 'utf8');
  } catch (error) {
    throw new AppError(500, 'DATASET_READ_FAILED', `Unable to read dataset at ${config.datasetPath}.`, {
      cause: error.message,
    });
  }
}

async function loadDatasetSnapshot() {
  const csvText = await readDatasetFile();
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => String(header).trim(),
  });

  if (parsed.errors.length > 0) {
    logger.warn('Dataset parsed with warnings.', {
      warningCount: parsed.errors.length,
      warnings: parsed.errors.slice(0, 5).map((entry) => entry.message),
    });
  }

  const rawRecords = parsed.data.map((row) => ({
    disease: row.Disease || row.disease || '',
    symptoms: Object.entries(row)
      .filter(([key, value]) => !/^disease$/i.test(key) && String(value ?? '').trim())
      .map(([, value]) => String(value).replace(/_/g, ' ')),
  }));

  const diseaseEntries = buildDiseaseMap(rawRecords);

  if (diseaseEntries.length < 10) {
    throw new AppError(500, 'DATASET_INVALID', 'The clinical dataset does not contain enough diseases.', {
      diseaseCount: diseaseEntries.length,
    });
  }

  const symptomCatalog = buildSymptomCatalog(diseaseEntries);
  const symptomLookup = new Map(symptomCatalog.map((entry) => [entry.name, entry]));

  return {
    loadedAt: new Date().toISOString(),
    sourcePath: config.datasetPath,
    diseaseEntries,
    diseaseLookup: buildDiseaseLookup(diseaseEntries),
    symptomCatalog,
    symptomLookup,
  };
}

export async function getDatasetSnapshot() {
  if (!datasetSnapshotPromise) {
    datasetSnapshotPromise = loadDatasetSnapshot().catch((error) => {
      datasetSnapshotPromise = null;
      throw error;
    });
  }

  return datasetSnapshotPromise;
}

export async function warmDatasetCache() {
  const snapshot = await getDatasetSnapshot();

  logger.info('Dataset cache warmed.', {
    sourcePath: snapshot.sourcePath,
    diseaseCount: snapshot.diseaseEntries.length,
    symptomCount: snapshot.symptomCatalog.length,
  });

  return snapshot;
}

export function resetDatasetCache() {
  datasetSnapshotPromise = null;
}
