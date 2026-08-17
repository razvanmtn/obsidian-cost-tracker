import { App, Modal, Notice, Setting } from "obsidian";
import { parseAmount, todayIso, uid } from "../format";
import { newExpense } from "../parser";
import type { Expense } from "../types";

export class ExpenseModal extends Modal {
	private amount = "";
	private category: string;
	private date: string;
	private merchant = "";
	private notes = "";

	constructor(
		app: App,
		private categories: string[],
		private existing: Expense | null,
		private onSubmit: (expense: Expense) => Promise<void>,
	) {
		super(app);
		this.amount = existing ? existing.amount.toFixed(2) : "";
		this.category = existing?.category ?? categories[0] ?? "";
		this.date = existing?.date || todayIso();
		this.merchant = existing?.merchant ?? "";
		this.notes = existing?.notes ?? "";
	}

	onOpen(): void {
		this.setTitle(this.existing ? "Edit expense" : "Add expense");
		this.modalEl.addEventListener("keydown", this.onEnter);
		const { contentEl } = this;

		new Setting(contentEl).setName("Amount").addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.step = "0.01";
			text.inputEl.min = "0";
			text.setPlaceholder("0.00");
			text.setValue(this.amount);
			text.onChange((value) => {
				this.amount = value;
			});
			window.setTimeout(() => text.inputEl.focus(), 20);
		});

		new Setting(contentEl).setName("Category").addText((text) => {
			text.setPlaceholder("Materials, Dining, Tools…");
			text.setValue(this.category);
			text.onChange((value) => {
				this.category = value;
			});
			if (this.categories.length > 0) {
				const listId = "ct-category-list";
				text.inputEl.setAttribute("list", listId);
				const datalist = contentEl.createEl("datalist", { attr: { id: listId } });
				for (const category of this.categories) {
					datalist.createEl("option", { attr: { value: category } });
				}
			}
		});

		new Setting(contentEl).setName("Date").addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.date);
			text.onChange((value) => {
				this.date = value;
			});
		});

		new Setting(contentEl).setName("Merchant").addText((text) => {
			text.setPlaceholder("Who was paid");
			text.setValue(this.merchant);
			text.onChange((value) => {
				this.merchant = value;
			});
		});

		new Setting(contentEl).setName("Notes").addText((text) => {
			text.setPlaceholder("Optional");
			text.setValue(this.notes);
			text.onChange((value) => {
				this.notes = value;
			});
		});

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText(this.existing ? "Save" : "Add")
				.setCta()
				.onClick(() => {
					void this.submit();
				});
		});
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
		const amount = parseAmount(this.amount);
		if (amount <= 0) {
			new Notice("Enter an amount greater than zero.");
			return;
		}
		const category = this.category.trim() || "Other";
		await this.onSubmit(
			newExpense({
				id: this.existing?.id ?? uid(),
				amount,
				category,
				date: this.date || todayIso(),
				merchant: this.merchant.trim(),
				notes: this.notes.trim(),
			}),
		);
		this.close();
	}
}
