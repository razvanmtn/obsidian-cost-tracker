export function splitRow(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let escaping = false;
	let trimmed = line.trim();
	if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
	if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

	for (const char of trimmed) {
		if (escaping) {
			current += char;
			escaping = false;
			continue;
		}
		if (char === "\\") {
			escaping = true;
			continue;
		}
		if (char === "|") {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	cells.push(current.trim());
	return cells;
}

export function isSeparatorRow(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed.includes("-")) return false;
	return /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(trimmed);
}

export function escapeCell(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function stringifyTable(
	headers: readonly string[],
	rows: Record<string, string>[],
): string {
	const header = `| ${headers.join(" | ")} |`;
	const separator = `| ${headers.map(() => "---").join(" | ")} |`;
	const body = rows.map((row) => {
		const cells = headers.map((headerName) => escapeCell(row[headerName] ?? ""));
		return `| ${cells.join(" | ")} |`;
	});
	return [header, separator, ...body].join("\n");
}

export function parseTable(markdown: string): Record<string, string>[] {
	const lines = markdown
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.startsWith("|") || line.includes("|"));
	if (lines.length < 2) return [];

	const headerLine = lines[0];
	if (!headerLine) return [];
	const headers = splitRow(headerLine).map((header) => header.toLowerCase());
	let start = 1;
	const maybeSep = lines[1];
	if (maybeSep && isSeparatorRow(maybeSep)) start = 2;

	const rows: Record<string, string>[] = [];
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		if (!line || isSeparatorRow(line)) continue;
		const cells = splitRow(line);
		if (cells.every((cell) => cell === "")) continue;
		const row: Record<string, string> = {};
		headers.forEach((header, index) => {
			row[header] = cells[index] ?? "";
		});
		rows.push(row);
	}
	return rows;
}
