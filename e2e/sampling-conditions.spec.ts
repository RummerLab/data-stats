import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('sampling conditions fit a phone and pass axe in both themes', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await page.goto('/effort');
	await expect(
		page.getByRole('heading', { name: 'Which conditions did fieldwork sample?', exact: true })
	).toBeVisible();
	for (const colorScheme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme });
		const results = await new AxeBuilder({ page }).include('main').analyze();
		expect(
			results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		).toEqual([]);
	}
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
	).toBeLessThanOrEqual(1);
	await expect(page.getByRole('button', { name: /Download CSV/ }).first()).toBeVisible();
});
