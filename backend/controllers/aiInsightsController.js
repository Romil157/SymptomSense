import { writeAuditLog } from '../services/audit/auditLogService.js';
import { generateAiInsight } from '../services/ai/aiService.js';

export async function createAiInsight(req, res, next) {
  try {
    const insight = await generateAiInsight(req.body);

    await writeAuditLog({
      action: 'insights.generate',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        provider: insight.provider,
        cached: insight.cached,
      },
    });

    res.status(200).json({
      requestId: req.id,
      ...insight,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'insights.generate',
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
