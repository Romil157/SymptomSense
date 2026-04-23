import { writeAuditLog } from '../services/audit/auditLogService.js';
import { triggerMedicationReminders } from '../services/reminders/reminderEngine.js';

export async function triggerReminders(req, res, next) {
  try {
    const response = await triggerMedicationReminders(req.user?.sub, req.body?.now);

    await writeAuditLog({
      action: 'reminder.trigger',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        count: response.reminders.length,
        checkedAt: response.checkedAt,
      },
    });

    res.status(200).json({
      requestId: req.id,
      ...response,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'reminder.trigger',
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
