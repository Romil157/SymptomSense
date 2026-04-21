import { describe, expect, it } from '@jest/globals';
import { buildDiseaseMap } from '../../backend/domain/scoring/diseaseMap.js';
import {
  getDurationMultiplier,
  runRuleEngine,
} from '../../backend/domain/scoring/scoringEngine.js';

const diseaseEntries = buildDiseaseMap([
  {
    disease: 'Influenza',
    symptoms: ['fever', 'cough', 'fatigue', 'headache'],
  },
  {
    disease: 'Panic Disorder',
    symptoms: ['chest tightness', 'shortness of breath', 'dizziness', 'insomnia'],
  },
  {
    disease: 'Migraine',
    symptoms: ['headache', 'nausea', 'dizziness'],
  },
]);

describe('scoring engine', () => {
  it('scores diseases deterministically and exposes explainability metadata', () => {
    const analysis = runRuleEngine({
      selectedSymptoms: [
        { name: 'fever', displayName: 'Fever', severity: 4, durationDays: 2 },
        { name: 'cough', displayName: 'Cough', severity: 3, durationDays: 2 },
        { name: 'fatigue', displayName: 'Fatigue', severity: 3, durationDays: 4 },
      ],
      diseaseEntries,
    });

    expect(analysis.results[0].disease).toBe('Influenza');
    expect(analysis.results[0].confidence).toBeGreaterThan(0.7);
    expect(analysis.results[0].matchedSymptoms).toHaveLength(3);
    expect(analysis.results[0].matchedSymptoms).toEqual(
      expect.arrayContaining(['Fever', 'Cough', 'Fatigue'])
    );
    expect(analysis.results[0].explainability.topContributors[0].label).toBe('Fever');
    expect(analysis.results[0].explainability.whySuggested).toContain('Matched 3 of 3');
  });

  it('flags red-flag symptoms independently of disease ranking', () => {
    const analysis = runRuleEngine({
      selectedSymptoms: [
        { name: 'chest pain', displayName: 'Chest Pain', severity: 5, durationDays: 0 },
        {
          name: 'shortness of breath',
          displayName: 'Shortness of Breath',
          severity: 4,
          durationDays: 0,
        },
      ],
      diseaseEntries,
    });

    expect(analysis.redFlags).toHaveLength(2);
    expect(analysis.redFlags[0].code).toBe('chest pain');
    expect(analysis.redFlags[1].code).toBe('shortness of breath');
  });

  it('keeps same-day symptoms clinically relevant via non-zero duration weighting', () => {
    expect(getDurationMultiplier(0)).toBeGreaterThan(0);
    expect(getDurationMultiplier(45)).toBeGreaterThan(getDurationMultiplier(1));
  });
});
