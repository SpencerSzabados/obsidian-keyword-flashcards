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
    configPath: 'config.json',
    maxCardsPerSession: 20,
    srsDataPath: 'srs-data.json',
    enableSRS: true,
    includeNewCards: true,
    maxNewCardsPerSession: 5
};
// Constants for SRS algorithm
const SRS_DEFAULTS = {
    INITIAL_EASE_FACTOR: 2.5,
    MIN_EASE_FACTOR: 1.3,
    EASE_BONUS: 0.15,
    EASE_PENALTY: 0.2,
    INITIAL_INTERVAL: 1,
    MIN_INTERVAL: 1,
    HARD_INTERVAL_MULTIPLIER: 0.5,
    NOW: Date.now()
};
class FlashcardsPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.cardTypes = [];
        this.srsData = { cards: {}, version: 1 };
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Loading flashcards plugin');
            yield this.loadSettings();
            yield this.loadCardTypesConfig();
            yield this.loadSRSData();
            // Add ribbon icon
            this.addRibbonIcon('dice', 'Flashcards', (evt) => {
                this.startFlashcardSession();
            });
            // Add commands
            this.addCommand({
                id: 'start-flashcard-session',
                name: 'Start Flashcard Session',
                callback: () => {
                    this.startFlashcardSession();
                }
            });
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
    loadSRSData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get the path to the Obsidian vault
                const vaultPath = this.app.vault.adapter.basePath;
                // Combine with the SRS data file path from settings
                const srsDataFilePath = path__namespace.join(vaultPath, this.settings.srsDataPath);
                // Check if the file exists
                if (fs__namespace.existsSync(srsDataFilePath)) {
                    // Read and parse the JSON file
                    const srsDataContent = fs__namespace.readFileSync(srsDataFilePath, 'utf8');
                    this.srsData = JSON.parse(srsDataContent);
                    console.log(`Loaded SRS data for ${Object.keys(this.srsData.cards).length} cards`);
                }
                else {
                    // Create default SRS data if file doesn't exist
                    this.srsData = { cards: {}, version: 1 };
                    // Create the SRS data file with default settings
                    fs__namespace.writeFileSync(srsDataFilePath, JSON.stringify(this.srsData, null, 2));
                    console.log(`Created default SRS data file at ${srsDataFilePath}`);
                }
            }
            catch (error) {
                console.error('Error loading SRS data:', error);
                new obsidian.Notice('Error loading SRS data file');
            }
        });
    }
    saveSRSData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get the path to the Obsidian vault
                const vaultPath = this.app.vault.adapter.basePath;
                // Combine with the SRS data file path from settings
                const srsDataFilePath = path__namespace.join(vaultPath, this.settings.srsDataPath);
                // Save the SRS data
                fs__namespace.writeFileSync(srsDataFilePath, JSON.stringify(this.srsData, null, 2));
                console.log(`Saved SRS data for ${Object.keys(this.srsData.cards).length} cards`);
            }
            catch (error) {
                console.error('Error saving SRS data:', error);
                new obsidian.Notice('Error saving SRS data file');
            }
        });
    }
    startFlashcardSession() {
        return __awaiter(this, void 0, void 0, function* () {
            const allFlashcards = yield this.parseFlashcards();
            if (allFlashcards.length === 0) {
                new obsidian.Notice('No flashcards found. Check your configuration and make sure your notes contain the defined patterns.');
                return;
            }
            // If SRS is enabled, filter cards based on review schedule
            let sessionFlashcards = allFlashcards;
            if (this.settings.enableSRS) {
                sessionFlashcards = this.filterCardsForSession(allFlashcards);
                if (sessionFlashcards.length === 0) {
                    new obsidian.Notice('No cards due for review right now. Check back later!');
                    return;
                }
            }
            else if (this.settings.shuffleCards) {
                this.shuffleArray(sessionFlashcards);
            }
            new FlashcardModal(this.app, sessionFlashcards, this).open();
        });
    }
    // Generate unique ID for a card
    generateCardId(card) {
        return `${card.source}::${card.type}::${card.name}`;
    }
    // Filter cards for the current session based on SRS scheduling
    filterCardsForSession(allCards) {
        const currentTime = Date.now();
        const dueCards = [];
        const newCards = [];
        // First, identify due and new cards
        for (const card of allCards) {
            const cardId = this.generateCardId(card);
            const srsData = this.srsData.cards[cardId];
            if (!srsData) {
                // This is a new card
                if (this.settings.includeNewCards) {
                    newCards.push(card);
                }
            }
            else if (srsData.nextReview <= currentTime) {
                // This card is due for review
                dueCards.push(card);
            }
        }
        // Sort due cards by how overdue they are (most overdue first)
        dueCards.sort((a, b) => {
            const aId = this.generateCardId(a);
            const bId = this.generateCardId(b);
            const aNextReview = this.srsData.cards[aId].nextReview;
            const bNextReview = this.srsData.cards[bId].nextReview;
            return aNextReview - bNextReview;
        });
        // Shuffle new cards if needed
        if (this.settings.shuffleCards) {
            this.shuffleArray(newCards);
        }
        // Combine cards, respecting limits
        const result = [...dueCards];
        // Add new cards up to the limit
        const newCardsToAdd = Math.min(newCards.length, this.settings.maxNewCardsPerSession, this.settings.maxCardsPerSession - result.length);
        if (newCardsToAdd > 0) {
            result.push(...newCards.slice(0, newCardsToAdd));
        }
        // Limit total cards
        return result.slice(0, this.settings.maxCardsPerSession);
    }
    // Process card rating and schedule next review
    processCardRating(card, rating) {
        const cardId = this.generateCardId(card);
        const now = Date.now();
        // Get or create SRS data for this card
        let cardData = this.srsData.cards[cardId];
        if (!cardData) {
            cardData = {
                cardId,
                nextReview: now,
                easeFactor: SRS_DEFAULTS.INITIAL_EASE_FACTOR,
                interval: SRS_DEFAULTS.INITIAL_INTERVAL,
                consecutiveCorrect: 0,
                history: []
            };
            this.srsData.cards[cardId] = cardData;
        }
        // Calculate new values based on rating
        let { interval, easeFactor, consecutiveCorrect } = cardData;
        // Update ease factor based on rating
        if (rating === 'easy') {
            easeFactor += SRS_DEFAULTS.EASE_BONUS;
            consecutiveCorrect++;
        }
        else if (rating === 'medium') {
            // Keep ease factor the same
            consecutiveCorrect++;
        }
        else if (rating === 'hard') {
            easeFactor -= SRS_DEFAULTS.EASE_PENALTY;
            consecutiveCorrect = 0; // Reset streak for hard cards
        }
        // Ensure ease factor doesn't go below minimum
        easeFactor = Math.max(easeFactor, SRS_DEFAULTS.MIN_EASE_FACTOR);
        // Calculate new interval
        if (consecutiveCorrect === 0) {
            // Reset interval for hard cards
            interval = SRS_DEFAULTS.INITIAL_INTERVAL;
        }
        else if (consecutiveCorrect === 1) {
            // First correct review
            interval = SRS_DEFAULTS.INITIAL_INTERVAL;
        }
        else {
            // Apply spaced repetition formula
            if (rating === 'hard') {
                interval = interval * SRS_DEFAULTS.HARD_INTERVAL_MULTIPLIER;
            }
            else {
                interval = interval * easeFactor;
            }
        }
        // Ensure interval doesn't go below minimum
        interval = Math.max(interval, SRS_DEFAULTS.MIN_INTERVAL);
        // Calculate next review date (convert interval from days to milliseconds)
        const nextReview = now + interval * 24 * 60 * 60 * 1000;
        // Update card data
        cardData.lastReviewed = now;
        cardData.nextReview = nextReview;
        cardData.easeFactor = easeFactor;
        cardData.interval = interval;
        cardData.consecutiveCorrect = consecutiveCorrect;
        // Add to history
        cardData.history.push({
            timestamp: now,
            rating,
            intervalApplied: interval
        });
        // Save updated SRS data
        this.saveSRSData();
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
                                const card = {
                                    id: `${file.path}::${cardType.name}::${name}`,
                                    type: cardType.name,
                                    name,
                                    content: cardContent,
                                    source: file.path,
                                    folder
                                };
                                flashcards.push(card);
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
    constructor(app, flashcards, plugin) {
        super(app);
        this.currentIndex = 0;
        this.showingAnswer = false;
        this.flashcards = flashcards;
        this.plugin = plugin;
        this.sessionSummary = {
            cardsReviewed: 0,
            easy: 0,
            medium: 0,
            hard: 0
        };
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
        // Create controls (different for front and back of card)
        this.createControls();
        // Add keyboard controls
        this.scope.register([], 'Enter', () => {
            if (this.showingAnswer) {
                // Skip to next card if looking at answer
                this.handleRating('medium');
            }
            else {
                this.flipCard();
            }
            return false;
        });
        this.scope.register([], 'Space', () => {
            if (this.showingAnswer) {
                // Skip to next card if looking at answer
                this.handleRating('medium');
            }
            else {
                this.flipCard();
            }
            return false;
        });
        this.scope.register([], 'ArrowLeft', () => {
            if (!this.showingAnswer) {
                this.previousCard();
            }
            return false;
        });
        this.scope.register([], 'ArrowRight', () => {
            if (this.showingAnswer) {
                this.handleRating('medium');
            }
            else {
                this.flipCard();
            }
            return false;
        });
        // Add keyboard shortcuts for rating
        this.scope.register([], '1', () => {
            if (this.showingAnswer)
                this.handleRating('hard');
            return false;
        });
        this.scope.register([], '2', () => {
            if (this.showingAnswer)
                this.handleRating('medium');
            return false;
        });
        this.scope.register([], '3', () => {
            if (this.showingAnswer)
                this.handleRating('easy');
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
            // If SRS is enabled, show due date info
            if (this.plugin.settings.enableSRS) {
                const cardId = this.plugin.generateCardId(card);
                const cardData = this.plugin.srsData.cards[cardId];
                if (cardData) {
                    const dueDate = new Date(cardData.nextReview);
                    cardEl.createEl("div", {
                        cls: "flashcard-due-date",
                        text: `Due: ${dueDate.toLocaleDateString()}`
                    });
                }
                else {
                    cardEl.createEl("div", {
                        cls: "flashcard-new-card",
                        text: "New Card"
                    });
                }
            }
        }
        else {
            // Show back of card
            const contentEl = cardEl.createEl("div", { cls: "flashcard-content" });
            // Create a new component for markdown rendering
            const component = new obsidian.Component();
            component.load();
            // Render markdown content
            obsidian.MarkdownRenderer.renderMarkdown(card.content, contentEl, card.source, component);
            cardEl.createEl("div", {
                cls: "flashcard-source",
                text: `Source: ${card.source}`
            });
        }
    }
    createControls() {
        // Remove existing controls
        const existingControls = this.contentEl.querySelector(".flashcard-controls");
        if (existingControls) {
            existingControls.remove();
        }
        const controlsEl = this.contentEl.createEl("div", { cls: "flashcard-controls" });
        if (!this.showingAnswer) {
            // Controls for front of card
            const prevBtn = controlsEl.createEl("button", { text: "Previous" });
            prevBtn.addEventListener("click", () => {
                this.previousCard();
            });
            const flipBtn = controlsEl.createEl("button", { text: "Flip Card" });
            flipBtn.addEventListener("click", () => {
                this.flipCard();
            });
            const skipBtn = controlsEl.createEl("button", { text: "Skip" });
            skipBtn.addEventListener("click", () => {
                this.nextCard();
            });
        }
        else {
            // Controls for back of card (rating buttons)
            const ratingContainer = controlsEl.createEl("div", { cls: "flashcard-rating" });
            const hardBtn = ratingContainer.createEl("button", {
                cls: "flashcard-rating-hard",
                text: "Hard (1)"
            });
            hardBtn.addEventListener("click", () => {
                this.handleRating('hard');
            });
            const mediumBtn = ratingContainer.createEl("button", {
                cls: "flashcard-rating-medium",
                text: "Medium (2)"
            });
            mediumBtn.addEventListener("click", () => {
                this.handleRating('medium');
            });
            const easyBtn = ratingContainer.createEl("button", {
                cls: "flashcard-rating-easy",
                text: "Easy (3)"
            });
            easyBtn.addEventListener("click", () => {
                this.handleRating('easy');
            });
        }
    }
    handleRating(rating) {
        const currentCard = this.flashcards[this.currentIndex];
        // Update session summary
        this.sessionSummary.cardsReviewed++;
        this.sessionSummary[rating]++;
        // Process the rating if SRS is enabled
        if (this.plugin.settings.enableSRS) {
            this.plugin.processCardRating(currentCard, rating);
        }
        // Move to next card
        if (this.currentIndex < this.flashcards.length - 1) {
            this.currentIndex++;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl);
            this.createControls();
        }
        else {
            // End of session
            this.showSessionSummary();
        }
    }
    flipCard() {
        this.showingAnswer = !this.showingAnswer;
        const cardEl = this.contentEl.querySelector(".flashcard-card");
        this.displayCurrentFlashcard(cardEl);
        this.createControls();
    }
    nextCard() {
        if (this.currentIndex < this.flashcards.length - 1) {
            this.currentIndex++;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl);
            this.createControls();
        }
        else {
            // End of session
            this.showSessionSummary();
        }
    }
    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl);
            this.createControls();
        }
        else {
            // At the beginning of the deck
            new obsidian.Notice("You're at the first flashcard!");
        }
    }
    showSessionSummary() {
        // Clear content
        this.contentEl.empty();
        this.contentEl.addClass("flashcard-summary");
        // Create summary header
        const headerEl = this.contentEl.createEl("div", { cls: "flashcard-summary-header" });
        headerEl.createEl("h2", { text: "Session Complete!" });
        // Create summary content
        const summaryEl = this.contentEl.createEl("div", { cls: "flashcard-summary-content" });
        summaryEl.createEl("p", {
            text: `You reviewed ${this.sessionSummary.cardsReviewed} cards in this session.`
        });
        const statsEl = summaryEl.createEl("div", { cls: "flashcard-summary-stats" });
        statsEl.createEl("div", {
            text: `Easy: ${this.sessionSummary.easy} cards`
        });
        statsEl.createEl("div", {
            text: `Medium: ${this.sessionSummary.medium} cards`
        });
        statsEl.createEl("div", {
            text: `Hard: ${this.sessionSummary.hard} cards`
        });
        // Create controls
        const controlsEl = this.contentEl.createEl("div", { cls: "flashcard-summary-controls" });
        const restartBtn = controlsEl.createEl("button", {
            text: "Start New Session"
        });
        restartBtn.addEventListener("click", () => {
            this.close();
            this.plugin.startFlashcardSession();
        });
        const closeBtn = controlsEl.createEl("button", {
            text: "Close"
        });
        closeBtn.addEventListener("click", () => {
            this.close();
        });
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
        // General settings
        containerEl.createEl('h3', { text: 'General Settings' });
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
        // SRS settings section
        containerEl.createEl('h3', { text: 'Spaced Repetition Settings' });
        new obsidian.Setting(containerEl)
            .setName('Enable Spaced Repetition')
            .setDesc('Use spaced repetition algorithm to schedule card reviews')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.enableSRS)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.enableSRS = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('SRS Data File Path')
            .setDesc('Path to store spaced repetition data (relative to vault root)')
            .addText(text => text
            .setValue(this.plugin.settings.srsDataPath)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.srsDataPath = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Maximum Cards Per Session')
            .setDesc('Limit the number of cards to review in each session')
            .addSlider(slider => slider
            .setLimits(5, 100, 5)
            .setValue(this.plugin.settings.maxCardsPerSession)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.maxCardsPerSession = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Include New Cards')
            .setDesc('Include cards that have never been reviewed before')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.includeNewCards)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.includeNewCards = value;
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Maximum New Cards Per Session')
            .setDesc('Limit the number of new cards to include in each session')
            .addSlider(slider => slider
            .setLimits(0, 20, 1)
            .setValue(this.plugin.settings.maxNewCardsPerSession)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.maxNewCardsPerSession = value;
            yield this.plugin.saveSettings();
        })));
        // Reset SRS data button
        new obsidian.Setting(containerEl)
            .setName('Reset SRS Data')
            .setDesc('WARNING: This will reset all spaced repetition progress')
            .addButton(button => button
            .setButtonText('Reset All SRS Data')
            .setWarning()
            .onClick(() => __awaiter(this, void 0, void 0, function* () {
            const confirmReset = confirm('Are you sure you want to reset all spaced repetition data? ' +
                'This will erase all review history and scheduling information.');
            if (confirmReset) {
                // Reset SRS data
                this.plugin.srsData = { cards: {}, version: 1 };
                yield this.plugin.saveSRSData();
                new obsidian.Notice('Spaced repetition data has been reset');
            }
        })));
        // Reload configuration button
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
        containerEl.createEl('h3', { text: 'SRS Statistics' });
        const statsInfo = containerEl.createEl('div', {
            cls: 'flashcard-srs-stats'
        });
        // Calculate some basic stats
        const totalCards = Object.keys(this.plugin.srsData.cards).length;
        let dueCards = 0;
        let dueToday = 0;
        const now = Date.now();
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        for (const cardId in this.plugin.srsData.cards) {
            const card = this.plugin.srsData.cards[cardId];
            if (card.nextReview <= now) {
                dueCards++;
            }
            if (card.nextReview <= endOfToday.getTime()) {
                dueToday++;
            }
        }
        statsInfo.createEl('p', {
            text: `Total cards in system: ${totalCards}`
        });
        statsInfo.createEl('p', {
            text: `Cards due now: ${dueCards}`
        });
        statsInfo.createEl('p', {
            text: `Cards due today: ${dueToday}`
        });
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
        // Add CSS for SRS rating buttons
        this.addCustomCSS();
    }
    addCustomCSS() {
        // Create a style element for custom CSS if it doesn't exist
        let styleEl = document.getElementById('flashcards-plugin-custom-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'flashcards-plugin-custom-css';
            document.head.appendChild(styleEl);
        }
        // Add CSS for SRS rating buttons
        styleEl.innerHTML = `
            .flashcard-card {
                padding: 20px;
                background: var(--background-primary);
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                min-height: 200px;
            }
            
            .flashcard-rating {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
            }
            
            .flashcard-rating button {
                flex: 1;
                margin: 0 5px;
                padding: 10px;
                border-radius: 4px;
                font-weight: bold;
            }
            
            .flashcard-rating-hard {
                background-color: rgba(255, 75, 75, 0.2);
                border: 1px solid rgba(255, 75, 75, 0.5);
            }
            
            .flashcard-rating-medium {
                background-color: rgba(255, 165, 0, 0.2);
                border: 1px solid rgba(255, 165, 0, 0.5);
            }
            
            .flashcard-rating-easy {
                background-color: rgba(75, 255, 75, 0.2);
                border: 1px solid rgba(75, 255, 75, 0.5);
            }
            
            .flashcard-summary {
                text-align: center;
                padding: 20px;
            }
            
            .flashcard-summary-stats {
                margin: 20px 0;
                font-size: 16px;
                line-height: 1.6;
            }
            
            .flashcard-summary-controls {
                margin-top: 30px;
            }
            
            .flashcard-summary-controls button {
                margin: 0 10px;
                padding: 8px 16px;
            }
            
            .flashcard-due-date,
            .flashcard-new-card {
                margin-top: 10px;
                font-size: 12px;
                opacity: 0.7;
            }
            
            .flashcard-new-card {
                color: var(--text-accent);
                font-weight: bold;
            }
        `;
    }
}

module.exports = FlashcardsPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIE1vZGFsLCBOb3RpY2UsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgVEZpbGUsIE1hcmtkb3duUmVuZGVyZXIsIENvbXBvbmVudCB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuLy8gRGVmaW5lIHRoZSBjYXJkIHR5cGUgY29uZmlndXJhdGlvbiBzdHJ1Y3R1cmVcclxuaW50ZXJmYWNlIENhcmRUeXBlQ29uZmlnIHtcclxuICAgIGlkOiBzdHJpbmc7ICAgICAgICAgIC8vIFVuaXF1ZSBpZGVudGlmaWVyXHJcbiAgICBuYW1lOiBzdHJpbmc7ICAgICAgICAvLyBEaXNwbGF5IG5hbWVcclxuICAgIHBhdHRlcm46IHN0cmluZzsgICAgIC8vIFJlZ2V4IHBhdHRlcm4gZm9yIG1hdGNoaW5nXHJcbiAgICBlbmFibGVkOiBib29sZWFuOyAgICAvLyBXaGV0aGVyIHRoaXMgdHlwZSBpcyBlbmFibGVkXHJcbn1cclxuXHJcbmludGVyZmFjZSBGbGFzaENhcmQge1xyXG4gICAgaWQ6IHN0cmluZzsgICAgICAgICAgLy8gVW5pcXVlIGlkZW50aWZpZXIgZm9yIGVhY2ggY2FyZFxyXG4gICAgdHlwZTogc3RyaW5nOyAgICAgICAgLy8gVGhlIGNhcmQgdHlwZSBuYW1lXHJcbiAgICBuYW1lOiBzdHJpbmc7ICAgICAgICAvLyBUaGUgbmFtZSBjb21wb25lbnRcclxuICAgIGNvbnRlbnQ6IHN0cmluZzsgICAgIC8vIFRoZSBib2R5IGNvbnRlbnRcclxuICAgIHNvdXJjZTogc3RyaW5nOyAgICAgIC8vIFNvdXJjZSBmaWxlIHBhdGhcclxuICAgIGZvbGRlcjogc3RyaW5nOyAgICAgIC8vIFBhcmVudCBmb2xkZXIgbmFtZVxyXG59XHJcblxyXG4vLyBTUlMgcmVsYXRlZCBpbnRlcmZhY2VzXHJcbmludGVyZmFjZSBTUlNDYXJkRGF0YSB7XHJcbiAgICBjYXJkSWQ6IHN0cmluZzsgICAgICAgICAgICAvLyBVbmlxdWUgaWRlbnRpZmllciBmb3IgdGhlIGNhcmRcclxuICAgIGxhc3RSZXZpZXdlZD86IG51bWJlcjsgICAgIC8vIFRpbWVzdGFtcCBvZiBsYXN0IHJldmlld1xyXG4gICAgbmV4dFJldmlldzogbnVtYmVyOyAgICAgICAgLy8gVGltZXN0YW1wIGZvciBuZXh0IHNjaGVkdWxlZCByZXZpZXdcclxuICAgIGVhc2VGYWN0b3I6IG51bWJlcjsgICAgICAgIC8vIE11bHRpcGxpZXIgdGhhdCBhZmZlY3RzIGludGVydmFsIGdyb3d0aCAoaGlnaGVyID0gZWFzaWVyKVxyXG4gICAgaW50ZXJ2YWw6IG51bWJlcjsgICAgICAgICAgLy8gQ3VycmVudCBpbnRlcnZhbCBpbiBkYXlzXHJcbiAgICBjb25zZWN1dGl2ZUNvcnJlY3Q6IG51bWJlcjsgLy8gTnVtYmVyIG9mIGNvbnNlY3V0aXZlIGNvcnJlY3QgcmV2aWV3c1xyXG4gICAgaGlzdG9yeTogU1JTUmV2aWV3SGlzdG9yeVtdOyAvLyBSZWNvcmQgb2YgcHJldmlvdXMgcmV2aWV3c1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU1JTUmV2aWV3SGlzdG9yeSB7XHJcbiAgICB0aW1lc3RhbXA6IG51bWJlcjsgICAgICAgICAvLyBXaGVuIHRoZSByZXZpZXcgb2NjdXJyZWRcclxuICAgIHJhdGluZzogJ2Vhc3knIHwgJ21lZGl1bScgfCAnaGFyZCc7IC8vIFVzZXIgcmF0aW5nXHJcbiAgICBpbnRlcnZhbEFwcGxpZWQ6IG51bWJlcjsgICAvLyBJbnRlcnZhbCB0aGF0IHdhcyBhcHBsaWVkIGF0IHRoaXMgcmV2aWV3XHJcbn1cclxuXHJcbmludGVyZmFjZSBTUlNEYXRhIHtcclxuICAgIGNhcmRzOiBSZWNvcmQ8c3RyaW5nLCBTUlNDYXJkRGF0YT47XHJcbiAgICB2ZXJzaW9uOiBudW1iZXI7ICAgICAgICAgICAvLyBGb3IgZnV0dXJlIGNvbXBhdGliaWxpdHlcclxufVxyXG5cclxuLy8gRXh0ZW5kZWQgcGx1Z2luIHNldHRpbmdzXHJcbmludGVyZmFjZSBGbGFzaGNhcmRzUGx1Z2luU2V0dGluZ3Mge1xyXG4gICAgc2h1ZmZsZUNhcmRzOiBib29sZWFuO1xyXG4gICAgY29uZmlnUGF0aDogc3RyaW5nO1xyXG4gICAgbWF4Q2FyZHNQZXJTZXNzaW9uOiBudW1iZXI7ICAvLyBNYXggY2FyZHMgdG8gcmV2aWV3IHBlciBzZXNzaW9uXHJcbiAgICBzcnNEYXRhUGF0aDogc3RyaW5nOyAgICAgICAgLy8gUGF0aCB0byBzdG9yZSBTUlMgZGF0YVxyXG4gICAgZW5hYmxlU1JTOiBib29sZWFuOyAgICAgICAgIC8vIFRvZ2dsZSBmb3IgU1JTIGZ1bmN0aW9uYWxpdHlcclxuICAgIGluY2x1ZGVOZXdDYXJkczogYm9vbGVhbjsgICAvLyBJbmNsdWRlIG5ldyBjYXJkcyBpbiBzZXNzaW9uc1xyXG4gICAgbWF4TmV3Q2FyZHNQZXJTZXNzaW9uOiBudW1iZXI7IC8vIExpbWl0IGZvciBuZXcgY2FyZHNcclxufVxyXG5cclxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogRmxhc2hjYXJkc1BsdWdpblNldHRpbmdzID0ge1xyXG4gICAgc2h1ZmZsZUNhcmRzOiB0cnVlLFxyXG4gICAgY29uZmlnUGF0aDogJ2NvbmZpZy5qc29uJyxcclxuICAgIG1heENhcmRzUGVyU2Vzc2lvbjogMjAsXHJcbiAgICBzcnNEYXRhUGF0aDogJ3Nycy1kYXRhLmpzb24nLFxyXG4gICAgZW5hYmxlU1JTOiB0cnVlLFxyXG4gICAgaW5jbHVkZU5ld0NhcmRzOiB0cnVlLFxyXG4gICAgbWF4TmV3Q2FyZHNQZXJTZXNzaW9uOiA1XHJcbn1cclxuXHJcbi8vIENvbnN0YW50cyBmb3IgU1JTIGFsZ29yaXRobVxyXG5jb25zdCBTUlNfREVGQVVMVFMgPSB7XHJcbiAgICBJTklUSUFMX0VBU0VfRkFDVE9SOiAyLjUsXHJcbiAgICBNSU5fRUFTRV9GQUNUT1I6IDEuMyxcclxuICAgIEVBU0VfQk9OVVM6IDAuMTUsXHJcbiAgICBFQVNFX1BFTkFMVFk6IDAuMixcclxuICAgIElOSVRJQUxfSU5URVJWQUw6IDEsIC8vIDEgZGF5XHJcbiAgICBNSU5fSU5URVJWQUw6IDEsIC8vIDEgZGF5XHJcbiAgICBIQVJEX0lOVEVSVkFMX01VTFRJUExJRVI6IDAuNSwgLy8gUmVkdWNlIGludGVydmFsIGJ5IDUwJSBmb3IgaGFyZCBjYXJkc1xyXG4gICAgTk9XOiBEYXRlLm5vdygpXHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZsYXNoY2FyZHNQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gICAgc2V0dGluZ3M6IEZsYXNoY2FyZHNQbHVnaW5TZXR0aW5ncztcclxuICAgIGNhcmRUeXBlczogQ2FyZFR5cGVDb25maWdbXSA9IFtdO1xyXG4gICAgc3JzRGF0YTogU1JTRGF0YSA9IHsgY2FyZHM6IHt9LCB2ZXJzaW9uOiAxIH07XHJcblxyXG4gICAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdMb2FkaW5nIGZsYXNoY2FyZHMgcGx1Z2luJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRDYXJkVHlwZXNDb25maWcoKTtcclxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRTUlNEYXRhKCk7XHJcblxyXG4gICAgICAgIC8vIEFkZCByaWJib24gaWNvblxyXG4gICAgICAgIHRoaXMuYWRkUmliYm9uSWNvbignZGljZScsICdGbGFzaGNhcmRzJywgKGV2dDogTW91c2VFdmVudCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0Rmxhc2hjYXJkU2Vzc2lvbigpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBBZGQgY29tbWFuZHNcclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogJ3N0YXJ0LWZsYXNoY2FyZC1zZXNzaW9uJyxcclxuICAgICAgICAgICAgbmFtZTogJ1N0YXJ0IEZsYXNoY2FyZCBTZXNzaW9uJyxcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6ICdyZWxvYWQtZmxhc2hjYXJkLWNvbmZpZycsXHJcbiAgICAgICAgICAgIG5hbWU6ICdSZWxvYWQgRmxhc2hjYXJkIENvbmZpZ3VyYXRpb24nLFxyXG4gICAgICAgICAgICBjYWxsYmFjazogYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkQ2FyZFR5cGVzQ29uZmlnKCk7XHJcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdGbGFzaGNhcmQgY29uZmlndXJhdGlvbiByZWxvYWRlZCcpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIEFkZCBzZXR0aW5ncyB0YWJcclxuICAgICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZsYXNoY2FyZHNTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XHJcbiAgICB9XHJcblxyXG4gICAgb251bmxvYWQoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1VubG9hZGluZyBmbGFzaGNhcmRzIHBsdWdpbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgICAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBsb2FkQ2FyZFR5cGVzQ29uZmlnKCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIEdldCB0aGUgcGF0aCB0byB0aGUgT2JzaWRpYW4gdmF1bHRcclxuICAgICAgICAgICAgY29uc3QgdmF1bHRQYXRoID0gKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgYW55KS5iYXNlUGF0aDsgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDb21iaW5lIHdpdGggdGhlIGNvbmZpZyBmaWxlIHBhdGggZnJvbSBzZXR0aW5nc1xyXG4gICAgICAgICAgICBjb25zdCBjb25maWdGaWxlUGF0aCA9IHBhdGguam9pbih2YXVsdFBhdGgsIHRoaXMuc2V0dGluZ3MuY29uZmlnUGF0aCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSBleGlzdHNcclxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoY29uZmlnRmlsZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBSZWFkIGFuZCBwYXJzZSB0aGUgSlNPTiBmaWxlXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb25maWdEYXRhID0gZnMucmVhZEZpbGVTeW5jKGNvbmZpZ0ZpbGVQYXRoLCAndXRmOCcpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jYXJkVHlwZXMgPSBKU09OLnBhcnNlKGNvbmZpZ0RhdGEpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYExvYWRlZCAke3RoaXMuY2FyZFR5cGVzLmxlbmd0aH0gY2FyZCB0eXBlcyBmcm9tIGNvbmZpZ3VyYXRpb25gKTtcclxuXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgZGVmYXVsdCBjb25maWd1cmF0aW9uIGlmIGZpbGUgZG9lc24ndCBleGlzdFxyXG4gICAgICAgICAgICAgICAgdGhpcy5jYXJkVHlwZXMgPSBbXHJcbiAgICAgICAgICAgICAgICAgICAgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IFwiZGVmaW5pdGlvblwiLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJEZWZpbml0aW9uXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBcIlxcXFwqXFxcXCpEZWZpbml0aW9uOlxcXFxzKihbXipdKylcXFxcKlxcXFwqXFxcXHMqKFtcXFxcc1xcXFxTXSo/KSg/PVxcXFxuXFxcXHMqXFxcXG58XFxcXG5cXFxccypcXFxcKlxcXFwqfFxcXFxuXFxcXHMqI3sxLDZ9XFxcXHN8JClcIlxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgeyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IFwidGhlb3JlbVwiLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogXCJUaGVvcmVtXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBcIlxcXFwqXFxcXCpUaGVvcmVtOlxcXFxzKihbXipdKylcXFxcKlxcXFwqXFxcXHMqKFtcXFxcc1xcXFxTXSo/KSg/PVxcXFxuXFxcXHMqXFxcXG58XFxcXG5cXFxccypcXFxcKlxcXFwqfFxcXFxuXFxcXHMqI3sxLDZ9XFxcXHN8JClcIlxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgY29uZmlndXJhdGlvbiBmaWxlIHdpdGggZGVmYXVsdCBzZXR0aW5nc1xyXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhjb25maWdGaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkodGhpcy5jYXJkVHlwZXMsIG51bGwsIDIpKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDcmVhdGVkIGRlZmF1bHQgY29uZmlndXJhdGlvbiBmaWxlIGF0ICR7Y29uZmlnRmlsZVBhdGh9YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgbG9hZGluZyBjYXJkIHR5cGVzIGNvbmZpZ3VyYXRpb246JywgZXJyb3IpO1xyXG4gICAgICAgICAgICBuZXcgTm90aWNlKCdFcnJvciBsb2FkaW5nIGZsYXNoY2FyZCBjb25maWd1cmF0aW9uIGZpbGUnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9hZFNSU0RhdGEoKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gR2V0IHRoZSBwYXRoIHRvIHRoZSBPYnNpZGlhbiB2YXVsdFxyXG4gICAgICAgICAgICBjb25zdCB2YXVsdFBhdGggPSAodGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyBhbnkpLmJhc2VQYXRoOyBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIENvbWJpbmUgd2l0aCB0aGUgU1JTIGRhdGEgZmlsZSBwYXRoIGZyb20gc2V0dGluZ3NcclxuICAgICAgICAgICAgY29uc3Qgc3JzRGF0YUZpbGVQYXRoID0gcGF0aC5qb2luKHZhdWx0UGF0aCwgdGhpcy5zZXR0aW5ncy5zcnNEYXRhUGF0aCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgZmlsZSBleGlzdHNcclxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc3JzRGF0YUZpbGVQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gUmVhZCBhbmQgcGFyc2UgdGhlIEpTT04gZmlsZVxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3JzRGF0YUNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoc3JzRGF0YUZpbGVQYXRoLCAndXRmOCcpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zcnNEYXRhID0gSlNPTi5wYXJzZShzcnNEYXRhQ29udGVudCk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTG9hZGVkIFNSUyBkYXRhIGZvciAke09iamVjdC5rZXlzKHRoaXMuc3JzRGF0YS5jYXJkcykubGVuZ3RofSBjYXJkc2ApO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGRlZmF1bHQgU1JTIGRhdGEgaWYgZmlsZSBkb2Vzbid0IGV4aXN0XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNyc0RhdGEgPSB7IGNhcmRzOiB7fSwgdmVyc2lvbjogMSB9O1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgdGhlIFNSUyBkYXRhIGZpbGUgd2l0aCBkZWZhdWx0IHNldHRpbmdzXHJcbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNyc0RhdGFGaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkodGhpcy5zcnNEYXRhLCBudWxsLCAyKSk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQ3JlYXRlZCBkZWZhdWx0IFNSUyBkYXRhIGZpbGUgYXQgJHtzcnNEYXRhRmlsZVBhdGh9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsb2FkaW5nIFNSUyBkYXRhOicsIGVycm9yKTtcclxuICAgICAgICAgICAgbmV3IE5vdGljZSgnRXJyb3IgbG9hZGluZyBTUlMgZGF0YSBmaWxlJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNhdmVTUlNEYXRhKCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIEdldCB0aGUgcGF0aCB0byB0aGUgT2JzaWRpYW4gdmF1bHRcclxuICAgICAgICAgICAgY29uc3QgdmF1bHRQYXRoID0gKHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgYW55KS5iYXNlUGF0aDsgXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBDb21iaW5lIHdpdGggdGhlIFNSUyBkYXRhIGZpbGUgcGF0aCBmcm9tIHNldHRpbmdzXHJcbiAgICAgICAgICAgIGNvbnN0IHNyc0RhdGFGaWxlUGF0aCA9IHBhdGguam9pbih2YXVsdFBhdGgsIHRoaXMuc2V0dGluZ3Muc3JzRGF0YVBhdGgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgU1JTIGRhdGFcclxuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhzcnNEYXRhRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHRoaXMuc3JzRGF0YSwgbnVsbCwgMikpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgU2F2ZWQgU1JTIGRhdGEgZm9yICR7T2JqZWN0LmtleXModGhpcy5zcnNEYXRhLmNhcmRzKS5sZW5ndGh9IGNhcmRzYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2F2aW5nIFNSUyBkYXRhOicsIGVycm9yKTtcclxuICAgICAgICAgICAgbmV3IE5vdGljZSgnRXJyb3Igc2F2aW5nIFNSUyBkYXRhIGZpbGUnKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCkge1xyXG4gICAgICAgIGNvbnN0IGFsbEZsYXNoY2FyZHMgPSBhd2FpdCB0aGlzLnBhcnNlRmxhc2hjYXJkcygpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChhbGxGbGFzaGNhcmRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICBuZXcgTm90aWNlKCdObyBmbGFzaGNhcmRzIGZvdW5kLiBDaGVjayB5b3VyIGNvbmZpZ3VyYXRpb24gYW5kIG1ha2Ugc3VyZSB5b3VyIG5vdGVzIGNvbnRhaW4gdGhlIGRlZmluZWQgcGF0dGVybnMuJyk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIElmIFNSUyBpcyBlbmFibGVkLCBmaWx0ZXIgY2FyZHMgYmFzZWQgb24gcmV2aWV3IHNjaGVkdWxlXHJcbiAgICAgICAgbGV0IHNlc3Npb25GbGFzaGNhcmRzID0gYWxsRmxhc2hjYXJkcztcclxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5lbmFibGVTUlMpIHtcclxuICAgICAgICAgICAgc2Vzc2lvbkZsYXNoY2FyZHMgPSB0aGlzLmZpbHRlckNhcmRzRm9yU2Vzc2lvbihhbGxGbGFzaGNhcmRzKTtcclxuICAgICAgICAgICAgaWYgKHNlc3Npb25GbGFzaGNhcmRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnTm8gY2FyZHMgZHVlIGZvciByZXZpZXcgcmlnaHQgbm93LiBDaGVjayBiYWNrIGxhdGVyIScpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLnNodWZmbGVDYXJkcykge1xyXG4gICAgICAgICAgICB0aGlzLnNodWZmbGVBcnJheShzZXNzaW9uRmxhc2hjYXJkcyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXcgRmxhc2hjYXJkTW9kYWwodGhpcy5hcHAsIHNlc3Npb25GbGFzaGNhcmRzLCB0aGlzKS5vcGVuKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2VuZXJhdGUgdW5pcXVlIElEIGZvciBhIGNhcmRcclxuICAgIGdlbmVyYXRlQ2FyZElkKGNhcmQ6IEZsYXNoQ2FyZCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIGAke2NhcmQuc291cmNlfTo6JHtjYXJkLnR5cGV9Ojoke2NhcmQubmFtZX1gO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpbHRlciBjYXJkcyBmb3IgdGhlIGN1cnJlbnQgc2Vzc2lvbiBiYXNlZCBvbiBTUlMgc2NoZWR1bGluZ1xyXG4gICAgZmlsdGVyQ2FyZHNGb3JTZXNzaW9uKGFsbENhcmRzOiBGbGFzaENhcmRbXSk6IEZsYXNoQ2FyZFtdIHtcclxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IERhdGUubm93KCk7XHJcbiAgICAgICAgY29uc3QgZHVlQ2FyZHM6IEZsYXNoQ2FyZFtdID0gW107XHJcbiAgICAgICAgY29uc3QgbmV3Q2FyZHM6IEZsYXNoQ2FyZFtdID0gW107XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gRmlyc3QsIGlkZW50aWZ5IGR1ZSBhbmQgbmV3IGNhcmRzXHJcbiAgICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGFsbENhcmRzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRJZCA9IHRoaXMuZ2VuZXJhdGVDYXJkSWQoY2FyZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNyc0RhdGEgPSB0aGlzLnNyc0RhdGEuY2FyZHNbY2FyZElkXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghc3JzRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBhIG5ldyBjYXJkXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5pbmNsdWRlTmV3Q2FyZHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXdDYXJkcy5wdXNoKGNhcmQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNyc0RhdGEubmV4dFJldmlldyA8PSBjdXJyZW50VGltZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVGhpcyBjYXJkIGlzIGR1ZSBmb3IgcmV2aWV3XHJcbiAgICAgICAgICAgICAgICBkdWVDYXJkcy5wdXNoKGNhcmQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNvcnQgZHVlIGNhcmRzIGJ5IGhvdyBvdmVyZHVlIHRoZXkgYXJlIChtb3N0IG92ZXJkdWUgZmlyc3QpXHJcbiAgICAgICAgZHVlQ2FyZHMuc29ydCgoYSwgYikgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBhSWQgPSB0aGlzLmdlbmVyYXRlQ2FyZElkKGEpO1xyXG4gICAgICAgICAgICBjb25zdCBiSWQgPSB0aGlzLmdlbmVyYXRlQ2FyZElkKGIpO1xyXG4gICAgICAgICAgICBjb25zdCBhTmV4dFJldmlldyA9IHRoaXMuc3JzRGF0YS5jYXJkc1thSWRdLm5leHRSZXZpZXc7XHJcbiAgICAgICAgICAgIGNvbnN0IGJOZXh0UmV2aWV3ID0gdGhpcy5zcnNEYXRhLmNhcmRzW2JJZF0ubmV4dFJldmlldztcclxuICAgICAgICAgICAgcmV0dXJuIGFOZXh0UmV2aWV3IC0gYk5leHRSZXZpZXc7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU2h1ZmZsZSBuZXcgY2FyZHMgaWYgbmVlZGVkXHJcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Muc2h1ZmZsZUNhcmRzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2h1ZmZsZUFycmF5KG5ld0NhcmRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQ29tYmluZSBjYXJkcywgcmVzcGVjdGluZyBsaW1pdHNcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBbLi4uZHVlQ2FyZHNdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEFkZCBuZXcgY2FyZHMgdXAgdG8gdGhlIGxpbWl0XHJcbiAgICAgICAgY29uc3QgbmV3Q2FyZHNUb0FkZCA9IE1hdGgubWluKFxyXG4gICAgICAgICAgICBuZXdDYXJkcy5sZW5ndGgsXHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MubWF4TmV3Q2FyZHNQZXJTZXNzaW9uLFxyXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm1heENhcmRzUGVyU2Vzc2lvbiAtIHJlc3VsdC5sZW5ndGhcclxuICAgICAgICApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChuZXdDYXJkc1RvQWRkID4gMCkge1xyXG4gICAgICAgICAgICByZXN1bHQucHVzaCguLi5uZXdDYXJkcy5zbGljZSgwLCBuZXdDYXJkc1RvQWRkKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIExpbWl0IHRvdGFsIGNhcmRzXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5zbGljZSgwLCB0aGlzLnNldHRpbmdzLm1heENhcmRzUGVyU2Vzc2lvbik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUHJvY2VzcyBjYXJkIHJhdGluZyBhbmQgc2NoZWR1bGUgbmV4dCByZXZpZXdcclxuICAgIHByb2Nlc3NDYXJkUmF0aW5nKGNhcmQ6IEZsYXNoQ2FyZCwgcmF0aW5nOiAnZWFzeScgfCAnbWVkaXVtJyB8ICdoYXJkJyk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGNhcmRJZCA9IHRoaXMuZ2VuZXJhdGVDYXJkSWQoY2FyZCk7XHJcbiAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBHZXQgb3IgY3JlYXRlIFNSUyBkYXRhIGZvciB0aGlzIGNhcmRcclxuICAgICAgICBsZXQgY2FyZERhdGEgPSB0aGlzLnNyc0RhdGEuY2FyZHNbY2FyZElkXTtcclxuICAgICAgICBpZiAoIWNhcmREYXRhKSB7XHJcbiAgICAgICAgICAgIGNhcmREYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgY2FyZElkLFxyXG4gICAgICAgICAgICAgICAgbmV4dFJldmlldzogbm93LFxyXG4gICAgICAgICAgICAgICAgZWFzZUZhY3RvcjogU1JTX0RFRkFVTFRTLklOSVRJQUxfRUFTRV9GQUNUT1IsXHJcbiAgICAgICAgICAgICAgICBpbnRlcnZhbDogU1JTX0RFRkFVTFRTLklOSVRJQUxfSU5URVJWQUwsXHJcbiAgICAgICAgICAgICAgICBjb25zZWN1dGl2ZUNvcnJlY3Q6IDAsXHJcbiAgICAgICAgICAgICAgICBoaXN0b3J5OiBbXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnNyc0RhdGEuY2FyZHNbY2FyZElkXSA9IGNhcmREYXRhO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ2FsY3VsYXRlIG5ldyB2YWx1ZXMgYmFzZWQgb24gcmF0aW5nXHJcbiAgICAgICAgbGV0IHsgaW50ZXJ2YWwsIGVhc2VGYWN0b3IsIGNvbnNlY3V0aXZlQ29ycmVjdCB9ID0gY2FyZERhdGE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gVXBkYXRlIGVhc2UgZmFjdG9yIGJhc2VkIG9uIHJhdGluZ1xyXG4gICAgICAgIGlmIChyYXRpbmcgPT09ICdlYXN5Jykge1xyXG4gICAgICAgICAgICBlYXNlRmFjdG9yICs9IFNSU19ERUZBVUxUUy5FQVNFX0JPTlVTO1xyXG4gICAgICAgICAgICBjb25zZWN1dGl2ZUNvcnJlY3QrKztcclxuICAgICAgICB9IGVsc2UgaWYgKHJhdGluZyA9PT0gJ21lZGl1bScpIHtcclxuICAgICAgICAgICAgLy8gS2VlcCBlYXNlIGZhY3RvciB0aGUgc2FtZVxyXG4gICAgICAgICAgICBjb25zZWN1dGl2ZUNvcnJlY3QrKztcclxuICAgICAgICB9IGVsc2UgaWYgKHJhdGluZyA9PT0gJ2hhcmQnKSB7XHJcbiAgICAgICAgICAgIGVhc2VGYWN0b3IgLT0gU1JTX0RFRkFVTFRTLkVBU0VfUEVOQUxUWTtcclxuICAgICAgICAgICAgY29uc2VjdXRpdmVDb3JyZWN0ID0gMDsgIC8vIFJlc2V0IHN0cmVhayBmb3IgaGFyZCBjYXJkc1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBFbnN1cmUgZWFzZSBmYWN0b3IgZG9lc24ndCBnbyBiZWxvdyBtaW5pbXVtXHJcbiAgICAgICAgZWFzZUZhY3RvciA9IE1hdGgubWF4KGVhc2VGYWN0b3IsIFNSU19ERUZBVUxUUy5NSU5fRUFTRV9GQUNUT1IpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENhbGN1bGF0ZSBuZXcgaW50ZXJ2YWxcclxuICAgICAgICBpZiAoY29uc2VjdXRpdmVDb3JyZWN0ID09PSAwKSB7XHJcbiAgICAgICAgICAgIC8vIFJlc2V0IGludGVydmFsIGZvciBoYXJkIGNhcmRzXHJcbiAgICAgICAgICAgIGludGVydmFsID0gU1JTX0RFRkFVTFRTLklOSVRJQUxfSU5URVJWQUw7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb25zZWN1dGl2ZUNvcnJlY3QgPT09IDEpIHtcclxuICAgICAgICAgICAgLy8gRmlyc3QgY29ycmVjdCByZXZpZXdcclxuICAgICAgICAgICAgaW50ZXJ2YWwgPSBTUlNfREVGQVVMVFMuSU5JVElBTF9JTlRFUlZBTDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBBcHBseSBzcGFjZWQgcmVwZXRpdGlvbiBmb3JtdWxhXHJcbiAgICAgICAgICAgIGlmIChyYXRpbmcgPT09ICdoYXJkJykge1xyXG4gICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBpbnRlcnZhbCAqIFNSU19ERUZBVUxUUy5IQVJEX0lOVEVSVkFMX01VTFRJUExJRVI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpbnRlcnZhbCA9IGludGVydmFsICogZWFzZUZhY3RvcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBFbnN1cmUgaW50ZXJ2YWwgZG9lc24ndCBnbyBiZWxvdyBtaW5pbXVtXHJcbiAgICAgICAgaW50ZXJ2YWwgPSBNYXRoLm1heChpbnRlcnZhbCwgU1JTX0RFRkFVTFRTLk1JTl9JTlRFUlZBTCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQ2FsY3VsYXRlIG5leHQgcmV2aWV3IGRhdGUgKGNvbnZlcnQgaW50ZXJ2YWwgZnJvbSBkYXlzIHRvIG1pbGxpc2Vjb25kcylcclxuICAgICAgICBjb25zdCBuZXh0UmV2aWV3ID0gbm93ICsgaW50ZXJ2YWwgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFVwZGF0ZSBjYXJkIGRhdGFcclxuICAgICAgICBjYXJkRGF0YS5sYXN0UmV2aWV3ZWQgPSBub3c7XHJcbiAgICAgICAgY2FyZERhdGEubmV4dFJldmlldyA9IG5leHRSZXZpZXc7XHJcbiAgICAgICAgY2FyZERhdGEuZWFzZUZhY3RvciA9IGVhc2VGYWN0b3I7XHJcbiAgICAgICAgY2FyZERhdGEuaW50ZXJ2YWwgPSBpbnRlcnZhbDtcclxuICAgICAgICBjYXJkRGF0YS5jb25zZWN1dGl2ZUNvcnJlY3QgPSBjb25zZWN1dGl2ZUNvcnJlY3Q7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWRkIHRvIGhpc3RvcnlcclxuICAgICAgICBjYXJkRGF0YS5oaXN0b3J5LnB1c2goe1xyXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vdyxcclxuICAgICAgICAgICAgcmF0aW5nLFxyXG4gICAgICAgICAgICBpbnRlcnZhbEFwcGxpZWQ6IGludGVydmFsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU2F2ZSB1cGRhdGVkIFNSUyBkYXRhXHJcbiAgICAgICAgdGhpcy5zYXZlU1JTRGF0YSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHBhcnNlRmxhc2hjYXJkcygpOiBQcm9taXNlPEZsYXNoQ2FyZFtdPiB7XHJcbiAgICAgICAgY29uc3QgZmxhc2hjYXJkczogRmxhc2hDYXJkW10gPSBbXTtcclxuICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlciA9IHRoaXMuZ2V0UGFyZW50Rm9sZGVyTmFtZShmaWxlKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFByb2Nlc3MgZWFjaCBjYXJkIHR5cGUgZnJvbSB0aGUgbG9hZGVkIGNvbmZpZ3VyYXRpb25cclxuICAgICAgICAgICAgZm9yIChjb25zdCBjYXJkVHlwZSBvZiB0aGlzLmNhcmRUeXBlcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNhcmRUeXBlLmVuYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoY2FyZFR5cGUucGF0dGVybiwgJ2dpJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBtYXRjaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlICgobWF0Y2ggPSByZWdleC5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IG1hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhcmRDb250ZW50ID0gbWF0Y2hbMl0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYXJkOiBGbGFzaENhcmQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGAke2ZpbGUucGF0aH06OiR7Y2FyZFR5cGUubmFtZX06OiR7bmFtZX1gLCAvLyBHZW5lcmF0ZSB1bmlxdWUgSURcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBjYXJkVHlwZS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogY2FyZENvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiBmaWxlLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9sZGVyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbGFzaGNhcmRzLnB1c2goY2FyZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHdpdGggcmVnZXggcGF0dGVybiBmb3IgY2FyZCB0eXBlICR7Y2FyZFR5cGUubmFtZX06YCwgZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoYEludmFsaWQgcmVnZXggcGF0dGVybiBmb3IgY2FyZCB0eXBlOiAke2NhcmRUeXBlLm5hbWV9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBmbGFzaGNhcmRzO1xyXG4gICAgfVxyXG5cclxuICAgIGdldFBhcmVudEZvbGRlck5hbWUoZmlsZTogVEZpbGUpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IHBhdGggPSBmaWxlLnBhdGg7XHJcbiAgICAgICAgY29uc3QgbGFzdFNsYXNoSW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJSb290XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGZvbGRlclBhdGggPSBwYXRoLnN1YnN0cmluZygwLCBsYXN0U2xhc2hJbmRleCk7XHJcbiAgICAgICAgY29uc3QgbGFzdEZvbGRlclNsYXNoSW5kZXggPSBmb2xkZXJQYXRoLmxhc3RJbmRleE9mKCcvJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGxhc3RGb2xkZXJTbGFzaEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVyUGF0aDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZvbGRlclBhdGguc3Vic3RyaW5nKGxhc3RGb2xkZXJTbGFzaEluZGV4ICsgMSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2h1ZmZsZUFycmF5KGFycmF5OiBhbnlbXSkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGogPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoaSArIDEpKTtcclxuICAgICAgICAgICAgW2FycmF5W2ldLCBhcnJheVtqXV0gPSBbYXJyYXlbal0sIGFycmF5W2ldXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmNsYXNzIEZsYXNoY2FyZE1vZGFsIGV4dGVuZHMgTW9kYWwge1xyXG4gICAgZmxhc2hjYXJkczogRmxhc2hDYXJkW107XHJcbiAgICBjdXJyZW50SW5kZXg6IG51bWJlciA9IDA7XHJcbiAgICBzaG93aW5nQW5zd2VyOiBib29sZWFuID0gZmFsc2U7XHJcbiAgICBwbHVnaW46IEZsYXNoY2FyZHNQbHVnaW47XHJcbiAgICBzZXNzaW9uU3VtbWFyeToge1xyXG4gICAgICAgIGNhcmRzUmV2aWV3ZWQ6IG51bWJlcjtcclxuICAgICAgICBlYXN5OiBudW1iZXI7XHJcbiAgICAgICAgbWVkaXVtOiBudW1iZXI7XHJcbiAgICAgICAgaGFyZDogbnVtYmVyO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgZmxhc2hjYXJkczogRmxhc2hDYXJkW10sIHBsdWdpbjogRmxhc2hjYXJkc1BsdWdpbikge1xyXG4gICAgICAgIHN1cGVyKGFwcCk7XHJcbiAgICAgICAgdGhpcy5mbGFzaGNhcmRzID0gZmxhc2hjYXJkcztcclxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgICAgICB0aGlzLnNlc3Npb25TdW1tYXJ5ID0ge1xyXG4gICAgICAgICAgICBjYXJkc1Jldmlld2VkOiAwLFxyXG4gICAgICAgICAgICBlYXN5OiAwLFxyXG4gICAgICAgICAgICBtZWRpdW06IDAsXHJcbiAgICAgICAgICAgIGhhcmQ6IDBcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIG9uT3BlbigpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xyXG4gICAgICAgIHRoaXMuY29udGVudEVsLmFkZENsYXNzKFwiZmxhc2hjYXJkLW1vZGFsXCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENyZWF0ZSBoZWFkZXJcclxuICAgICAgICBjb25zdCBoZWFkZXJFbCA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1oZWFkZXJcIiB9KTtcclxuICAgICAgICBoZWFkZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJGbGFzaGNhcmRzXCIgfSk7XHJcbiAgICAgICAgaGVhZGVyRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgY2xzOiBcImZsYXNoY2FyZC1jb3VudGVyXCIsIFxyXG4gICAgICAgICAgICB0ZXh0OiBgQ2FyZCAke3RoaXMuY3VycmVudEluZGV4ICsgMX0gb2YgJHt0aGlzLmZsYXNoY2FyZHMubGVuZ3RofWAgXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBmbGFzaGNhcmQgY29udGFpbmVyXHJcbiAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLWNhcmRcIiB9KTtcclxuICAgICAgICB0aGlzLmRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbCk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBjb250cm9scyAoZGlmZmVyZW50IGZvciBmcm9udCBhbmQgYmFjayBvZiBjYXJkKVxyXG4gICAgICAgIHRoaXMuY3JlYXRlQ29udHJvbHMoKTtcclxuXHJcbiAgICAgICAgLy8gQWRkIGtleWJvYXJkIGNvbnRyb2xzXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ0VudGVyJywgKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTa2lwIHRvIG5leHQgY2FyZCBpZiBsb29raW5nIGF0IGFuc3dlclxyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVSYXRpbmcoJ21lZGl1bScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ1NwYWNlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTa2lwIHRvIG5leHQgY2FyZCBpZiBsb29raW5nIGF0IGFuc3dlclxyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVSYXRpbmcoJ21lZGl1bScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJ0Fycm93TGVmdCcsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnNob3dpbmdBbnN3ZXIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNDYXJkKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnQXJyb3dSaWdodCcsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVSYXRpbmcoJ21lZGl1bScpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mbGlwQ2FyZCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gQWRkIGtleWJvYXJkIHNob3J0Y3V0cyBmb3IgcmF0aW5nXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJzEnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNob3dpbmdBbnN3ZXIpIHRoaXMuaGFuZGxlUmF0aW5nKCdoYXJkJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtdLCAnMicsICgpID0+IHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd2luZ0Fuc3dlcikgdGhpcy5oYW5kbGVSYXRpbmcoJ21lZGl1bScpO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zY29wZS5yZWdpc3RlcihbXSwgJzMnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNob3dpbmdBbnN3ZXIpIHRoaXMuaGFuZGxlUmF0aW5nKCdlYXN5Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWw6IEhUTUxFbGVtZW50KSB7XHJcbiAgICAgICAgY2FyZEVsLmVtcHR5KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuZmxhc2hjYXJkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWVtcHR5XCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJObyBmbGFzaGNhcmRzIGZvdW5kLlwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjYXJkID0gdGhpcy5mbGFzaGNhcmRzW3RoaXMuY3VycmVudEluZGV4XTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBVcGRhdGUgY291bnRlclxyXG4gICAgICAgIGNvbnN0IGNvdW50ZXJFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNvdW50ZXJcIik7XHJcbiAgICAgICAgaWYgKGNvdW50ZXJFbCkge1xyXG4gICAgICAgICAgICBjb3VudGVyRWwudGV4dENvbnRlbnQgPSBgQ2FyZCAke3RoaXMuY3VycmVudEluZGV4ICsgMX0gb2YgJHt0aGlzLmZsYXNoY2FyZHMubGVuZ3RofWA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghdGhpcy5zaG93aW5nQW5zd2VyKSB7XHJcbiAgICAgICAgICAgIC8vIFNob3cgZnJvbnQgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCB0eXBlRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLXR5cGVcIiwgdGV4dDogY2FyZC50eXBlIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiZmxhc2hjYXJkLW5hbWVcIiwgdGV4dDogY2FyZC5uYW1lIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtZm9sZGVyXCIsIHRleHQ6IGBGb2xkZXI6ICR7Y2FyZC5mb2xkZXJ9YCB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtaW5zdHJ1Y3Rpb25cIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlByZXNzIEVudGVyIG9yIGNsaWNrICdGbGlwIENhcmQnIHRvIHJldmVhbFwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIElmIFNSUyBpcyBlbmFibGVkLCBzaG93IGR1ZSBkYXRlIGluZm9cclxuICAgICAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVNSUykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY2FyZElkID0gdGhpcy5wbHVnaW4uZ2VuZXJhdGVDYXJkSWQoY2FyZCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYXJkRGF0YSA9IHRoaXMucGx1Z2luLnNyc0RhdGEuY2FyZHNbY2FyZElkXTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGNhcmREYXRhKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHVlRGF0ZSA9IG5ldyBEYXRlKGNhcmREYXRhLm5leHRSZXZpZXcpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGR1ZURhdGVFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLWR1ZS1kYXRlXCIsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgRHVlOiAke2R1ZURhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCl9YCBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Q2FyZEVsID0gY2FyZEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtbmV3LWNhcmRcIiwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHQ6IFwiTmV3IENhcmRcIiBcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIFNob3cgYmFjayBvZiBjYXJkXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRFbCA9IGNhcmRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtY29udGVudFwiIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGNvbXBvbmVudCBmb3IgbWFya2Rvd24gcmVuZGVyaW5nXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBDb21wb25lbnQoKTtcclxuICAgICAgICAgICAgY29tcG9uZW50LmxvYWQoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFJlbmRlciBtYXJrZG93biBjb250ZW50XHJcbiAgICAgICAgICAgIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oXHJcbiAgICAgICAgICAgICAgICBjYXJkLmNvbnRlbnQsXHJcbiAgICAgICAgICAgICAgICBjb250ZW50RWwsXHJcbiAgICAgICAgICAgICAgICBjYXJkLnNvdXJjZSxcclxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3Qgc291cmNlRWwgPSBjYXJkRWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtc291cmNlXCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogYFNvdXJjZTogJHtjYXJkLnNvdXJjZX1gIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY3JlYXRlQ29udHJvbHMoKSB7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGV4aXN0aW5nIGNvbnRyb2xzXHJcbiAgICAgICAgY29uc3QgZXhpc3RpbmdDb250cm9scyA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNvbnRyb2xzXCIpO1xyXG4gICAgICAgIGlmIChleGlzdGluZ0NvbnRyb2xzKSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nQ29udHJvbHMucmVtb3ZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNvbnRyb2xzRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtY29udHJvbHNcIiB9KTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIXRoaXMuc2hvd2luZ0Fuc3dlcikge1xyXG4gICAgICAgICAgICAvLyBDb250cm9scyBmb3IgZnJvbnQgb2YgY2FyZFxyXG4gICAgICAgICAgICBjb25zdCBwcmV2QnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiUHJldmlvdXNcIiB9KTtcclxuICAgICAgICAgICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c0NhcmQoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBmbGlwQnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiRmxpcCBDYXJkXCIgfSk7XHJcbiAgICAgICAgICAgIGZsaXBCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZmxpcENhcmQoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBza2lwQnRuID0gY29udHJvbHNFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU2tpcFwiIH0pO1xyXG4gICAgICAgICAgICBza2lwQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5leHRDYXJkKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIENvbnRyb2xzIGZvciBiYWNrIG9mIGNhcmQgKHJhdGluZyBidXR0b25zKVxyXG4gICAgICAgICAgICBjb25zdCByYXRpbmdDb250YWluZXIgPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1yYXRpbmdcIiB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IGhhcmRCdG4gPSByYXRpbmdDb250YWluZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBcclxuICAgICAgICAgICAgICAgIGNsczogXCJmbGFzaGNhcmQtcmF0aW5nLWhhcmRcIiwgXHJcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIkhhcmQgKDEpXCIgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBoYXJkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVJhdGluZygnaGFyZCcpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnN0IG1lZGl1bUJ0biA9IHJhdGluZ0NvbnRhaW5lci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IFxyXG4gICAgICAgICAgICAgICAgY2xzOiBcImZsYXNoY2FyZC1yYXRpbmctbWVkaXVtXCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJNZWRpdW0gKDIpXCIgXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBtZWRpdW1CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlUmF0aW5nKCdtZWRpdW0nKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCBlYXN5QnRuID0gcmF0aW5nQ29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgXHJcbiAgICAgICAgICAgICAgICBjbHM6IFwiZmxhc2hjYXJkLXJhdGluZy1lYXN5XCIsIFxyXG4gICAgICAgICAgICAgICAgdGV4dDogXCJFYXN5ICgzKVwiIFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgZWFzeUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVSYXRpbmcoJ2Vhc3knKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGhhbmRsZVJhdGluZyhyYXRpbmc6ICdlYXN5JyB8ICdtZWRpdW0nIHwgJ2hhcmQnKSB7XHJcbiAgICAgICAgY29uc3QgY3VycmVudENhcmQgPSB0aGlzLmZsYXNoY2FyZHNbdGhpcy5jdXJyZW50SW5kZXhdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFVwZGF0ZSBzZXNzaW9uIHN1bW1hcnlcclxuICAgICAgICB0aGlzLnNlc3Npb25TdW1tYXJ5LmNhcmRzUmV2aWV3ZWQrKztcclxuICAgICAgICB0aGlzLnNlc3Npb25TdW1tYXJ5W3JhdGluZ10rKztcclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIHRoZSByYXRpbmcgaWYgU1JTIGlzIGVuYWJsZWRcclxuICAgICAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU1JTKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnByb2Nlc3NDYXJkUmF0aW5nKGN1cnJlbnRDYXJkLCByYXRpbmcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBNb3ZlIHRvIG5leHQgY2FyZFxyXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRJbmRleCA8IHRoaXMuZmxhc2hjYXJkcy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY3VycmVudEluZGV4Kys7XHJcbiAgICAgICAgICAgIHRoaXMuc2hvd2luZ0Fuc3dlciA9IGZhbHNlO1xyXG4gICAgICAgICAgICBjb25zdCBjYXJkRWwgPSB0aGlzLmNvbnRlbnRFbC5xdWVyeVNlbGVjdG9yKFwiLmZsYXNoY2FyZC1jYXJkXCIpO1xyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXlDdXJyZW50Rmxhc2hjYXJkKGNhcmRFbCBhcyBIVE1MRWxlbWVudCk7XHJcbiAgICAgICAgICAgIHRoaXMuY3JlYXRlQ29udHJvbHMoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBFbmQgb2Ygc2Vzc2lvblxyXG4gICAgICAgICAgICB0aGlzLnNob3dTZXNzaW9uU3VtbWFyeSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmbGlwQ2FyZCgpIHtcclxuICAgICAgICB0aGlzLnNob3dpbmdBbnN3ZXIgPSAhdGhpcy5zaG93aW5nQW5zd2VyO1xyXG4gICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIHRoaXMuY3JlYXRlQ29udHJvbHMoKTtcclxuICAgIH1cclxuXHJcbiAgICBuZXh0Q2FyZCgpIHtcclxuICAgICAgICBpZiAodGhpcy5jdXJyZW50SW5kZXggPCB0aGlzLmZsYXNoY2FyZHMubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRJbmRleCsrO1xyXG4gICAgICAgICAgICB0aGlzLnNob3dpbmdBbnN3ZXIgPSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc3QgY2FyZEVsID0gdGhpcy5jb250ZW50RWwucXVlcnlTZWxlY3RvcihcIi5mbGFzaGNhcmQtY2FyZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5Q3VycmVudEZsYXNoY2FyZChjYXJkRWwgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUNvbnRyb2xzKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gRW5kIG9mIHNlc3Npb25cclxuICAgICAgICAgICAgdGhpcy5zaG93U2Vzc2lvblN1bW1hcnkoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJldmlvdXNDYXJkKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50SW5kZXgtLTtcclxuICAgICAgICAgICAgdGhpcy5zaG93aW5nQW5zd2VyID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhcmRFbCA9IHRoaXMuY29udGVudEVsLnF1ZXJ5U2VsZWN0b3IoXCIuZmxhc2hjYXJkLWNhcmRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheUN1cnJlbnRGbGFzaGNhcmQoY2FyZEVsIGFzIEhUTUxFbGVtZW50KTtcclxuICAgICAgICAgICAgdGhpcy5jcmVhdGVDb250cm9scygpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGRlY2tcclxuICAgICAgICAgICAgbmV3IE5vdGljZShcIllvdSdyZSBhdCB0aGUgZmlyc3QgZmxhc2hjYXJkIVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc2hvd1Nlc3Npb25TdW1tYXJ5KCkge1xyXG4gICAgICAgIC8vIENsZWFyIGNvbnRlbnRcclxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xyXG4gICAgICAgIHRoaXMuY29udGVudEVsLmFkZENsYXNzKFwiZmxhc2hjYXJkLXN1bW1hcnlcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQ3JlYXRlIHN1bW1hcnkgaGVhZGVyXHJcbiAgICAgICAgY29uc3QgaGVhZGVyRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtc3VtbWFyeS1oZWFkZXJcIiB9KTtcclxuICAgICAgICBoZWFkZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJTZXNzaW9uIENvbXBsZXRlIVwiIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENyZWF0ZSBzdW1tYXJ5IGNvbnRlbnRcclxuICAgICAgICBjb25zdCBzdW1tYXJ5RWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtc3VtbWFyeS1jb250ZW50XCIgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VtbWFyeUVsLmNyZWF0ZUVsKFwicFwiLCB7IFxyXG4gICAgICAgICAgICB0ZXh0OiBgWW91IHJldmlld2VkICR7dGhpcy5zZXNzaW9uU3VtbWFyeS5jYXJkc1Jldmlld2VkfSBjYXJkcyBpbiB0aGlzIHNlc3Npb24uYCBcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBzdGF0c0VsID0gc3VtbWFyeUVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImZsYXNoY2FyZC1zdW1tYXJ5LXN0YXRzXCIgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3RhdHNFbC5jcmVhdGVFbChcImRpdlwiLCB7XHJcbiAgICAgICAgICAgIHRleHQ6IGBFYXN5OiAke3RoaXMuc2Vzc2lvblN1bW1hcnkuZWFzeX0gY2FyZHNgXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3RhdHNFbC5jcmVhdGVFbChcImRpdlwiLCB7XHJcbiAgICAgICAgICAgIHRleHQ6IGBNZWRpdW06ICR7dGhpcy5zZXNzaW9uU3VtbWFyeS5tZWRpdW19IGNhcmRzYFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN0YXRzRWwuY3JlYXRlRWwoXCJkaXZcIiwge1xyXG4gICAgICAgICAgICB0ZXh0OiBgSGFyZDogJHt0aGlzLnNlc3Npb25TdW1tYXJ5LmhhcmR9IGNhcmRzYFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIENyZWF0ZSBjb250cm9sc1xyXG4gICAgICAgIGNvbnN0IGNvbnRyb2xzRWwgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJmbGFzaGNhcmQtc3VtbWFyeS1jb250cm9sc1wiIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHJlc3RhcnRCdG4gPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgXHJcbiAgICAgICAgICAgIHRleHQ6IFwiU3RhcnQgTmV3IFNlc3Npb25cIiBcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXN0YXJ0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc3RhcnRGbGFzaGNhcmRTZXNzaW9uKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgY2xvc2VCdG4gPSBjb250cm9sc0VsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgXHJcbiAgICAgICAgICAgIHRleHQ6IFwiQ2xvc2VcIiBcclxuICAgICAgICB9KTtcclxuICAgICAgICBjbG9zZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG5jbGFzcyBGbGFzaGNhcmRzU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gICAgcGx1Z2luOiBGbGFzaGNhcmRzUGx1Z2luO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IEZsYXNoY2FyZHNQbHVnaW4pIHtcclxuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcGxheSgpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCB7Y29udGFpbmVyRWx9ID0gdGhpcztcclxuXHJcbiAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcclxuXHJcbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdGbGFzaGNhcmRzIFBsdWdpbiBTZXR0aW5ncyd9KTtcclxuXHJcbiAgICAgICAgLy8gR2VuZXJhbCBzZXR0aW5nc1xyXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHt0ZXh0OiAnR2VuZXJhbCBTZXR0aW5ncyd9KTtcclxuXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdTaHVmZmxlIENhcmRzJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1JhbmRvbWl6ZSB0aGUgb3JkZXIgb2YgZmxhc2hjYXJkcyBpbiBlYWNoIHNlc3Npb24nKVxyXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaHVmZmxlQ2FyZHMpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2h1ZmZsZUNhcmRzID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnQ29uZmlndXJhdGlvbiBGaWxlIFBhdGgnKVxyXG4gICAgICAgICAgICAuc2V0RGVzYygnUGF0aCB0byB0aGUgSlNPTiBjb25maWd1cmF0aW9uIGZpbGUgKHJlbGF0aXZlIHRvIHZhdWx0IHJvb3QpJylcclxuICAgICAgICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuY29uZmlnUGF0aClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb25maWdQYXRoID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU1JTIHNldHRpbmdzIHNlY3Rpb25cclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7dGV4dDogJ1NwYWNlZCBSZXBldGl0aW9uIFNldHRpbmdzJ30pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnRW5hYmxlIFNwYWNlZCBSZXBldGl0aW9uJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1VzZSBzcGFjZWQgcmVwZXRpdGlvbiBhbGdvcml0aG0gdG8gc2NoZWR1bGUgY2FyZCByZXZpZXdzJylcclxuICAgICAgICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZW5hYmxlU1JTKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmVuYWJsZVNSUyA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnU1JTIERhdGEgRmlsZSBQYXRoJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1BhdGggdG8gc3RvcmUgc3BhY2VkIHJlcGV0aXRpb24gZGF0YSAocmVsYXRpdmUgdG8gdmF1bHQgcm9vdCknKVxyXG4gICAgICAgICAgICAuYWRkVGV4dCh0ZXh0ID0+IHRleHRcclxuICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zcnNEYXRhUGF0aClcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5zcnNEYXRhUGF0aCA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAgICAgICAuc2V0TmFtZSgnTWF4aW11bSBDYXJkcyBQZXIgU2Vzc2lvbicpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdMaW1pdCB0aGUgbnVtYmVyIG9mIGNhcmRzIHRvIHJldmlldyBpbiBlYWNoIHNlc3Npb24nKVxyXG4gICAgICAgICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcclxuICAgICAgICAgICAgICAgIC5zZXRMaW1pdHMoNSwgMTAwLCA1KVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1heENhcmRzUGVyU2Vzc2lvbilcclxuICAgICAgICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubWF4Q2FyZHNQZXJTZXNzaW9uID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdJbmNsdWRlIE5ldyBDYXJkcycpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdJbmNsdWRlIGNhcmRzIHRoYXQgaGF2ZSBuZXZlciBiZWVuIHJldmlld2VkIGJlZm9yZScpXHJcbiAgICAgICAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluY2x1ZGVOZXdDYXJkcylcclxuICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbmNsdWRlTmV3Q2FyZHMgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICBcclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgLnNldE5hbWUoJ01heGltdW0gTmV3IENhcmRzIFBlciBTZXNzaW9uJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ0xpbWl0IHRoZSBudW1iZXIgb2YgbmV3IGNhcmRzIHRvIGluY2x1ZGUgaW4gZWFjaCBzZXNzaW9uJylcclxuICAgICAgICAgICAgLmFkZFNsaWRlcihzbGlkZXIgPT4gc2xpZGVyXHJcbiAgICAgICAgICAgICAgICAuc2V0TGltaXRzKDAsIDIwLCAxKVxyXG4gICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1heE5ld0NhcmRzUGVyU2Vzc2lvbilcclxuICAgICAgICAgICAgICAgIC5zZXREeW5hbWljVG9vbHRpcCgpXHJcbiAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubWF4TmV3Q2FyZHNQZXJTZXNzaW9uID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUmVzZXQgU1JTIGRhdGEgYnV0dG9uXHJcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgICAgIC5zZXROYW1lKCdSZXNldCBTUlMgRGF0YScpXHJcbiAgICAgICAgICAgIC5zZXREZXNjKCdXQVJOSU5HOiBUaGlzIHdpbGwgcmVzZXQgYWxsIHNwYWNlZCByZXBldGl0aW9uIHByb2dyZXNzJylcclxuICAgICAgICAgICAgLmFkZEJ1dHRvbihidXR0b24gPT4gYnV0dG9uXHJcbiAgICAgICAgICAgICAgICAuc2V0QnV0dG9uVGV4dCgnUmVzZXQgQWxsIFNSUyBEYXRhJylcclxuICAgICAgICAgICAgICAgIC5zZXRXYXJuaW5nKClcclxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb25maXJtUmVzZXQgPSBjb25maXJtKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHJlc2V0IGFsbCBzcGFjZWQgcmVwZXRpdGlvbiBkYXRhPyAnICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ1RoaXMgd2lsbCBlcmFzZSBhbGwgcmV2aWV3IGhpc3RvcnkgYW5kIHNjaGVkdWxpbmcgaW5mb3JtYXRpb24uJ1xyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpcm1SZXNldCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCBTUlMgZGF0YVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zcnNEYXRhID0geyBjYXJkczoge30sIHZlcnNpb246IDEgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNSU0RhdGEoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZSgnU3BhY2VkIHJlcGV0aXRpb24gZGF0YSBoYXMgYmVlbiByZXNldCcpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBSZWxvYWQgY29uZmlndXJhdGlvbiBidXR0b25cclxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAgICAgLnNldE5hbWUoJ1JlbG9hZCBDb25maWd1cmF0aW9uJylcclxuICAgICAgICAgICAgLnNldERlc2MoJ1JlbG9hZCB0aGUgY2FyZCB0eXBlcyBmcm9tIHRoZSBjb25maWd1cmF0aW9uIGZpbGUnKVxyXG4gICAgICAgICAgICAuYWRkQnV0dG9uKGJ1dHRvbiA9PiBidXR0b25cclxuICAgICAgICAgICAgICAgIC5zZXRCdXR0b25UZXh0KCdSZWxvYWQnKVxyXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmxvYWRDYXJkVHlwZXNDb25maWcoKTtcclxuICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKCdDb25maWd1cmF0aW9uIHJlbG9hZGVkJyk7XHJcbiAgICAgICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7dGV4dDogJ0N1cnJlbnQgQ2FyZCBUeXBlcyd9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBjYXJkVHlwZXNJbmZvID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ2RpdicsIHtcclxuICAgICAgICAgICAgY2xzOiAnZmxhc2hjYXJkLXR5cGVzLWluZm8nXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLmNhcmRUeXBlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY2FyZFR5cGVzSW5mby5jcmVhdGVFbCgncCcsIHtcclxuICAgICAgICAgICAgICAgIHRleHQ6ICdObyBjYXJkIHR5cGVzIGxvYWRlZC4gQ2hlY2sgeW91ciBjb25maWd1cmF0aW9uIGZpbGUuJ1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCB0YWJsZSA9IGNhcmRUeXBlc0luZm8uY3JlYXRlRWwoJ3RhYmxlJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlclJvdyA9IHRhYmxlLmNyZWF0ZUVsKCd0cicpO1xyXG4gICAgICAgICAgICBoZWFkZXJSb3cuY3JlYXRlRWwoJ3RoJywge3RleHQ6ICdJRCd9KTtcclxuICAgICAgICAgICAgaGVhZGVyUm93LmNyZWF0ZUVsKCd0aCcsIHt0ZXh0OiAnTmFtZSd9KTtcclxuICAgICAgICAgICAgaGVhZGVyUm93LmNyZWF0ZUVsKCd0aCcsIHt0ZXh0OiAnRW5hYmxlZCd9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmNhcmRUeXBlcy5mb3JFYWNoKGNhcmRUeXBlID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IHRhYmxlLmNyZWF0ZUVsKCd0cicpO1xyXG4gICAgICAgICAgICAgICAgcm93LmNyZWF0ZUVsKCd0ZCcsIHt0ZXh0OiBjYXJkVHlwZS5pZH0pO1xyXG4gICAgICAgICAgICAgICAgcm93LmNyZWF0ZUVsKCd0ZCcsIHt0ZXh0OiBjYXJkVHlwZS5uYW1lfSk7XHJcbiAgICAgICAgICAgICAgICByb3cuY3JlYXRlRWwoJ3RkJywge3RleHQ6IGNhcmRUeXBlLmVuYWJsZWQgPyAnWWVzJyA6ICdObyd9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHt0ZXh0OiAnU1JTIFN0YXRpc3RpY3MnfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3Qgc3RhdHNJbmZvID0gY29udGFpbmVyRWwuY3JlYXRlRWwoJ2RpdicsIHtcclxuICAgICAgICAgICAgY2xzOiAnZmxhc2hjYXJkLXNycy1zdGF0cydcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBDYWxjdWxhdGUgc29tZSBiYXNpYyBzdGF0c1xyXG4gICAgICAgIGNvbnN0IHRvdGFsQ2FyZHMgPSBPYmplY3Qua2V5cyh0aGlzLnBsdWdpbi5zcnNEYXRhLmNhcmRzKS5sZW5ndGg7XHJcbiAgICAgICAgbGV0IGR1ZUNhcmRzID0gMDtcclxuICAgICAgICBsZXQgZHVlVG9kYXkgPSAwO1xyXG4gICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgY29uc3QgZW5kT2ZUb2RheSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgZW5kT2ZUb2RheS5zZXRIb3VycygyMywgNTksIDU5LCA5OTkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAoY29uc3QgY2FyZElkIGluIHRoaXMucGx1Z2luLnNyc0RhdGEuY2FyZHMpIHtcclxuICAgICAgICAgICAgY29uc3QgY2FyZCA9IHRoaXMucGx1Z2luLnNyc0RhdGEuY2FyZHNbY2FyZElkXTtcclxuICAgICAgICAgICAgaWYgKGNhcmQubmV4dFJldmlldyA8PSBub3cpIHtcclxuICAgICAgICAgICAgICAgIGR1ZUNhcmRzKys7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGNhcmQubmV4dFJldmlldyA8PSBlbmRPZlRvZGF5LmdldFRpbWUoKSkge1xyXG4gICAgICAgICAgICAgICAgZHVlVG9kYXkrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBzdGF0c0luZm8uY3JlYXRlRWwoJ3AnLCB7XHJcbiAgICAgICAgICAgIHRleHQ6IGBUb3RhbCBjYXJkcyBpbiBzeXN0ZW06ICR7dG90YWxDYXJkc31gXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3RhdHNJbmZvLmNyZWF0ZUVsKCdwJywge1xyXG4gICAgICAgICAgICB0ZXh0OiBgQ2FyZHMgZHVlIG5vdzogJHtkdWVDYXJkc31gXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3RhdHNJbmZvLmNyZWF0ZUVsKCdwJywge1xyXG4gICAgICAgICAgICB0ZXh0OiBgQ2FyZHMgZHVlIHRvZGF5OiAke2R1ZVRvZGF5fWBcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDMnLCB7dGV4dDogJ0NvbmZpZ3VyYXRpb24gRm9ybWF0J30pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdwJywge1xyXG4gICAgICAgICAgICB0ZXh0OiAnVGhlIGNvbmZpZ3VyYXRpb24gZmlsZSBzaG91bGQgYmUgYSBKU09OIGFycmF5IG9mIGNhcmQgdHlwZSBvYmplY3RzIHdpdGggdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmU6J1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IGNvbmZpZ0V4YW1wbGUgPSBjb250YWluZXJFbC5jcmVhdGVFbCgncHJlJyk7XHJcbiAgICAgICAgY29uZmlnRXhhbXBsZS5zZXRUZXh0KEpTT04uc3RyaW5naWZ5KFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgXCJpZFwiOiBcImRlZmluaXRpb25cIixcclxuICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcIkRlZmluaXRpb25cIixcclxuICAgICAgICAgICAgICAgIFwiZW5hYmxlZFwiOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgXCJwYXR0ZXJuXCI6IFwiXFxcXCpcXFxcKkRlZmluaXRpb246XFxcXHMqKFteKl0rKVxcXFwqXFxcXCpcXFxccyooW1xcXFxzXFxcXFNdKj8pKD89XFxcXG5cXFxccypcXFxcbnxcXFxcblxcXFxzKlxcXFwqXFxcXCp8XFxcXG5cXFxccyojezEsNn1cXFxcc3wkKVwiXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIFwiaWRcIjogXCJleGFtcGxlXCIsXHJcbiAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJFeGFtcGxlXCIsXHJcbiAgICAgICAgICAgICAgICBcImVuYWJsZWRcIjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIFwicGF0dGVyblwiOiBcIlxcXFwqXFxcXCpFeGFtcGxlOlxcXFxzKihbXipdKylcXFxcKlxcXFwqXFxcXHMqKFtcXFxcc1xcXFxTXSo/KSg/PVxcXFxuXFxcXHMqXFxcXG58XFxcXG5cXFxccypcXFxcKlxcXFwqfFxcXFxuXFxcXHMqI3sxLDZ9XFxcXHN8JClcIlxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXSwgbnVsbCwgMikpO1xyXG5cclxuICAgICAgICAvLyBBZGQgQ1NTIGZvciBTUlMgcmF0aW5nIGJ1dHRvbnNcclxuICAgICAgICB0aGlzLmFkZEN1c3RvbUNTUygpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZEN1c3RvbUNTUygpIHtcclxuICAgICAgICAvLyBDcmVhdGUgYSBzdHlsZSBlbGVtZW50IGZvciBjdXN0b20gQ1NTIGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuICAgICAgICBsZXQgc3R5bGVFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmbGFzaGNhcmRzLXBsdWdpbi1jdXN0b20tY3NzJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFzdHlsZUVsKSB7XHJcbiAgICAgICAgICAgIHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG4gICAgICAgICAgICBzdHlsZUVsLmlkID0gJ2ZsYXNoY2FyZHMtcGx1Z2luLWN1c3RvbS1jc3MnO1xyXG4gICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlRWwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBBZGQgQ1NTIGZvciBTUlMgcmF0aW5nIGJ1dHRvbnNcclxuICAgICAgICBzdHlsZUVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1jYXJkIHtcclxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XHJcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB2YXIoLS1iYWNrZ3JvdW5kLXByaW1hcnkpO1xyXG4gICAgICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xyXG4gICAgICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggOHB4IHJnYmEoMCwgMCwgMCwgMC4xKTtcclxuICAgICAgICAgICAgICAgIG1hcmdpbi1ib3R0b206IDIwcHg7XHJcbiAgICAgICAgICAgICAgICBtaW4taGVpZ2h0OiAyMDBweDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1yYXRpbmcge1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcclxuICAgICAgICAgICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC5mbGFzaGNhcmQtcmF0aW5nIGJ1dHRvbiB7XHJcbiAgICAgICAgICAgICAgICBmbGV4OiAxO1xyXG4gICAgICAgICAgICAgICAgbWFyZ2luOiAwIDVweDtcclxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDEwcHg7XHJcbiAgICAgICAgICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XHJcbiAgICAgICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1yYXRpbmctaGFyZCB7XHJcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDI1NSwgNzUsIDc1LCAwLjIpO1xyXG4gICAgICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDc1LCA3NSwgMC41KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1yYXRpbmctbWVkaXVtIHtcclxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoMjU1LCAxNjUsIDAsIDAuMik7XHJcbiAgICAgICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgMTY1LCAwLCAwLjUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAuZmxhc2hjYXJkLXJhdGluZy1lYXN5IHtcclxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQtY29sb3I6IHJnYmEoNzUsIDI1NSwgNzUsIDAuMik7XHJcbiAgICAgICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDc1LCAyNTUsIDc1LCAwLjUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAuZmxhc2hjYXJkLXN1bW1hcnkge1xyXG4gICAgICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xyXG4gICAgICAgICAgICAgICAgcGFkZGluZzogMjBweDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1zdW1tYXJ5LXN0YXRzIHtcclxuICAgICAgICAgICAgICAgIG1hcmdpbjogMjBweCAwO1xyXG4gICAgICAgICAgICAgICAgZm9udC1zaXplOiAxNnB4O1xyXG4gICAgICAgICAgICAgICAgbGluZS1oZWlnaHQ6IDEuNjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1zdW1tYXJ5LWNvbnRyb2xzIHtcclxuICAgICAgICAgICAgICAgIG1hcmdpbi10b3A6IDMwcHg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC5mbGFzaGNhcmQtc3VtbWFyeS1jb250cm9scyBidXR0b24ge1xyXG4gICAgICAgICAgICAgICAgbWFyZ2luOiAwIDEwcHg7XHJcbiAgICAgICAgICAgICAgICBwYWRkaW5nOiA4cHggMTZweDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1kdWUtZGF0ZSxcclxuICAgICAgICAgICAgLmZsYXNoY2FyZC1uZXctY2FyZCB7XHJcbiAgICAgICAgICAgICAgICBtYXJnaW4tdG9wOiAxMHB4O1xyXG4gICAgICAgICAgICAgICAgZm9udC1zaXplOiAxMnB4O1xyXG4gICAgICAgICAgICAgICAgb3BhY2l0eTogMC43O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAuZmxhc2hjYXJkLW5ldy1jYXJkIHtcclxuICAgICAgICAgICAgICAgIGNvbG9yOiB2YXIoLS10ZXh0LWFjY2VudCk7XHJcbiAgICAgICAgICAgICAgICBmb250LXdlaWdodDogYm9sZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIGA7XHJcbiAgICB9XHJcbn0iXSwibmFtZXMiOlsiUGx1Z2luIiwiTm90aWNlIiwicGF0aCIsImZzIiwiTW9kYWwiLCJDb21wb25lbnQiLCJNYXJrZG93blJlbmRlcmVyIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGlu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
