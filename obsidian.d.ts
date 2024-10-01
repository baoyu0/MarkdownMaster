import * as _obsidian from "obsidian";

declare module "obsidian" {
    export interface App {
        workspace: Workspace;
    }

    export interface Workspace {
        getActiveViewOfType<T extends View>(type: Constructor<T>): T | null;
    }

    export class Plugin {
        app: App;
        addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => void): HTMLElement;
        addCommand(command: Command): void;
    }

    export interface Command {
        id: string;
        name: string;
        callback?: () => void;
        checkCallback?: (checking: boolean) => boolean | void;
    }

    export class Modal {
        app: App;
        contentEl: HTMLElement;
        constructor(app: App);
        open(): void;
        close(): void;
        onOpen(): void;
        onClose(): void;
    }

    export class Setting {
        constructor(containerEl: HTMLElement);
        setName(name: string): this;
        setDesc(desc: string): this;
        addButton(cb: (button: ButtonComponent) => any): this;
        addTextArea(cb: (text: TextAreaComponent) => any): this;
    }

    export interface ButtonComponent {
        setButtonText(name: string): this;
        setCta(): this;
        onClick(callback: () => void): this;
    }

    export interface TextAreaComponent {
        setValue(value: string): this;
        setDisabled(disabled: boolean): this;
    }

    export class Notice {
        constructor(message: string, timeout?: number);
    }

    export class MarkdownView extends View {
        editor: Editor;
    }

    export interface Editor {
        getValue(): string;
        setValue(value: string): void;
    }

    export abstract class View {
        // Add any necessary View properties here
    }

    export interface HTMLElement {
        createEl(tag: string, attr?: { [key: string]: any }): HTMLElement;
        empty(): void;
    }

    export type Constructor<T> = new (...args: any[]) => T;
}

export * from "obsidian";