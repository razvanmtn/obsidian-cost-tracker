# Cost Tracker

[![CI](https://github.com/razvanmtn/obsidian-cost-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/razvanmtn/obsidian-cost-tracker/actions/workflows/ci.yml)

An [Obsidian](https://obsidian.md) plugin that tracks spending in ordinary markdown notes. Each note is its own tracker: add expenses from a dedicated view, or edit the table in the note itself.

## Features

- One markdown note per tracker, with YAML frontmatter and a transactions table
- Dedicated **Spending** view for adding, editing, filtering, and deleting expenses
- **Reports** for totals, category and merchant breakdowns, monthly trends, and month-over-month changes
- Toggle between the tracker view and raw markdown at any time
- Default currency in plugin settings; each file can override it

## Install

Once the plugin is in the community directory:

1. Open **Settings → Community plugins**
2. Browse for **Cost Tracker**
3. Install and enable it

Until then, install from a GitHub release:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/razvanmtn/obsidian-cost-tracker/releases)
2. Copy them into `VaultFolder/.obsidian/plugins/cost-tracker/`
3. Reload Obsidian and enable **Cost Tracker** under **Settings → Community plugins**

## Use

- **New cost tracker** from the ribbon (wallet icon), the command palette, or a folder's file menu
- **Add expense** while a tracker note is open
- **Toggle cost tracker / markdown** to switch between the UI and the note
- **Turn current note into a cost tracker** to convert an existing markdown file

Plugin settings only set the default currency for new files. Change `currency` in a note's frontmatter to override it.

### Note format

```markdown
---
cost-tracker: true
currency: EUR
---

# Expenses

## Transactions

<!-- cost-tracker:transactions -->
| id | date | amount | category | merchant | notes |
| --- | --- | --- | --- | --- | --- |
| ab12cd | 2026-08-17 | 12.50 | Dining | Cafe | Lunch |
<!-- /cost-tracker:transactions -->
```

You can edit that table by hand. The plugin reads and writes the block between the `cost-tracker:transactions` comments.

## Develop

Requires [Node.js](https://nodejs.org/) 18 or later.

```bash
npm install
npm run dev
```

This repo is also a small Obsidian vault. Open the folder in Obsidian, enable the plugin, and `npm run dev` will rebuild into `.obsidian/plugins/cost-tracker/` as you edit.

```bash
npm run build   # production bundle
```

`main.js` is generated and is not committed. Releases attach the built files as GitHub assets.

## Release

Pushing a version tag builds the plugin and opens a **draft** GitHub release with the files Obsidian needs: `main.js`, `manifest.json`, and `styles.css`.

For the **first** public release, the version is already `1.0.0`. After these files are on `main`:

```bash
git tag -a 1.0.0 -m "1.0.0"
git push origin 1.0.0
```

For later releases, bump the version (updates `package.json`, `manifest.json`, and `versions.json`), then push the commit and tag. Do not prefix the tag with `v` — Obsidian matches it to `manifest.json`.

```bash
npm version patch   # or minor / major
git push origin main
git push origin 1.0.1
```

When the [Release](https://github.com/razvanmtn/obsidian-cost-tracker/actions) workflow finishes, open the draft release, check the notes, and publish it.

After the plugin is listed in the community directory, new GitHub releases are picked up automatically. You do not submit again for each version.

## Submit to the community directory

You only do this once, after the first public release exists:

1. Make this GitHub repository **public**
2. Publish the `1.0.0` GitHub release (tag `1.0.0`, with `main.js`, `manifest.json`, and `styles.css` attached)
3. Sign in at [community.obsidian.md](https://community.obsidian.md), link GitHub, and add this repository

Obsidian reads `manifest.json` from the default branch and downloads the plugin files from the GitHub release whose tag matches `version`.

## License

MIT. See [LICENSE](LICENSE).
