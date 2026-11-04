import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('scar transitions remain readable on mobile in both themes', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	for (const theme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme: theme });
		await page.goto('/neonates');
		await expect(
			page.getByRole('heading', { name: 'Scar changes in the same shark' })
		).toBeVisible();
		const card = page
			.locator('figure')
			.filter({ has: page.getByRole('heading', { name: 'Observed scar transitions' }) })
			.first();
		await expect(card).toBeVisible();
		await card.locator('svg').focus();
		await page.keyboard.press('ArrowRight');
		await expect(card.locator('.tip')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(card.getByRole('button', { name: /Download CSV/ })).toBeVisible();
		const result = await new AxeBuilder({ page }).include('main').analyze();
		expect(
			result.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
		).toEqual([]);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
		).toBeLessThanOrEqual(1);
	}
});
