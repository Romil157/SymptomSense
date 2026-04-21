import { config } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';
import { buildInsightPrompt } from '../promptBuilder.js';

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateAnthropicInsight(payload) {
  if (!config.anthropicApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'Anthropic AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildInsightPrompt(payload);

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 600,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'Anthropic AI provider returned an unsuccessful response.', {
      provider: 'anthropic',
      status: response.status,
      body: (await response.text()).slice(0, 300),
    });
  }

  const data = await response.json();
  const insight = (data?.content || [])
    .filter((entry) => entry.type === 'text')
    .map((entry) => entry.text)
    .join('\n')
    .trim();

  if (!insight) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'Anthropic AI provider returned an empty response.');
  }

  return {
    provider: 'anthropic',
    model: config.anthropicModel,
    insight,
  };
}
