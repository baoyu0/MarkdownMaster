declare module "obsidian" {
    export class Plugin {
        app: App;
        loadData(): Promise<any>;
        saveData(data: any): Promise<void>;
        addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => any): HTMLElement;
        addCommand(command: Command): void;
    }

    export class App {
        workspace: Workspace;
    }

    export class Workspace {
        getActiveViewOfType<T extends View>(type: Constructor<T>): T | null;
    }

    export class MarkdownView extends View {
        editor: Editor;
    }

    export class Editor {
        getValue(): string;
        setValue(value: string): void;
    }

    export class Notice {
        constructor(message: string, timeout?: number);
    }

    export class Modal {
        constructor(app: App);
        open(): void;
        close(): void;
        onOpen(): void;
        onClose(): void;
        contentEl: HTMLElement;
    }

    export class Setting {
        constructor(containerEl: HTMLElement);
        setName(name: string): this;
        setDesc(desc: string): this;
        addButton(cb: (button: ButtonComponent) => any): this;
        addTextArea(cb: (text: TextAreaComponent) => any): this;
    }

    export interface Command {
        id: string;
        name: string;
        callback: () => any;
    }

    export class ButtonComponent {
        setButtonText(name: string): this;
        setCta(): this;
        onClick(callback: () => any): this;
    }

    export class TextAreaComponent {
        setValue(value: string): this;
        setDisabled(disabled: boolean): this;
    }

    export type Constructor<T> = new (...args: any[]) => T;
}