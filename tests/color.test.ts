import { describe, expect, it } from 'vitest';
import { withAlpha } from '../src/color';

describe('withAlpha', () => {
	it('converts 6-digit hex to rgba', () => {
		expect(withAlpha('#7852ee', 0.2)).toBe('rgba(120, 82, 238, 0.2)');
	});

	it('expands 3-digit hex', () => {
		expect(withAlpha('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)');
	});

	it('rewrites hsl() to hsla() (the Obsidian accent case)', () => {
		expect(withAlpha('hsl(254, 80%, 68%)', 0.18)).toBe(
			'hsla(254, 80%, 68%, 0.18)',
		);
	});

	it('rewrites rgb() to rgba()', () => {
		expect(withAlpha('rgb(10, 20, 30)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
	});

	it('handles space-separated modern syntax', () => {
		expect(withAlpha('hsl(254 80% 68%)', 0.18)).toBe('hsla(254, 80%, 68%, 0.18)');
	});

	it('returns unknown formats unchanged', () => {
		expect(withAlpha('rebeccapurple', 0.2)).toBe('rebeccapurple');
	});
});
