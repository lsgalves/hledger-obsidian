import { describe, expect, it } from 'vitest';
import { buildLedgerCsv, csvField } from '../src/csv';

describe('csvField', () => {
	it('quotes fields containing comma, quote, or newline', () => {
		expect(csvField('plain')).toBe('plain');
		expect(csvField('a,b')).toBe('"a,b"');
		expect(csvField('he said "hi"')).toBe('"he said ""hi"""');
		expect(csvField('line1\nline2')).toBe('"line1\nline2"');
	});
});

describe('buildLedgerCsv', () => {
	it('builds a header plus one escaped line per row', () => {
		const csv = buildLedgerCsv([
			{
				date: new Date(2026, 0, 5),
				description: 'Rent, monthly',
				category: 'expenses:housing',
				amount: -1700,
			},
		]);
		expect(csv).toBe(
			'Date,Description,Category,Amount\n05/01/2026,"Rent, monthly",expenses:housing,-1700',
		);
	});
});
