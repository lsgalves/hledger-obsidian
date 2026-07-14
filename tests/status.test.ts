import { describe, expect, it } from 'vitest';
import {
	nextStatus,
	rewriteStatus,
	statusMarker,
	transactionSignature,
} from '../src/status';
import type { Transaction } from '../src/types';

function txn(
	date: Date,
	description: string,
	accounts: string[],
	status: Transaction['status'] = 'unmarked',
): Transaction {
	return {
		date,
		description,
		status,
		postings: accounts.map((account) => ({
			account,
			parts: account.split(':'),
			commodity: 'BRL',
			amount: 0,
		})),
	};
}

describe('nextStatus', () => {
	it('cycles unmarked → pending → cleared → unmarked', () => {
		expect(nextStatus('unmarked')).toBe('pending');
		expect(nextStatus('pending')).toBe('cleared');
		expect(nextStatus('cleared')).toBe('unmarked');
	});
});

describe('statusMarker', () => {
	it('maps statuses to hledger markers', () => {
		expect(statusMarker('cleared')).toBe('*');
		expect(statusMarker('pending')).toBe('!');
		expect(statusMarker('unmarked')).toBe('');
	});
});

const FILE = [
	'2026-06-01 Coffee',
	'    expenses:food  R$12,00',
	'    assets:cash',
	'',
	'2026-06-02 * Rent',
	'    expenses:rent  R$1500,00',
	'    assets:bank',
	'',
].join('\n');

describe('rewriteStatus', () => {
	it('adds a marker to an unmarked transaction', () => {
		const sig = transactionSignature(
			txn(new Date(2026, 5, 1), 'Coffee', ['expenses:food', 'assets:cash']),
		);
		const r = rewriteStatus(FILE, sig, 'cleared');
		expect(r.changed).toBe(true);
		expect(r.content).toContain('2026-06-01 * Coffee');
		// untouched transaction stays the same
		expect(r.content).toContain('2026-06-02 * Rent');
	});

	it('removes a marker when set to unmarked', () => {
		const sig = transactionSignature(
			txn(new Date(2026, 5, 2), 'Rent', ['expenses:rent', 'assets:bank'], 'cleared'),
		);
		const r = rewriteStatus(FILE, sig, 'unmarked');
		expect(r.changed).toBe(true);
		expect(r.content).toContain('2026-06-02 Rent');
		expect(r.content).not.toContain('2026-06-02 * Rent');
	});

	it('reports no change when nothing matches', () => {
		const sig = transactionSignature(
			txn(new Date(2026, 5, 9), 'Nope', ['expenses:x', 'assets:y']),
		);
		const r = rewriteStatus(FILE, sig, 'pending');
		expect(r.changed).toBe(false);
		expect(r.ambiguous).toBe(false);
	});

	it('refuses to guess between duplicate transactions', () => {
		const dup = [FILE, '2026-06-01 Coffee', '    expenses:food  R$12,00', '    assets:cash', ''].join(
			'\n',
		);
		const sig = transactionSignature(
			txn(new Date(2026, 5, 1), 'Coffee', ['expenses:food', 'assets:cash']),
		);
		const r = rewriteStatus(dup, sig, 'cleared');
		expect(r.changed).toBe(false);
		expect(r.ambiguous).toBe(true);
	});
});
