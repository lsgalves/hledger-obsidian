import { Platform } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { isExternalPath } from './loader';

type NodeFs = typeof import('node:fs');
type NodeFsPromises = typeof import('node:fs/promises');
type NodeOs = typeof import('node:os');

/**
 * Node's require as Obsidian's desktop (Electron) runtime exposes it on window.
 * Reached lazily so the plugin still loads on mobile, where Node is absent; a
 * dynamic import('node:*') is not an option because the renderer cannot resolve
 * the node: URL scheme at runtime.
 */
function desktopRequire(): (id: string) => unknown {
	const req = (window as Window & { require?: (id: string) => unknown }).require;
	if (!Platform.isDesktop || !req) {
		throw new Error('journal files outside the vault are desktop-only');
	}
	return req;
}

function nodeFs(): NodeFsPromises {
	return desktopRequire()('node:fs/promises') as NodeFsPromises;
}

/** Node's fs module (for fs.watch), desktop only. */
export function nodeFsModule(): NodeFs {
	return desktopRequire()('node:fs') as NodeFs;
}

/** Expand a leading ~/ to the user's home directory (desktop only). */
export function expandHome(path: string): string {
	if (!path.startsWith('~/')) return path;
	const os = desktopRequire()('node:os') as NodeOs;
	return os.homedir().replace(/\\/g, '/') + path.slice(1);
}

/** Canonicalize a user-typed external path: forward slashes, no trailing slash. */
export function normalizeExternalPath(path: string): string {
	const p = path.replace(/\\/g, '/');
	return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/**
 * Reads and writes journal files by path: vault-relative paths go through the vault
 * adapter, external (outside-vault) paths through Node's fs — the latter desktop only.
 */
export class JournalIO {
	constructor(private adapter: DataAdapter) {}

	async exists(path: string): Promise<boolean> {
		if (!isExternalPath(path)) return this.adapter.exists(path);
		const fs = nodeFs();
		try {
			await fs.access(expandHome(path));
			return true;
		} catch {
			return false;
		}
	}

	async read(path: string): Promise<string> {
		if (!isExternalPath(path)) return this.adapter.read(path);
		return nodeFs().readFile(expandHome(path), 'utf8');
	}

	async write(path: string, content: string): Promise<void> {
		if (!isExternalPath(path)) return this.adapter.write(path, content);
		await nodeFs().writeFile(expandHome(path), content, 'utf8');
	}
}
