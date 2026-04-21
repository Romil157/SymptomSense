import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';

let tensorflowModulePromise = null;
let tensorflowModelPromise = null;

async function loadTensorFlowRuntime() {
  if (!tensorflowModulePromise) {
    tensorflowModulePromise = import('@tensorflow/tfjs-node').catch(() => {
      logger.warn('TensorFlow.js runtime is not installed. ML inference will stay disabled.');
      return null;
    });
  }

  return tensorflowModulePromise;
}

export async function loadTensorFlowModel() {
  try {
    await fs.access(config.mlModelPath);
  } catch {
    return null;
  }

  if (!tensorflowModelPromise) {
    tensorflowModelPromise = (async () => {
      const tf = await loadTensorFlowRuntime();
      if (!tf) {
        return null;
      }

      try {
        const model = await tf.loadLayersModel(pathToFileURL(config.mlModelPath).href);
        return { tf, model };
      } catch (error) {
        logger.warn('TensorFlow.js model could not be loaded. Falling back to rules engine.', {
          modelPath: config.mlModelPath,
          message: error.message,
        });
        return null;
      }
    })();
  }

  return tensorflowModelPromise;
}
