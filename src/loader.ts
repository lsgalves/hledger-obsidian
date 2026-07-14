export type ReadFile = (path: string) => Promise<string>;

export interface LoadResult {
	source: string;
	missingIncludes: string[];
	files: string[]; // every file successfully read, entry first, includes in order
}

const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;

/** True for a filesystem path outside the vault: POSIX-absolute, Windows drive, or ~/. */
export function isExternalPath(path: string): boolean {
	return path.startsWith('/') || path.startsWith('~/') || WINDOWS_DRIVE_RE.test(path);
}

/** Resolve a (possibly relative) include path against the including file, POSIX-style. */
export function resolveIncludePath(fromFile: string, includePath: string): string {
	if (isExternalPath(includePath)) {
		// Filesystem-absolute when the journal lives outside the vault,
		// vault-root-relative when it lives inside.
		return isExternalPath(fromFile) ? includePath : includePath.replace(/^\/+/, '');
	}
	const dir = fromFile.includes('/')
		? fromFile.slice(0, fromFile.lastIndexOf('/'))
		: '';
	const root = fromFile.startsWith('/') ? '/' : '';
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
	return root + out.join('/');
}

const INCLUDE_RE = /^\s*!?include\s+(.+?)\s*$/;

/** Read `entryPath` and inline all `include` directives recursively into one string. */
export async function loadJournal(
	entryPath: string,
	read: ReadFile,
): Promise<LoadResult> {
	const missingIncludes: string[] = [];
	const files: string[] = [];
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
		files.push(path);
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
	return { source, missingIncludes, files };
}
