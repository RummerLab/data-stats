import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('model fit checks follow the catch model', async ({ page }) => {
	await page.goto('/drivers');
	const summary = page.getByText('How well does the model describe the catches?', { exact: true });
	// The synthetic fixture has too few complete sets to fit the model, so there is nothing to check.
	if (!(await page.getByRole('heading', { name: 'Sea temperature, step by step' }).count())) {
		await expect(summary).toHaveCount(0);
		return;
	}
	await summary.click();
	const model = page.getByRole('combobox', { name: 'Model', exact: true });
	await expect(model).toBeVisible();
	for (const theme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme: theme });
		const result = await new AxeBuilder({ page }).include('main').analyze();
		expect(
			result.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
		).toEqual([]);
	}
	for (const i of ['1', '2']) {
		await model.selectOption(i);
		await expect(page.locator('#model-fit figure').first()).toBeVisible();
	}
});
