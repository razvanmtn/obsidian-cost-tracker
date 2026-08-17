import { addMonths, currentMonthKey, monthKeyFromIso, roundMoney } from "./format";
import type { Expense, Insight, MonthDelta, NamedAmount, PeriodKey, SpendSnapshot } from "./types";

export function expensesInPeriod(expenses: Expense[], period: PeriodKey): Expense[] {
	if (period === "all") return expenses;
	return expenses.filter((expense) => monthKeyFromIso(expense.date) === period);
}

export function monthsInExpenses(expenses: Expense[]): string[] {
	const months = new Set<string>();
	for (const expense of expenses) {
		if (expense.date.length >= 7) months.add(monthKeyFromIso(expense.date));
	}
	return [...months].sort().reverse();
}

function named(map: Map<string, number>, total: number): NamedAmount[] {
	const safe = total > 0 ? total : 1;
	return [...map.entries()]
		.map(([name, amount]) => ({
			name,
			amount: roundMoney(amount),
			percent: amount / safe,
		}))
		.sort((a, b) => b.amount - a.amount);
}

export function snapshot(expenses: Expense[]): SpendSnapshot {
	const byCategory = new Map<string, number>();
	const byMerchant = new Map<string, number>();
	const byMonth = new Map<string, number>();
	let total = 0;
	for (const expense of expenses) {
		total += expense.amount;
		byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
		const merchant = expense.merchant.trim() || "(no merchant)";
		byMerchant.set(merchant, (byMerchant.get(merchant) ?? 0) + expense.amount);
		if (expense.date.length >= 7) {
			const month = monthKeyFromIso(expense.date);
			byMonth.set(month, (byMonth.get(month) ?? 0) + expense.amount);
		}
	}
	total = roundMoney(total);
	return {
		total,
		count: expenses.length,
		average: expenses.length > 0 ? roundMoney(total / expenses.length) : 0,
		byCategory: named(byCategory, total),
		byMerchant: named(byMerchant, total),
		byMonth: named(byMonth, total).sort((a, b) => a.name.localeCompare(b.name)),
	};
}

export function monthDeltas(current: SpendSnapshot, previous: SpendSnapshot | null): MonthDelta[] {
	if (!previous) return [];
	const names = new Set([...current.byCategory.map((row) => row.name), ...previous.byCategory.map((row) => row.name)]);
	return [...names]
		.map((category) => {
			const cur = current.byCategory.find((row) => row.name === category)?.amount ?? 0;
			const prev = previous.byCategory.find((row) => row.name === category)?.amount ?? 0;
			return {
				category,
				current: cur,
				previous: prev,
				delta: roundMoney(cur - prev),
				deltaPct: prev > 0 ? (cur - prev) / prev : cur > 0 ? null : 0,
			};
		})
		.filter((row) => row.current > 0 || row.previous > 0)
		.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function buildInsights(
	current: SpendSnapshot,
	previous: SpendSnapshot | null,
	period: PeriodKey,
): Insight[] {
	if (current.count === 0) {
		return [
			{
				severity: "info",
				title: "No spending yet",
				detail: "Add an expense to see where the money goes.",
			},
		];
	}

	const insights: Insight[] = [];
	const top = current.byCategory[0];
	if (top) {
		insights.push({
			severity: "info",
			title: `${top.name} is the largest category`,
			detail: `${top.percent * 100 >= 1 ? Math.round(top.percent * 100) : (top.percent * 100).toFixed(1)}% of spending in this ${period === "all" ? "file" : "month"} went here.`,
		});
	}

	const top3 = current.byCategory.slice(0, 3);
	const share = top3.reduce((sum, row) => sum + row.percent, 0);
	if (top3.length >= 2 && share >= 0.7) {
		insights.push({
			severity: "warn",
			title: "Spending is concentrated",
			detail: `${top3.map((row) => row.name).join(", ")} make up ${Math.round(share * 100)}% of the total. Those are the categories to watch.`,
		});
	}

	const merchant = current.byMerchant[0];
	if (merchant && merchant.percent >= 0.25 && merchant.name !== "(no merchant)") {
		insights.push({
			severity: "info",
			title: `Top merchant: ${merchant.name}`,
			detail: `${Math.round(merchant.percent * 100)}% of spending went there.`,
		});
	}

	if (previous && previous.total > 0 && period !== "all") {
		const change = (current.total - previous.total) / previous.total;
		if (change >= 0.15) {
			insights.push({
				severity: "warn",
				title: "Spending rose versus last month",
				detail: `Up ${Math.round(change * 100)}% from the previous month in this file.`,
			});
		} else if (change <= -0.1) {
			insights.push({
				severity: "good",
				title: "Spending fell versus last month",
				detail: `Down ${Math.round(Math.abs(change) * 100)}% from the previous month.`,
			});
		}
	}

	if (period !== "all" && period === currentMonthKey() && current.count > 0) {
		const today = new Date().getDate();
		const daily = current.total / Math.max(today, 1);
		insights.push({
			severity: "info",
			title: "Current daily pace",
			detail: `About ${daily.toFixed(2)} per day so far this month. A full month at this pace would be ${(daily * 30).toFixed(0)}.`,
		});
	}

	if (previous && period !== "all") {
		const grown = monthDeltas(current, previous).filter((row) => row.delta > 0)[0];
		if (grown && grown.delta > 0) {
			insights.push({
				severity: "info",
				title: `${grown.category} grew the most`,
				detail: `Up ${grown.delta.toFixed(2)} versus last month.`,
			});
		}
	}

	return insights.slice(0, 6);
}

export function previousPeriod(period: PeriodKey): PeriodKey | null {
	if (period === "all") return null;
	return addMonths(period, -1);
}
