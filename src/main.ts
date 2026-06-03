import { Notice, Plugin, TFile, type WorkspaceLeaf } from 'obsidian';
import { loadJournal } from './loader';
import { buildModel } from './model';
import {
	DEFAULT_SETTINGS,
	type HledgerSettings,
	HledgerSettingTab,
} from './settings';
import { HledgerView, VIEW_TYPE_HLEDGER } from './view';
import type { Journal } from './types';

type LoadResult =
	| { error: 'no-path' | 'missing-file'; path?: string }
	| { journal: Journal; missingIncludes: string[]; path: string };

export default class HledgerPlugin extends Plugin {
	settings!: HledgerSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

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

	onunload(): void {}

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

	/** Read the configured journal, resolve includes, and build the domain model. */
	async loadModel(): Promise<LoadResult> {
		const path = this.settings.journalPath;
		if (!path) return { error: 'no-path' };
		const exists = await this.app.vault.adapter.exists(path);
		if (!exists) return { error: 'missing-file', path };
		try {
			const { source, missingIncludes } = await loadJournal(path, (p) =>
				this.app.vault.adapter.read(p),
			);
			return { journal: buildModel(source), missingIncludes, path };
		} catch (err) {
			new Notice(`Hledger: failed to read journal — ${String(err)}`);
			return { error: 'missing-file', path };
		}
	}

	/** Append a transaction block to the configured journal file and refresh open views. */
	async appendEntry(entry: string): Promise<void> {
		const path = this.settings.journalPath;
		if (!path) {
			new Notice('Hledger: no journal file configured.');
			return;
		}
		const exists = await this.app.vault.adapter.exists(path);
		if (!exists) {
			new Notice(`Hledger: journal file not found — ${path}`);
			return;
		}
		try {
			const content = await this.app.vault.adapter.read(path);
			const base = content.replace(/\s*$/, '');
			const next = base.length === 0 ? entry : `${base}\n\n${entry}`;
			await this.app.vault.adapter.write(path, next);
			new Notice('Hledger: entry added.');
			this.refreshViews();
		} catch (err) {
			new Notice(`Hledger: failed to write entry — ${String(err)}`);
		}
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
