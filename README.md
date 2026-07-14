# Hledger for Obsidian

Parse a configured [hledger](https://hledger.org) journal file (`.journal` / `.ledger`)
from your vault and view it as a native dashboard with interactive charts.

## Features

- Reads a single configured journal file; `include` directives are resolved recursively.
- Dedicated dashboard view (ribbon icon + "Open dashboard" command).
- Summary cards: net worth, income, expenses, savings.
- Interactive charts (Chart.js, themed to your Obsidian theme):
  - Net worth over time
  - Income vs expenses (monthly)
  - Expenses by category
  - Account balances + recent transactions
- Period filter (month / 12 months / year / all), commodity selector, account
  filter, and a status filter (cleared / pending / unmarked).
- Cash-flow waterfall: opening balance → income → expenses by category → closing balance.
- Drill-down: select a category slice or a balance bar to scope the dashboard to it.
- **Compare** tab: current period vs the previous comparable one, per category, with deltas.
- Reconciliation: select the status dot on any transaction to cycle
  unmarked → pending (`!`) → cleared (`*`); the change is written back to the journal.
- New-entry dialog with smart autocomplete (suggests the account/source/amount from a
  similar past transaction).
- Account classification configurable for English or Portuguese account names.

## Screenshots

![Overview tab](https://github.com/user-attachments/assets/447452fc-9ce1-4d80-aeaf-9fa8c96c10e5)

![Expenses tab](https://github.com/user-attachments/assets/ea6c8a04-9662-4362-81d0-ef3dca9cb70c)

![Income tab](https://github.com/user-attachments/assets/a3d385f8-2d73-4d47-9596-86736eed9710)

![New entry screen](https://github.com/user-attachments/assets/113230bf-8a06-4343-88bb-678b20875b12)

## Setup

1. Enable the plugin.
2. In **Settings → Hledger**, set **Journal file path** to your main file
   (e.g. `finance/main.journal`). An absolute path outside the vault also works
   (e.g. `~/finance/main.journal` or `C:/ledger/main.journal`) — desktop only,
   since mobile apps cannot reach files outside the vault.
3. Open the dashboard via the wallet ribbon icon or the command palette.

## Notes

- Currency conversion is not performed; pick a commodity to view.
- Number formats (`1,234.56`, `1.234,56`, `240,50`) are detected heuristically.

## Embedding reports in notes

Drop an `hledger` code block into any note to render a mini-report inline:

````
```hledger
type: expenses
period: month
commodity: BRL
account: expenses:food
```
````

Keys (all optional): `type` (`summary`, `expenses`, `income`, `balances`, `networth`,
`monthly`), `period` (`month`, `12months`, `year`, `all`), `commodity`, `account`,
`status` (`all`, `cleared`, `pending`, `unmarked`), and `title`.

## Development

- `npm run dev` — watch build
- `npm run build` — production build
- `npm test` — run unit tests (Vitest)
