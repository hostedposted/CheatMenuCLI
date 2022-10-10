import { Configuration as WebpackConfiguration } from "webpack";
export interface Config {
    /**
     * The title of your cheat menu.
     */
    title: string;
    /**
     * The cheat menu's categories.
     */
    categories: string[];
}
export declare const readConfig: (path: string) => Promise<Config>;
export declare const webpackConfiguration: (config: Config) => WebpackConfiguration;
