import { App, ButtonComponent, Modal, Notice } from 'obsidian';
import { parseAmount } from './amount';
import type { EntryData } from './entry';

export class EntryModal extends Modal {
	private accounts: string[];
	private commodity: string;
	private onSubmit: (data: EntryData) => void;

	constructor(
		app: App,
		accounts: string[],
		commodity: string,
		onSubmit: (data: EntryData) => void,
	) {
		super(app);
		this.accounts = accounts;
		this.commodity = commodity;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.titleEl.setText('New entry');
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('hledger-entry-modal');

		const listId = 'hledger-accounts-list';
		const datalist = contentEl.createEl('datalist');
		datalist.id = listId;
		for (const a of this.accounts) datalist.createEl('option', { value: a });

		const now = new Date();
		const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;

		const dateInput = this.field('Date', 'date');
		dateInput.value = today;
		const descInput = this.field('Description', 'text');
		const categoryInput = this.field('Account (category)', 'text');
		categoryInput.setAttribute('list', listId);
		const amountInput = this.field(
			this.commodity ? `Amount (${this.commodity})` : 'Amount',
			'text',
		);
		const sourceInput = this.field('Source account', 'text');
		sourceInput.setAttribute('list', listId);

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
					commodity: this.commodity,
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
				this.onSubmit(data);
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
