import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownRenderer, Component } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

// Define the card type configuration structure
interface CardTypeConfig {
    id: string;          // Unique identifier
    name: string;        // Display name
    pattern: string;     // Regex pattern for matching
    enabled: boolean;    // Whether this type is enabled
}

interface FlashCard {
    id: string;          // Unique identifier for each card
    type: string;        // The card type name
    name: string;        // The name component
    content: string;     // The body content
    source: string;      // Source file path
    folder: string;      // Parent folder name
}

// SRS related interfaces
interface SRSCardData {
    cardId: string;            // Unique identifier for the card
    lastReviewed?: number;     // Timestamp of last review
    nextReview: number;        // Timestamp for next scheduled review
    easeFactor: number;        // Multiplier that affects interval growth (higher = easier)
    interval: number;          // Current interval in days
    consecutiveCorrect: number; // Number of consecutive correct reviews
    history: SRSReviewHistory[]; // Record of previous reviews
}

interface SRSReviewHistory {
    timestamp: number;         // When the review occurred
    rating: 'easy' | 'medium' | 'hard'; // User rating
    intervalApplied: number;   // Interval that was applied at this review
}

interface SRSData {
    cards: Record<string, SRSCardData>;
    version: number;           // For future compatibility
}

// Extended plugin settings
interface FlashcardsPluginSettings {
    shuffleCards: boolean;
    configPath: string;
    maxCardsPerSession: number;  // Max cards to review per session
    srsDataPath: string;        // Path to store SRS data
    enableSRS: boolean;         // Toggle for SRS functionality
    includeNewCards: boolean;   // Include new cards in sessions
    maxNewCardsPerSession: number; // Limit for new cards
}

const DEFAULT_SETTINGS: FlashcardsPluginSettings = {
    shuffleCards: true,
    configPath: 'config.json',
    maxCardsPerSession: 20,
    srsDataPath: 'srs-data.json',
    enableSRS: true,
    includeNewCards: true,
    maxNewCardsPerSession: 5
}

// Constants for SRS algorithm
const SRS_DEFAULTS = {
    INITIAL_EASE_FACTOR: 2.5,
    MIN_EASE_FACTOR: 1.3,
    EASE_BONUS: 0.15,
    EASE_PENALTY: 0.2,
    INITIAL_INTERVAL: 1, // 1 day
    MIN_INTERVAL: 1, // 1 day
    HARD_INTERVAL_MULTIPLIER: 0.5, // Reduce interval by 50% for hard cards
    NOW: Date.now()
}

export default class FlashcardsPlugin extends Plugin {
    settings: FlashcardsPluginSettings;
    cardTypes: CardTypeConfig[] = [];
    srsData: SRSData = { cards: {}, version: 1 };

    async onload() {
        console.log('Loading flashcards plugin');
        
        await this.loadSettings();
        await this.loadCardTypesConfig();
        await this.loadSRSData();

        // Add ribbon icon
        this.addRibbonIcon('dice', 'Flashcards', (evt: MouseEvent) => {
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
            callback: async () => {
                await this.loadCardTypesConfig();
                new Notice('Flashcard configuration reloaded');
            }
        });

        // Add settings tab
        this.addSettingTab(new FlashcardsSettingTab(this.app, this));
    }

    onunload() {
        console.log('Unloading flashcards plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadCardTypesConfig() {
        try {
            // Get the path to the Obsidian vault
            const vaultPath = (this.app.vault.adapter as any).basePath; 
            
            // Combine with the config file path from settings
            const configFilePath = path.join(vaultPath, this.settings.configPath);
            
            // Check if the file exists
            if (fs.existsSync(configFilePath)) {
                // Read and parse the JSON file
                const configData = fs.readFileSync(configFilePath, 'utf8');
                this.cardTypes = JSON.parse(configData);
                console.log(`Loaded ${this.cardTypes.length} card types from configuration`);

            } else {
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
                fs.writeFileSync(configFilePath, JSON.stringify(this.cardTypes, null, 2));
                console.log(`Created default configuration file at ${configFilePath}`);
            }

        } catch (error) {
            console.error('Error loading card types configuration:', error);
            new Notice('Error loading flashcard configuration file');
        }
    }

    async loadSRSData() {
        try {
            // Get the path to the Obsidian vault
            const vaultPath = (this.app.vault.adapter as any).basePath; 
            
            // Combine with the SRS data file path from settings
            const srsDataFilePath = path.join(vaultPath, this.settings.srsDataPath);
            
            // Check if the file exists
            if (fs.existsSync(srsDataFilePath)) {
                // Read and parse the JSON file
                const srsDataContent = fs.readFileSync(srsDataFilePath, 'utf8');
                this.srsData = JSON.parse(srsDataContent);
                console.log(`Loaded SRS data for ${Object.keys(this.srsData.cards).length} cards`);
            } else {
                // Create default SRS data if file doesn't exist
                this.srsData = { cards: {}, version: 1 };
                
                // Create the SRS data file with default settings
                fs.writeFileSync(srsDataFilePath, JSON.stringify(this.srsData, null, 2));
                console.log(`Created default SRS data file at ${srsDataFilePath}`);
            }
        } catch (error) {
            console.error('Error loading SRS data:', error);
            new Notice('Error loading SRS data file');
        }
    }

    async saveSRSData() {
        try {
            // Get the path to the Obsidian vault
            const vaultPath = (this.app.vault.adapter as any).basePath; 
            
            // Combine with the SRS data file path from settings
            const srsDataFilePath = path.join(vaultPath, this.settings.srsDataPath);
            
            // Save the SRS data
            fs.writeFileSync(srsDataFilePath, JSON.stringify(this.srsData, null, 2));
            console.log(`Saved SRS data for ${Object.keys(this.srsData.cards).length} cards`);
        } catch (error) {
            console.error('Error saving SRS data:', error);
            new Notice('Error saving SRS data file');
        }
    }

    async startFlashcardSession() {
        const allFlashcards = await this.parseFlashcards();
        
        if (allFlashcards.length === 0) {
            new Notice('No flashcards found. Check your configuration and make sure your notes contain the defined patterns.');
            return;
        }

        // If SRS is enabled, filter cards based on review schedule
        let sessionFlashcards = allFlashcards;
        if (this.settings.enableSRS) {
            sessionFlashcards = this.filterCardsForSession(allFlashcards);
            if (sessionFlashcards.length === 0) {
                new Notice('No cards due for review right now. Check back later!');
                return;
            }
        } else if (this.settings.shuffleCards) {
            this.shuffleArray(sessionFlashcards);
        }

        new FlashcardModal(this.app, sessionFlashcards, this).open();
    }

    // Generate unique ID for a card
    generateCardId(card: FlashCard): string {
        return `${card.source}::${card.type}::${card.name}`;
    }

    // Filter cards for the current session based on SRS scheduling
    filterCardsForSession(allCards: FlashCard[]): FlashCard[] {
        const currentTime = Date.now();
        const dueCards: FlashCard[] = [];
        const newCards: FlashCard[] = [];
        
        // First, identify due and new cards
        for (const card of allCards) {
            const cardId = this.generateCardId(card);
            const srsData = this.srsData.cards[cardId];
            
            if (!srsData) {
                // This is a new card
                if (this.settings.includeNewCards) {
                    newCards.push(card);
                }
            } else if (srsData.nextReview <= currentTime) {
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
        const newCardsToAdd = Math.min(
            newCards.length,
            this.settings.maxNewCardsPerSession,
            this.settings.maxCardsPerSession - result.length
        );
        
        if (newCardsToAdd > 0) {
            result.push(...newCards.slice(0, newCardsToAdd));
        }
        
        // Limit total cards
        return result.slice(0, this.settings.maxCardsPerSession);
    }

    // Process card rating and schedule next review
    processCardRating(card: FlashCard, rating: 'easy' | 'medium' | 'hard'): void {
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
        } else if (rating === 'medium') {
            // Keep ease factor the same
            consecutiveCorrect++;
        } else if (rating === 'hard') {
            easeFactor -= SRS_DEFAULTS.EASE_PENALTY;
            consecutiveCorrect = 0;  // Reset streak for hard cards
        }
        
        // Ensure ease factor doesn't go below minimum
        easeFactor = Math.max(easeFactor, SRS_DEFAULTS.MIN_EASE_FACTOR);
        
        // Calculate new interval
        if (consecutiveCorrect === 0) {
            // Reset interval for hard cards
            interval = SRS_DEFAULTS.INITIAL_INTERVAL;
        } else if (consecutiveCorrect === 1) {
            // First correct review
            interval = SRS_DEFAULTS.INITIAL_INTERVAL;
        } else {
            // Apply spaced repetition formula
            if (rating === 'hard') {
                interval = interval * SRS_DEFAULTS.HARD_INTERVAL_MULTIPLIER;
            } else {
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

    async parseFlashcards(): Promise<FlashCard[]> {
        const flashcards: FlashCard[] = [];
        const files = this.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const content = await this.app.vault.read(file);
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
                            
                            const card: FlashCard = {
                                id: `${file.path}::${cardType.name}::${name}`, // Generate unique ID
                                type: cardType.name,
                                name,
                                content: cardContent,
                                source: file.path,
                                folder
                            };
                            
                            flashcards.push(card);
                        }
                    } catch (e) {
                        console.error(`Error with regex pattern for card type ${cardType.name}:`, e);
                        new Notice(`Invalid regex pattern for card type: ${cardType.name}`);
                    }
                }
            }
        }
        
        return flashcards;
    }

    getParentFolderName(file: TFile): string {
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

    shuffleArray(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

class FlashcardModal extends Modal {
    flashcards: FlashCard[];
    currentIndex: number = 0;
    showingAnswer: boolean = false;
    plugin: FlashcardsPlugin;
    sessionSummary: {
        cardsReviewed: number;
        easy: number;
        medium: number;
        hard: number;
    };

    constructor(app: App, flashcards: FlashCard[], plugin: FlashcardsPlugin) {
        super(app);
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
            } else {
                this.flipCard();
            }
            return false;
        });

        this.scope.register([], 'Space', () => {
            if (this.showingAnswer) {
                // Skip to next card if looking at answer
                this.handleRating('medium');
            } else {
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
            } else {
                this.flipCard();
            }
            return false;
        });

        // Add keyboard shortcuts for rating
        this.scope.register([], '1', () => {
            if (this.showingAnswer) this.handleRating('hard');
            return false;
        });
        
        this.scope.register([], '2', () => {
            if (this.showingAnswer) this.handleRating('medium');
            return false;
        });
        
        this.scope.register([], '3', () => {
            if (this.showingAnswer) this.handleRating('easy');
            return false;
        });
    }

    displayCurrentFlashcard(cardEl: HTMLElement) {
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
            const typeEl = cardEl.createEl("div", { cls: "flashcard-type", text: card.type });
            const nameEl = cardEl.createEl("div", { cls: "flashcard-name", text: card.name });
            const folderEl = cardEl.createEl("div", { cls: "flashcard-folder", text: `Folder: ${card.folder}` });
            
            const instructionEl = cardEl.createEl("div", { 
                cls: "flashcard-instruction", 
                text: "Press Enter or click 'Flip Card' to reveal" 
            });
            
            // If SRS is enabled, show due date info
            if (this.plugin.settings.enableSRS) {
                const cardId = this.plugin.generateCardId(card);
                const cardData = this.plugin.srsData.cards[cardId];
                
                if (cardData) {
                    const dueDate = new Date(cardData.nextReview);
                    const dueDateEl = cardEl.createEl("div", { 
                        cls: "flashcard-due-date", 
                        text: `Due: ${dueDate.toLocaleDateString()}` 
                    });
                } else {
                    const newCardEl = cardEl.createEl("div", { 
                        cls: "flashcard-new-card", 
                        text: "New Card" 
                    });
                }
            }
        } else {
            // Show back of card
            const contentEl = cardEl.createEl("div", { cls: "flashcard-content" });
            
            // Create a new component for markdown rendering
            const component = new Component();
            component.load();
            
            // Render markdown content
            MarkdownRenderer.renderMarkdown(
                card.content,
                contentEl,
                card.source,
                component
            );
            
            const sourceEl = cardEl.createEl("div", { 
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
        } else {
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

    handleRating(rating: 'easy' | 'medium' | 'hard') {
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
            this.displayCurrentFlashcard(cardEl as HTMLElement);
            this.createControls();
        } else {
            // End of session
            this.showSessionSummary();
        }
    }

    flipCard() {
        this.showingAnswer = !this.showingAnswer;
        const cardEl = this.contentEl.querySelector(".flashcard-card");
        this.displayCurrentFlashcard(cardEl as HTMLElement);
        this.createControls();
    }

    nextCard() {
        if (this.currentIndex < this.flashcards.length - 1) {
            this.currentIndex++;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl as HTMLElement);
            this.createControls();
        } else {
            // End of session
            this.showSessionSummary();
        }
    }

    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl as HTMLElement);
            this.createControls();
        } else {
            // At the beginning of the deck
            new Notice("You're at the first flashcard!");
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


class FlashcardsSettingTab extends PluginSettingTab {
    plugin: FlashcardsPlugin;

    constructor(app: App, plugin: FlashcardsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Flashcards Plugin Settings'});

        // General settings
        containerEl.createEl('h3', {text: 'General Settings'});

        new Setting(containerEl)
            .setName('Shuffle Cards')
            .setDesc('Randomize the order of flashcards in each session')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleCards)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleCards = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Configuration File Path')
            .setDesc('Path to the JSON configuration file (relative to vault root)')
            .addText(text => text
                .setValue(this.plugin.settings.configPath)
                .onChange(async (value) => {
                    this.plugin.settings.configPath = value;
                    await this.plugin.saveSettings();
                }));
        
        // SRS settings section
        containerEl.createEl('h3', {text: 'Spaced Repetition Settings'});
        
        new Setting(containerEl)
            .setName('Enable Spaced Repetition')
            .setDesc('Use spaced repetition algorithm to schedule card reviews')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSRS)
                .onChange(async (value) => {
                    this.plugin.settings.enableSRS = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('SRS Data File Path')
            .setDesc('Path to store spaced repetition data (relative to vault root)')
            .addText(text => text
                .setValue(this.plugin.settings.srsDataPath)
                .onChange(async (value) => {
                    this.plugin.settings.srsDataPath = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Maximum Cards Per Session')
            .setDesc('Limit the number of cards to review in each session')
            .addSlider(slider => slider
                .setLimits(5, 100, 5)
                .setValue(this.plugin.settings.maxCardsPerSession)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxCardsPerSession = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Include New Cards')
            .setDesc('Include cards that have never been reviewed before')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeNewCards)
                .onChange(async (value) => {
                    this.plugin.settings.includeNewCards = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Maximum New Cards Per Session')
            .setDesc('Limit the number of new cards to include in each session')
            .addSlider(slider => slider
                .setLimits(0, 20, 1)
                .setValue(this.plugin.settings.maxNewCardsPerSession)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxNewCardsPerSession = value;
                    await this.plugin.saveSettings();
                }));
        
        // Reset SRS data button
        new Setting(containerEl)
            .setName('Reset SRS Data')
            .setDesc('WARNING: This will reset all spaced repetition progress')
            .addButton(button => button
                .setButtonText('Reset All SRS Data')
                .setWarning()
                .onClick(async () => {
                    const confirmReset = confirm(
                        'Are you sure you want to reset all spaced repetition data? ' +
                        'This will erase all review history and scheduling information.'
                    );
                    
                    if (confirmReset) {
                        // Reset SRS data
                        this.plugin.srsData = { cards: {}, version: 1 };
                        await this.plugin.saveSRSData();
                        new Notice('Spaced repetition data has been reset');
                    }
                }));
        
        // Reload configuration button
        new Setting(containerEl)
            .setName('Reload Configuration')
            .setDesc('Reload the card types from the configuration file')
            .addButton(button => button
                .setButtonText('Reload')
                .onClick(async () => {
                    await this.plugin.loadCardTypesConfig();
                    new Notice('Configuration reloaded');
                }));
                
        containerEl.createEl('h3', {text: 'Current Card Types'});
        
        const cardTypesInfo = containerEl.createEl('div', {
            cls: 'flashcard-types-info'
        });
        
        if (this.plugin.cardTypes.length === 0) {
            cardTypesInfo.createEl('p', {
                text: 'No card types loaded. Check your configuration file.'
            });
        } else {
            const table = cardTypesInfo.createEl('table');
            const headerRow = table.createEl('tr');
            headerRow.createEl('th', {text: 'ID'});
            headerRow.createEl('th', {text: 'Name'});
            headerRow.createEl('th', {text: 'Enabled'});
            
            this.plugin.cardTypes.forEach(cardType => {
                const row = table.createEl('tr');
                row.createEl('td', {text: cardType.id});
                row.createEl('td', {text: cardType.name});
                row.createEl('td', {text: cardType.enabled ? 'Yes' : 'No'});
            });
        }
        
        containerEl.createEl('h3', {text: 'SRS Statistics'});
        
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
        
        containerEl.createEl('h3', {text: 'Configuration Format'});
        
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