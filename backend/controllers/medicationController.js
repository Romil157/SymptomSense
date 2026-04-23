import { writeAuditLog } from '../services/audit/auditLogService.js';
import {
  createMedicationSchedule,
  deleteMedicationSchedule,
  listActiveMedicationSchedules,
} from '../services/medications/medicationService.js';

export async function createMedication(req, res, next) {
  try {
    const medication = await createMedicationSchedule(req.user?.sub, req.body);

    await writeAuditLog({
      action: 'medication.create',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        medicationId: medication.id,
        name: medication.name,
        frequency: medication.frequency,
      },
    });

    res.status(201).json({
      requestId: req.id,
      medication,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'medication.create',
      status: 'failure',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        code: error.code || 'UNKNOWN',
      },
    });

    next(error);
  }
}

export async function listMedications(req, res, next) {
  try {
    const medications = await listActiveMedicationSchedules(req.user?.sub);

    await writeAuditLog({
      action: 'medication.list',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        count: medications.length,
      },
    });

    res.status(200).json({
      requestId: req.id,
      medications,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'medication.list',
      status: 'failure',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        code: error.code || 'UNKNOWN',
      },
    });

    next(error);
  }
}

export async function deleteMedication(req, res, next) {
  try {
    const deletedMedication = await deleteMedicationSchedule(req.user?.sub, req.params.medicationId);

    await writeAuditLog({
      action: 'medication.delete',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        medicationId: deletedMedication.id,
        name: deletedMedication.name,
      },
    });

    res.status(200).json({
      requestId: req.id,
      medication: deletedMedication,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'medication.delete',
      status: 'failure',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        medicationId: req.params?.medicationId,
        code: error.code || 'UNKNOWN',
      },
    });

    next(error);
  }
}
