export function pad(n: number): string {
	return String(n).padStart(2, "0");
}

export function currentMonthKey(date = new Date()): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
	const match = /^(\d{4})-(\d{2})$/.exec(key);
	if (!match) {
		const now = new Date();
		return { year: now.getFullYear(), month: now.getMonth() + 1 };
	}
	return { year: Number(match[1]), month: Number(match[2]) };
}

export function monthLabel(key: string): string {
	const { year, month } = parseMonthKey(key);
	return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

export function addMonths(key: string, delta: number): string {
	const { year, month } = parseMonthKey(key);
	const date = new Date(year, month - 1 + delta, 1);
	return currentMonthKey(date);
}

export function daysInMonth(key: string): number {
	const { year, month } = parseMonthKey(key);
	return new Date(year, month, 0).getDate();
}

export function clampDateToMonth(key: string, day: number): string {
	const max = daysInMonth(key);
	const clamped = Math.min(Math.max(1, day), max);
	return `${key}-${pad(clamped)}`;
}

export function todayIso(date = new Date()): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function defaultDateForMonth(key: string, date = new Date()): string {
	const current = currentMonthKey(date);
	if (key === current) return todayIso(date);
	if (key < current) return `${key}-${pad(daysInMonth(key))}`;
	return `${key}-01`;
}

export function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

export function formatMoney(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		return `${amount.toFixed(2)} ${currency}`;
	}
}

export function formatPct(ratio: number, digits = 0): string {
	if (!Number.isFinite(ratio)) return "—";
	return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatSignedMoney(amount: number, currency: string): string {
	const formatted = formatMoney(Math.abs(amount), currency);
	if (amount > 0) return `+${formatted}`;
	if (amount < 0) return `−${formatted}`;
	return formatted;
}

export function uid(): string {
	return Math.random().toString(36).slice(2, 8);
}

export function parseAmount(raw: string): number {
	const cleaned = raw.replace(/\s/g, "").replace(",", ".");
	const value = Number.parseFloat(cleaned);
	if (!Number.isFinite(value)) return 0;
	return roundMoney(Math.abs(value));
}

export function parseBool(raw: string): boolean {
	const value = raw.trim().toLowerCase();
	return value === "true" || value === "yes" || value === "1";
}

export function compareIsoDate(a: string, b: string): number {
	return a.localeCompare(b);
}

export function monthKeyFromIso(iso: string): string {
	return iso.slice(0, 7);
}
