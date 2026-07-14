import { setIcon } from 'obsidian';
import type { TxnStatus } from './types';

const STATUS_ICON: Record<TxnStatus, string> = {
	cleared: 'check-circle-2',
	pending: 'circle-dot',
	unmarked: 'circle',
};

const STATUS_TITLE: Record<TxnStatus, string> = {
	cleared: 'Cleared — select to unmark',
	pending: 'Pending — select to clear',
	unmarked: 'Unmarked — select to mark pending',
};

/** A clickable status dot that cycles unmarked → pending → cleared on each click. */
export function renderStatusBadge(
	parent: HTMLElement,
	status: TxnStatus,
	onToggle: () => void,
): HTMLElement {
	const el = parent.createSpan({ cls: `hledger-status is-${status}` });
	setIcon(el, STATUS_ICON[status]);
	el.setAttribute('title', STATUS_TITLE[status]);
	el.addEventListener('click', (e) => {
		e.stopPropagation();
		onToggle();
	});
	return el;
}
