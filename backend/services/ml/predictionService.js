import { logger } from '../../config/logger.js';
import { loadTensorFlowModel } from './modelService.js';

function vectorizeSymptoms(symptomNames, symptomCatalog) {
  const symptomIndex = new Map(symptomCatalog.map((symptom, index) => [symptom.name, index]));
  const vector = new Array(symptomCatalog.length).fill(0);

  for (const symptomName of symptomNames) {
    const index = symptomIndex.get(symptomName);
    if (index !== undefined) {
      vector[index] = 1;
    }
  }

  return vector;
}

export async function predictSymptoms(symptomNames, datasetSnapshot) {
  const runtime = await loadTensorFlowModel();
  if (!runtime) {
    return null;
  }

  const { tf, model } = runtime;
  const inputTensor = tf.tensor2d([vectorizeSymptoms(symptomNames, datasetSnapshot.symptomCatalog)]);

  try {
    const prediction = model.predict(inputTensor);
    const scores = Array.from(await prediction.data());

    prediction.dispose?.();

    return scores
      .map((score, index) => ({
        disease: datasetSnapshot.diseaseEntries[index]?.disease,
        probability: Number(score.toFixed(4)),
      }))
      .filter((entry) => entry.disease && entry.probability > 0)
      .sort((left, right) => right.probability - left.probability)
      .slice(0, 3);
  } catch (error) {
    logger.warn('TensorFlow.js inference failed. Using deterministic fallback.', {
      message: error.message,
    });
    return null;
  } finally {
    inputTensor.dispose();
  }
}
