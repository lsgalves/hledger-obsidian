import { App, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import type HledgerPlugin from './main';
import { DEFAULT_PREFIXES, prefixesToText, textToPrefixes } from './compute';
import type { AccountPrefixMap, PeriodKey } from './types';

export interface HledgerSettings {
	journalPath: string;
	defaultPeriod: PeriodKey;
	defaultCommodity: string;
	recentTransactionsCount: number;
	accountPrefixes: AccountPrefixMap;
}

export const DEFAULT_SETTINGS: HledgerSettings = {
	journalPath: '',
	defaultPeriod: '12months',
	defaultCommodity: '',
	recentTransactionsCount: 10,
	accountPrefixes: DEFAULT_PREFIXES,
};

export class HledgerSettingTab extends PluginSettingTab {
	plugin: HledgerPlugin;

	constructor(app: App, plugin: HledgerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Journal file path')
			.setDesc(
				'Path to your main hledger file in the vault (.journal or .ledger). Include directives are supported.',
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder('finance/main.journal')
					.setValue(this.plugin.settings.journalPath)
					.onChange(async (value) => {
						this.plugin.settings.journalPath = value.trim()
							? normalizePath(value.trim())
							: '';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Default period').addDropdown((dd) =>
			dd
				.addOptions({
					month: 'Month',
					'12months': '12 months',
					year: 'Year',
					all: 'All',
				})
				.setValue(this.plugin.settings.defaultPeriod)
				.onChange(async (value) => {
					this.plugin.settings.defaultPeriod = value as PeriodKey;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl)
			.setName('Default commodity')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Currency to show by default (e.g. BRL, $, USD). Empty = first found.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.defaultCommodity)
					.onChange(async (value) => {
						this.plugin.settings.defaultCommodity = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Recent transactions')
			.setDesc('How many recent transactions to list.')
			.addText((text) =>
				text
					.setValue(`${this.plugin.settings.recentTransactionsCount}`)
					.onChange(async (value) => {
						const n = Number.parseInt(value, 10);
						this.plugin.settings.recentTransactionsCount =
							Number.isFinite(n) && n > 0 ? n : 10;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Account classification (advanced)')
			.setDesc(
				'One "prefix = class" per line. Class is one of: asset, liability, equity, income, expense.',
			)
			.addTextArea((ta) => {
				ta.setValue(prefixesToText(this.plugin.settings.accountPrefixes));
				ta.onChange(async (value) => {
					const parsed = textToPrefixes(value);
					this.plugin.settings.accountPrefixes =
						Object.keys(parsed).length > 0 ? parsed : DEFAULT_PREFIXES;
					await this.plugin.saveSettings();
				});
			});
	}
}
