import webpack, { Configuration as WebpackConfiguration } from "webpack"
import TerserPlugin from "terser-webpack-plugin"
import glob from "glob"

export interface Config {
    /**
     * The title of your cheat menu.
     */
    title: string
    /**
     * The cheat menu's categories.
     */
    categories: string[]
}

export const readConfig = async (path: string): Promise<Config> => {
    const config = await import(path)
    return config.config
}

export const webpackConfiguration: (config: Config) => WebpackConfiguration = (config: Config) => ({
    entry: [
        ...glob.sync("./src/hacks/**/*.ts{,x}"),
        "./src/index.ts"
    ],
    output: {
        filename: "bundle.js"
    },
    module: {
        rules: [
            {
                test: /\.(js|ts|tsx)$/i,
                use: [{
                    loader: "babel-loader", 
                    options: {
                        presets: [
                            "@babel/preset-env",
                            "@babel/preset-typescript",
                            "preact-cli/babel"
                        ],
                        plugins: [
                            "@quickbaseoss/babel-plugin-styled-components-css-namespace",
                            "babel-plugin-styled-components",
                            "@babel/proposal-class-properties",
                            "@babel/proposal-object-rest-spread"
                        ]
                    }
                }],
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new webpack.DefinePlugin({
            CHEATMENUCONFIG: JSON.stringify(config)
        })
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            react: "preact/compat",
            "react-dom/test-utils": "preact/compat",
            "react-dom": "preact/compat"
        }
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                parallel: true,
                extractComments: false
            })
        ]
    }
})
