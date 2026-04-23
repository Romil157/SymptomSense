import { expect, test } from '@playwright/test';

async function authenticateClinician(page) {
  await page.goto('/');

  await page.getByLabel('Email').fill('clinician@symptomsense.local');
  await page.getByLabel('Password').fill('StrongPassword123!');
  await page.getByRole('button', { name: /start secure session/i }).click();
  await page.getByRole('button', { name: /i understand and accept/i }).click();
}

test('clinician can authenticate and run a symptom analysis flow', async ({ page }) => {
  await authenticateClinician(page);

  await page.getByLabel('Age', { exact: true }).fill('34');
  await page.getByLabel('Biological Sex').selectOption('male');
  await page.getByRole('button', { name: /continue to symptom selection/i }).click();

  await page.getByPlaceholder(/search symptoms/i).fill('dizziness');
  await page.getByRole('button', { name: /dizziness/i }).first().click();

  await page.getByPlaceholder(/search symptoms/i).fill('insomnia');
  await page.getByRole('button', { name: /insomnia/i }).first().click();

  await page.getByRole('button', { name: /analyze symptoms/i }).click();

  await expect(page.getByText('Ranked Conditions and Evidence')).toBeVisible();
  await expect(page.getByText('AI Clinical Communication Layer')).toBeVisible();
  await expect(page.getByText('Medication Education (General Information)')).toBeVisible();
  await expect(page.getByText('General adult range:')).toBeVisible();
  await expect(
    page.getByText('This information is for educational purposes only and does not constitute medical advice.')
  ).toBeVisible();
});

test('clinician can add a medication schedule and receive an in-app backend reminder without browser notifications', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let notificationCalls = 0;

    class NotificationStub {
      constructor() {
        notificationCalls += 1;
      }

      static requestPermission() {
        notificationCalls += 1;
        return Promise.resolve('granted');
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: NotificationStub,
    });

    Object.defineProperty(window, '__getNotificationCallCount', {
      configurable: true,
      value: () => notificationCalls,
    });
  });

  await authenticateClinician(page);

  const medicationName = `Paracetamol ${Date.now()}`;
  const currentTime = await page.evaluate(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  await page.getByLabel('Medication Name').fill(medicationName);
  await page.getByLabel('Dosage').fill('500mg');
  await page.getByLabel('Reminder time 1').fill(currentTime);
  await page.getByRole('button', { name: /save medication schedule/i }).click();

  await expect(page.getByText(medicationName)).toBeVisible();

  await page.getByRole('button', { name: /check reminders now/i }).click();

  await expect(page.getByText('Medication Reminder', { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`Time to take 500mg ${medicationName}`))).toBeVisible();
  await expect(page.evaluate(() => window.__getNotificationCallCount())).resolves.toBe(0);
});
