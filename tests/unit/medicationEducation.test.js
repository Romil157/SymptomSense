import { describe, expect, it } from '@jest/globals';
import {
  buildDeterministicMedicationEducation,
  buildSafetyGateFallback,
  buildUncertaintyFallback,
  generateMedicationEducation,
  normalizeMedicationEducationPayload,
  parseMedicationEducationJson,
} from '../../backend/services/ai/medicationEducationService.js';

describe('medication education service', () => {
  it('parses strict JSON payloads and code-fenced JSON responses', () => {
    const strictJson = parseMedicationEducationJson(
      '{"medications":[],"generalAdvice":"Consult a clinician.","disclaimer":"x"}'
    );
    const fencedJson = parseMedicationEducationJson(
      '```json\n{"medications":[],"generalAdvice":"Consult a clinician.","disclaimer":"x"}\n```'
    );

    expect(strictJson.generalAdvice).toBe('Consult a clinician.');
    expect(fencedJson.generalAdvice).toBe('Consult a clinician.');
  });

  it('enforces allowlist, rejects banned categories, caps count to 3, and normalizes dosage text', () => {
    const normalized = normalizeMedicationEducationPayload(
      {
        medications: [
          {
            name: 'Paracetamol',
            category: 'Analgesic',
            usage: 'Pain support',
            dosage: 'bad dosage',
            notes: 'note',
          },
          {
            name: 'Ibuprofen',
            category: 'NSAID',
            usage: 'Pain support',
            dosage: 'bad dosage',
            notes: 'note',
          },
          {
            name: 'Cetirizine',
            category: 'Antihistamine',
            usage: 'Allergy support',
            dosage: 'bad dosage',
            notes: 'note',
          },
          {
            name: 'Loratadine',
            category: 'Antihistamine',
            usage: 'Allergy support',
            dosage: 'bad dosage',
            notes: 'note',
          },
          {
            name: 'Azithromycin',
            category: 'Antibiotic',
            usage: 'Should be blocked',
            dosage: '500 mg',
            notes: 'blocked',
          },
        ],
        generalAdvice: 'General educational advice.',
        disclaimer: 'anything',
      },
      'Consult a clinician.'
    );

    expect(normalized.medications).toHaveLength(3);
    expect(normalized.medications.map((entry) => entry.name)).toContain('Acetaminophen (Paracetamol)');
    expect(normalized.medications.find((entry) => entry.name === 'Acetaminophen (Paracetamol)')?.dosage).toContain(
      '325-650 mg'
    );
    expect(normalized.medications.some((entry) => /azithromycin/i.test(entry.name))).toBe(false);
  });

  it('returns deterministic education with non-empty fallback for unsupported adult conditions', () => {
    const supported = buildDeterministicMedicationEducation('Tension headache');
    const unsupported = buildDeterministicMedicationEducation('Panic Disorder');
    const uncertainty = buildUncertaintyFallback();

    expect(supported.medications.length).toBeGreaterThan(0);
    expect(unsupported.medications.length).toBeGreaterThan(0);
    expect(unsupported.medications[0].name).toBe('Acetaminophen (Paracetamol)');
    expect(unsupported.generalAdvice).toBe(uncertainty.generalAdvice);
  });

  it('returns cough-oriented OTC options for respiratory conditions', () => {
    const respiratory = buildDeterministicMedicationEducation('Acute bronchitis with dry cough');
    const names = respiratory.medications.map((entry) => entry.name);

    expect(names).toContain('Dextromethorphan');
    expect(names).toContain('Guaifenesin');
  });

  it('applies adult/minor and red-flag safety gates', async () => {
    const minor = await generateMedicationEducation({
      disease: 'Tension headache',
      patient: { age: 16, sex: 'female' },
      redFlags: [],
    });
    const redFlag = await generateMedicationEducation({
      disease: 'Tension headache',
      patient: { age: 34, sex: 'male' },
      redFlags: [{ symptom: 'chest pain', reason: 'urgent concern' }],
    });
    const policyFallback = buildSafetyGateFallback('red_flags');

    expect(minor.provider).toBe('policy');
    expect(minor.medications).toHaveLength(0);
    expect(redFlag.provider).toBe('policy');
    expect(redFlag.medications).toHaveLength(0);
    expect(redFlag.generalAdvice).toBe(policyFallback.generalAdvice);
  });
});
