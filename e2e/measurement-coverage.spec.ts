import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('coverage heatmaps fit a phone and pass axe in both themes', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await page.goto('/data-quality');
	await expect(
		page.getByRole('heading', { name: 'What was recorded, season by season', exact: true })
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
	// The notes table is wider than a phone: it scrolls and takes keyboard focus (#150).
	const notes = page.getByRole('region', { name: 'Data notes' });
	await notes.focus();
	await expect(notes).toBeFocused();
});

test('the catch model shows which sets it uses', async ({ page }) => {
	await page.goto('/drivers');
	await page.getByText('Which sets does the model use?', { exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Sets left after each filter' })).toBeVisible();
});
