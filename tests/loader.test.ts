import { describe, expect, it } from 'vitest';
import { isExternalPath, loadJournal, resolveIncludePath } from '../src/loader';

function makeReader(files: Record<string, string>) {
	return (path: string): Promise<string> => {
		const content = files[path];
		if (content === undefined) return Promise.reject(new Error(`ENOENT: ${path}`));
		return Promise.resolve(content);
	};
}

describe('resolveIncludePath', () => {
	it('resolves a sibling include', () => {
		expect(resolveIncludePath('finance/main.journal', '2026.journal')).toBe(
			'finance/2026.journal',
		);
	});

	it('resolves a parent-relative include', () => {
		expect(resolveIncludePath('finance/a/main.journal', '../shared.journal')).toBe(
			'finance/shared.journal',
		);
	});

	it('keeps includes of an external journal absolute', () => {
		expect(resolveIncludePath('/home/me/finance/main.journal', '2026.journal')).toBe(
			'/home/me/finance/2026.journal',
		);
		expect(
			resolveIncludePath('/home/me/finance/a/main.journal', '../shared.journal'),
		).toBe('/home/me/finance/shared.journal');
	});

	it('resolves includes of a Windows-drive journal', () => {
		expect(resolveIncludePath('C:/ledger/main.journal', '2026.journal')).toBe(
			'C:/ledger/2026.journal',
		);
	});

	it('treats an absolute include as vault-root-relative inside the vault', () => {
		expect(resolveIncludePath('finance/main.journal', '/shared/x.journal')).toBe(
			'shared/x.journal',
		);
	});

	it('keeps an absolute include absolute outside the vault', () => {
		expect(resolveIncludePath('/home/me/main.journal', '/data/x.journal')).toBe(
			'/data/x.journal',
		);
	});
});

describe('isExternalPath', () => {
	it('flags absolute, drive, and home paths as external', () => {
		expect(isExternalPath('/home/me/x.journal')).toBe(true);
		expect(isExternalPath('C:/ledger/x.journal')).toBe(true);
		expect(isExternalPath('C:\\ledger\\x.journal')).toBe(true);
		expect(isExternalPath('~/x.journal')).toBe(true);
	});

	it('keeps vault-relative paths internal', () => {
		expect(isExternalPath('finance/main.journal')).toBe(false);
		expect(isExternalPath('main.journal')).toBe(false);
	});
});

describe('loadJournal', () => {
	it('inlines include directives in order', async () => {
		const read = makeReader({
			'main.journal': 'line A\ninclude sub.journal\nline C',
			'sub.journal': 'line B',
		});
		const { source, missingIncludes } = await loadJournal('main.journal', read);
		expect(source).toBe('line A\nline B\nline C');
		expect(missingIncludes).toEqual([]);
	});

	it('records missing includes and keeps going', async () => {
		const read = makeReader({ 'main.journal': 'include nope.journal\nline X' });
		const { source, missingIncludes } = await loadJournal('main.journal', read);
		expect(source).toBe('\nline X');
		expect(missingIncludes).toEqual(['nope.journal']);
	});

	it('guards against include cycles', async () => {
		const read = makeReader({
			'a.journal': 'A\ninclude b.journal',
			'b.journal': 'B\ninclude a.journal',
		});
		const { source } = await loadJournal('a.journal', read);
		expect(source).toBe('A\nB\n');
	});
});
