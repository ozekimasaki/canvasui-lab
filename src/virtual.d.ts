declare module "*.css";

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
