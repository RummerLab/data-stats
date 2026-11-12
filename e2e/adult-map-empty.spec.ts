import { expect, test } from '@playwright/test';

for (const rejected of [false, true]) {
	test(`adult GPS notices remain visible with no usable points (rejected=${rejected})`, async ({
		page
	}) => {
		await page.route('**/adults/__data.json*', async (route) => {
			const response = await route.fetch();
			const body = await response.json();
			// SvelteKit's flattened data uses array indices as references. Append synthetic
			// values so shared numbers in the original response are not changed in place.
			const node = body.nodes.find(
				(n: { data?: unknown[] } | null) => n?.data?.[0] && 'where' in (n.data[0] as object)
			);
			const data: unknown[] = node.data;
			const root = data[0] as Record<string, number>;
			const where = data[root.where] as Record<string, number>;
			const add = (v: unknown) => data.push(v) - 1;
			root.n = add(3);
			where.points = add([]);
			where.density = add(null);
			where.missing = add(rejected ? 2 : 3);
			const exclusion = add({ label: add('Synthetic adult'), reason: add('on land') });
			where.setAside = add(rejected ? [exclusion] : []);
			await route.fulfill({ response, json: body });
		});
		await page.goto('/');
		await page
			.locator('a[href="/adults"]')
			.first()
			.evaluate((a: HTMLAnchorElement) => a.click());
		await expect(page.getByText('No usable GPS points are available for this map.')).toBeVisible();
		await expect(
			page.getByText(`${rejected ? 2 : 3} captures have no GPS point.`, { exact: false })
		).toBeVisible();
		if (rejected)
			await expect(page.getByText('1 point left out (on land).', { exact: false })).toBeVisible();
	});
}
