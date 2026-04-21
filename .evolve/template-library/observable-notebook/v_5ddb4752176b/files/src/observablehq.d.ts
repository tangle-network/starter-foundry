declare module '@observablehq/framework' {
  export interface Config {
    title?: string;
    pages?: Array<{ name: string; path: string }>;
    theme?: string | string[];
    root?: string;
    output?: string;
    search?: boolean;
    [key: string]: unknown;
  }
  export function defineConfig(config: Config): Config;
}
