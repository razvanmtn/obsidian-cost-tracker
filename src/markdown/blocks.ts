export function getBlock(body: string, name: string): string | null {
	const start = `<!-- cost-tracker:${name} -->`;
	const end = `<!-- /cost-tracker:${name} -->`;
	const startIndex = body.indexOf(start);
	const endIndex = body.indexOf(end);
	if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;
	return body.slice(startIndex + start.length, endIndex).trim();
}

export function setBlock(body: string, name: string, inner: string): string {
	const start = `<!-- cost-tracker:${name} -->`;
	const end = `<!-- /cost-tracker:${name} -->`;
	const wrapped = `${start}\n${inner.trim()}\n${end}`;
	const startIndex = body.indexOf(start);
	const endIndex = body.indexOf(end);
	if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
		const prefix = body.trimEnd();
		return `${prefix}${prefix ? "\n\n" : ""}${wrapped}\n`;
	}
	return `${body.slice(0, startIndex)}${wrapped}${body.slice(endIndex + end.length)}`;
}
