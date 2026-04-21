import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { createCacheKey } from '../../utils/sanitizers.js';
import { aiCache } from '../cache/memoryCache.js';
import { generateAnthropicInsight } from './providers/claudeProvider.js';
import { generateFallbackInsight } from './providers/fallbackProvider.js';
import { generateNvidiaInsight } from './providers/nvidiaProvider.js';

const providers = {
  fallback: generateFallbackInsight,
  nvidia: generateNvidiaInsight,
  anthropic: generateAnthropicInsight,
};

export async function generateAiInsight(payload) {
  const cacheKey = createCacheKey({
    patient: payload.patient,
    result: payload.result,
    redFlags: payload.redFlags,
  });
  const cached = aiCache.get(cacheKey);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const providerName = providers[config.aiProvider] ? config.aiProvider : 'fallback';
  const provider = providers[providerName];

  let response;

  try {
    response = await provider(payload);
  } catch (error) {
    logger.warn('Primary AI provider failed. Falling back to deterministic insight.', {
      provider: providerName,
      message: error.message,
    });
    response = await generateFallbackInsight(payload);
  }

  const finalResponse = {
    ...response,
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  aiCache.set(cacheKey, finalResponse);

  return finalResponse;
}
