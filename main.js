'use strict';

var obsidian = require('obsidian');
var fs = require('fs');
var path = require('path');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

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
    shuffleCards: true,
    configPath: 'config.json'
};
class FlashcardsPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.cardTypes = [];
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading flashcards plugin');
            yield this.loadSettings();
            yield this.loadCardTypesConfig();
            // Add ribbon icon
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
            // Add command to reload configuration
            this.addCommand({
                id: 'reload-flashcard-config',
                name: 'Reload Flashcard Configuration',
                callback: () => __awaiter(this, void 0, void 0, function* () {
                    yield this.loadCardTypesConfig();
                    new obsidian.Notice('Flashcard configuration reloaded');
                })
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
    loadCardTypesConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get the path to the Obsidian vault
                const vaultPath = this.app.vault.adapter.basePath;
                // Combine with the config file path from settings
                const configFilePath = path__namespace.join(vaultPath, this.settings.configPath);
                // Check if the file exists
                if (fs__namespace.existsSync(configFilePath)) {
                    // Read and parse the JSON file
                    const configData = fs__namespace.readFileSync(configFilePath, 'utf8');
                    this.cardTypes = JSON.parse(configData);
                    console.log(`Loaded ${this.cardTypes.length} card types from configuration`);
                }
                else {
                    // Create default configuration if file doesn't exist
                    this.cardTypes = [
                        {
                            id: "definition",
                            name: "Definition",
                            enabled: true,
                            pattern: "\\*\\*Definition:\\s*([^*]+)\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*\\*\\*|\\n\\s*#{1,6}\\s|$)"
                        },
                        {
                            id: "theorem",
                            name: "Theorem",
                            enabled: true,
                            pattern: "\\*\\*Theorem:\\s*([^*]+)\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*\\*\\*|\\n\\s*#{1,6}\\s|$)"
                        }
                    ];
                    // Create the configuration file with default settings
                    fs__namespace.writeFileSync(configFilePath, JSON.stringify(this.cardTypes, null, 2));
                    console.log(`Created default configuration file at ${configFilePath}`);
                }
            }
            catch (error) {
                console.error('Error loading card types configuration:', error);
                new obsidian.Notice('Error loading flashcard configuration file');
            }
        });
    }
    startFlashcardSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const flashcards = yield this.parseFlashcards();
            if (flashcards.length === 0) {
                new obsidian.Notice('No flashcards found. Check your configuration and make sure your notes contain the defined patterns.');
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
                // Process each card type from the loaded configuration
                for (const cardType of this.cardTypes) {
                    if (cardType.enabled) {
                        try {
                            const regex = new RegExp(cardType.pattern, 'gi');
                            let match;
                            while ((match = regex.exec(content)) !== null) {
                                const name = match[1].trim();
                                const cardContent = match[2].trim();
                                flashcards.push({
                                    type: cardType.name,
                                    name,
                                    content: cardContent,
                                    source: file.path,
                                    folder
                                });
                            }
                        }
                        catch (e) {
                            console.error(`Error with regex pattern for card type ${cardType.name}:`, e);
                            new obsidian.Notice(`Invalid regex pattern for card type: ${cardType.name}`);
                        }
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
            .setName('Shuffle Cards')
            .setDesc('Randomize the order of flashcards in each session')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.shuffleCards)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.shuffleCards = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Configuration File Path')
            .setDesc('Path to the JSON configuration file (relative to vault root)')
            .addText(text => text
            .setValue(this.plugin.settings.configPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.configPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Reload Configuration')
            .setDesc('Reload the card types from the configuration file')
            .addButton(button => button
            .setButtonText('Reload')
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            yield this.plugin.loadCardTypesConfig();
            new obsidian.Notice('Configuration reloaded');
        })));
        containerEl.createEl('h3', { text: 'Current Card Types' });
        const cardTypesInfo = containerEl.createEl('div', {
            cls: 'flashcard-types-info'
        });
        if (this.plugin.cardTypes.length === 0) {
            cardTypesInfo.createEl('p', {
                text: 'No card types loaded. Check your configuration file.'
            });
        }
        else {
            const table = cardTypesInfo.createEl('table');
            const headerRow = table.createEl('tr');
            headerRow.createEl('th', { text: 'ID' });
            headerRow.createEl('th', { text: 'Name' });
            headerRow.createEl('th', { text: 'Enabled' });
            this.plugin.cardTypes.forEach(cardType => {
                const row = table.createEl('tr');
                row.createEl('td', { text: cardType.id });
                row.createEl('td', { text: cardType.name });
                row.createEl('td', { text: cardType.enabled ? 'Yes' : 'No' });
            });
        }
        containerEl.createEl('h3', { text: 'Configuration Format' });
        containerEl.createEl('p', {
            text: 'The configuration file should be a JSON array of card type objects with the following structure:'
        });
        const configExample = containerEl.createEl('pre');
        configExample.setText(JSON.stringify([
            {
                "id": "definition",
                "name": "Definition",
                "enabled": true,
                "pattern": "\\*\\*Definition:\\s*([^*]+)\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*\\*\\*|\\n\\s*#{1,6}\\s|$)"
            },
            {
                "id": "example",
                "name": "Example",
                "enabled": true,
                "pattern": "\\*\\*Example:\\s*([^*]+)\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\s*\\*\\*|\\n\\s*#{1,6}\\s|$)"
            }
        ], null, 2));
    }
}

module.exports = FlashcardsPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuXHJcbi8vIERlZmluZSB0aGUgY2FyZCB0eXBlIGNvbmZpZ3VyYXRpb24gc3RydWN0dXJlXHJcbmludGVyZmFjZSBDYXJkVHlwZUNvbmZpZyB7XHJcbiAgICBpZDogc3RyaW5nOyAgICAgICAgICAvLyBVbmlxdWUgaWRlbnRpZmllclxyXG4gICAgbmFtZTogc3RyaW5nOyAgICAgICAgLy8gRGlzcGxheSBuYW1lXHJcbiAgICBwYXR0ZXJuOiBzdHJpbmc7ICAgICAvLyBSZWdleCBwYXR0ZXJuIGZvciBtYXRjaGluZ1xyXG4gICAgZW5hYmxlZDogYm9vbGVhbjsgICAgLy8gV2hldGhlciB0aGlzIHR5cGUgaXMgZW5hYmxlZFxyXG59XHJcblxyXG5cclxuaW50ZXJmYWNlIEZsYXNoQ2FyZCB7XHJcbiAgICB0eXBlOiBzdHJpbmc7ICAgICAgICAvLyBUaGUgY2FyZCB0eXBlIG5hbWVcclxuICAgIG5hbWU6IHN0cmluZzsgICAgICAgIC8vIFRoZSBuYW1lIGNvbXBvbmVudFxyXG4gICAgY29udGVudDogc3RyaW5nOyAgICAgLy8gVGhlIGJvZHkgY29udGVudFxyXG4gICAgc291cmNlOiBzdHJpbmc7ICAgICAgLy8gU291cmNlIGZpbGUgcGF0aFxyXG4gICAgZm9sZGVyOiBzdHJpbmc7ICAgICAgLy8gUGFyZW50IGZvbGRlciBuYW1lXHJcbn1cclxuXHJcblxyXG5pbnRlcmZhY2UgRmxhc2hjYXJkc1BsdWdpblNldHRpbmdzIHtcclxuICAgIHNodWZmbGVDYXJkczogYm9vbGVhbjtcclxuICAgIGNvbmZpZ1BhdGg6IHN0cmluZzsgIC8vIFBhdGggdG8gdGhlIEpTT04gY29uZmlndXJhdGlvbiBmaWxlXHJcbn1cclxuXHJcblxyXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBGbGFzaGNhcmRzUGx1Z2luU2V0dGluZ3MgPSB7XHJcbiAgICBzaHVmZmxlQ2FyZHM6IHRydWUsXHJcbiAgICBjb25maWdQYXRoOiAnY29uZmlnLmpzb24nXHJcbn1cclxuXHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGbGFzaGNhcmRzUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICAgIHNldHRpbmdzOiBGbGFzaGNhcmRzUGx1Z2luU2V0dGluZ3M7XHJcbiAgICBjYXJkVHlwZXM6IENhcmRUeXBlQ29uZmlnW10gPSBbXTtcclxuXHJcbiAgICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0xvYWRpbmcgZmxhc2hjYXJkcyBwbHVnaW4nKTtcclxuICAgICAgICBcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZENhcmRUeXBlc0NvbmZpZygpO1xyXG5cclxuICAgICAgICAvLyBBZGQgcmliYm9uIGljb25cclxuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oJ2RpY2UnLCAnRmxhc2hjYXJkcycsIChldnQ6IE1vdXNlRXZlbnQpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zdGFydEZsYXNoY2FyZFNlc3Npb24oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIGNvbW1hbmRcclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogJ3N0YXJ0LWZsYXNoY2FyZC1zZXNzaW9uJyxcclxuICAgICAgICAgICAgbmFtZTogJ1N0YXJ0IEZsYXNoY2FyZCBTZXNzaW9uJyxcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIGNvbW1hbmQgdG8gcmVsb2FkIGNvbmZpZ3VyYXRpb25cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogJ3JlbG9hZC1mbGFzaGNhcmQtY29uZmlnJyxcclxuICAgICAgICAgICAgbmFtZTogJ1JlbG9hZCBGbGFzaGNhcmQgQ29uZmlndXJhdGlvbicsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRDYXJkVHlwZXNDb25maWcoKTtcclxuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0ZsYXNoY2FyZCBjb25maWd1cmF0aW9uIHJlbG9hZGVkJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIHNldHRpbmdzIHRhYlxyXG4gICAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgRmxhc2hjYXJkc1NldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuICAgIH1cclxuXHJcbiAgICBvbnVubG9hZCgpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnVW5sb2FkaW5nIGZsYXNoY2FyZHMgcGx1Z2luJyk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGxvYWRDYXJkVHlwZXNDb25maWcoKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gR2V0IHRoZSBwYXRoIHRvIHRoZSBPYnNpZGlhbiB2YXVsdFxyXG4gICAgICAgICAgICBjb25zdCB2YXVsdFBhdGggPSAodGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyBhbnkpLmJhc2VQYXRoOyBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIENvbWJpbmUgd2l0aCB0aGUgY29uZmlnIGZpbGUgcGF0aCBmcm9tIHNldHRpbmdzXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0ZpbGVQYXRoID0gcGF0aC5qb2luKHZhdWx0UGF0aCwgdGhpcy5zZXR0aW5ncy5jb25maWdQYXRoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBmaWxlIGV4aXN0c1xyXG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhjb25maWdGaWxlUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgIC8vIFJlYWQgYW5kIHBhcnNlIHRoZSBKU09OIGZpbGVcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnRmlsZVBhdGgsICd1dGY4Jyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNhcmRUeXBlcyA9IEpTT04ucGFyc2UoY29uZmlnRGF0YSk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTG9hZGVkICR7dGhpcy5jYXJkVHlwZXMubGVuZ3RofSBjYXJkIHR5cGVzIGZyb20gY29uZmlndXJhdGlvbmApO1xyXG5cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBkZWZhdWx0IGNvbmZpZ3VyYXRpb24gaWYgZmlsZSBkb2Vzbid0IGV4aXN0XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNhcmRUeXBlcyA9IFtcclxuICAgICAgICAgICAgICAgICAgICB7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogXCJkZWZpbml0aW9uXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIkRlZmluaXRpb25cIiwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm46IFwiXFxcXCpcXFxcKkRlZmluaXRpb246XFxcXHMqKFteKl0rKVxcXFwqXFxcXCpcXFxccyooW1xcXFxzXFxcXFNdKj8pKD89XFxcXG5cXFxccypcXFxcbnxcXFxcblxcXFxzKlxcXFwqXFxcXCp8XFxcXG5cXFxccyojezEsNn1cXFxcc3wkKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogXCJ0aGVvcmVtXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIlRoZW9yZW1cIiwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm46IFwiXFxcXCpcXFxcKlRoZW9yZW06XFxcXHMqKFteKl0rKVxcXFwqXFxcXCpcXFxccyooW1xcXFxzXFxcXFNdKj8pKD89XFxcXG5cXFxccypcXFxcbnxcXFxcblxcXFxzKlxcXFwqXFxcXCp8XFxcXG5cXFxccyojezEsNn1cXFxcc3wkKVwiXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgd2l0aCBkZWZhdWx0IHNldHRpbmdzXHJcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKGNvbmZpZ0ZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeSh0aGlzLmNhcmRUeXBlcywgbnVsbCwgMikpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYENyZWF0ZWQgZGVmYXVsdCBjb25maWd1cmF0aW9uIGZpbGUgYXQgJHtjb25maWdGaWxlUGF0aH1gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsb2FkaW5nIGNhcmQgdHlwZXMgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ0Vycm9yIGxvYWRpbmcgZmxhc2hjYXJkIGNvbmZpZ3VyYXRpb24gZmlsZScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzdGFydEZsYXNoY2FyZFNlc3Npb24oKSB7XHJcbiAgICAgICAgY29uc3QgZmxhc2hjYXJkcyA9IGF3YWl0IHRoaXMucGFyc2VGbGFzaGNhcmRzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGZsYXNoY2FyZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoJ05vIGZsYXNoY2FyZHMgZm91bmQuIENoZWNrIHlvdXIgY29uZmlndXJhdGlvbiBhbmQgbWFrZSBzdXJlIHlvdXIgbm90ZXMgY29udGFpbiB0aGUgZGVmaW5lZCBwYXR0ZXJucy4nKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2h1ZmZsZUNhcmRzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2h1ZmZsZUFycmF5KGZsYXNoY2FyZHMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV3IEZsYXNoY2FyZE1vZGFsKHRoaXMuYXBwLCBmbGFzaGNhcmRzKS5vcGVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgcGFyc2VGbGFzaGNhcmRzKCk6IFByb21pc2U8Rmxhc2hDYXJkW10+IHtcclxuICAgICAgICBjb25zdCBmbGFzaGNhcmRzOiBGbGFzaENhcmRbXSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcclxuICAgICAgICAgICAgY29uc3QgZm9sZGVyID0gdGhpcy5nZXRQYXJlbnRGb2xkZXJOYW1lKGZpbGUpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUHJvY2VzcyBlYWNoIGNhcmQgdHlwZSBmcm9tIHRoZSBsb2FkZWQgY29uZmlndXJhdGlvblxyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNhcmRUeXBlIG9mIHRoaXMuY2FyZFR5cGVzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2FyZFR5cGUuZW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChjYXJkVHlwZS5wYXR0ZXJuLCAnZ2knKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG1hdGNoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKChtYXRjaCA9IHJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gbWF0Y2hbMV0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FyZENvbnRlbnQgPSBtYXRjaFsyXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsYXNoY2FyZHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY2FyZFR5cGUubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGNhcmRDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZTogZmlsZS5wYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlclxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHdpdGggcmVnZXggcGF0dGVybiBmb3IgY2FyZCB0eXBlICR7Y2FyZFR5cGUubmFtZX06YCwgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoYEludmFsaWQgcmVnZXggcGF0dGVybiBmb3IgY2FyZCB0eXBlOiAke2NhcmRUeXBlLm5hbWV9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmbGFzaGNhcmRzO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBhcmVudEZvbGRlck5hbWUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IHBhdGggPSBmaWxlLnBhdGg7XHJcbiAgICAgICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJSb290XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZvbGRlclBhdGggPSBwYXRoLnN1YnN0cmluZygwLCBsYXN0U2xhc2hJbmRleCk7XHJcbiAgICAgICAgY29uc3QgbGFzdEZvbGRlclNsYXNoSW5kZXggPSBmb2xkZXJQYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RGb2xkZXJTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVyUGF0aDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZvbGRlclBhdGguc3Vic3RyaW5nKGxhc3RGb2xkZXJTbGFzaEluZGV4ICsgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2h1ZmZsZUFycmF5KGFycmF5OiBhbnlbXSkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGogPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoaSArIDEpKTtcclxuICAgICAgICAgICAgW2FycmF5W2ldLCBhcnJheVtqXV0gPSBbYXJyYXlbal0sIGFycmF5W2ldXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5jbGFzcyBGbGFzaGNhcmRNb2RhbCBleHRlbmRzIE1vZGFsIHtcclxuICAgIGZsYXNoY2FyZHM6IEZsYXNoQ2FyZFtdO1xyXG4gICAgY3VycmVudEluZGV4OiBudW1iZXIgPSAwO1xyXG4gICAgc2hvd2luZ0Fuc3dlcjogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBmbGFzaGNhcmRzOiBGbGFzaENhcmRbXSkge1xyXG4gICAgICAgIHN1cGVyKGFwcCk7XHJcbiAgICAgICAgdGhpcy5mbGFzaGNhcmRzID0gZmxhc2hjYXJkcztcclxuICAgIH1cclxuXHJcbiAgICBvbk9wZW4oKSB7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcclxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcImZsYXNoY2FyZC1tb2RhbFwiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBDcmVhdGUgaGVhZGVyXHJcbiAgICAgICAgY29uc3QgaGVhZGVyRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtaGVhZGVyXCIgfSk7XHJcbiAgICAgICAgaGVhZGVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiRmxhc2hjYXJkc1wiIH0pO1xyXG4gICAgICAgIGhlYWRlckVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtY291bnRlclwiLCBcclxuICAgICAgICAgICAgdGV4dDogYENhcmQgJHt0aGlzLmN1cnJlbnRJbmRleCArIDF9IG9mICR7dGhpcy5mbGFzaGNhcmRzLmxlbmd0aH1gIFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgZmxhc2hjYXJkIGNvbnRhaW5lclxyXG4gICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1jYXJkXCIgfSk7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwpO1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgY29udHJvbHNcclxuICAgICAgICBjb25zdCBjb250cm9sc0VsID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNvbnRyb2xzXCIgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcHJldkJ0biA9IGNvbnRyb2xzRWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlByZXZpb3VzXCIgfSk7XHJcbiAgICAgICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnByZXZpb3VzQ2FyZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZsaXBCdG4gPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJGbGlwIENhcmRcIiB9KTtcclxuICAgICAgICBmbGlwQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuZmxpcENhcmQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBuZXh0QnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiTmV4dFwiIH0pO1xyXG4gICAgICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQga2V5Ym9hcmQgY29udHJvbHNcclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnRW50ZXInLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNob3dpbmdBbnN3ZXIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmV4dENhcmQoKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcENhcmQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW10sICdTcGFjZScsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ0Fycm93TGVmdCcsICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NhcmQoKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnQXJyb3dSaWdodCcsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWw6IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgY2FyZEVsLmVtcHR5KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuZmxhc2hjYXJkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWVtcHR5XCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJObyBmbGFzaGNhcmRzIGZvdW5kLlwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjYXJkID0gdGhpcy5mbGFzaGNhcmRzW3RoaXMuY3VycmVudEluZGV4XTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBVcGRhdGUgY291bnRlclxyXG4gICAgICAgIGNvbnN0IGNvdW50ZXJFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNvdW50ZXJcIik7XHJcbiAgICAgICAgaWYgKGNvdW50ZXJFbCkge1xyXG4gICAgICAgICAgICBjb3VudGVyRWwudGV4dENvbnRlbnQgPSBgQ2FyZCAke3RoaXMuY3VycmVudEluZGV4ICsgMX0gb2YgJHt0aGlzLmZsYXNoY2FyZHMubGVuZ3RofWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghdGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgIC8vIFNob3cgZnJvbnQgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCB0eXBlRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLXR5cGVcIiwgdGV4dDogY2FyZC50eXBlIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLW5hbWVcIiwgdGV4dDogY2FyZC5uYW1lIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtZm9sZGVyXCIsIHRleHQ6IGBGb2xkZXI6ICR7Y2FyZC5mb2xkZXJ9YCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtaW5zdHJ1Y3Rpb25cIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlByZXNzIEVudGVyIG9yIGNsaWNrICdGbGlwIENhcmQnIHRvIHJldmVhbFwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBTaG93IGJhY2sgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50RWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNvbnRlbnRcIiB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBjb21wb25lbnQgZm9yIG1hcmtkb3duIHJlbmRlcmluZ1xyXG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgQ29tcG9uZW50KCk7XHJcbiAgICAgICAgICAgIGNvbXBvbmVudC5sb2FkKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBVc2UgdGhlIG5ld2VyIHJlbmRlciBtZXRob2QgZnJvbSB0aGUgZXhhbXBsZVxyXG4gICAgICAgICAgICBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKFxyXG4gICAgICAgICAgICAgICAgY2FyZC5jb250ZW50LFxyXG4gICAgICAgICAgICAgICAgY29udGVudEVsLFxyXG4gICAgICAgICAgICAgICAgY2FyZC5zb3VyY2UsXHJcbiAgICAgICAgICAgICAgICBjb21wb25lbnRcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZUVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLXNvdXJjZVwiLCBcclxuICAgICAgICAgICAgICAgIHRleHQ6IGBTb3VyY2U6ICR7Y2FyZC5zb3VyY2V9YCBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBpbnN0cnVjdGlvbkVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWluc3RydWN0aW9uXCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJQcmVzcyBFbnRlciBvciBjbGljayAnTmV4dCcgdG8gY29udGludWVcIiBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZsaXBDYXJkKCkge1xyXG4gICAgICAgIHRoaXMuc2hvd2luZ0Fuc3dlciA9ICF0aGlzLnNob3dpbmdBbnN3ZXI7XHJcbiAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY2FyZFwiKTtcclxuICAgICAgICB0aGlzLmRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbCBhcyBIVE1MRWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgbmV4dENhcmQoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEluZGV4IDwgdGhpcy5mbGFzaGNhcmRzLmxlbmd0aCAtIDEpIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgrKztcclxuICAgICAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBdCB0aGUgZW5kIG9mIHRoZSBkZWNrXHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJFbmQgb2YgZmxhc2hjYXJkcyByZWFjaGVkIVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJldmlvdXNDYXJkKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgtLTtcclxuICAgICAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBkZWNrXHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJZb3UncmUgYXQgdGhlIGZpcnN0IGZsYXNoY2FyZCFcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5cclxuY2xhc3MgRmxhc2hjYXJkc1NldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcclxuICAgIHBsdWdpbjogRmxhc2hjYXJkc1BsdWdpbjtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBGbGFzaGNhcmRzUGx1Z2luKSB7XHJcbiAgICAgICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xyXG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xyXG4gICAgfVxyXG5cclxuICAgIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XHJcblxyXG4gICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcblxyXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHt0ZXh0OiAnRmxhc2hjYXJkcyBQbHVnaW4gU2V0dGluZ3MnfSk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnU2h1ZmZsZSBDYXJkcycpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdSYW5kb21pemUgdGhlIG9yZGVyIG9mIGZsYXNoY2FyZHMgaW4gZWFjaCBzZXNzaW9uJylcclxuICAgICAgICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2h1ZmZsZUNhcmRzKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnNodWZmbGVDYXJkcyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG5cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgLnNldE5hbWUoJ0NvbmZpZ3VyYXRpb24gRmlsZSBQYXRoJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1BhdGggdG8gdGhlIEpTT04gY29uZmlndXJhdGlvbiBmaWxlIChyZWxhdGl2ZSB0byB2YXVsdCByb290KScpXHJcbiAgICAgICAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbmZpZ1BhdGgpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29uZmlnUGF0aCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdSZWxvYWQgQ29uZmlndXJhdGlvbicpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdSZWxvYWQgdGhlIGNhcmQgdHlwZXMgZnJvbSB0aGUgY29uZmlndXJhdGlvbiBmaWxlJylcclxuICAgICAgICAgICAgLmFkZEJ1dHRvbihidXR0b24gPT4gYnV0dG9uXHJcbiAgICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnUmVsb2FkJylcclxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5sb2FkQ2FyZFR5cGVzQ29uZmlnKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnQ29uZmlndXJhdGlvbiByZWxvYWRlZCcpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gzJywge3RleHQ6ICdDdXJyZW50IENhcmQgVHlwZXMnfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY2FyZFR5cGVzSW5mbyA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdkaXYnLCB7XHJcbiAgICAgICAgICAgIGNsczogJ2ZsYXNoY2FyZC10eXBlcy1pbmZvJ1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5jYXJkVHlwZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIGNhcmRUeXBlc0luZm8uY3JlYXRlRWwoJ3AnLCB7XHJcbiAgICAgICAgICAgICAgICB0ZXh0OiAnTm8gY2FyZCB0eXBlcyBsb2FkZWQuIENoZWNrIHlvdXIgY29uZmlndXJhdGlvbiBmaWxlLidcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgdGFibGUgPSBjYXJkVHlwZXNJbmZvLmNyZWF0ZUVsKCd0YWJsZScpO1xyXG4gICAgICAgICAgICBjb25zdCBoZWFkZXJSb3cgPSB0YWJsZS5jcmVhdGVFbCgndHInKTtcclxuICAgICAgICAgICAgaGVhZGVyUm93LmNyZWF0ZUVsKCd0aCcsIHt0ZXh0OiAnSUQnfSk7XHJcbiAgICAgICAgICAgIGhlYWRlclJvdy5jcmVhdGVFbCgndGgnLCB7dGV4dDogJ05hbWUnfSk7XHJcbiAgICAgICAgICAgIGhlYWRlclJvdy5jcmVhdGVFbCgndGgnLCB7dGV4dDogJ0VuYWJsZWQnfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5jYXJkVHlwZXMuZm9yRWFjaChjYXJkVHlwZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByb3cgPSB0YWJsZS5jcmVhdGVFbCgndHInKTtcclxuICAgICAgICAgICAgICAgIHJvdy5jcmVhdGVFbCgndGQnLCB7dGV4dDogY2FyZFR5cGUuaWR9KTtcclxuICAgICAgICAgICAgICAgIHJvdy5jcmVhdGVFbCgndGQnLCB7dGV4dDogY2FyZFR5cGUubmFtZX0pO1xyXG4gICAgICAgICAgICAgICAgcm93LmNyZWF0ZUVsKCd0ZCcsIHt0ZXh0OiBjYXJkVHlwZS5lbmFibGVkID8gJ1llcycgOiAnTm8nfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7dGV4dDogJ0NvbmZpZ3VyYXRpb24gRm9ybWF0J30pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdwJywge1xyXG4gICAgICAgICAgICB0ZXh0OiAnVGhlIGNvbmZpZ3VyYXRpb24gZmlsZSBzaG91bGQgYmUgYSBKU09OIGFycmF5IG9mIGNhcmQgdHlwZSBvYmplY3RzIHdpdGggdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmU6J1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNvbmZpZ0V4YW1wbGUgPSBjb250YWluZXJFbC5jcmVhdGVFbCgncHJlJyk7XHJcbiAgICAgICAgY29uZmlnRXhhbXBsZS5zZXRUZXh0KEpTT04uc3RyaW5naWZ5KFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJpZFwiOiBcImRlZmluaXRpb25cIixcclxuICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkRlZmluaXRpb25cIixcclxuICAgICAgICAgICAgICAgIFwiZW5hYmxlZFwiOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgXCJwYXR0ZXJuXCI6IFwiXFxcXCpcXFxcKkRlZmluaXRpb246XFxcXHMqKFteKl0rKVxcXFwqXFxcXCpcXFxccyooW1xcXFxzXFxcXFNdKj8pKD89XFxcXG5cXFxccypcXFxcbnxcXFxcblxcXFxzKlxcXFwqXFxcXCp8XFxcXG5cXFxccyojezEsNn1cXFxcc3wkKVwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiaWRcIjogXCJleGFtcGxlXCIsXHJcbiAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFeGFtcGxlXCIsXHJcbiAgICAgICAgICAgICAgICBcImVuYWJsZWRcIjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIFwicGF0dGVyblwiOiBcIlxcXFwqXFxcXCpFeGFtcGxlOlxcXFxzKihbXipdKylcXFxcKlxcXFwqXFxcXHMqKFtcXFxcc1xcXFxTXSo/KSg/PVxcXFxuXFxcXHMqXFxcXG58XFxcXG5cXFxccypcXFxcKlxcXFwqfFxcXFxuXFxcXHMqI3sxLDZ9XFxcXHN8JClcIlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXSwgbnVsbCwgMikpO1xyXG4gICAgfVxyXG59Il0sIm5hbWVzIjpbIlBsdWdpbiIsIk5vdGljZSIsInBhdGgiLCJmcyIsIk1vZGFsIiwiQ29tcG9uZW50IiwiTWFya2Rvd25SZW5kZXJlciIs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
