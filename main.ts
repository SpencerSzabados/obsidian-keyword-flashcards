import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownRenderer, Component } from 'obsidian';

interface FlashCard {
    type: string;           // "Definition" or "Theorem"
    name: string;           // The name component
    content: string;        // The body content
    source: string;         // Source file path
    folder: string;         // Parent folder name
}

interface FlashcardsPluginSettings {
    includeDefinitions: boolean;
    includeTheorems: boolean;
    shuffleCards: boolean;
}

const DEFAULT_SETTINGS: FlashcardsPluginSettings = {
    includeDefinitions: true,
    includeTheorems: true,
    shuffleCards: true
}

export default class FlashcardsPlugin extends Plugin {
    settings: FlashcardsPluginSettings;

    async onload() {
        console.log('Loading flashcards plugin');
        
        await this.loadSettings();

        // Add ribbon icon - fixed the arguments to match expected signature
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

    async startFlashcardSession() {
        const flashcards = await this.parseFlashcards();
        
        if (flashcards.length === 0) {
            new Notice('No flashcards found. Make sure your notes contain blocks starting with "**Definition: (Name)**" or "**Theorem: (Name)**"');
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
            .setName('Include Definitions')
            .setDesc('Extract flashcards from blocks starting with "**Definition: (Name)**"')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeDefinitions)
                .onChange(async (value) => {
                    this.plugin.settings.includeDefinitions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Theorems')
            .setDesc('Extract flashcards from blocks starting with "**Theorem: (Name)**"')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeTheorems)
                .onChange(async (value) => {
                    this.plugin.settings.includeTheorems = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Shuffle Cards')
            .setDesc('Randomize the order of flashcards in each session')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.shuffleCards)
                .onChange(async (value) => {
                    this.plugin.settings.shuffleCards = value;
                    await this.plugin.saveSettings();
                }));
    }
}