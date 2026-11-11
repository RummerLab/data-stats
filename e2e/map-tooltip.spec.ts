import { expect, test } from '@playwright/test';

test('map tooltips display workbook labels as text', async ({ page }) => {
	const label = '<b data-tooltip-markup>Haapiti</b>';
	await page.route('**/nurseries/__data.json*', async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replaceAll('"Haapiti"', JSON.stringify(label));
		await route.fulfill({ response, body });
	});
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	await page.goto('/');
	await page
		.locator('a[href="/nurseries"]')
		.first()
		.evaluate((a: HTMLAnchorElement) => a.click());
	const points = page.locator('.leaflet-interactive.ps-layer-0');
	await expect(points.first()).toBeVisible();
	let found = false;
	for (const point of await points.all()) {
		await point.dispatchEvent('mouseover');
		const tip = page.locator('.leaflet-tooltip');
		if ((await tip.textContent())?.includes('Haapiti')) {
			await expect(tip).toHaveText(label);
			await expect(tip.locator('[data-tooltip-markup]')).toHaveCount(0);
			found = true;
			break;
		}
		await point.dispatchEvent('mouseout');
	}
	expect(found).toBe(true);
});
