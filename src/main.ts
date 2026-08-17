import {
	MarkdownView,
	Menu,
	normalizePath,
	Notice,
	Plugin,
	TFile,
	TFolder,
	WorkspaceLeaf,
	type ViewState,
} from "obsidian";
import { FRONTMATTER_KEY, VIEW_TYPE_COST_TRACKER } from "./constants";
import { NewTrackerModal } from "./modals/new-tracker-modal";
import { emptyTrackerDoc, isTrackerFrontmatter, parseTracker, serializeTracker } from "./parser";
import { CostTrackerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type PluginSettings } from "./types";
import { CostTrackerView } from "./views/cost-tracker-view";

type SetViewStateFn = (state: ViewState, extraState?: unknown) => Promise<unknown>;

export default class CostTrackerPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	private fileModes: Record<string, string> = {};
	private bypassRedirect = false;
	private redirectEnabled = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_COST_TRACKER, (leaf) => new CostTrackerView(leaf, this));
		this.registerRedirect();

		this.addRibbonIcon("wallet", "New cost tracker", () => {
			void this.promptNewTracker();
		});

		this.addCommand({
			id: "create-tracker",
			name: "Create new cost tracker",
			callback: () => {
				void this.promptNewTracker();
			},
		});
		this.addCommand({
			id: "toggle-view",
			name: "Toggle cost tracker / markdown",
			checkCallback: (checking) => {
				const leaf = this.app.workspace.activeLeaf;
				if (!leaf) return false;
				const file = this.fileFromLeaf(leaf);
				if (!file) return false;
				if (!this.isTrackerFile(file.path) && !(leaf.view instanceof CostTrackerView)) return false;
				if (!checking) void this.toggleView(leaf);
				return true;
			},
		});
		this.addCommand({
			id: "add-expense",
			name: "Add expense",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(CostTrackerView);
				if (!view) return false;
				if (!checking) view.addExpense();
				return true;
			},
		});
		this.addCommand({
			id: "convert-note",
			name: "Turn current note into a cost tracker",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) void this.convertFile(file);
				return true;
			},
		});

		this.addSettingTab(new CostTrackerSettingTab(this.app, this));
		this.redirectEnabled = true;

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				this.buildFileMenu(menu, file);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu) => {
				const file = this.app.workspace.getActiveFile();
				if (file) this.buildFileMenu(menu, file);
			}),
		);
	}

	async onunload(): Promise<void> {
		this.redirectEnabled = false;
		this.bypassRedirect = true;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_COST_TRACKER)) {
			const file = leaf.view instanceof CostTrackerView ? leaf.view.file : null;
			if (file) {
				await leaf.setViewState({
					type: "markdown",
					state: { file: file.path },
				});
			}
		}
		this.bypassRedirect = false;
	}

	isTrackerFile(path: string): boolean {
		const cache = this.app.metadataCache.getCache(path);
		return isTrackerFrontmatter(cache?.frontmatter?.[FRONTMATTER_KEY]);
	}

	async openAsMarkdown(leaf: WorkspaceLeaf): Promise<void> {
		const file = this.fileFromLeaf(leaf);
		if (!file) return;
		this.fileModes[this.modeKey(leaf, file.path)] = "markdown";
		this.bypassRedirect = true;
		try {
			await leaf.setViewState({
				type: "markdown",
				state: { file: file.path },
				active: true,
			});
		} finally {
			this.bypassRedirect = false;
		}
	}

	async openAsTracker(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
		this.fileModes[this.modeKey(leaf, file.path)] = VIEW_TYPE_COST_TRACKER;
		await leaf.setViewState({
			type: VIEW_TYPE_COST_TRACKER,
			state: { file: file.path },
			active: true,
		});
	}

	private registerRedirect(): void {
		const plugin = this;
		const proto = WorkspaceLeaf.prototype as unknown as { setViewState: SetViewStateFn };
		const original = proto.setViewState;
		proto.setViewState = function (this: WorkspaceLeaf, state: ViewState, extraState?: unknown) {
			const filePath = typeof state.state?.file === "string" ? state.state.file : "";
			const key = plugin.modeKey(this, filePath);
			if (
				!plugin.bypassRedirect &&
				plugin.redirectEnabled &&
				state.type === "markdown" &&
				filePath &&
				plugin.fileModes[key] !== "markdown" &&
				plugin.isTrackerFile(filePath)
			) {
				plugin.fileModes[key] = VIEW_TYPE_COST_TRACKER;
				return original.call(this, { ...state, type: VIEW_TYPE_COST_TRACKER }, extraState);
			}
			return original.call(this, state, extraState);
		};
		this.register(() => {
			proto.setViewState = original;
		});
	}

	private modeKey(leaf: WorkspaceLeaf, filePath: string): string {
		const id = (leaf as WorkspaceLeaf & { id?: string }).id;
		return id || filePath;
	}

	private fileFromLeaf(leaf: WorkspaceLeaf): TFile | null {
		if (leaf.view instanceof CostTrackerView) return leaf.view.file;
		if (leaf.view instanceof MarkdownView) return leaf.view.file;
		return null;
	}

	private async toggleView(leaf: WorkspaceLeaf): Promise<void> {
		const file = this.fileFromLeaf(leaf);
		if (!file) return;
		if (leaf.view instanceof CostTrackerView) {
			await this.openAsMarkdown(leaf);
			return;
		}
		if (!this.isTrackerFile(file.path)) {
			await this.convertFile(file);
			return;
		}
		await this.openAsTracker(leaf, file);
	}

	private promptNewTracker(folder?: TFolder): void {
		new NewTrackerModal(this.app, "Expenses", async (name) => {
			await this.createTracker(name, folder);
		}).open();
	}

	private async createTracker(name: string, folder?: TFolder): Promise<void> {
		const parent =
			folder ??
			this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "");
		const path = this.uniqueMarkdownPath(parent, name);
		const file = await this.app.vault.create(
			path,
			serializeTracker(emptyTrackerDoc(name, this.settings.currency)),
		);
		const leaf = this.app.workspace.getLeaf("tab");
		await this.openAsTracker(leaf, file);
		new Notice(`Created ${file.basename}`);
	}

	private uniqueMarkdownPath(folder: TFolder, basename: string): string {
		const dir = folder.path === "/" ? "" : folder.path;
		const make = (stem: string) => normalizePath(dir ? `${dir}/${stem}.md` : `${stem}.md`);
		let stem = basename;
		let index = 1;
		while (this.app.vault.getAbstractFileByPath(make(stem))) {
			stem = `${basename} ${index}`;
			index += 1;
		}
		return make(stem);
	}

	private async convertFile(file: TFile): Promise<void> {
		if (this.isTrackerFile(file.path)) {
			const leaf = this.app.workspace.getLeaf(false);
			await this.openAsTracker(leaf, file);
			return;
		}
		const raw = await this.app.vault.read(file);
		const doc = parseTracker(raw, this.settings.currency);
		doc.currency = doc.frontmatter.currency || this.settings.currency;
		const next = serializeTracker(doc);
		if (next !== raw) await this.app.vault.modify(file, next);
		const leaf = this.app.workspace.getLeaf(false);
		await this.openAsTracker(leaf, file);
		new Notice("This note is now a cost tracker.");
	}

	private buildFileMenu(menu: Menu, file: unknown): void {
		if (file instanceof TFolder) {
			menu.addItem((item) => {
				item.setTitle("New cost tracker").setIcon("wallet").onClick(() => {
					this.promptNewTracker(file);
				});
			});
			return;
		}
		if (!(file instanceof TFile) || file.extension !== "md") return;
		if (this.isTrackerFile(file.path)) {
			menu.addItem((item) => {
				item.setTitle("Open as cost tracker").setIcon("wallet").onClick(() => {
					const leaf = this.app.workspace.getLeaf(false);
					void this.openAsTracker(leaf, file);
				});
			});
			return;
		}
		menu.addItem((item) => {
			item.setTitle("Turn into cost tracker").setIcon("wallet").onClick(() => {
				void this.convertFile(file);
			});
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PluginSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
