import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const DEFAULT_STORE = Object.freeze({
  version: 1,
  medications: [],
});

function normalizeStore(store) {
  if (!store || typeof store !== 'object') {
    return structuredClone(DEFAULT_STORE);
  }

  return {
    version: 1,
    medications: Array.isArray(store.medications)
      ? store.medications.map((medication) => ({
          ...medication,
          reminders: Array.isArray(medication.reminders) ? medication.reminders : [],
        }))
      : [],
  };
}

class MedicationRepository {
  constructor(filePath) {
    this.filePath = filePath;
    this.store = null;
    this.loadPromise = null;
    this.operationQueue = Promise.resolve();
  }

  async ensureLoaded() {
    if (this.store) {
      return this.store;
    }

    if (!this.loadPromise) {
      this.loadPromise = this.loadStore();
    }

    await this.loadPromise;
    return this.store;
  }

  async loadStore() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.store = normalizeStore(JSON.parse(raw));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Medication store could not be read. Rebuilding from an empty state.', {
          filePath: this.filePath,
          message: error.message,
        });
      }

      this.store = structuredClone(DEFAULT_STORE);
      await this.persist();
    }
  }

  async persist() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    const payload = JSON.stringify(this.store, null, 2);

    await fs.writeFile(tempPath, payload, 'utf8');

    try {
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      if (!['EPERM', 'EEXIST', 'ENOTEMPTY'].includes(error.code)) {
        await fs.rm(tempPath, { force: true });
        throw error;
      }

      await fs.rm(this.filePath, { force: true });
      await fs.rename(tempPath, this.filePath);
    }
  }

  async snapshot() {
    await this.ensureLoaded();
    return structuredClone(this.store);
  }

  async update(mutator) {
    await this.ensureLoaded();

    const execute = async () => {
      const result = await mutator(this.store);
      await this.persist();
      return structuredClone(result);
    };

    const nextOperation = this.operationQueue.then(execute, execute);
    this.operationQueue = nextOperation.then(
      () => undefined,
      () => undefined
    );

    return nextOperation;
  }

  async reset() {
    this.store = structuredClone(DEFAULT_STORE);
    await this.persist();
  }
}

export const medicationRepository = new MedicationRepository(config.medicationStoreFile);

export async function resetMedicationRepository() {
  await medicationRepository.reset();
}
