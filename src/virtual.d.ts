declare module "*.css";

declare module "monaco-editor/language/typescript/monaco.contribution" {
  export const typescriptDefaults: {
    setCompilerOptions(options: Record<string, unknown>): void;
    setDiagnosticsOptions(options: Record<string, unknown>): void;
  };
  export const JsxEmit: { ReactJSX: number };
  export const ScriptTarget: { ESNext: number };
  export const ModuleKind: { ESNext: number };
}

declare module "virtual:stories-registry" {
  export interface RawStory {
    name: string;
    args?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    render?: (args: Record<string, unknown>) => unknown;
  }
  export interface RawStoryModule {
    path: string;
    meta: {
      title?: string;
      component?: unknown;
      argTypes?: Record<string, unknown>;
      parameters?: Record<string, unknown>;
    };
    stories: RawStory[];
  }
  export const stories: RawStoryModule[];
}

declare module "virtual:pen-designs" {
  export const designs: { path: string; raw: string }[];
}
