import { buildMedicationResponse, createMedicationRecord, isMedicationActive } from './medicationSchedule.js';
import { medicationRepository } from './medicationRepository.js';
import { AppError } from '../../utils/AppError.js';

export async function createMedicationSchedule(ownerId, payload) {
  const medicationRecord = createMedicationRecord(payload, ownerId);

  return medicationRepository.update((store) => {
    store.medications.push(medicationRecord);
    return buildMedicationResponse(medicationRecord, new Date(medicationRecord.createdAt));
  });
}

export async function listActiveMedicationSchedules(ownerId, now = new Date()) {
  const snapshot = await medicationRepository.snapshot();

  return snapshot.medications
    .filter((medication) => medication.ownerId === ownerId)
    .filter((medication) => isMedicationActive(medication, now))
    .map((medication) => buildMedicationResponse(medication, now))
    .sort((left, right) => {
      if (!left.nextDueAt && !right.nextDueAt) {
        return left.name.localeCompare(right.name);
      }

      if (!left.nextDueAt) {
        return 1;
      }

      if (!right.nextDueAt) {
        return -1;
      }

      return left.nextDueAt.localeCompare(right.nextDueAt);
    });
}

export async function deleteMedicationSchedule(ownerId, medicationId) {
  return medicationRepository.update((store) => {
    const targetIndex = store.medications.findIndex(
      (medication) => medication.id === medicationId && medication.ownerId === ownerId
    );

    if (targetIndex < 0) {
      throw new AppError(404, 'MEDICATION_NOT_FOUND', 'Medication schedule was not found.');
    }

    const [deletedMedication] = store.medications.splice(targetIndex, 1);
    return buildMedicationResponse(deletedMedication, new Date());
  });
}
