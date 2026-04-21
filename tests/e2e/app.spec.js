import { expect, test } from '@playwright/test';

test('clinician can authenticate and run a symptom analysis flow', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Email').fill('clinician@symptomsense.local');
  await page.getByLabel('Password').fill('StrongPassword123!');
  await page.getByRole('button', { name: /start secure session/i }).click();

  await page.getByRole('button', { name: /i understand and accept/i }).click();

  await page.getByLabel('Age').fill('34');
  await page.getByLabel('Biological Sex').selectOption('male');
  await page.getByRole('button', { name: /continue to symptom selection/i }).click();

  await page.getByPlaceholder(/search symptoms/i).fill('dizziness');
  await page.getByRole('button', { name: /dizziness/i }).first().click();

  await page.getByPlaceholder(/search symptoms/i).fill('insomnia');
  await page.getByRole('button', { name: /insomnia/i }).first().click();

  await page.getByRole('button', { name: /analyze symptoms/i }).click();

  await expect(page.getByText('Ranked Conditions and Evidence')).toBeVisible();
  await expect(page.getByText('AI Clinical Communication Layer')).toBeVisible();
});
