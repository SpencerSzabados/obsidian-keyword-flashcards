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
            // Process content as markdown
            const processedContent = card.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .split('\n').join('<br>');
            contentEl.innerHTML = processedContent;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XHJcblxyXG5pbnRlcmZhY2UgRmxhc2hDYXJkIHtcclxuICAgIHR5cGU6IHN0cmluZzsgICAgICAgICAgIC8vIFwiRGVmaW5pdGlvblwiIG9yIFwiVGhlb3JlbVwiXHJcbiAgICBuYW1lOiBzdHJpbmc7ICAgICAgICAgICAvLyBUaGUgbmFtZSBjb21wb25lbnRcclxuICAgIGNvbnRlbnQ6IHN0cmluZzsgICAgICAgIC8vIFRoZSBib2R5IGNvbnRlbnRcclxuICAgIHNvdXJjZTogc3RyaW5nOyAgICAgICAgIC8vIFNvdXJjZSBmaWxlIHBhdGhcclxuICAgIGZvbGRlcjogc3RyaW5nOyAgICAgICAgIC8vIFBhcmVudCBmb2xkZXIgbmFtZVxyXG59XHJcblxyXG5pbnRlcmZhY2UgRmxhc2hjYXJkc1BsdWdpblNldHRpbmdzIHtcclxuICAgIGluY2x1ZGVEZWZpbml0aW9uczogYm9vbGVhbjtcclxuICAgIGluY2x1ZGVUaGVvcmVtczogYm9vbGVhbjtcclxuICAgIHNodWZmbGVDYXJkczogYm9vbGVhbjtcclxufVxyXG5cclxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogRmxhc2hjYXJkc1BsdWdpblNldHRpbmdzID0ge1xyXG4gICAgaW5jbHVkZURlZmluaXRpb25zOiB0cnVlLFxyXG4gICAgaW5jbHVkZVRoZW9yZW1zOiB0cnVlLFxyXG4gICAgc2h1ZmZsZUNhcmRzOiB0cnVlXHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZsYXNoY2FyZHNQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gICAgc2V0dGluZ3M6IEZsYXNoY2FyZHNQbHVnaW5TZXR0aW5ncztcclxuXHJcbiAgICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0xvYWRpbmcgZmxhc2hjYXJkcyBwbHVnaW4nKTtcclxuICAgICAgICBcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgICAgICAvLyBBZGQgcmliYm9uIGljb24gLSBmaXhlZCB0aGUgYXJndW1lbnRzIHRvIG1hdGNoIGV4cGVjdGVkIHNpZ25hdHVyZVxyXG4gICAgICAgIHRoaXMuYWRkUmliYm9uSWNvbignZGljZScsICdGbGFzaGNhcmRzJywgKGV2dDogTW91c2VFdmVudCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0Rmxhc2hjYXJkU2Vzc2lvbigpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgY29tbWFuZFxyXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgICAgICAgIGlkOiAnc3RhcnQtZmxhc2hjYXJkLXNlc3Npb24nLFxyXG4gICAgICAgICAgICBuYW1lOiAnU3RhcnQgRmxhc2hjYXJkIFNlc3Npb24nLFxyXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGFydEZsYXNoY2FyZFNlc3Npb24oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgc2V0dGluZ3MgdGFiXHJcbiAgICAgICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBGbGFzaGNhcmRzU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG4gICAgfVxyXG5cclxuICAgIG9udW5sb2FkKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdVbmxvYWRpbmcgZmxhc2hjYXJkcyBwbHVnaW4nKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCkge1xyXG4gICAgICAgIGNvbnN0IGZsYXNoY2FyZHMgPSBhd2FpdCB0aGlzLnBhcnNlRmxhc2hjYXJkcygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChmbGFzaGNhcmRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBuZXcgTm90aWNlKCdObyBmbGFzaGNhcmRzIGZvdW5kLiBNYWtlIHN1cmUgeW91ciBub3RlcyBjb250YWluIGJsb2NrcyBzdGFydGluZyB3aXRoIFwiKipEZWZpbml0aW9uOiAoTmFtZSkqKlwiIG9yIFwiKipUaGVvcmVtOiAoTmFtZSkqKlwiJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLnNodWZmbGVDYXJkcykge1xyXG4gICAgICAgICAgICB0aGlzLnNodWZmbGVBcnJheShmbGFzaGNhcmRzKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5ldyBGbGFzaGNhcmRNb2RhbCh0aGlzLmFwcCwgZmxhc2hjYXJkcykub3BlbigpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHBhcnNlRmxhc2hjYXJkcygpOiBQcm9taXNlPEZsYXNoQ2FyZFtdPiB7XHJcbiAgICAgICAgY29uc3QgZmxhc2hjYXJkczogRmxhc2hDYXJkW10gPSBbXTtcclxuICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xyXG4gICAgICAgICAgICBjb25zdCBmb2xkZXIgPSB0aGlzLmdldFBhcmVudEZvbGRlck5hbWUoZmlsZSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBGaW5kIERlZmluaXRpb24gYmxvY2tzXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmluY2x1ZGVEZWZpbml0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGVmaW5pdGlvblJlZ2V4ID0gL1xcKlxcKkRlZmluaXRpb246XFxzKihbXipdKylcXCpcXCpcXHMqKFtcXHNcXFNdKj8pKD89XFxuXFxzKlxcbnxcXG5cXHMqXFwqXFwqfFxcblxccyojezEsNn1cXHN8JCkvZ2k7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2g7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHdoaWxlICgobWF0Y2ggPSBkZWZpbml0aW9uUmVnZXguZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gbWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhcmRDb250ZW50ID0gbWF0Y2hbMl0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGZsYXNoY2FyZHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiRGVmaW5pdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBjYXJkQ29udGVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiBmaWxlLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlclxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBGaW5kIFRoZW9yZW0gYmxvY2tzXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmluY2x1ZGVUaGVvcmVtcykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdGhlb3JlbVJlZ2V4ID0gL1xcKlxcKlRoZW9yZW06XFxzKihbXipdKylcXCpcXCpcXHMqKFtcXHNcXFNdKj8pKD89XFxuXFxzKlxcbnxcXG5cXHMqXFwqXFwqfFxcblxccyojezEsNn1cXHN8JCkvZ2k7XHJcbiAgICAgICAgICAgICAgICBsZXQgbWF0Y2g7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHdoaWxlICgobWF0Y2ggPSB0aGVvcmVtUmVnZXguZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gbWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhcmRDb250ZW50ID0gbWF0Y2hbMl0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGZsYXNoY2FyZHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwiVGhlb3JlbVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBjYXJkQ29udGVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiBmaWxlLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlclxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gZmxhc2hjYXJkcztcclxuICAgIH1cclxuXHJcbiAgICBnZXRQYXJlbnRGb2xkZXJOYW1lKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBwYXRoID0gZmlsZS5wYXRoO1xyXG4gICAgICAgIGNvbnN0IGxhc3RTbGFzaEluZGV4ID0gcGF0aC5sYXN0SW5kZXhPZignLycpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChsYXN0U2xhc2hJbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiUm9vdFwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBmb2xkZXJQYXRoID0gcGF0aC5zdWJzdHJpbmcoMCwgbGFzdFNsYXNoSW5kZXgpO1xyXG4gICAgICAgIGNvbnN0IGxhc3RGb2xkZXJTbGFzaEluZGV4ID0gZm9sZGVyUGF0aC5sYXN0SW5kZXhPZignLycpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChsYXN0Rm9sZGVyU2xhc2hJbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlclBhdGg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmb2xkZXJQYXRoLnN1YnN0cmluZyhsYXN0Rm9sZGVyU2xhc2hJbmRleCArIDEpO1xyXG4gICAgfVxyXG5cclxuICAgIHNodWZmbGVBcnJheShhcnJheTogYW55W10pIHtcclxuICAgICAgICBmb3IgKGxldCBpID0gYXJyYXkubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSkge1xyXG4gICAgICAgICAgICBjb25zdCBqID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGkgKyAxKSk7XHJcbiAgICAgICAgICAgIFthcnJheVtpXSwgYXJyYXlbal1dID0gW2FycmF5W2pdLCBhcnJheVtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5jbGFzcyBGbGFzaGNhcmRNb2RhbCBleHRlbmRzIE1vZGFsIHtcclxuICAgIGZsYXNoY2FyZHM6IEZsYXNoQ2FyZFtdO1xyXG4gICAgY3VycmVudEluZGV4OiBudW1iZXIgPSAwO1xyXG4gICAgc2hvd2luZ0Fuc3dlcjogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBmbGFzaGNhcmRzOiBGbGFzaENhcmRbXSkge1xyXG4gICAgICAgIHN1cGVyKGFwcCk7XHJcbiAgICAgICAgdGhpcy5mbGFzaGNhcmRzID0gZmxhc2hjYXJkcztcclxuICAgIH1cclxuXHJcbiAgICBvbk9wZW4oKSB7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImZsYXNoY2FyZC1tb2RhbFwiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBDcmVhdGUgaGVhZGVyXHJcbiAgICAgICAgY29uc3QgaGVhZGVyRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtaGVhZGVyXCIgfSk7XHJcbiAgICAgICAgaGVhZGVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiRmxhc2hjYXJkc1wiIH0pO1xyXG4gICAgICAgIGhlYWRlckVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtY291bnRlclwiLCBcclxuICAgICAgICAgICAgdGV4dDogYENhcmQgJHt0aGlzLmN1cnJlbnRJbmRleCArIDF9IG9mICR7dGhpcy5mbGFzaGNhcmRzLmxlbmd0aH1gIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgZmxhc2hjYXJkIGNvbnRhaW5lclxyXG4gICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1jYXJkXCIgfSk7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwpO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgY29udHJvbHNcclxuICAgICAgICBjb25zdCBjb250cm9sc0VsID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNvbnRyb2xzXCIgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcHJldkJ0biA9IGNvbnRyb2xzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlByZXZpb3VzXCIgfSk7XHJcbiAgICAgICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzQ2FyZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZsaXBCdG4gPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJGbGlwIENhcmRcIiB9KTtcclxuICAgICAgICBmbGlwQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuZmxpcENhcmQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBuZXh0QnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiTmV4dFwiIH0pO1xyXG4gICAgICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQga2V5Ym9hcmQgY29udHJvbHNcclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnRW50ZXInLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNob3dpbmdBbnN3ZXIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmV4dENhcmQoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcENhcmQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW10sICdTcGFjZScsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ0Fycm93TGVmdCcsICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NhcmQoKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnQXJyb3dSaWdodCcsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWw6IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgY2FyZEVsLmVtcHR5KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuZmxhc2hjYXJkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWVtcHR5XCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJObyBmbGFzaGNhcmRzIGZvdW5kLlwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjYXJkID0gdGhpcy5mbGFzaGNhcmRzW3RoaXMuY3VycmVudEluZGV4XTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBVcGRhdGUgY291bnRlclxyXG4gICAgICAgIGNvbnN0IGNvdW50ZXJFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNvdW50ZXJcIik7XHJcbiAgICAgICAgaWYgKGNvdW50ZXJFbCkge1xyXG4gICAgICAgICAgICBjb3VudGVyRWwudGV4dENvbnRlbnQgPSBgQ2FyZCAke3RoaXMuY3VycmVudEluZGV4ICsgMX0gb2YgJHt0aGlzLmZsYXNoY2FyZHMubGVuZ3RofWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghdGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgIC8vIFNob3cgZnJvbnQgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCB0eXBlRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLXR5cGVcIiwgdGV4dDogY2FyZC50eXBlIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLW5hbWVcIiwgdGV4dDogY2FyZC5uYW1lIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtZm9sZGVyXCIsIHRleHQ6IGBGb2xkZXI6ICR7Y2FyZC5mb2xkZXJ9YCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtaW5zdHJ1Y3Rpb25cIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlByZXNzIEVudGVyIG9yIGNsaWNrICdGbGlwIENhcmQnIHRvIHJldmVhbFwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBTaG93IGJhY2sgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50RWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNvbnRlbnRcIiB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFByb2Nlc3MgY29udGVudCBhcyBtYXJrZG93blxyXG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWRDb250ZW50ID0gY2FyZC5jb250ZW50XHJcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFwqXFwqKC4qPylcXCpcXCovZywgJzxzdHJvbmc+JDE8L3N0cm9uZz4nKVxyXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL18oLio/KV8vZywgJzxlbT4kMTwvZW0+JylcclxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9gKC4qPylgL2csICc8Y29kZT4kMTwvY29kZT4nKVxyXG4gICAgICAgICAgICAgICAgLnNwbGl0KCdcXG4nKS5qb2luKCc8YnI+Jyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb250ZW50RWwuaW5uZXJIVE1MID0gcHJvY2Vzc2VkQ29udGVudDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZUVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLXNvdXJjZVwiLCBcclxuICAgICAgICAgICAgICAgIHRleHQ6IGBTb3VyY2U6ICR7Y2FyZC5zb3VyY2V9YCBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBpbnN0cnVjdGlvbkVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWluc3RydWN0aW9uXCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJQcmVzcyBFbnRlciBvciBjbGljayAnTmV4dCcgdG8gY29udGludWVcIiBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZsaXBDYXJkKCkge1xyXG4gICAgICAgIHRoaXMuc2hvd2luZ0Fuc3dlciA9ICF0aGlzLnNob3dpbmdBbnN3ZXI7XHJcbiAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY2FyZFwiKTtcclxuICAgICAgICB0aGlzLmRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbCBhcyBIVE1MRWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmV4dENhcmQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEluZGV4IDwgdGhpcy5mbGFzaGNhcmRzLmxlbmd0aCAtIDEpIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgrKztcclxuICAgICAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBdCB0aGUgZW5kIG9mIHRoZSBkZWNrXHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJFbmQgb2YgZmxhc2hjYXJkcyByZWFjaGVkIVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJldmlvdXNDYXJkKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgtLTtcclxuICAgICAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBkZWNrXHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJZb3UncmUgYXQgdGhlIGZpcnN0IGZsYXNoY2FyZCFcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5jbGFzcyBGbGFzaGNhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGbGFzaGNhcmRzUGx1Z2luO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IEZsYXNoY2FyZHNQbHVnaW4pIHtcclxuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuXHJcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdGbGFzaGNhcmRzIFBsdWdpbiBTZXR0aW5ncyd9KTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdJbmNsdWRlIERlZmluaXRpb25zJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ0V4dHJhY3QgZmxhc2hjYXJkcyBmcm9tIGJsb2NrcyBzdGFydGluZyB3aXRoIFwiKipEZWZpbml0aW9uOiAoTmFtZSkqKlwiJylcclxuICAgICAgICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5jbHVkZURlZmluaXRpb25zKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmluY2x1ZGVEZWZpbml0aW9ucyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgLnNldE5hbWUoJ0luY2x1ZGUgVGhlb3JlbXMnKVxyXG4gICAgICAgICAgICAuc2V0RGVzYygnRXh0cmFjdCBmbGFzaGNhcmRzIGZyb20gYmxvY2tzIHN0YXJ0aW5nIHdpdGggXCIqKlRoZW9yZW06IChOYW1lKSoqXCInKVxyXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlVGhlb3JlbXMpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5jbHVkZVRoZW9yZW1zID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnU2h1ZmZsZSBDYXJkcycpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdSYW5kb21pemUgdGhlIG9yZGVyIG9mIGZsYXNoY2FyZHMgaW4gZWFjaCBzZXNzaW9uJylcclxuICAgICAgICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2h1ZmZsZUNhcmRzKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNodWZmbGVDYXJkcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgfVxyXG59Il0sIm5hbWVzIjpbIlBsdWdpbiIsIk5vdGljZSIsIk1vZGFsIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsTUFBTSxnQkFBZ0IsR0FBNkI7QUFDL0MsSUFBQSxrQkFBa0IsRUFBRSxJQUFJO0FBQ3hCLElBQUEsZUFBZSxFQUFFLElBQUk7QUFDckIsSUFBQSxZQUFZLEVBQUUsSUFBSTtDQUNyQixDQUFBO0FBRW9CLE1BQUEsZ0JBQWlCLFNBQVFBLGVBQU0sQ0FBQTtJQUcxQyxNQUFNLEdBQUE7O0FBQ1IsWUFBQSxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7QUFFekMsWUFBQSxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQzs7WUFHMUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLENBQUMsR0FBZSxLQUFJO2dCQUN6RCxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztBQUNqQyxhQUFDLENBQUMsQ0FBQzs7WUFHSCxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ1osZ0JBQUEsRUFBRSxFQUFFLHlCQUF5QjtBQUM3QixnQkFBQSxJQUFJLEVBQUUseUJBQXlCO2dCQUMvQixRQUFRLEVBQUUsTUFBSztvQkFDWCxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztpQkFDaEM7QUFDSixhQUFBLENBQUMsQ0FBQzs7QUFHSCxZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7U0FDaEUsQ0FBQSxDQUFBO0FBQUEsS0FBQTtJQUVELFFBQVEsR0FBQTtBQUNKLFFBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0tBQzlDO0lBRUssWUFBWSxHQUFBOztBQUNkLFlBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1NBQzlFLENBQUEsQ0FBQTtBQUFBLEtBQUE7SUFFSyxZQUFZLEdBQUE7O1lBQ2QsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUN0QyxDQUFBLENBQUE7QUFBQSxLQUFBO0lBRUsscUJBQXFCLEdBQUE7O0FBQ3ZCLFlBQUEsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7QUFFaEQsWUFBQSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3pCLGdCQUFBLElBQUlDLGVBQU0sQ0FBQywwSEFBMEgsQ0FBQyxDQUFDO2dCQUN2SSxPQUFPO0FBQ1YsYUFBQTtBQUVELFlBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRTtBQUM1QixnQkFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2pDLGFBQUE7WUFFRCxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1NBQ25ELENBQUEsQ0FBQTtBQUFBLEtBQUE7SUFFSyxlQUFlLEdBQUE7O1lBQ2pCLE1BQU0sVUFBVSxHQUFnQixFQUFFLENBQUM7WUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztBQUVoRCxZQUFBLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO0FBQ3RCLGdCQUFBLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNoRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRzlDLGdCQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRTtvQkFDbEMsTUFBTSxlQUFlLEdBQUcsbUZBQW1GLENBQUM7QUFDNUcsb0JBQUEsSUFBSSxLQUFLLENBQUM7QUFFVixvQkFBQSxPQUFPLENBQUMsS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxFQUFFO3dCQUNyRCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQzdCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFFcEMsVUFBVSxDQUFDLElBQUksQ0FBQztBQUNaLDRCQUFBLElBQUksRUFBRSxZQUFZOzRCQUNsQixJQUFJO0FBQ0osNEJBQUEsT0FBTyxFQUFFLFdBQVc7NEJBQ3BCLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSTs0QkFDakIsTUFBTTtBQUNULHlCQUFBLENBQUMsQ0FBQztBQUNOLHFCQUFBO0FBQ0osaUJBQUE7O0FBR0QsZ0JBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFBRTtvQkFDL0IsTUFBTSxZQUFZLEdBQUcsZ0ZBQWdGLENBQUM7QUFDdEcsb0JBQUEsSUFBSSxLQUFLLENBQUM7QUFFVixvQkFBQSxPQUFPLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxFQUFFO3dCQUNsRCxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQzdCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFFcEMsVUFBVSxDQUFDLElBQUksQ0FBQztBQUNaLDRCQUFBLElBQUksRUFBRSxTQUFTOzRCQUNmLElBQUk7QUFDSiw0QkFBQSxPQUFPLEVBQUUsV0FBVzs0QkFDcEIsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJOzRCQUNqQixNQUFNO0FBQ1QseUJBQUEsQ0FBQyxDQUFDO0FBQ04scUJBQUE7QUFDSixpQkFBQTtBQUNKLGFBQUE7QUFFRCxZQUFBLE9BQU8sVUFBVSxDQUFDO1NBQ3JCLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFFRCxJQUFBLG1CQUFtQixDQUFDLElBQVcsRUFBQTtBQUMzQixRQUFBLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdkIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUU3QyxRQUFBLElBQUksY0FBYyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ3ZCLFlBQUEsT0FBTyxNQUFNLENBQUM7QUFDakIsU0FBQTtRQUVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3JELE1BQU0sb0JBQW9CLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUV6RCxRQUFBLElBQUksb0JBQW9CLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDN0IsWUFBQSxPQUFPLFVBQVUsQ0FBQztBQUNyQixTQUFBO1FBRUQsT0FBTyxVQUFVLENBQUMsU0FBUyxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQ3pEO0FBRUQsSUFBQSxZQUFZLENBQUMsS0FBWSxFQUFBO0FBQ3JCLFFBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3ZDLFlBQUEsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDL0MsU0FBQTtLQUNKO0FBQ0osQ0FBQTtBQUVELE1BQU0sY0FBZSxTQUFRQyxjQUFLLENBQUE7SUFLOUIsV0FBWSxDQUFBLEdBQVEsRUFBRSxVQUF1QixFQUFBO1FBQ3pDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUpmLElBQVksQ0FBQSxZQUFBLEdBQVcsQ0FBQyxDQUFDO1FBQ3pCLElBQWEsQ0FBQSxhQUFBLEdBQVksS0FBSyxDQUFDO0FBSTNCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7S0FDaEM7SUFFRCxNQUFNLEdBQUE7QUFDRixRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDdkIsUUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDOztBQUczQyxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDN0UsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQztBQUNoRCxRQUFBLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO0FBQ3JCLFlBQUEsR0FBRyxFQUFFLG1CQUFtQjtBQUN4QixZQUFBLElBQUksRUFBRSxDQUFBLEtBQUEsRUFBUSxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQSxJQUFBLEVBQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUUsQ0FBQTtBQUNyRSxTQUFBLENBQUMsQ0FBQzs7QUFHSCxRQUFBLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7QUFDekUsUUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7O0FBR3JDLFFBQUEsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQztBQUVqRixRQUFBLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDcEUsUUFBQSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQUs7WUFDbkMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3hCLFNBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBQSxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO0FBQ3JFLFFBQUEsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxNQUFLO1lBQ25DLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNwQixTQUFDLENBQUMsQ0FBQztBQUVILFFBQUEsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNoRSxRQUFBLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsTUFBSztZQUNuQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7QUFDcEIsU0FBQyxDQUFDLENBQUM7O1FBR0gsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFLO1lBQ2xDLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDcEIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ25CLGFBQUE7QUFBTSxpQkFBQTtnQkFDSCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7QUFDbkIsYUFBQTtBQUNELFlBQUEsT0FBTyxLQUFLLENBQUM7QUFDakIsU0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLE1BQUs7WUFDbEMsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNwQixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7QUFDbkIsYUFBQTtBQUFNLGlCQUFBO2dCQUNILElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNuQixhQUFBO0FBQ0QsWUFBQSxPQUFPLEtBQUssQ0FBQztBQUNqQixTQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBSztZQUN0QyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7QUFDcEIsWUFBQSxPQUFPLEtBQUssQ0FBQztBQUNqQixTQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxZQUFZLEVBQUUsTUFBSztZQUN2QyxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ3BCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNuQixhQUFBO0FBQU0saUJBQUE7Z0JBQ0gsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ25CLGFBQUE7QUFDRCxZQUFBLE9BQU8sS0FBSyxDQUFDO0FBQ2pCLFNBQUMsQ0FBQyxDQUFDO0tBQ047QUFFRCxJQUFBLHVCQUF1QixDQUFDLE1BQW1CLEVBQUE7UUFDdkMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBRWYsUUFBQSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM5QixZQUFBLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO0FBQ25CLGdCQUFBLEdBQUcsRUFBRSxpQkFBaUI7QUFDdEIsZ0JBQUEsSUFBSSxFQUFFLHNCQUFzQjtBQUMvQixhQUFBLENBQUMsQ0FBQztZQUNILE9BQU87QUFDVixTQUFBO1FBRUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7O1FBR2hELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDckUsUUFBQSxJQUFJLFNBQVMsRUFBRTtBQUNYLFlBQUEsU0FBUyxDQUFDLFdBQVcsR0FBRyxDQUFRLEtBQUEsRUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQSxJQUFBLEVBQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN4RixTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTs7WUFFTixNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ25FLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDakUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQVcsUUFBQSxFQUFBLElBQUksQ0FBQyxNQUFNLENBQUEsQ0FBRSxFQUFFLEVBQUU7QUFFckcsWUFBc0IsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUU7QUFDekMsZ0JBQUEsR0FBRyxFQUFFLHVCQUF1QjtBQUM1QixnQkFBQSxJQUFJLEVBQUUsNENBQTRDO0FBQ3JELGFBQUEsRUFBRTtBQUNOLFNBQUE7QUFBTSxhQUFBOztBQUVILFlBQUEsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDOztBQUd2RSxZQUFBLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLE9BQU87QUFDaEMsaUJBQUEsT0FBTyxDQUFDLGdCQUFnQixFQUFFLHFCQUFxQixDQUFDO0FBQ2hELGlCQUFBLE9BQU8sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDO0FBQ2xDLGlCQUFBLE9BQU8sQ0FBQyxVQUFVLEVBQUUsaUJBQWlCLENBQUM7aUJBQ3RDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFOUIsWUFBQSxTQUFTLENBQUMsU0FBUyxHQUFHLGdCQUFnQixDQUFDO0FBRXZDLFlBQWlCLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFO0FBQ3BDLGdCQUFBLEdBQUcsRUFBRSxrQkFBa0I7QUFDdkIsZ0JBQUEsSUFBSSxFQUFFLENBQUEsUUFBQSxFQUFXLElBQUksQ0FBQyxNQUFNLENBQUUsQ0FBQTtBQUNqQyxhQUFBLEVBQUU7QUFFSCxZQUFzQixNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRTtBQUN6QyxnQkFBQSxHQUFHLEVBQUUsdUJBQXVCO0FBQzVCLGdCQUFBLElBQUksRUFBRSx5Q0FBeUM7QUFDbEQsYUFBQSxFQUFFO0FBQ04sU0FBQTtLQUNKO0lBRUQsUUFBUSxHQUFBO0FBQ0osUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztRQUN6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQy9ELFFBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQXFCLENBQUMsQ0FBQztLQUN2RDtJQUVELFFBQVEsR0FBQTtRQUNKLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDaEQsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3BCLFlBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7WUFDM0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUMvRCxZQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFxQixDQUFDLENBQUM7QUFDdkQsU0FBQTtBQUFNLGFBQUE7O0FBRUgsWUFBQSxJQUFJRCxlQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUM1QyxTQUFBO0tBQ0o7SUFFRCxZQUFZLEdBQUE7QUFDUixRQUFBLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUU7WUFDdkIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3BCLFlBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7WUFDM0IsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUMvRCxZQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFxQixDQUFDLENBQUM7QUFDdkQsU0FBQTtBQUFNLGFBQUE7O0FBRUgsWUFBQSxJQUFJQSxlQUFNLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztBQUNoRCxTQUFBO0tBQ0o7QUFDSixDQUFBO0FBRUQsTUFBTSxvQkFBcUIsU0FBUUUseUJBQWdCLENBQUE7SUFHL0MsV0FBWSxDQUFBLEdBQVEsRUFBRSxNQUF3QixFQUFBO0FBQzFDLFFBQUEsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNuQixRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0tBQ3hCO0lBRUQsT0FBTyxHQUFBO0FBQ0gsUUFBQSxNQUFNLEVBQUMsV0FBVyxFQUFDLEdBQUcsSUFBSSxDQUFDO1FBRTNCLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUVwQixXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBQyxDQUFDLENBQUM7UUFFakUsSUFBSUMsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDbkIsT0FBTyxDQUFDLHFCQUFxQixDQUFDO2FBQzlCLE9BQU8sQ0FBQyx1RUFBdUUsQ0FBQztBQUNoRixhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQUksTUFBTTthQUN0QixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUM7QUFDakQsYUFBQSxRQUFRLENBQUMsQ0FBTyxLQUFLLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO1lBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQztBQUNoRCxZQUFBLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUNwQyxDQUFBLENBQUMsQ0FBQyxDQUFDO1FBRVosSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDbkIsT0FBTyxDQUFDLGtCQUFrQixDQUFDO2FBQzNCLE9BQU8sQ0FBQyxvRUFBb0UsQ0FBQztBQUM3RSxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQUksTUFBTTthQUN0QixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDO0FBQzlDLGFBQUEsUUFBUSxDQUFDLENBQU8sS0FBSyxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBQzdDLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3BDLENBQUEsQ0FBQyxDQUFDLENBQUM7UUFFWixJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQzthQUNuQixPQUFPLENBQUMsZUFBZSxDQUFDO2FBQ3hCLE9BQU8sQ0FBQyxtREFBbUQsQ0FBQztBQUM1RCxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQUksTUFBTTthQUN0QixRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQzNDLGFBQUEsUUFBUSxDQUFDLENBQU8sS0FBSyxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBQzFDLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3BDLENBQUEsQ0FBQyxDQUFDLENBQUM7S0FDZjtBQUNKOzs7OyJ9
