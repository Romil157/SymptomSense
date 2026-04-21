import { writeAuditLog } from '../services/audit/auditLogService.js';
import { loginClinician } from '../services/auth/authService.js';

export async function login(req, res, next) {
  try {
    const session = await loginClinician(req.body);

    await writeAuditLog({
      action: 'auth.login',
      status: 'success',
      actor: session.user.email,
      requestId: req.id,
      ip: req.ip,
    });

    res.status(200).json({
      requestId: req.id,
      ...session,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'auth.login',
      status: 'failure',
      actor: req.body?.email || 'unknown',
      requestId: req.id,
      ip: req.ip,
      details: {
        code: error.code || 'UNKNOWN',
      },
    });

    next(error);
  }
}
