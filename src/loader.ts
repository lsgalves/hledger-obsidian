export type ReadFile = (path: string) => Promise<string>;

export interface LoadResult {
	source: string;
	missingIncludes: string[];
}

/** Resolve a (possibly relative) include path against the including file, POSIX-style. */
export function resolveIncludePath(fromFile: string, includePath: string): string {
	if (includePath.startsWith('/')) return includePath.replace(/^\/+/, '');
	const dir = fromFile.includes('/')
		? fromFile.slice(0, fromFile.lastIndexOf('/'))
		: '';
	const segments = (dir ? dir.split('/') : []).concat(includePath.split('/'));
	const out: string[] = [];
	for (const seg of segments) {
		if (seg === '' || seg === '.') continue;
		if (seg === '..') {
			out.pop();
			continue;
		}
		out.push(seg);
	}
	return out.join('/');
}

const INCLUDE_RE = /^\s*!?include\s+(.+?)\s*$/;

/** Read `entryPath` and inline all `include` directives recursively into one string. */
export async function loadJournal(
	entryPath: string,
	read: ReadFile,
): Promise<LoadResult> {
	const missingIncludes: string[] = [];
	const visiting = new Set<string>();

	async function inline(path: string): Promise<string> {
		if (visiting.has(path)) return ''; // cycle guard
		visiting.add(path);
		let content: string;
		try {
			content = await read(path);
		} catch {
			missingIncludes.push(path);
			visiting.delete(path);
			return '';
		}
		const out: string[] = [];
		for (const line of content.split('\n')) {
			const m = line.match(INCLUDE_RE);
			if (m && m[1] !== undefined) {
				out.push(await inline(resolveIncludePath(path, m[1].trim())));
			} else {
				out.push(line);
			}
		}
		visiting.delete(path);
		return out.join('\n');
	}

	const source = await inline(entryPath);
	return { source, missingIncludes };
}
