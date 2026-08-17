import { FRONTMATTER_KEY, TX_HEADERS } from "./constants";
import { compareIsoDate, parseAmount, uid } from "./format";
import { getBlock, setBlock } from "./markdown/blocks";
import { splitFrontmatter, writeFrontmatter } from "./markdown/frontmatter";
import { parseTable, stringifyTable } from "./markdown/tables";
import type { Expense, TrackerDoc } from "./types";

export function isTrackerFrontmatter(value: unknown): boolean {
	return value === true || value === "true" || value === "basic";
}

export function emptyTrackerDoc(title: string, currency: string): TrackerDoc {
	return {
		currency,
		frontmatter: {
			[FRONTMATTER_KEY]: "true",
			currency,
		},
		body: [
			`# ${title}`,
			"",
			"## Transactions",
			"",
			"<!-- cost-tracker:transactions -->",
			"",
			"<!-- /cost-tracker:transactions -->",
			"",
		].join("\n"),
		expenses: [],
	};
}

export function parseTracker(raw: string, fallbackCurrency: string): TrackerDoc {
	const { frontmatter, body } = splitFrontmatter(raw);
	const block = getBlock(body, "transactions");
	const expenses = (block ? parseTable(block) : [])
		.map((row) => rowToExpense(row))
		.filter((row): row is Expense => row !== null)
		.sort((a, b) => compareIsoDate(a.date, b.date) || a.id.localeCompare(b.id));
	return {
		currency: (frontmatter.currency || fallbackCurrency || "EUR").toUpperCase(),
		frontmatter,
		body,
		expenses,
	};
}

export function serializeTracker(doc: TrackerDoc): string {
	const frontmatter = { ...doc.frontmatter };
	frontmatter[FRONTMATTER_KEY] = "true";
	frontmatter.currency = doc.currency;
	const table = stringifyTable(
		TX_HEADERS,
		doc.expenses.map((expense) => ({
			id: expense.id,
			date: expense.date,
			amount: expense.amount.toFixed(2),
			category: expense.category,
			merchant: expense.merchant,
			notes: expense.notes,
		})),
	);
	const body = setBlock(doc.body, "transactions", table);
	return writeFrontmatter(frontmatter, body);
}

export function newExpense(partial: Partial<Expense> & Pick<Expense, "amount" | "category">): Expense {
	return {
		id: partial.id || uid(),
		date: partial.date || "",
		amount: partial.amount,
		category: partial.category,
		merchant: partial.merchant ?? "",
		notes: partial.notes ?? "",
	};
}

function rowToExpense(row: Record<string, string>): Expense | null {
	const amount = parseAmount(row.amount ?? "");
	if (amount <= 0) return null;
	let date = (row.date ?? "").trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = "";
	return {
		id: (row.id ?? "").trim() || uid(),
		date,
		amount,
		category: (row.category ?? "Other").trim() || "Other",
		merchant: (row.merchant ?? "").trim(),
		notes: (row.notes ?? "").trim(),
	};
}
