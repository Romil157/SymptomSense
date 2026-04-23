import { z } from 'zod';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { createCacheKey, sanitizeFreeText } from '../../utils/sanitizers.js';
import { AppError } from '../../utils/AppError.js';
import { aiCache } from '../cache/memoryCache.js';

const EDUCATIONAL_DISCLAIMER =
  'This information is for educational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional before taking any medication.';

const UNCERTAINTY_ADVICE =
  'Consult a healthcare professional for appropriate evaluation and treatment options.';

const MINOR_ADVICE =
  'For children and adolescents, medication choices should be reviewed by a qualified clinician before use. Seek professional guidance for age-appropriate care.';

const RED_FLAG_ADVICE =
  'Urgent warning signs were identified. Seek prompt in-person medical evaluation instead of relying on self-treatment.';

const BANNED_CATEGORY_PATTERN =
  /\b(antibiotic|opioid|benzodiazepine|controlled|stimulant|antipsychotic|biologic|chemotherapy|anticoagulant)\b/i;

const DIRECTIVE_PATTERN =
  /\b(you should|take this|start taking|you must|must take|you need to take|use this)\b/i;

const medicationCatalog = Object.freeze({
  acetaminophen: {
    name: 'Acetaminophen (Paracetamol)',
    category: 'Analgesic/Antipyretic',
    usage: 'Often used for mild pain or fever relief.',
    dosage: '325-650 mg every 4-6 hours; maximum 3,000 mg/day.',
    notes: 'Avoid combining with other products that contain acetaminophen.',
    aliases: ['acetaminophen', 'paracetamol', 'acetaminophen (paracetamol)'],
  },
  ibuprofen: {
    name: 'Ibuprofen',
    category: 'NSAID',
    usage: 'Commonly used for short-term pain, inflammation, or fever relief.',
    dosage: '200-400 mg every 6-8 hours with food; maximum 1,200 mg/day OTC.',
    notes: 'Avoid if there is a history of ulcer, kidney disease, or NSAID sensitivity.',
    aliases: ['ibuprofen'],
  },
  cetirizine: {
    name: 'Cetirizine',
    category: 'Antihistamine',
    usage: 'Often used for sneezing, runny nose, and itching from allergies.',
    dosage: '10 mg once daily.',
    notes: 'May cause drowsiness in some people.',
    aliases: ['cetirizine'],
  },
  loratadine: {
    name: 'Loratadine',
    category: 'Antihistamine',
    usage: 'Commonly used for daytime allergy symptom relief.',
    dosage: '10 mg once daily.',
    notes: 'Usually less sedating than older antihistamines.',
    aliases: ['loratadine'],
  },
  ors: {
    name: 'Oral Rehydration Salts',
    category: 'Oral Rehydration Therapy',
    usage: 'Often used to replace fluids and electrolytes during diarrhea.',
    dosage: 'Use as directed on product labeling after each loose stool.',
    notes: 'Persistent diarrhea, blood in stool, or high fever needs medical review.',
    aliases: ['oral rehydration salts', 'ors', 'oral rehydration solution'],
  },
  loperamide: {
    name: 'Loperamide',
    category: 'Antidiarrheal',
    usage: 'May be considered for short-term non-bloody diarrhea symptom relief.',
    dosage: '4 mg initially, then 2 mg after each loose stool; maximum 8 mg/day OTC.',
    notes: 'Avoid when fever, severe abdominal pain, or blood in stool is present.',
    aliases: ['loperamide'],
  },
  famotidine: {
    name: 'Famotidine',
    category: 'H2 Receptor Blocker',
    usage: 'Commonly used for short-term heartburn or acid-related discomfort.',
    dosage: '10-20 mg once or twice daily.',
    notes: 'Ongoing symptoms should be reviewed by a clinician.',
    aliases: ['famotidine'],
  },
  calcium_carbonate: {
    name: 'Calcium Carbonate Antacid',
    category: 'Antacid',
    usage: 'Often used for quick, short-term heartburn relief.',
    dosage: 'Use product-labeled dose as needed; do not exceed labeled daily maximum.',
    notes: 'Frequent daily use warrants clinical review.',
    aliases: ['calcium carbonate', 'antacid', 'calcium carbonate antacid'],
  },
  dextromethorphan: {
    name: 'Dextromethorphan',
    category: 'Antitussive',
    usage: 'May be considered for short-term dry cough symptom relief.',
    dosage: '10-20 mg every 4 hours or 30 mg every 6-8 hours; follow OTC label limits.',
    notes: 'Avoid combining with other cough products that duplicate active ingredients.',
    aliases: ['dextromethorphan', 'dxm'],
  },
  guaifenesin: {
    name: 'Guaifenesin',
    category: 'Expectorant',
    usage: 'Commonly used for productive cough with mucus.',
    dosage: '200-400 mg every 4 hours or 600-1200 mg every 12 hours; follow OTC label limits.',
    notes: 'Hydration may improve mucus clearance.',
    aliases: ['guaifenesin'],
  },
});

const conditionFallbackRules = Object.freeze([
  {
    pattern: /\b(tension headache|headache|migraine)\b/i,
    medicationKeys: ['acetaminophen', 'ibuprofen'],
    generalAdvice:
      'Hydration, rest, and trigger avoidance are commonly recommended. Seek care for severe, persistent, or unusual headache patterns.',
  },
  {
    pattern: /\b(allergic rhinitis|seasonal allergy|allergy)\b/i,
    medicationKeys: ['cetirizine', 'loratadine'],
    generalAdvice:
      'Reducing allergen exposure and monitoring breathing symptoms may help. Seek care if symptoms worsen or affect breathing.',
  },
  {
    pattern: /\b(gastroenteritis|diarrhea|acute diarrhea)\b/i,
    medicationKeys: ['ors', 'loperamide'],
    generalAdvice:
      'Fluid replacement is central during diarrhea. Seek prompt care if there is dehydration, blood in stool, or persistent fever.',
  },
  {
    pattern: /\b(heartburn|acid reflux|gerd|dyspepsia)\b/i,
    medicationKeys: ['famotidine', 'calcium_carbonate'],
    generalAdvice:
      'Smaller meals and avoiding late-night eating are often helpful. Persistent or worsening symptoms should be clinically evaluated.',
  },
  {
    pattern: /\b(common cold|viral upper respiratory|rhinosinusitis|dry cough|productive cough|acute bronchitis|flu|influenza)\b/i,
    medicationKeys: ['acetaminophen', 'dextromethorphan', 'guaifenesin'],
    generalAdvice:
      'Rest, hydration, and symptom monitoring are often used during viral respiratory illness. Seek care for breathing difficulty or persistent high fever.',
  },
]);

const medicationAliasLookup = new Map(
  Object.entries(medicationCatalog).flatMap(([key, entry]) =>
    entry.aliases.map((alias) => [normalizeLookupValue(alias), key])
  )
);

const medicationItemSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  usage: z.string().min(1).max(260),
  dosage: z.string().min(1).max(180),
  notes: z.string().min(1).max(260),
});

const medicationEducationResponseSchema = z.object({
  medications: z.array(medicationItemSchema).default([]),
  generalAdvice: z.string().min(1).max(420),
  disclaimer: z.string().min(1).max(300),
});

function normalizeLookupValue(value) {
  return sanitizeFreeText(value, { maxLength: 120 }).toLowerCase();
}

function sanitizeGeneralAdvice(value, fallback) {
  const text = sanitizeFreeText(value, { maxLength: 420 });

  if (!text || DIRECTIVE_PATTERN.test(text)) {
    return fallback;
  }

  return text;
}

function buildBaseResponse({
  provider,
  model,
  medications,
  generalAdvice,
}) {
  return {
    provider,
    model,
    medications,
    generalAdvice,
    disclaimer: EDUCATIONAL_DISCLAIMER,
  };
}

function getFallbackRule(disease) {
  const normalizedDisease = sanitizeFreeText(disease, { maxLength: 160 });
  return conditionFallbackRules.find((rule) => rule.pattern.test(normalizedDisease)) || null;
}

function getCanonicalMedicationByName(name) {
  const aliasKey = medicationAliasLookup.get(normalizeLookupValue(name));

  if (!aliasKey) {
    return null;
  }

  const catalogItem = medicationCatalog[aliasKey];
  return {
    name: catalogItem.name,
    category: catalogItem.category,
    usage: catalogItem.usage,
    dosage: catalogItem.dosage,
    notes: catalogItem.notes,
  };
}

export function parseMedicationEducationJson(rawText) {
  const text = String(rawText || '').trim();

  if (!text) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'AI provider returned an empty medication education response.');
  }

  const withoutCodeFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(withoutCodeFence);
  } catch {
    const objectStart = withoutCodeFence.indexOf('{');
    const objectEnd = withoutCodeFence.lastIndexOf('}');

    if (objectStart < 0 || objectEnd <= objectStart) {
      throw new AppError(502, 'AI_INVALID_JSON', 'AI provider did not return valid JSON.');
    }

    try {
      return JSON.parse(withoutCodeFence.slice(objectStart, objectEnd + 1));
    } catch {
      throw new AppError(502, 'AI_INVALID_JSON', 'AI provider did not return valid JSON.');
    }
  }
}

export function normalizeMedicationEducationPayload(payload, fallbackAdvice) {
  const parsed = medicationEducationResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(502, 'AI_INVALID_JSON', 'AI provider returned an invalid medication education schema.');
  }

  const deduplicated = new Map();

  for (const medication of parsed.data.medications) {
    if (BANNED_CATEGORY_PATTERN.test(medication.category)) {
      continue;
    }

    const canonicalMedication = getCanonicalMedicationByName(medication.name);

    if (!canonicalMedication) {
      continue;
    }

    deduplicated.set(canonicalMedication.name, canonicalMedication);
  }

  return {
    medications: Array.from(deduplicated.values()).slice(0, 3),
    generalAdvice: sanitizeGeneralAdvice(parsed.data.generalAdvice, fallbackAdvice),
    disclaimer: EDUCATIONAL_DISCLAIMER,
  };
}

export function buildUncertaintyFallback() {
  return buildBaseResponse({
    provider: 'fallback',
    model: 'deterministic-medication-education-v1',
    medications: [],
    generalAdvice: UNCERTAINTY_ADVICE,
  });
}

export function buildSafetyGateFallback(reason) {
  if (reason === 'underage') {
    return buildBaseResponse({
      provider: 'policy',
      model: 'safety-policy-v1',
      medications: [],
      generalAdvice: MINOR_ADVICE,
    });
  }

  return buildBaseResponse({
    provider: 'policy',
    model: 'safety-policy-v1',
    medications: [],
    generalAdvice: RED_FLAG_ADVICE,
  });
}

export function buildDeterministicMedicationEducation(disease) {
  const matchedRule = getFallbackRule(disease);
  const fallbackMedications = fallbackMedication(disease);

  return buildBaseResponse({
    provider: 'fallback',
    model: 'deterministic-medication-education-v1',
    medications: fallbackMedications,
    generalAdvice: matchedRule?.generalAdvice || UNCERTAINTY_ADVICE,
  });
}

export function fallbackMedication(disease) {
  const matchedRule = getFallbackRule(disease);
  const medicationKeys = matchedRule?.medicationKeys?.length ? matchedRule.medicationKeys : ['acetaminophen'];

  return medicationKeys
    .map((key) => {
      const medication = medicationCatalog[key];

      if (!medication) {
        return null;
      }

      return {
        name: medication.name,
        category: medication.category,
        usage: medication.usage,
        dosage: medication.dosage,
        notes: medication.notes,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildMedicationEducationPrompt({ disease, patient }) {
  return {
    systemPrompt:
      'You are a clinical information assistant inside a secure health informatics system. Return educational, non-prescriptive medication information only. Never prescribe, diagnose, or personalize treatment.',
    userPrompt: `Generate medication education for:
Disease: ${sanitizeFreeText(disease, { maxLength: 160 })}
Patient age: ${patient.age}
Patient sex: ${sanitizeFreeText(patient.sex, { maxLength: 40 })}

Strict safety rules:
1) Do not provide prescriptions or personalized medical advice.
2) Include only commonly used, broadly safe educational options.
3) Prefer OTC and first-line low-risk options.
4) Exclude antibiotics, controlled substances, and specialist-only therapies.
5) Dosage must be general adult safe range only, not patient-specific.
6) Use neutral phrasing such as "commonly used" or "may be considered".
7) Do not use directive language.
8) Prefer general symptom-relief medications when disease-specific drugs are not safe.
9) Always attempt to provide at least one safe educational option before returning empty.
10) Return strict JSON only with this shape:
{
  "medications":[
    {"name":"","category":"","usage":"","dosage":"","notes":""}
  ],
  "generalAdvice":"",
  "disclaimer":"${EDUCATIONAL_DISCLAIMER}"
}

Maximum 3 medications. Keep fields concise.`,
  };
}

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

async function generateNvidiaMedicationEducation(payload) {
  if (!config.nvidiaApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'NVIDIA AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildMedicationEducationPrompt(payload);
  const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.nvidiaApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.nvidiaModel,
      max_tokens: 500,
      temperature: 0.2,
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
  const rawResponse = data?.choices?.[0]?.message?.content;

  if (!rawResponse) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'NVIDIA AI provider returned an empty response.');
  }

  return {
    provider: 'nvidia',
    model: config.nvidiaModel,
    rawResponse,
  };
}

async function generateAnthropicMedicationEducation(payload) {
  if (!config.anthropicApiKey) {
    throw new AppError(503, 'AI_PROVIDER_NOT_CONFIGURED', 'Anthropic AI provider is not configured.');
  }

  const { systemPrompt, userPrompt } = buildMedicationEducationPrompt(payload);
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 500,
      temperature: 0.2,
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
  const rawResponse = (data?.content || [])
    .filter((entry) => entry.type === 'text')
    .map((entry) => entry.text)
    .join('\n')
    .trim();

  if (!rawResponse) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'Anthropic AI provider returned an empty response.');
  }

  return {
    provider: 'anthropic',
    model: config.anthropicModel,
    rawResponse,
  };
}

async function generateAiMedicationEducation(payload) {
  const providerName =
    config.aiProvider === 'nvidia' || config.aiProvider === 'anthropic'
      ? config.aiProvider
      : 'fallback';

  if (providerName === 'fallback') {
    return buildDeterministicMedicationEducation(payload.disease);
  }

  try {
    const providerResponse =
      providerName === 'nvidia'
        ? await generateNvidiaMedicationEducation(payload)
        : await generateAnthropicMedicationEducation(payload);
    const parsedJson = parseMedicationEducationJson(providerResponse.rawResponse);
    const fallbackRule = getFallbackRule(payload.disease);
    const normalizedResponse = normalizeMedicationEducationPayload(
      parsedJson,
      fallbackRule?.generalAdvice || UNCERTAINTY_ADVICE
    );

    if (!normalizedResponse.medications.length) {
      return {
        provider: providerResponse.provider,
        model: providerResponse.model,
        medications: fallbackMedication(payload.disease),
        generalAdvice: normalizedResponse.generalAdvice,
        disclaimer: EDUCATIONAL_DISCLAIMER,
      };
    }

    return {
      provider: providerResponse.provider,
      model: providerResponse.model,
      ...normalizedResponse,
    };
  } catch (error) {
    logger.warn('Medication education AI provider failed. Falling back to deterministic guidance.', {
      provider: providerName,
      message: error.message,
    });

    return buildDeterministicMedicationEducation(payload.disease);
  }
}

function buildMedicationEducationCacheKey(payload) {
  return createCacheKey({
    type: 'medication-education-v2',
    disease: payload.disease,
    patient: payload.patient,
    redFlags: payload.redFlags,
  });
}

function withResponseMetadata(payload, { cached }) {
  return {
    ...payload,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    cached,
  };
}

export async function generateMedicationEducation(payload) {
  if (Number(payload.patient?.age) < 18) {
    return withResponseMetadata(buildSafetyGateFallback('underage'), { cached: false });
  }

  if ((payload.redFlags || []).length > 0) {
    return withResponseMetadata(buildSafetyGateFallback('red_flags'), { cached: false });
  }

  const cacheKey = buildMedicationEducationCacheKey(payload);
  const cachedResponse = aiCache.get(cacheKey);

  if (cachedResponse) {
    return withResponseMetadata(cachedResponse, { cached: true });
  }

  const generatedResponse = await generateAiMedicationEducation(payload);
  const finalResponse = withResponseMetadata(generatedResponse, { cached: false });
  aiCache.set(cacheKey, finalResponse);

  return finalResponse;
}
