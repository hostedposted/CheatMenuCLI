#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import inquirer from "inquirer";
import figlet from "figlet";
import gradient from "gradient-string";
import webpack from "webpack";
import { readConfig, webpackConfiguration } from "./config.js";
import path from "path";
import chalkAnimation from "chalk-animation";
import { pathToFileURL, fileURLToPath } from "url";
import fs from "fs/promises";
import spawn from "cross-spawn";
import memfs from "memfs";
import chokidar from "chokidar";
import { Server } from "socket.io";
import clipboardy from "clipboardy";
const io = new Server({
    cors: {
        origin: "*"
    }
});
/**
 * Install node modules synchronously and save to dependencies in package.json
 * @param {string|string[]} packages Node module or modules to install
 * @param {string} packageManager Package manager to use for installation.
 * @param {boolean} developer If the package should be installed as a dev dependency.
 * @returns {void}
 */
function installSyncSave(packages, packageManager = "npm", developer = false) {
    const packageList = Array.isArray(packages) ? packages : [packages];
    const installCmd = packageManager === "yarn" ? "add" : "install";
    const installProcess = spawn.sync(packageManager, [installCmd].concat(...(developer ? ["-D"] : []), ...packageList), { stdio: "inherit" });
    const error = installProcess.error;
    if (error !== undefined) {
        const pluralS = packageList.length > 1 ? "s" : "";
        console.log(gradient.morning(`Could not execute ${packageManager}. Please install the following package${pluralS} with a package manager of your choice: ${packageList.join(", ")}.`));
    }
}
async function build(argv, builtHandler = () => { }, webpackHandler = () => { }) {
    let config;
    try {
        config = await readConfig(pathToFileURL(argv.config ?? "./cheat-menu-config.js").href);
    }
    catch (e) {
        return console.log(gradient.pastel.multiline(figlet.textSync("A configuration file is required.")));
    }
    const compiler = webpack(webpackConfiguration(config));
    webpackHandler(compiler);
    compiler.outputPath = path.resolve("dist");
    const buildingText = chalkAnimation.rainbow("Building...");
    compiler.run(async (err, stats) => {
        buildingText.stop();
        if (err != null) {
            console.log(gradient.morning.multiline(figlet.textSync("An error occurred while building.")));
            console.log(gradient.morning.multiline(err.stack));
            return;
        }
        if ((stats?.hasErrors()) ?? false) {
            console.log(gradient.morning.multiline(figlet.textSync("An error occurred while building.")));
            stats?.compilation.errors.forEach(e => {
                console.log(gradient.morning.multiline(e.stack));
            });
            return;
        }
        if (argv["generate-bookmarklet"]) {
            const bundle = await fs.readFile(path.resolve("dist", "bundle.js"));
            const bookmarklet = `javascript:(function(){${encodeURIComponent(bundle.toString())}})()`;
            await fs.writeFile(path.resolve("dist", "bookmarklet.txt"), bookmarklet);
        }
        console.log(gradient.pastel.multiline(figlet.textSync("Built successfully!")));
        builtHandler();
    });
}
void yargs(hideBin(process.argv))
    .scriptName("chenu-cli")
    .usage("$0 <cmd> [args]")
    .command("init", "Create a new cheat menu.", async (argv) => {
    console.log(gradient.pastel.multiline(figlet.textSync("Cheat menu creation!")));
    const { cheat_menu_title: cheatMenuTitle, output_directory: outputDirectory, package_manager: packageManager } = await inquirer.prompt([
        {
            name: "cheat_menu_title",
            type: "input",
            message: "What would you like to name the cheat menu?"
        },
        {
            name: "output_directory",
            type: "input",
            message: "What directory would you like this project to be created in?"
        },
        {
            name: "package_manager",
            type: "list",
            message: "What package manager would you like to use?",
            choices: ["npm", "yarn", "pnpm"]
        }
    ]);
    await fs.mkdir(path.join(outputDirectory, "src", "hacks"), { recursive: true });
    await fs.writeFile(path.join(path.resolve(outputDirectory), "cheat-menu-config.js"), `/** @type {import("chenu-cli").Config} */
export const config = {
    title: ${JSON.stringify(cheatMenuTitle)},
    categories: []
}\n`);
    await fs.writeFile(path.join(path.resolve(outputDirectory), "package.json"), `{
    "name": ${JSON.stringify(outputDirectory)},
    "version": "1.0.0",
    "main": "dist/bundle.js",
    "license": "MIT",
    "type": "module",
    "scripts": {
        "build": "chenu-cli build"
    }
}\n`);
    await fs.writeFile(path.join(path.resolve(outputDirectory), "src", "index.ts"), `import { create } from "chenu"
\ncreate()\n`);
    process.chdir(outputDirectory);
    installSyncSave("chenu", packageManager);
    installSyncSave("chenu-cli", packageManager, true);
    console.log(gradient.pastel("The cheat menu has initialized successfully!"));
})
    .command("build", "Build your cheat menu.", (yargs) => {
    yargs.option("config", {
        default: "cheat-menu-config.js",
        description: "Specify path to configuration file.",
        type: "string"
    });
    yargs.option("generate-bookmarklet", {
        default: false,
        type: "boolean",
        description: "If a bookmarklet should be generated."
    });
}, async (argv) => {
    await build(argv);
})
    .command("dev", "Watch for changes, build, then hot reload cheat menu.", (yargs) => {
    yargs.option("config", {
        default: "cheat-menu-config.js",
        description: "Specify path to configuration file.",
        type: "string"
    });
}, async (argv) => {
    const customFs = memfs.createFsFromVolume(new memfs.Volume());
    // @ts-expect-error
    customFs.join = path.join;
    io.attach(4545);
    let currentBundle;
    chokidar.watch("./src").on("change", () => {
        void (async () => {
            await build(argv, () => {
                currentBundle = customFs.readFileSync("dist/bundle.js");
                io.emit("bundle", currentBundle.toString("utf-8"));
            }, compiler => {
                compiler.outputFileSystem = customFs;
            });
        })();
    });
    io.on("connect", (socket) => {
        socket.emit("bundle", currentBundle.toString("utf-8"));
    });
    const hotReloadFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "hot-reload.js");
    const hotReloadFile = await fs.readFile(hotReloadFilePath);
    await clipboardy.write(hotReloadFile.toString("utf-8"));
    console.log(gradient.pastel("Code has been copied to your clipboard. Using it will add on an auto reloading cheat menu."));
    await build(argv, () => {
        currentBundle = customFs.readFileSync("dist/bundle.js");
    }, compiler => {
        compiler.outputFileSystem = customFs;
    });
})
    .help()
    .demandCommand(1, "")
    .argv;
