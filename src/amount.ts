/**
 * Parse an hledger amount number string into a JS number.
 *
 * hledger does not normalize digit-group/decimal separators, so the string may be
 * "7700.00" (plain), "240,50" (comma decimal), "1,234.56" (US), or "1.234,56" (EU).
 * `sign` is the separate sign token emitted by hledger-parser ('-' | '+' | undefined).
 *
 * Heuristic:
 * - both ',' and '.' present → the rightmost is the decimal separator.
 * - only ',' → decimal unless it appears multiple times or is followed by exactly 3 digits.
 * - only '.' → decimal unless it appears multiple times (then it is a thousands separator).
 */
export function parseAmount(numberStr: string, sign?: string): number {
	const negative = sign === '-';
	let s = numberStr.replace(/\s/g, '');
	const hasComma = s.includes(',');
	const hasDot = s.includes('.');

	if (hasComma && hasDot) {
		const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
		const thousandsSep = decimalSep === ',' ? '.' : ',';
		s = s.split(thousandsSep).join('');
		s = s.replace(decimalSep, '.');
	} else if (hasComma) {
		const parts = s.split(',');
		const last = parts[parts.length - 1] ?? '';
		if (parts.length > 2 || (parts.length === 2 && last.length === 3)) {
			s = parts.join(''); // thousands separator
		} else {
			s = parts.join('.'); // decimal comma
		}
	} else if (hasDot) {
		const parts = s.split('.');
		if (parts.length > 2) {
			s = parts.join(''); // multiple dots → thousands
		}
		// single dot → decimal, leave as-is
	}

	const n = Number(s);
	const value = Number.isFinite(n) ? n : 0;
	return negative ? -value : value;
}
