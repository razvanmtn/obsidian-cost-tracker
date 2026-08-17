import { App, PluginSettingTab, Setting } from "obsidian";
import { CURRENCIES } from "./constants";
import type CostTrackerPlugin from "./main";

export class CostTrackerSettingTab extends PluginSettingTab {
	plugin: CostTrackerPlugin;

	constructor(app: App, plugin: CostTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("p", {
			text: "Each cost tracker is a normal markdown note. This only sets the currency for new files.",
		});

		new Setting(containerEl)
			.setName("Default currency")
			.setDesc("Used when you create a new tracker. Each file can override this in its frontmatter.")
			.addDropdown((dropdown) => {
				for (const code of CURRENCIES) {
					dropdown.addOption(code, code);
				}
				if (!CURRENCIES.includes(this.plugin.settings.currency as (typeof CURRENCIES)[number])) {
					dropdown.addOption(this.plugin.settings.currency, this.plugin.settings.currency);
				}
				dropdown.setValue(this.plugin.settings.currency);
				dropdown.onChange(async (value) => {
					this.plugin.settings.currency = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
