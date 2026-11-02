import { describe, expect, it } from 'vitest';
import { manifestChanges, releaseNeeded } from '../../../scripts/nightlyRelease.mjs';

describe('nightly release rules', () => {
	const base = {
		name: 'x',
		dependencies: { a: '^1.0.0' },
		devDependencies: { vitest: '^5.0.0', svelte: '^5.0.0' }
	};

	it('skips a release for tooling-only updates', () => {
		const after = { ...base, devDependencies: { ...base.devDependencies, vitest: '^5.1.0' } };
		expect(releaseNeeded(base, after)).toBe(false);
	});

	it('releases when a bundled devDependency or runtime dependency moves', () => {
		expect(
			releaseNeeded(base, {
				...base,
				devDependencies: { ...base.devDependencies, svelte: '^5.1.0' }
			})
		).toBe(true);
		expect(releaseNeeded(base, { ...base, dependencies: { a: '^1.1.0' } })).toBe(true);
	});

	it('lists every change', () => {
		expect(manifestChanges(base, { ...base, dependencies: { a: '^1.1.0' } })).toHaveLength(1);
	});
});
