// @ts-check
import { expect, test } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('should match GitHub login page screenshot @chromium', async ({ page }) => {
    await page.goto('https://github.com/login');
    await expect(page).toHaveScreenshot('github-login-initial.png');
    await page.getByRole('textbox', { name: 'Username or email address' }).click();
    await page.getByRole('textbox', { name: 'Username or email address' }).fill('test');
    await expect(page).toHaveScreenshot('github-login-filled.png');
  });
});
