export function splitFrontmatter(raw: string): {
	frontmatter: Record<string, string>;
	body: string;
} {
	if (!raw.startsWith("---")) {
		return { frontmatter: {}, body: raw };
	}
	const end = raw.indexOf("\n---", 3);
	if (end === -1) {
		return { frontmatter: {}, body: raw };
	}
	const yaml = raw.slice(4, end).trim();
	let body = raw.slice(end + 4);
	if (body.startsWith("\n")) body = body.slice(1);
	const frontmatter: Record<string, string> = {};
	for (const line of yaml.split("\n")) {
		const index = line.indexOf(":");
		if (index === -1) continue;
		const key = line.slice(0, index).trim();
		const value = line.slice(index + 1).trim();
		if (key) frontmatter[key] = value;
	}
	return { frontmatter, body };
}

export function writeFrontmatter(
	frontmatter: Record<string, string>,
	body: string,
): string {
	const keys = Object.keys(frontmatter);
	if (keys.length === 0) return body.replace(/^\n+/, "");
	const yaml = keys.map((key) => `${key}: ${frontmatter[key]}`).join("\n");
	return `---\n${yaml}\n---\n\n${body.replace(/^\n+/, "")}`;
}
