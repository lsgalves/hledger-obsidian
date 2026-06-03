/**
 * Return `color` with the given alpha (0–1), handling the formats Obsidian theme
 * variables actually produce: hex (`#rgb`/`#rrggbb`), `rgb()/rgba()`, and `hsl()/hsla()`.
 *
 * String concatenation like `color + '33'` only works for hex; `--interactive-accent`
 * commonly resolves to `hsl(...)`, where concatenation yields an invalid color that
 * canvas silently renders as opaque black. This converts safely instead.
 */
export function withAlpha(color: string, alpha: number): string {
	const c = color.trim();

	if (c.startsWith('#')) {
		let hex = c.slice(1);
		if (hex.length === 3 || hex.length === 4) {
			hex = hex
				.split('')
				.map((ch) => ch + ch)
				.join('');
		}
		const r = Number.parseInt(hex.slice(0, 2), 16);
		const g = Number.parseInt(hex.slice(2, 4), 16);
		const b = Number.parseInt(hex.slice(4, 6), 16);
		if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
			return `rgba(${r}, ${g}, ${b}, ${alpha})`;
		}
		return c;
	}

	const rgb = c.match(/^rgba?\(([^)]+)\)$/i);
	if (rgb && rgb[1] !== undefined) {
		const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length >= 3) {
			return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
		}
	}

	const hsl = c.match(/^hsla?\(([^)]+)\)$/i);
	if (hsl && hsl[1] !== undefined) {
		const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length >= 3) {
			return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
		}
	}

	return c;
}
