export interface Expense {
	id: string;
	date: string;
	amount: number;
	category: string;
	merchant: string;
	notes: string;
}

export interface TrackerDoc {
	currency: string;
	frontmatter: Record<string, string>;
	body: string;
	expenses: Expense[];
}

export interface NamedAmount {
	name: string;
	amount: number;
	percent: number;
}

export interface SpendSnapshot {
	total: number;
	count: number;
	average: number;
	byCategory: NamedAmount[];
	byMerchant: NamedAmount[];
	byMonth: NamedAmount[];
}

export interface Insight {
	severity: "info" | "warn" | "good";
	title: string;
	detail: string;
}

export interface MonthDelta {
	category: string;
	current: number;
	previous: number;
	delta: number;
	deltaPct: number | null;
}

export type PeriodKey = "all" | string;
export type TrackerTab = "spending" | "reports";

export interface PluginSettings {
	currency: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	currency: "EUR",
};
