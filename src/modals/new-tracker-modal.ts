import { App, Modal, Setting } from "obsidian";

export class NewTrackerModal extends Modal {
	private name: string;

	constructor(
		app: App,
		defaultName: string,
		private onSubmit: (name: string) => Promise<void>,
	) {
		super(app);
		this.name = defaultName;
	}

	onOpen(): void {
		this.setTitle("New cost tracker");
		new Setting(this.contentEl).setName("Name").addText((text) => {
			text.setValue(this.name);
			text.onChange((value) => {
				this.name = value;
			});
			text.inputEl.focus();
			text.inputEl.select();
		});
		new Setting(this.contentEl).addButton((button) => {
			button
				.setButtonText("Create")
				.setCta()
				.onClick(() => {
					void this.submit();
				});
		});
		this.modalEl.addEventListener("keydown", this.onEnter);
	}

	onClose(): void {
		this.modalEl.removeEventListener("keydown", this.onEnter);
		this.contentEl.empty();
	}

	private onEnter = (event: KeyboardEvent): void => {
		if (event.key === "Enter") {
			event.preventDefault();
			void this.submit();
		}
	};

	private async submit(): Promise<void> {
		const name = this.name.trim() || "Expenses";
		this.close();
		await this.onSubmit(name);
	}
}
