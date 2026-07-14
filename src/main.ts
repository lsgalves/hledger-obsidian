import { Notice, Platform, Plugin, TFile, type WorkspaceLeaf } from 'obsidian';
import { isExternalPath, loadJournal } from './loader';
import { JournalIO, expandHome, nodeFsModule } from './journal-fs';
import { buildModel } from './model';
import {
	DEFAULT_SETTINGS,
	type HledgerSettings,
	HledgerSettingTab,
} from './settings';
import { HledgerView, VIEW_TYPE_HLEDGER } from './view';
import { registerHledgerCodeBlock } from './codeblock';
import { rewriteStatus, transactionSignature } from './status';
import type { Journal, Transaction, TxnStatus } from './types';

// Type-only: erased at compile time, safe on mobile.
type FSWatcher = ReturnType<(typeof import('node:fs'))['watch']>;

type LoadResult =
	| { error: 'no-path' | 'missing-file' | 'mobile-external'; path?: string }
	| { journal: Journal; missingIncludes: string[]; path: string };

export default class HledgerPlugin extends Plugin {
	settings!: HledgerSettings;
	private io!: JournalIO;
	private externalWatchers = new Map<string, FSWatcher>();
	private refreshTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.io = new JournalIO(this.app.vault.adapter);

		this.registerView(
			VIEW_TYPE_HLEDGER,
			(leaf: WorkspaceLeaf) => new HledgerView(leaf, this),
		);

		this.addRibbonIcon('wallet', 'Open hledger dashboard', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-dashboard',
			name: 'Open dashboard',
			callback: () => {
				void this.activateView();
			},
		});

		this.addSettingTab(new HledgerSettingTab(this.app, this));

		registerHledgerCodeBlock(this);

		// Refresh open dashboards when any journal/ledger file changes.
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (
					file instanceof TFile &&
					(file.extension === 'journal' || file.extension === 'ledger')
				) {
					this.refreshViews();
				}
			}),
		);
	}

	onunload(): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		for (const watcher of this.externalWatchers.values()) watcher.close();
		this.externalWatchers.clear();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<HledgerSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	/** External (outside-vault) paths need Node's fs, which mobile does not have. */
	private externalBlocked(path: string): boolean {
		return isExternalPath(path) && !Platform.isDesktop;
	}

	/** Read the configured journal, resolve includes, and build the domain model. */
	async loadModel(): Promise<LoadResult> {
		const path = this.settings.journalPath;
		if (!path) return { error: 'no-path' };
		if (this.externalBlocked(path)) return { error: 'mobile-external', path };
		const exists = await this.io.exists(path);
		if (!exists) return { error: 'missing-file', path };
		let loaded: Awaited<ReturnType<typeof loadJournal>>;
		try {
			loaded = await loadJournal(path, (p) => this.io.read(p));
		} catch (err) {
			new Notice(`Hledger: failed to read journal — ${String(err)}`);
			return { error: 'missing-file', path };
		}
		this.watchExternalFiles(loaded.files.filter(isExternalPath));
		// buildModel never throws; parse problems surface via journal.errors.
		return {
			journal: buildModel(loaded.source),
			missingIncludes: loaded.missingIncludes,
			path,
		};
	}

	/** Append a transaction block to the configured journal file and refresh open views. */
	async appendEntry(entry: string): Promise<void> {
		const path = this.settings.journalPath;
		if (!path) {
			new Notice('Hledger: no journal file configured.');
			return;
		}
		if (this.externalBlocked(path)) {
			new Notice('Hledger: journal files outside the vault are desktop-only.');
			return;
		}
		const exists = await this.io.exists(path);
		if (!exists) {
			new Notice(`Hledger: journal file not found — ${path}`);
			return;
		}
		try {
			const content = await this.io.read(path);
			const base = content.replace(/\s*$/, '');
			const next = base.length === 0 ? entry : `${base}\n\n${entry}`;
			await this.io.write(path, next);
			new Notice('Hledger: entry added.');
			this.refreshViews();
		} catch (err) {
			new Notice(`Hledger: failed to write entry — ${String(err)}`);
		}
	}

	/**
	 * Toggle a transaction's cleared/pending/unmarked marker in whichever journal file
	 * (main or include) contains it, then refresh open views. Aborts safely when the
	 * transaction can't be located unambiguously.
	 */
	async setTransactionStatus(txn: Transaction, next: TxnStatus): Promise<void> {
		const path = this.settings.journalPath;
		if (!path) {
			new Notice('Hledger: no journal file configured.');
			return;
		}
		if (this.externalBlocked(path)) {
			new Notice('Hledger: journal files outside the vault are desktop-only.');
			return;
		}
		const signature = transactionSignature(txn);
		try {
			const { files } = await loadJournal(path, (p) => this.io.read(p));
			for (const file of files) {
				const content = await this.io.read(file);
				const result = rewriteStatus(content, signature, next);
				if (result.ambiguous) {
					new Notice('Hledger: duplicate transaction — edit the status by hand.');
					return;
				}
				if (result.changed) {
					await this.io.write(file, result.content);
					this.refreshViews();
					return;
				}
			}
			new Notice('Hledger: could not locate that transaction.');
		} catch (err) {
			new Notice(`Hledger: failed to update status — ${String(err)}`);
		}
	}

	/**
	 * Watch journal files that live outside the vault (the vault 'modify' event does not
	 * cover them) and refresh open dashboards when they change on disk.
	 */
	private watchExternalFiles(paths: string[]): void {
		if (!Platform.isDesktop) return;
		if (paths.length === 0 && this.externalWatchers.size === 0) return;
		const fs = nodeFsModule();
		const wanted = new Set(paths);
		for (const [path, watcher] of this.externalWatchers) {
			if (!wanted.has(path)) {
				watcher.close();
				this.externalWatchers.delete(path);
			}
		}
		for (const path of wanted) {
			if (this.externalWatchers.has(path)) continue;
			try {
				const watcher = fs.watch(expandHome(path), (event) => {
					if (event === 'rename') {
						// Editors that save via rename invalidate the watcher;
						// the refresh below re-establishes it.
						watcher.close();
						this.externalWatchers.delete(path);
					}
					this.scheduleRefresh();
				});
				this.externalWatchers.set(path, watcher);
			} catch {
				// File may have vanished; the next successful load retries.
			}
		}
	}

	/** Debounced refresh — editors often fire several change events per save. */
	private scheduleRefresh(): void {
		if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refreshViews();
		}, 300);
	}

	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HLEDGER)) {
			const view = leaf.view;
			if (view instanceof HledgerView) void view.refresh();
		}
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_HLEDGER);
		if (existing.length > 0 && existing[0]) {
			await workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_HLEDGER, active: true });
		await workspace.revealLeaf(leaf);
	}
}
