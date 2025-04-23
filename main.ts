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
    type: string;        // The card type name
    name: string;        // The name component
    content: string;     // The body content
    source: string;      // Source file path
    folder: string;      // Parent folder name
}


interface FlashcardsPluginSettings {
    shuffleCards: boolean;
    configPath: string;  // Path to the JSON configuration file
}


const DEFAULT_SETTINGS: FlashcardsPluginSettings = {
    shuffleCards: true,
    configPath: 'config.json'
}


export default class FlashcardsPlugin extends Plugin {
    settings: FlashcardsPluginSettings;
    cardTypes: CardTypeConfig[] = [];

    async onload() {
        console.log('Loading flashcards plugin');
        
        await this.loadSettings();
        await this.loadCardTypesConfig();

        // Add ribbon icon
        this.addRibbonIcon('dice', 'Flashcards', (evt: MouseEvent) => {
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

    async startFlashcardSession() {
        const flashcards = await this.parseFlashcards();
        
        if (flashcards.length === 0) {
            new Notice('No flashcards found. Check your configuration and make sure your notes contain the defined patterns.');
            return;
        }

        if (this.settings.shuffleCards) {
            this.shuffleArray(flashcards);
        }

        new FlashcardModal(this.app, flashcards).open();
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
                            
                            flashcards.push({
                                type: cardType.name,
                                name,
                                content: cardContent,
                                source: file.path,
                                folder
                            });
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

    constructor(app: App, flashcards: FlashCard[]) {
        super(app);
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
            } else {
                this.flipCard();
            }
            return false;
        });

        this.scope.register([], 'Space', () => {
            if (this.showingAnswer) {
                this.nextCard();
            } else {
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
            } else {
                this.flipCard();
            }
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
        } else {
            // Show back of card
            const contentEl = cardEl.createEl("div", { cls: "flashcard-content" });
            
            // Create a new component for markdown rendering
            const component = new Component();
            component.load();
            
            // Use the newer render method from the example
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
            
            const instructionEl = cardEl.createEl("div", { 
                cls: "flashcard-instruction", 
                text: "Press Enter or click 'Next' to continue" 
            });
        }
    }

    flipCard() {
        this.showingAnswer = !this.showingAnswer;
        const cardEl = this.contentEl.querySelector(".flashcard-card");
        this.displayCurrentFlashcard(cardEl as HTMLElement);
    }

    nextCard() {
        if (this.currentIndex < this.flashcards.length - 1) {
            this.currentIndex++;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl as HTMLElement);
        } else {
            // At the end of the deck
            new Notice("End of flashcards reached!");
        }
    }

    previousCard() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showingAnswer = false;
            const cardEl = this.contentEl.querySelector(".flashcard-card");
            this.displayCurrentFlashcard(cardEl as HTMLElement);
        } else {
            // At the beginning of the deck
            new Notice("You're at the first flashcard!");
        }
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
    }
}