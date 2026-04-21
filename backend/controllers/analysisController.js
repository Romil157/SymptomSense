import { writeAuditLog } from '../services/audit/auditLogService.js';
import { runSymptomAnalysis } from '../services/analysisService.js';

export async function analyzeSymptoms(req, res, next) {
  try {
    const analysis = await runSymptomAnalysis(req.body);

    await writeAuditLog({
      action: 'analysis.run',
      status: 'success',
      actor: req.user?.sub,
      requestId: req.id,
      ip: req.ip,
      details: {
        symptomCount: req.body.symptoms.length,
        urgent: analysis.redFlags.length > 0,
        strategy: analysis.summary.modelStrategy,
      },
    });

    res.status(200).json({
      requestId: req.id,
      ...analysis,
    });
  } catch (error) {
    await writeAuditLog({
      action: 'analysis.run',
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
