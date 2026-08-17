import { Notice, TextFileView, setIcon, type WorkspaceLeaf } from "obsidian";
import {
	buildInsights,
	expensesInPeriod,
	monthDeltas,
	monthsInExpenses,
	previousPeriod,
	snapshot,
} from "../analytics";
import { VIEW_TYPE_COST_TRACKER } from "../constants";
import { compareIsoDate, formatMoney, formatPct, monthLabel } from "../format";
import { ExpenseModal } from "../modals/expense-modal";
import { emptyTrackerDoc, parseTracker, serializeTracker } from "../parser";
import type CostTrackerPlugin from "../main";
import type { Expense, NamedAmount, PeriodKey, SpendSnapshot, TrackerDoc, TrackerTab } from "../types";

export class CostTrackerView extends TextFileView {
	plugin: CostTrackerPlugin;
	doc: TrackerDoc = emptyTrackerDoc("Expenses", "EUR");
	period: PeriodKey = "all";
	tab: TrackerTab = "spending";
	query = "";
	private rendering = false;

	constructor(leaf: WorkspaceLeaf, plugin: CostTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.addAction("file-text", "Open as markdown", () => {
			void this.plugin.openAsMarkdown(this.leaf);
		});
	}

	getViewType(): string {
		return VIEW_TYPE_COST_TRACKER;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Cost tracker";
	}

	getIcon(): string {
		return "wallet";
	}

	getViewData(): string {
		return serializeTracker(this.doc);
	}

	setViewData(data: string, _clear: boolean): void {
		this.doc = parseTracker(data, this.plugin.settings.currency);
		if (!this.doc.frontmatter.currency) this.doc.currency = this.plugin.settings.currency;
		void this.render();
	}

	clear(): void {
		this.doc = emptyTrackerDoc("Expenses", this.plugin.settings.currency);
		this.contentEl.empty();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private money(amount: number): string {
		return formatMoney(amount, this.doc.currency || this.plugin.settings.currency);
	}

	private saveAndRender(): void {
		this.requestSave();
		void this.render();
	}

	private visibleExpenses(): Expense[] {
		return expensesInPeriod(this.doc.expenses, this.period);
	}

	async render(): Promise<void> {
		if (this.rendering) return;
		this.rendering = true;
		const scroll = this.contentEl.scrollTop;
		try {
			const visible = this.visibleExpenses();
			const snap = snapshot(visible);
			const prevKey = previousPeriod(this.period);
			const previous = prevKey ? snapshot(expensesInPeriod(this.doc.expenses, prevKey)) : null;

			this.contentEl.empty();
			this.contentEl.addClass("ct-root");
			this.renderToolbar(this.contentEl);
			this.renderTabs(this.contentEl);

			const body = this.contentEl.createDiv({ cls: "ct-body" });
			if (this.tab === "spending") this.renderSpending(body, visible, snap);
			else this.renderReports(body, snap, previous);
			this.contentEl.scrollTop = scroll;
		} finally {
			this.rendering = false;
		}
	}

	private renderToolbar(root: HTMLElement): void {
		const bar = root.createDiv({ cls: "ct-toolbar" });
		const title = bar.createDiv({ cls: "ct-title-block" });
		title.createEl("h2", { text: this.file?.basename ?? "Cost tracker" });
		title.createDiv({
			cls: "ct-toolbar-hint",
			text: this.period === "all" ? "All spending in this file" : monthLabel(this.period),
		});

		const actions = bar.createDiv({ cls: "ct-toolbar-actions" });
		const select = actions.createEl("select", { cls: "dropdown" });
		select.createEl("option", { text: "All time", attr: { value: "all" } });
		for (const month of monthsInExpenses(this.doc.expenses)) {
			select.createEl("option", { text: monthLabel(month), attr: { value: month } });
		}
		select.value = this.period;
		select.addEventListener("change", () => {
			this.period = select.value === "all" ? "all" : select.value;
			void this.render();
		});
		this.textButton(actions, "plus", "Add expense", () => this.openExpense(), true);
	}

	private renderTabs(root: HTMLElement): void {
		const tabs = root.createDiv({ cls: "ct-tabs" });
		for (const item of [
			{ id: "spending" as const, label: "Spending" },
			{ id: "reports" as const, label: "Reports" },
		]) {
			const button = tabs.createEl("button", {
				cls: this.tab === item.id ? "ct-tab is-active" : "ct-tab",
				text: item.label,
			});
			button.addEventListener("click", () => {
				this.tab = item.id;
				void this.render();
			});
		}
	}

	private renderSpending(root: HTMLElement, visible: Expense[], snap: SpendSnapshot): void {
		this.renderKpis(root, snap);

		if (this.doc.expenses.length === 0) {
			const empty = root.createDiv({ cls: "ct-empty" });
			empty.createEl("h3", { text: "No expenses yet" });
			empty.createEl("p", {
				text: "This file is the tracker. Add spending here, or edit the markdown table directly.",
			});
			this.textButton(empty, "plus", "Add expense", () => this.openExpense(), true);
			return;
		}

		const filters = root.createDiv({ cls: "ct-filters" });
		const search = filters.createEl("input", {
			cls: "ct-search",
			attr: { type: "search", placeholder: "Filter category, merchant, notes" },
		});
		search.value = this.query;

		const table = root.createEl("table", { cls: "ct-table" });
		const head = table.createEl("thead").createEl("tr");
		for (const label of ["Date", "Amount", "Category", "Merchant", "Notes", ""]) {
			head.createEl("th", { text: label });
		}
		const body = table.createEl("tbody");
		const empty = root.createDiv({ cls: "ct-muted" });

		const paint = (): void => {
			body.empty();
			const query = this.query.trim().toLowerCase();
			const rows = visible
				.slice()
				.sort((a, b) => compareIsoDate(b.date, a.date) || b.id.localeCompare(a.id))
				.filter((expense) => {
					if (!query) return true;
					return `${expense.category} ${expense.merchant} ${expense.notes}`.toLowerCase().includes(query);
				});
			empty.setText(rows.length === 0 ? "No expenses match." : "");
			table.toggleClass("is-hidden", rows.length === 0);
			for (const expense of rows) {
				const tr = body.createEl("tr");
				tr.createEl("td", { text: expense.date });
				tr.createEl("td", { cls: "ct-out", text: this.money(expense.amount) });
				tr.createEl("td", { text: expense.category });
				tr.createEl("td", { text: expense.merchant });
				tr.createEl("td", { cls: "ct-notes", text: expense.notes });
				const actions = tr.createEl("td", { cls: "ct-row-actions" });
				this.iconButton(actions, "pencil", "Edit", () => this.openExpense(expense));
				this.iconButton(actions, "trash-2", "Delete", () => {
					this.doc.expenses = this.doc.expenses.filter((row) => row.id !== expense.id);
					this.saveAndRender();
				});
			}
		};

		search.addEventListener("input", () => {
			this.query = search.value;
			paint();
		});
		paint();
	}

	private renderReports(root: HTMLElement, snap: SpendSnapshot, previous: SpendSnapshot | null): void {
		this.renderKpis(root, snap);
		if (snap.count === 0) {
			root.createDiv({ cls: "ct-muted", text: "Add expenses to see reports." });
			return;
		}

		const insights = buildInsights(snap, previous, this.period);
		if (insights.length > 0) {
			const panel = this.panel(root, "What stands out");
			const list = panel.createDiv({ cls: "ct-insights" });
			for (const insight of insights) {
				const card = list.createDiv({ cls: `ct-insight is-${insight.severity}` });
				card.createDiv({ cls: "ct-insight-title", text: insight.title });
				card.createDiv({ cls: "ct-insight-detail", text: insight.detail });
			}
		}

		const grid = root.createDiv({ cls: "ct-grid" });
		this.barList(this.panel(grid, "Where money went"), snap.byCategory, snap.total);
		this.barList(this.panel(grid, "Top merchants"), snap.byMerchant.slice(0, 8), snap.total);

		const months = this.panel(root, "Spending by month");
		if (snap.byMonth.length === 0) this.barList(months, [], 0);
		else this.trendChart(months, snap);

		const deltas = monthDeltas(snap, previous);
		if (this.period !== "all" && deltas.length > 0) {
			const panel = this.panel(root, "Versus previous month");
			const table = panel.createEl("table", { cls: "ct-table" });
			const head = table.createEl("thead").createEl("tr");
			for (const label of ["Category", "This month", "Last month", "Change"]) {
				head.createEl("th", { text: label });
			}
			const body = table.createEl("tbody");
			for (const row of deltas.slice(0, 12)) {
				const tr = body.createEl("tr");
				tr.createEl("td", { text: row.category });
				tr.createEl("td", { text: this.money(row.current) });
				tr.createEl("td", { text: this.money(row.previous) });
				const cell = tr.createEl("td", { cls: row.delta > 0 ? "ct-out" : row.delta < 0 ? "ct-in" : "" });
				const pct = row.deltaPct === null ? "new" : formatPct(row.deltaPct);
				cell.setText(`${this.money(row.delta)} (${pct})`);
			}
		}

		if (snap.byCategory.length > 0) {
			const pareto = this.panel(root, "Cumulative share");
			const table = pareto.createEl("table", { cls: "ct-table" });
			const head = table.createEl("thead").createEl("tr");
			for (const label of ["Category", "Amount", "Share", "Cumulative"]) {
				head.createEl("th", { text: label });
			}
			const body = table.createEl("tbody");
			let running = 0;
			for (const row of snap.byCategory) {
				running += row.percent;
				const tr = body.createEl("tr");
				tr.createEl("td", { text: row.name });
				tr.createEl("td", { text: this.money(row.amount) });
				tr.createEl("td", { text: formatPct(row.percent) });
				tr.createEl("td", { text: formatPct(running) });
			}
		}
	}

	private renderKpis(parent: HTMLElement, snap: SpendSnapshot): void {
		const kpis = parent.createDiv({ cls: "ct-kpis" });
		this.kpi(kpis, "Spent", this.money(snap.total));
		this.kpi(kpis, "Expenses", String(snap.count));
		this.kpi(kpis, "Average", this.money(snap.average));
		const top = snap.byCategory[0];
		this.kpi(kpis, "Top category", top ? `${top.name} · ${formatPct(top.percent)}` : "—");
	}

	private kpi(parent: HTMLElement, label: string, value: string): void {
		const card = parent.createDiv({ cls: "ct-kpi" });
		card.createDiv({ cls: "ct-kpi-label", text: label });
		card.createDiv({ cls: "ct-kpi-value", text: value });
	}

	private panel(parent: HTMLElement, title: string): HTMLElement {
		const panel = parent.createDiv({ cls: "ct-panel" });
		panel.createEl("h3", { text: title });
		return panel;
	}

	private barList(parent: HTMLElement, rows: NamedAmount[], total: number): void {
		if (rows.length === 0) {
			parent.createDiv({ cls: "ct-muted", text: "Nothing to chart yet." });
			return;
		}
		const max = Math.max(...rows.map((row) => row.amount), 1);
		for (const row of rows) {
			const item = parent.createDiv({ cls: "ct-bar-row" });
			const meta = item.createDiv({ cls: "ct-bar-meta" });
			meta.createSpan({ text: row.name });
			meta.createSpan({
				cls: "ct-bar-value",
				text: `${this.money(row.amount)} · ${formatPct(total > 0 ? row.amount / total : 0)}`,
			});
			const track = item.createDiv({ cls: "ct-bar-track" });
			const fill = track.createDiv({ cls: "ct-bar-fill" });
			fill.style.width = `${(row.amount / max) * 100}%`;
		}
	}

	private trendChart(parent: HTMLElement, snap: SpendSnapshot): void {
		const rows = snap.byMonth;
		const max = Math.max(...rows.map((row) => row.amount), 1);
		const chart = parent.createDiv({ cls: "ct-trend" });
		for (const row of rows) {
			const col = chart.createDiv({ cls: "ct-trend-col" });
			const bars = col.createDiv({ cls: "ct-trend-bars" });
			const bar = bars.createDiv({ cls: "ct-trend-bar is-out" });
			bar.style.height = `${(row.amount / max) * 100}%`;
			col.createDiv({ cls: "ct-trend-label", text: row.name.slice(5) });
		}
	}

	private textButton(
		parent: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
		cta = false,
	): HTMLElement {
		const button = parent.createEl("button", { cls: cta ? "mod-cta ct-btn" : "ct-btn" });
		setIcon(button.createSpan({ cls: "ct-btn-icon" }), icon);
		button.createSpan({ text: label });
		button.addEventListener("click", onClick);
		return button;
	}

	private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
		const button = parent.createEl("button", { cls: "clickable-icon ct-icon-btn", attr: { "aria-label": label } });
		setIcon(button, icon);
		button.addEventListener("click", onClick);
		return button;
	}

	addExpense(existing?: Expense): void {
		this.openExpense(existing);
	}

	private openExpense(existing?: Expense): void {
		const categories = [...new Set(this.doc.expenses.map((expense) => expense.category).filter(Boolean))].sort();
		new ExpenseModal(this.app, categories, existing ?? null, async (expense) => {
			if (existing) {
				this.doc.expenses = this.doc.expenses.map((row) => (row.id === existing.id ? expense : row));
			} else {
				this.doc.expenses.push(expense);
			}
			this.saveAndRender();
			new Notice("Saved to this note.");
		}).open();
	}
}
