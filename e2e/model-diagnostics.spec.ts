import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('model diagnostics expose accessible fit checks and species selection', async ({ page }) => {
	await page.goto('/drivers');
	await page.getByText('How well does the model describe the catches?', { exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toBeVisible();
	for (const theme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme: theme });
		const result = await new AxeBuilder({ page }).include('main').analyze();
		expect(
			result.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
		).toEqual([]);
	}
	await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('1');
	await expect(
		page.getByText(
			'Diagnostics are unavailable: the model needs a converged fit and a supported sample.'
		)
	).toBeVisible();
});
