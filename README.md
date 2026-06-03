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
- Period filter (month / 12 months / year / all), commodity selector, and account
  filter (scopes the category, balances, and recent-transaction panels to a subtree).
- Account classification configurable for English or Portuguese account names.

## Setup

1. Enable the plugin.
2. In **Settings → Hledger**, set **Journal file path** to your main file
   (e.g. `finance/main.journal`).
3. Open the dashboard via the wallet ribbon icon or the command palette.

## Notes

- Currency conversion is not performed; pick a commodity to view.
- Number formats (`1,234.56`, `1.234,56`, `240,50`) are detected heuristically.

## Development

- `npm run dev` — watch build
- `npm run build` — production build
- `npm test` — run unit tests (Vitest)
