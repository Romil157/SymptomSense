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

export async function generateNvidiaInsight(payload) {
  if (!config.nvidiaApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'NVIDIA AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildInsightPrompt(payload);

  const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.nvidiaApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.nvidiaModel,
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new AppError(502, 'AI_PROVIDER_ERROR', 'NVIDIA AI provider returned an unsuccessful response.', {
      provider: 'nvidia',
      status: response.status,
      body: (await response.text()).slice(0, 300),
    });
  }

  const data = await response.json();
  const insight = data?.choices?.[0]?.message?.content?.trim();

  if (!insight) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'NVIDIA AI provider returned an empty response.');
  }

  return {
    provider: 'nvidia',
    model: config.nvidiaModel,
    insight,
  };
}
