import { expect, test } from '@playwright/test';

test('move lines expose their details to the keyboard after overlay toggles', async ({ page }) => {
	await page.route(/server\.arcgisonline\.com|tile\.openstreetmap\.org/, (route) => route.abort());
	await page.goto('/recaptures');
	const map = page.getByRole('region', {
		name: "Map of recaptured sharks' moves between nurseries"
	});
	const line = map.locator('.ps-line-0[role="button"]').first();
	await expect(line).toBeVisible();
	const label = await line.getAttribute('aria-label');
	await line.focus();
	await expect(map.locator('.leaflet-tooltip').last()).toHaveText(label!);
	await line.press('Enter');
	await expect(map.locator('.leaflet-popup-content')).toContainText(label!);
	await line.press('Escape');
	await expect(map.locator('.leaflet-popup-content')).toHaveCount(0);
	// Re-adding an overlay creates another path element: it must retain the handlers.
	const toggle = map.getByRole('checkbox', { name: /Blacktip.*moves/i });
	await toggle.uncheck();
	await toggle.check();
	await line.focus();
	await line.press('Space');
	await expect(map.locator('.leaflet-popup-content')).toContainText(label!);
});

test('SVG map fallback supports the shared arrow-key chart controls', async ({ page }) => {
	// Keep the hydrated SVG fallback by preventing the lazy Leaflet module from loading.
	await page.route('**/*.js', async (route) => {
		const response = await route.fetch();
		const body = await response.text();
		if (body.includes('Leaflet') && body.includes('1.9.4')) await route.abort();
		else await route.fulfill({ response, body });
	});
	await page.goto('/recaptures');
	const map = page.locator('.chart-card').filter({
		has: page.getByRole('heading', { name: 'Moves between nurseries on the map', exact: true })
	});
	const svg = map.locator('svg[role="application"]');
	await expect(svg).toBeVisible();
	await svg.focus();
	await svg.press('Home');
	await expect(map.locator('.tip')).toContainText('Moves');
	await svg.press('End');
	await expect(map.locator('.tip')).toContainText('Same-nursery recaptures');
	await svg.press('Escape');
	await expect(map.locator('.tip')).toHaveCount(0);
});
