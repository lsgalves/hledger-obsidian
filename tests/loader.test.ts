import { describe, expect, it } from 'vitest';
import { loadJournal, resolveIncludePath } from '../src/loader';

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
