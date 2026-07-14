export type AccountClass =
	| 'asset'
	| 'liability'
	| 'equity'
	| 'income'
	| 'expense'
	| 'other';

/** A normalized posting: one account, one commodity, one signed numeric amount. */
export interface Posting {
	account: string; // full account joined by ':' e.g. 'expenses:food'
	parts: string[]; // ['expenses', 'food']
	commodity: string; // '' when the amount had no commodity
	amount: number; // signed
}

export type TxnStatus = 'cleared' | 'pending' | 'unmarked';

/** Status the dashboard filters on: any status, or one specific status. */
export type StatusFilter = 'all' | TxnStatus;

export interface Transaction {
	date: Date;
	description: string;
	status: TxnStatus;
	postings: Posting[];
}

export interface Journal {
	transactions: Transaction[]; // sorted ascending by date
	commodities: string[]; // distinct, sorted
	accounts: string[]; // distinct full account names, sorted
	errors: string[]; // lexer + parser error messages
}

/** Maps a lowercased top-level account segment to a class. */
export type AccountPrefixMap = Record<string, AccountClass>;

export type PeriodKey = 'month' | '12months' | 'year' | 'all';
