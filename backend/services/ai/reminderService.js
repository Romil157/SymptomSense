import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sanitizeFreeText } from '../../utils/sanitizers.js';
import { AppError } from '../../utils/AppError.js';

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

function buildReminderPrompt(medication, patientContext) {
  const patientNote = patientContext
    ? `Patient context: ${sanitizeFreeText(JSON.stringify(patientContext), { maxLength: 300 })}`
    : 'Patient context: not provided.';

  return {
    systemPrompt:
      'You are a medication adherence assistant. Write one short reminder message in plain language. Stay educational and supportive. Do not change the prescribed dose, do not provide diagnosis, and do not mention emergency instructions.',
    userPrompt: `Write a medication reminder for this scheduled dose.

Medication: ${sanitizeFreeText(medication.name, { maxLength: 120 })}
Dosage: ${sanitizeFreeText(medication.dosage, { maxLength: 80 })}
Frequency: ${sanitizeFreeText(medication.frequency, { maxLength: 40 })}
Scheduled time: ${sanitizeFreeText(medication.scheduledTime || medication.dueAt || 'scheduled dose', {
      maxLength: 80,
    })}
${patientNote}

Requirements:
- 1 sentence only
- Mention the dosage and medication name
- Encourage consistency without sounding alarming
- No hashtags, bullets, or quotation marks`,
  };
}

async function generateNvidiaReminder(medication, patientContext) {
  if (!config.nvidiaApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'NVIDIA AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildReminderPrompt(medication, patientContext);
  const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.nvidiaApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.nvidiaModel,
      max_tokens: 120,
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
  const message = data?.choices?.[0]?.message?.content?.trim();

  if (!message) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'NVIDIA AI provider returned an empty response.');
  }

  return {
    provider: 'nvidia',
    model: config.nvidiaModel,
    message: sanitizeFreeText(message, { maxLength: 220 }),
  };
}

async function generateAnthropicReminder(medication, patientContext) {
  if (!config.anthropicApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'Anthropic AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildReminderPrompt(medication, patientContext);
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 120,
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
  const message = (data?.content || [])
    .filter((entry) => entry.type === 'text')
    .map((entry) => entry.text)
    .join(' ')
    .trim();

  if (!message) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'Anthropic AI provider returned an empty response.');
  }

  return {
    provider: 'anthropic',
    model: config.anthropicModel,
    message: sanitizeFreeText(message, { maxLength: 220 }),
  };
}

export async function generateFallbackReminder(medication) {
  return {
    provider: 'fallback',
    model: 'deterministic-medication-reminder-v1',
    message: `Time to take ${medication.dosage} ${medication.name}. Staying consistent helps maintain effectiveness.`,
  };
}

export async function generateReminderMessage(medication, patientContext) {
  const providerName =
    config.aiProvider === 'nvidia' || config.aiProvider === 'anthropic'
      ? config.aiProvider
      : 'fallback';

  try {
    if (providerName === 'nvidia') {
      return await generateNvidiaReminder(medication, patientContext);
    }

    if (providerName === 'anthropic') {
      return await generateAnthropicReminder(medication, patientContext);
    }
  } catch (error) {
    logger.warn('Reminder AI provider failed. Falling back to deterministic reminder copy.', {
      provider: providerName,
      message: error.message,
    });
  }

  return generateFallbackReminder(medication);
}
