import { App, ButtonComponent, Modal, Notice } from 'obsidian';
import { parseAmount } from './amount';
import type { EntryData } from './entry';
import type { EntrySuggestion } from './suggest';
import { suggestForDescription } from './suggest';

export interface EntryModalOptions {
	accounts: string[];
	commodity: string;
	descriptions: string[];
	suggestions: Map<string, EntrySuggestion>;
	onSubmit: (data: EntryData) => void;
}

export class EntryModal extends Modal {
	private opts: EntryModalOptions;

	constructor(app: App, opts: EntryModalOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen(): void {
		this.titleEl.setText('New entry');
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('hledger-entry-modal');
		const { commodity } = this.opts;

		const acctListId = 'hledger-accounts-list';
		const acctList = contentEl.createEl('datalist');
		acctList.id = acctListId;
		for (const a of this.opts.accounts) acctList.createEl('option', { value: a });

		const descListId = 'hledger-desc-list';
		const descList = contentEl.createEl('datalist');
		descList.id = descListId;
		for (const d of this.opts.descriptions) descList.createEl('option', { value: d });

		const now = new Date();
		const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;

		const dateInput = this.field('Date', 'date');
		dateInput.value = today;
		const descInput = this.field('Description', 'text');
		descInput.setAttribute('list', descListId);
		const categoryInput = this.field('Account (category)', 'text');
		categoryInput.setAttribute('list', acctListId);
		const amountInput = this.field(
			commodity ? `Amount (${commodity})` : 'Amount',
			'text',
		);
		const sourceInput = this.field('Source account', 'text');
		sourceInput.setAttribute('list', acctListId);

		// Smart autocomplete: fill empty category/source from the closest past description.
		const applySuggestion = (): void => {
			const sug = suggestForDescription(this.opts.suggestions, descInput.value);
			if (!sug) return;
			if (!categoryInput.value.trim()) categoryInput.value = sug.category;
			if (!sourceInput.value.trim()) sourceInput.value = sug.source;
			if (!amountInput.value.trim() && sug.amount) amountInput.value = sug.amount;
		};
		descInput.addEventListener('change', applySuggestion);
		descInput.addEventListener('blur', applySuggestion);

		const buttons = contentEl.createDiv({ cls: 'hledger-modal-buttons' });
		new ButtonComponent(buttons).setButtonText('Cancel').onClick(() => this.close());
		new ButtonComponent(buttons)
			.setButtonText('Add')
			.setCta()
			.onClick(() => {
				const data: EntryData = {
					date: dateInput.value.trim(),
					description: descInput.value.trim(),
					category: categoryInput.value.trim(),
					amount: amountInput.value.trim(),
					commodity,
					source: sourceInput.value.trim(),
				};
				if (
					!data.date ||
					!data.description ||
					!data.category ||
					!data.amount ||
					!data.source
				) {
					new Notice('Please fill in all fields.');
					return;
				}
				if (parseAmount(data.amount) === 0) {
					new Notice('Please enter a valid amount.');
					return;
				}
				this.opts.onSubmit(data);
				this.close();
			});

		descInput.focus();
	}

	private field(label: string, type: string): HTMLInputElement {
		const row = this.contentEl.createDiv({ cls: 'hledger-modal-field' });
		row.createEl('label', { text: label });
		return row.createEl('input', { type });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
