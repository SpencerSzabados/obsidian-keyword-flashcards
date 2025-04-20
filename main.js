'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const DEFAULT_SETTINGS = {
    includeDefinitions: true,
    includeTheorems: true,
    shuffleCards: true
};
class FlashcardsPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading flashcards plugin');
            yield this.loadSettings();
            // Add ribbon icon - fixed the arguments to match expected signature
            this.addRibbonIcon('dice', 'Flashcards', (evt) => {
                this.startFlashcardSession();
            });
            // Add command
            this.addCommand({
                id: 'start-flashcard-session',
                name: 'Start Flashcard Session',
                callback: () => {
                    this.startFlashcardSession();
                }
            });
            // Add settings tab
            this.addSettingTab(new FlashcardsSettingTab(this.app, this));
        });
    }
    onunload() {
        console.log('Unloading flashcards plugin');
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
    startFlashcardSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const flashcards = yield this.parseFlashcards();
            if (flashcards.length === 0) {
                new obsidian.Notice('No flashcards found. Make sure your notes contain blocks starting with "**Definition: (Name)**" or "**Theorem: (Name)**"');
                return;
            }
            if (this.settings.shuffleCards) {
                this.shuffleArray(flashcards);
            }
            new FlashcardModal(this.app, flashcards).open();
        });
    }
    parseFlashcards() {
        return __awaiter(this, void 0, void 0, function* () {
            const flashcards = [];
            const files = this.app.vault.getMarkdownFiles();
            for (const file of files) {
                const content = yield this.app.vault.read(file);
                const folder = this.getParentFolderName(file);
                // Find Definition blocks
                if (this.settings.includeDefinitions) {
                    const definitionRegex = /\*\*Definition:\s*([^*]+)\*\*\s*([\s\S]*?)(?=\n\s*\n|\n\s*\*\*|\n\s*#{1,6}\s|$)/gi;
                    let match;
                    while ((match = definitionRegex.exec(content)) !== null) {
                        const name = match[1].trim();
                        const cardContent = match[2].trim();
                        flashcards.push({
                            type: "Definition",
                            name,
                            content: cardContent,
                            source: file.path,
                            folder
                        });
                    }
                }
                // Find Theorem blocks
                if (this.settings.includeTheorems) {
                    const theoremRegex = /\*\*Theorem:\s*([^*]+)\*\*\s*([\s\S]*?)(?=\n\s*\n|\n\s*\*\*|\n\s*#{1,6}\s|$)/gi;
                    let match;
                    while ((match = theoremRegex.exec(content)) !== null) {
                        const name = match[1].trim();
                        const cardContent = match[2].trim();
                        flashcards.push({
                            type: "Theorem",
                            name,
                            content: cardContent,
                            source: file.path,
                            folder
                        });
                    }
                }
            }
            return flashcards;
        });
    }
    getParentFolderName(file) {
        const path = file.path;
        const lastSlashIndex = path.lastIndexOf('/');
        if (lastSlashIndex === -1) {
            return "Root";
        }
        const folderPath = path.substring(0, lastSlashIndex);
        const lastFolderSlashIndex = folderPath.lastIndexOf('/');
        if (lastFolderSlashIndex === -1) {
            return folderPath;
        }
        return folderPath.substring(lastFolderSlashIndex + 1);
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
class FlashcardModal extends obsidian.Modal {
    constructor(app, flashcards) {
        super(app);
        this.currentIndex = 0;
        this.showingAnswer = false;
        this.flashcards = flashcards;
    }
    onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("flashcard-modal");
        // Create header
        const headerEl = this.contentEl.createEl("div", { cls: "flashcard-header" });
        headerEl.createEl("h2", { text: "Flashcards" });
        headerEl.createEl("div", {
            cls: "flashcard-counter",
            text: `Card ${this.currentIndex + 1} of ${this.flashcards.length}`
        });
        // Create flashcard container
        const cardEl = this.contentEl.createEl("div", { cls: "flashcard-card" });
        this.displayCurrentFlashcard(cardEl);
        // Create controls
        const controlsEl = this.contentEl.createEl("div", { cls: "flashcard-controls" });
        const prevBtn = controlsEl.createEl("button", { text: "Previous" });
        prevBtn.addEventListener("click", () => {
            this.previousCard();
        });
        const flipBtn = controlsEl.createEl("button", { text: "Flip Card" });
        flipBtn.addEventListener("click", () => {
            this.flipCard();
        });
        const nextBtn = controlsEl.createEl("button", { text: "Next" });
        nextBtn.addEventListener("click", () => {
            this.nextCard();
        });
        // Add keyboard controls
        this.scope.register([], 'Enter', () => {
            if (this.showingAnswer) {
                this.nextCard();
            }
            else {
                this.flipCard();
            }
            return false;
        });
        this.scope.register([], 'Space', () => {
            if (this.showingAnswer) {
                this.nextCard();
            }
            else {
                this.flipCard();
            }
            return false;
        });
        this.scope.register([], 'ArrowLeft', () => {
            this.previousCard();
            return false;
        });
        this.scope.register([], 'ArrowRight', () => {
            if (this.showingAnswer) {
                this.nextCard();
            }
            else {
                this.flipCard();
            }
            return false;
        });
    }
    displayCurrentFlashcard(cardEl) {
        cardEl.empty();
        if (this.flashcards.length === 0) {
            cardEl.createEl("div", {
                cls: "flashcard-empty",
                text: "No flashcards found."
            });
            return;
        }
        const card = this.flashcards[this.currentIndex];
        // Update counter
        const counterEl = this.contentEl.querySelector(".flashcard-counter");
        if (counterEl) {
            counterEl.textContent = `Card ${this.currentIndex + 1} of ${this.flashcards.length}`;
        }
        if (!this.showingAnswer) {
            // Show front of card
            cardEl.createEl("div", { cls: "flashcard-type", text: card.type });
            cardEl.createEl("div", { cls: "flashcard-name", text: card.name });
            cardEl.createEl("div", { cls: "flashcard-folder", text: `Folder: ${card.folder}` });
            cardEl.createEl("div", {
                cls: "flashcard-instruction",
                text: "Press Enter or click 'Flip Card' to reveal"
            });
        }
        else {
            // Show back of card
            const contentEl = cardEl.createEl("div", { cls: "flashcard-content" });
            // Create a new component for markdown rendering
            const component = new obsidian.Component();
            component.load();
            // Use the newer render method from the example
            obsidian.MarkdownRenderer.renderMarkdown(card.content, contentEl, card.source, component);
            cardEl.createEl("div", {
                cls: "flashcard-source",
                text: `Source: ${card.source}`
            });
            cardEl.createEl("div", {
                cls: "flashcard-instruction",
                text: "Press Enter or click 'Next' to continue"
            });
        }
    }
    flipCard() {
        this.showingAnswer = !this.showingAnswer;
        const cardEl = this.contentEl.querySelector(".flashcard-card");
        this.displayCurrentFlashcard(cardEl);
    }
    nextCard() {
        if (this.currentIndex < this.flashcards.length - 1) {
            this.currentIndex++;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl);
        }
        else {
            // At the end of the deck
            new obsidian.Notice("End of flashcards reached!");
        }
    }
    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl);
        }
        else {
            // At the beginning of the deck
            new obsidian.Notice("You're at the first flashcard!");
        }
    }
}
class FlashcardsSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Flashcards Plugin Settings' });
        new obsidian.Setting(containerEl)
            .setName('Include Definitions')
            .setDesc('Extract flashcards from blocks starting with "**Definition: (Name)**"')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.includeDefinitions)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.includeDefinitions = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Include Theorems')
            .setDesc('Extract flashcards from blocks starting with "**Theorem: (Name)**"')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.includeTheorems)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.includeTheorems = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Shuffle Cards')
            .setDesc('Randomize the order of flashcards in each session')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.shuffleCards)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.shuffleCards = value;
            yield this.plugin.saveSettings();
        })));
    }
}

module.exports = FlashcardsPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcclxuXHJcbmludGVyZmFjZSBGbGFzaENhcmQge1xyXG4gICAgdHlwZTogc3RyaW5nOyAgICAgICAgICAgLy8gXCJEZWZpbml0aW9uXCIgb3IgXCJUaGVvcmVtXCJcclxuICAgIG5hbWU6IHN0cmluZzsgICAgICAgICAgIC8vIFRoZSBuYW1lIGNvbXBvbmVudFxyXG4gICAgY29udGVudDogc3RyaW5nOyAgICAgICAgLy8gVGhlIGJvZHkgY29udGVudFxyXG4gICAgc291cmNlOiBzdHJpbmc7ICAgICAgICAgLy8gU291cmNlIGZpbGUgcGF0aFxyXG4gICAgZm9sZGVyOiBzdHJpbmc7ICAgICAgICAgLy8gUGFyZW50IGZvbGRlciBuYW1lXHJcbn1cclxuXHJcbmludGVyZmFjZSBGbGFzaGNhcmRzUGx1Z2luU2V0dGluZ3Mge1xyXG4gICAgaW5jbHVkZURlZmluaXRpb25zOiBib29sZWFuO1xyXG4gICAgaW5jbHVkZVRoZW9yZW1zOiBib29sZWFuO1xyXG4gICAgc2h1ZmZsZUNhcmRzOiBib29sZWFuO1xyXG59XHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBGbGFzaGNhcmRzUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBpbmNsdWRlRGVmaW5pdGlvbnM6IHRydWUsXHJcbiAgICBpbmNsdWRlVGhlb3JlbXM6IHRydWUsXHJcbiAgICBzaHVmZmxlQ2FyZHM6IHRydWVcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRmxhc2hjYXJkc1BsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgICBzZXR0aW5nczogRmxhc2hjYXJkc1BsdWdpblNldHRpbmdzO1xyXG5cclxuICAgIGFzeW5jIG9ubG9hZCgpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnTG9hZGluZyBmbGFzaGNhcmRzIHBsdWdpbicpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XHJcblxyXG4gICAgICAgIC8vIEFkZCByaWJib24gaWNvbiAtIGZpeGVkIHRoZSBhcmd1bWVudHMgdG8gbWF0Y2ggZXhwZWN0ZWQgc2lnbmF0dXJlXHJcbiAgICAgICAgdGhpcy5hZGRSaWJib25JY29uKCdkaWNlJywgJ0ZsYXNoY2FyZHMnLCAoZXZ0OiBNb3VzZUV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBjb21tYW5kXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6ICdzdGFydC1mbGFzaGNhcmQtc2Vzc2lvbicsXHJcbiAgICAgICAgICAgIG5hbWU6ICdTdGFydCBGbGFzaGNhcmQgU2Vzc2lvbicsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXJ0Rmxhc2hjYXJkU2Vzc2lvbigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBzZXR0aW5ncyB0YWJcclxuICAgICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZsYXNoY2FyZHNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcbiAgICB9XHJcblxyXG4gICAgb251bmxvYWQoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1VubG9hZGluZyBmbGFzaGNhcmRzIHBsdWdpbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgICAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzdGFydEZsYXNoY2FyZFNlc3Npb24oKSB7XHJcbiAgICAgICAgY29uc3QgZmxhc2hjYXJkcyA9IGF3YWl0IHRoaXMucGFyc2VGbGFzaGNhcmRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGZsYXNoY2FyZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ05vIGZsYXNoY2FyZHMgZm91bmQuIE1ha2Ugc3VyZSB5b3VyIG5vdGVzIGNvbnRhaW4gYmxvY2tzIHN0YXJ0aW5nIHdpdGggXCIqKkRlZmluaXRpb246IChOYW1lKSoqXCIgb3IgXCIqKlRoZW9yZW06IChOYW1lKSoqXCInKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2h1ZmZsZUNhcmRzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2h1ZmZsZUFycmF5KGZsYXNoY2FyZHMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV3IEZsYXNoY2FyZE1vZGFsKHRoaXMuYXBwLCBmbGFzaGNhcmRzKS5vcGVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcGFyc2VGbGFzaGNhcmRzKCk6IFByb21pc2U8Rmxhc2hDYXJkW10+IHtcclxuICAgICAgICBjb25zdCBmbGFzaGNhcmRzOiBGbGFzaENhcmRbXSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlciA9IHRoaXMuZ2V0UGFyZW50Rm9sZGVyTmFtZShmaWxlKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEZpbmQgRGVmaW5pdGlvbiBibG9ja3NcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuaW5jbHVkZURlZmluaXRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkZWZpbml0aW9uUmVnZXggPSAvXFwqXFwqRGVmaW5pdGlvbjpcXHMqKFteKl0rKVxcKlxcKlxccyooW1xcc1xcU10qPykoPz1cXG5cXHMqXFxufFxcblxccypcXCpcXCp8XFxuXFxzKiN7MSw2fVxcc3wkKS9naTtcclxuICAgICAgICAgICAgICAgIGxldCBtYXRjaDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgd2hpbGUgKChtYXRjaCA9IGRlZmluaXRpb25SZWdleC5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBtYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FyZENvbnRlbnQgPSBtYXRjaFsyXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgZmxhc2hjYXJkcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJEZWZpbml0aW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNhcmRDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IGZpbGUucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9sZGVyXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEZpbmQgVGhlb3JlbSBibG9ja3NcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuaW5jbHVkZVRoZW9yZW1zKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0aGVvcmVtUmVnZXggPSAvXFwqXFwqVGhlb3JlbTpcXHMqKFteKl0rKVxcKlxcKlxccyooW1xcc1xcU10qPykoPz1cXG5cXHMqXFxufFxcblxccypcXCpcXCp8XFxuXFxzKiN7MSw2fVxcc3wkKS9naTtcclxuICAgICAgICAgICAgICAgIGxldCBtYXRjaDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgd2hpbGUgKChtYXRjaCA9IHRoZW9yZW1SZWdleC5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBtYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FyZENvbnRlbnQgPSBtYXRjaFsyXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgZmxhc2hjYXJkcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJUaGVvcmVtXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNhcmRDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6IGZpbGUucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9sZGVyXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBmbGFzaGNhcmRzO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBhcmVudEZvbGRlck5hbWUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IHBhdGggPSBmaWxlLnBhdGg7XHJcbiAgICAgICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJSb290XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZvbGRlclBhdGggPSBwYXRoLnN1YnN0cmluZygwLCBsYXN0U2xhc2hJbmRleCk7XHJcbiAgICAgICAgY29uc3QgbGFzdEZvbGRlclNsYXNoSW5kZXggPSBmb2xkZXJQYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RGb2xkZXJTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVyUGF0aDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZvbGRlclBhdGguc3Vic3RyaW5nKGxhc3RGb2xkZXJTbGFzaEluZGV4ICsgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2h1ZmZsZUFycmF5KGFycmF5OiBhbnlbXSkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGogPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoaSArIDEpKTtcclxuICAgICAgICAgICAgW2FycmF5W2ldLCBhcnJheVtqXV0gPSBbYXJyYXlbal0sIGFycmF5W2ldXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmNsYXNzIEZsYXNoY2FyZE1vZGFsIGV4dGVuZHMgTW9kYWwge1xyXG4gICAgZmxhc2hjYXJkczogRmxhc2hDYXJkW107XHJcbiAgICBjdXJyZW50SW5kZXg6IG51bWJlciA9IDA7XHJcbiAgICBzaG93aW5nQW5zd2VyOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGZsYXNoY2FyZHM6IEZsYXNoQ2FyZFtdKSB7XHJcbiAgICAgICAgc3VwZXIoYXBwKTtcclxuICAgICAgICB0aGlzLmZsYXNoY2FyZHMgPSBmbGFzaGNhcmRzO1xyXG4gICAgfVxyXG5cclxuICAgIG9uT3BlbigpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xyXG4gICAgICAgIHRoaXMuY29udGVudEVsLmFkZENsYXNzKFwiZmxhc2hjYXJkLW1vZGFsXCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENyZWF0ZSBoZWFkZXJcclxuICAgICAgICBjb25zdCBoZWFkZXJFbCA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1oZWFkZXJcIiB9KTtcclxuICAgICAgICBoZWFkZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJGbGFzaGNhcmRzXCIgfSk7XHJcbiAgICAgICAgaGVhZGVyRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgY2xzOiBcImZsYXNoY2FyZC1jb3VudGVyXCIsIFxyXG4gICAgICAgICAgICB0ZXh0OiBgQ2FyZCAke3RoaXMuY3VycmVudEluZGV4ICsgMX0gb2YgJHt0aGlzLmZsYXNoY2FyZHMubGVuZ3RofWAgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBmbGFzaGNhcmQgY29udGFpbmVyXHJcbiAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNhcmRcIiB9KTtcclxuICAgICAgICB0aGlzLmRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbCk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBjb250cm9sc1xyXG4gICAgICAgIGNvbnN0IGNvbnRyb2xzRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtY29udHJvbHNcIiB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBwcmV2QnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiUHJldmlvdXNcIiB9KTtcclxuICAgICAgICBwcmV2QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNDYXJkKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmxpcEJ0biA9IGNvbnRyb2xzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkZsaXAgQ2FyZFwiIH0pO1xyXG4gICAgICAgIGZsaXBCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IG5leHRCdG4gPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJOZXh0XCIgfSk7XHJcbiAgICAgICAgbmV4dEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLm5leHRDYXJkKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBrZXlib2FyZCBjb250cm9sc1xyXG4gICAgICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW10sICdFbnRlcicsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ1NwYWNlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5leHRDYXJkKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDYXJkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnQXJyb3dMZWZ0JywgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzQ2FyZCgpO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW10sICdBcnJvd1JpZ2h0JywgKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5leHRDYXJkKCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZsaXBDYXJkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbDogSFRNTEVsZW1lbnQpIHtcclxuICAgICAgICBjYXJkRWwuZW1wdHkoKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5mbGFzaGNhcmRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtZW1wdHlcIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIk5vIGZsYXNoY2FyZHMgZm91bmQuXCIgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNhcmQgPSB0aGlzLmZsYXNoY2FyZHNbdGhpcy5jdXJyZW50SW5kZXhdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFVwZGF0ZSBjb3VudGVyXHJcbiAgICAgICAgY29uc3QgY291bnRlckVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY291bnRlclwiKTtcclxuICAgICAgICBpZiAoY291bnRlckVsKSB7XHJcbiAgICAgICAgICAgIGNvdW50ZXJFbC50ZXh0Q29udGVudCA9IGBDYXJkICR7dGhpcy5jdXJyZW50SW5kZXggKyAxfSBvZiAke3RoaXMuZmxhc2hjYXJkcy5sZW5ndGh9YDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCF0aGlzLnNob3dpbmdBbnN3ZXIpIHtcclxuICAgICAgICAgICAgLy8gU2hvdyBmcm9udCBvZiBjYXJkXHJcbiAgICAgICAgICAgIGNvbnN0IHR5cGVFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtdHlwZVwiLCB0ZXh0OiBjYXJkLnR5cGUgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtbmFtZVwiLCB0ZXh0OiBjYXJkLm5hbWUgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlckVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1mb2xkZXJcIiwgdGV4dDogYEZvbGRlcjogJHtjYXJkLmZvbGRlcn1gIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25FbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IFxyXG4gICAgICAgICAgICAgICAgY2xzOiBcImZsYXNoY2FyZC1pbnN0cnVjdGlvblwiLCBcclxuICAgICAgICAgICAgICAgIHRleHQ6IFwiUHJlc3MgRW50ZXIgb3IgY2xpY2sgJ0ZsaXAgQ2FyZCcgdG8gcmV2ZWFsXCIgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIFNob3cgYmFjayBvZiBjYXJkXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtY29udGVudFwiIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGNvbXBvbmVudCBmb3IgbWFya2Rvd24gcmVuZGVyaW5nXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBDb21wb25lbnQoKTtcclxuICAgICAgICAgICAgY29tcG9uZW50LmxvYWQoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFVzZSB0aGUgbmV3ZXIgcmVuZGVyIG1ldGhvZCBmcm9tIHRoZSBleGFtcGxlXHJcbiAgICAgICAgICAgIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oXHJcbiAgICAgICAgICAgICAgICBjYXJkLmNvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50RWwsXHJcbiAgICAgICAgICAgICAgICBjYXJkLnNvdXJjZSxcclxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3Qgc291cmNlRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtc291cmNlXCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogYFNvdXJjZTogJHtjYXJkLnNvdXJjZX1gIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtaW5zdHJ1Y3Rpb25cIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlByZXNzIEVudGVyIG9yIGNsaWNrICdOZXh0JyB0byBjb250aW51ZVwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZmxpcENhcmQoKSB7XHJcbiAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gIXRoaXMuc2hvd2luZ0Fuc3dlcjtcclxuICAgICAgICBjb25zdCBjYXJkRWwgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKFwiLmZsYXNoY2FyZC1jYXJkXCIpO1xyXG4gICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBuZXh0Q2FyZCgpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJyZW50SW5kZXggPCB0aGlzLmZsYXNoY2FyZHMubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleCsrO1xyXG4gICAgICAgICAgICB0aGlzLnNob3dpbmdBbnN3ZXIgPSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY2FyZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEF0IHRoZSBlbmQgb2YgdGhlIGRlY2tcclxuICAgICAgICAgICAgbmV3IE5vdGljZShcIkVuZCBvZiBmbGFzaGNhcmRzIHJlYWNoZWQhXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcmV2aW91c0NhcmQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEluZGV4ID4gMCkge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleC0tO1xyXG4gICAgICAgICAgICB0aGlzLnNob3dpbmdBbnN3ZXIgPSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY2FyZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGRlY2tcclxuICAgICAgICAgICAgbmV3IE5vdGljZShcIllvdSdyZSBhdCB0aGUgZmlyc3QgZmxhc2hjYXJkIVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmNsYXNzIEZsYXNoY2FyZHNTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XHJcbiAgICBwbHVnaW46IEZsYXNoY2FyZHNQbHVnaW47XHJcblxyXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogRmxhc2hjYXJkc1BsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIH1cclxuXHJcbiAgICBkaXNwbGF5KCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHtjb250YWluZXJFbH0gPSB0aGlzO1xyXG5cclxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xyXG5cclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7dGV4dDogJ0ZsYXNoY2FyZHMgUGx1Z2luIFNldHRpbmdzJ30pO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgLnNldE5hbWUoJ0luY2x1ZGUgRGVmaW5pdGlvbnMnKVxyXG4gICAgICAgICAgICAuc2V0RGVzYygnRXh0cmFjdCBmbGFzaGNhcmRzIGZyb20gYmxvY2tzIHN0YXJ0aW5nIHdpdGggXCIqKkRlZmluaXRpb246IChOYW1lKSoqXCInKVxyXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlRGVmaW5pdGlvbnMpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5jbHVkZURlZmluaXRpb25zID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnSW5jbHVkZSBUaGVvcmVtcycpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdFeHRyYWN0IGZsYXNoY2FyZHMgZnJvbSBibG9ja3Mgc3RhcnRpbmcgd2l0aCBcIioqVGhlb3JlbTogKE5hbWUpKipcIicpXHJcbiAgICAgICAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluY2x1ZGVUaGVvcmVtcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlVGhlb3JlbXMgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdTaHVmZmxlIENhcmRzJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1JhbmRvbWl6ZSB0aGUgb3JkZXIgb2YgZmxhc2hjYXJkcyBpbiBlYWNoIHNlc3Npb24nKVxyXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaHVmZmxlQ2FyZHMpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2h1ZmZsZUNhcmRzID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICB9XHJcbn0iXSwibmFtZXMiOlsiUGx1Z2luIiwiTm90aWNlIiwiTW9kYWwiLCJDb21wb25lbnQiLCJNYXJrZG93blJlbmRlcmVyIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsTUFBTSxnQkFBZ0IsR0FBNkI7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
