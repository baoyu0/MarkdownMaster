import * as _obsidian from "obsidian";

declare module "obsidian" {
    export interface App {
        workspace: Workspace;
        vault: Vault;  // 添加这一行
    }

    export interface Workspace {
        getActiveViewOfType<T extends View>(type: Constructor<T>): T | null;
        on(name: 'file-open', callback: (file: TFile) => any, ctx?: any): EventRef;
    }

    export class Plugin {
        app: App;
        loadData(): Promise<any>;
        saveData(data: any): Promise<void>;
        addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => void): HTMLElement;
        addCommand(command: Command): void;
        addSettingTab(settingTab: PluginSettingTab): void;
        registerEvent(ref: EventRef): EventRef;
    }

    export interface Command {
        id: string;
        name: string;
        callback?: () => void;
        checkCallback?: (checking: boolean) => boolean | void;
    }

    export abstract class PluginSettingTab extends SettingTab {
        plugin: Plugin;
        constructor(app: App, plugin: Plugin);
    }

    export abstract class SettingTab {
        app: App;
        containerEl: HTMLElement;

        constructor(app: App, containerEl: HTMLElement);
        display(): void;
        hide(): void;
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
        addToggle(cb: (toggle: ToggleComponent) => any): this;
        addTextArea(cb: (text: TextAreaComponent) => any): this;
        addSlider(callback: (slider: SliderComponent) => any): this;
        addDropdown(callback: (dropdown: DropdownComponent) => any): this;
    }

    export interface ButtonComponent {
        setButtonText(name: string): this;
        setCta(): this;
        onClick(callback: () => void): this;
    }

    export interface ToggleComponent {
        setValue(value: boolean): this;
        onChange(callback: (value: boolean) => void): this;
    }

    export interface TextAreaComponent {
        setValue(value: string): this;
        onChange(callback: (value: string) => void): this;
        setPlaceholder(placeholder: string): this;  // 添加这一行
    }

    export interface SliderComponent {
        setLimits(min: number, max: number, step: number): this;
        setValue(value: number): this;
        setDynamicTooltip(): this;
        onChange(callback: (value: number) => void): this;
    }

    export interface DropdownComponent {
        addOption(value: string, display: string): this;
        setValue(value: string): this;
        onChange(callback: (value: string) => void): this;
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
        createDiv(options?: { cls?: string }): HTMLElement;
        createSpan(): HTMLElement;
        style: CSSStyleDeclaration;  // 添加这一行
        textContent: string;  // 添加这一行
    }

    export type Constructor<T> = new (...args: any[]) => T;

    export interface Vault {
        getMarkdownFiles(): TFile[];
        read(file: TFile): Promise<string>;
        modify(file: TFile, data: string): Promise<void>;
    }

    export interface TFile {
        path: string;
        name: string;
        extension: string;
    }

    export type EventRef = any;
}

export * from "obsidian";