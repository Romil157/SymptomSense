import { writeAuditLog } from '../services/audit/auditLogService.js';
import { generateMedicationEducation } from '../services/ai/medicationEducationService.js';

export async function createMedicationEducation(req, res, next) {
  try {
    const education = await generateMedicationEducation(req.body);

    await writeAuditLog({
      action: 'medication.education.generate',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        provider: education.provider,
        cached: education.cached,
        medicationCount: education.medications.length,
      },
    });

    res.status(200).json({
      requestId: req.id,
      ...education,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'medication.education.generate',
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
