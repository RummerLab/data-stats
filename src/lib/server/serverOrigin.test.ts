import { describe, expect, it } from 'vitest';
import { resolveForwarding } from '../../../scripts/serverOrigin.mjs';

describe('server origin handling', () => {
	it('fills in http for direct plain-HTTP requests', () => {
		const f = resolveForwarding({});
		const headers: Record<string, string> = {};
		f.apply(headers, false);
		expect(headers['x-forwarded-proto']).toBe('http');
	});

	it('keeps a proxy-provided protocol', () => {
		const f = resolveForwarding({});
		const headers: Record<string, string> = { 'x-forwarded-proto': 'https' };
		f.apply(headers, false);
		expect(headers['x-forwarded-proto']).toBe('https');
	});

	it('pins protocol and host from ORIGIN', () => {
		const f = resolveForwarding({ ORIGIN: 'https://data.physioshark.org' });
		const headers: Record<string, string> = {};
		f.apply(headers, false);
		expect(headers['x-forwarded-proto']).toBe('https');
		expect(headers['x-physioshark-host']).toBe('data.physioshark.org');
	});
});
