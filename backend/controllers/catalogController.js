import { getSymptomCatalog } from '../services/catalogService.js';

export async function listSymptoms(req, res, next) {
  try {
    const catalog = await getSymptomCatalog();

    res.status(200).json({
      requestId: req.id,
      ...catalog,
    });
  } catch (error) {
    next(error);
  }
}
