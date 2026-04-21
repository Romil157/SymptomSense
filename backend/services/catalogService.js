import { getDatasetSnapshot } from './dataset/datasetService.js';

export async function getSymptomCatalog() {
  const snapshot = await getDatasetSnapshot();

  return {
    loadedAt: snapshot.loadedAt,
    total: snapshot.symptomCatalog.length,
    symptoms: snapshot.symptomCatalog,
  };
}
