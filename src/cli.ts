#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, validateConfig } from "./config.js";
import { injectTestIds, setupGitHooks, injectStagedFiles } from "./injector.js";
import { startWatchMode } from "./watcher.js";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const program = new Command();

program
  .name("proteus")
  .description(
    "Proteus - The shape-shifting CLI for automatic data-testid injection"
  )
  .version(pkg.version);

program
  .command("inject")
  .description("Inject data-testid attributes into React components")
  .argument("[files...]", "Specific files to process")
  .option("-c, --config <path>", "Path to config file")
  .option("--include <paths...>", "Files to include")
  .option("--exclude <paths...>", "Files to exclude")
  .option(
    "--strategy <type>",
    "ID generation strategy (safe-hash | functional)"
  )
  .option("--verbose", "Enable verbose logs")
  .option("--json", "Enable machine-readable JSON output")
  .option("-w, --watch", "Watch mode for development")
  .action(async (files, options) => {
    try {
      // When JSON output is enabled, automatically silence any other logs.
      const silent = options.json;
      let config = loadConfig(options.config, silent);

      if (options.include) config.include = options.include;
      if (options.exclude) config.exclude = options.exclude;
      if (options.strategy) config.strategy = options.strategy;
      if (options.verbose !== undefined) config.verbose = options.verbose;
      if (options.json !== undefined) config.json = options.json;

      // Verbose and JSON modes are mutually exclusive.
      if (config.verbose && config.json) {
        config.verbose = false;
      }

      validateConfig(config, silent);

      if (options.watch) {
        startWatchMode(config);
      } else {
        if (!silent) {
          console.log("🌊 Proteus is transforming your components...");
        }
        const stats = await injectTestIds(config, files);

        if (silent) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log("\n📊 Injection completed:");
          console.log(`  Files processed: ${stats.filesProcessed}`);
          console.log(`  Test IDs injected: ${stats.totalInjected}`);
          console.log(`  Errors: ${stats.errors}`);

          if (stats.errors > 0) {
            console.log("\n❌ Errors occurred:");
            stats.errorMessages.forEach(msg => console.log(`  - ${msg}`));
          }

          if (stats.totalInjected === 0) {
            console.log(
              "💡 No new test IDs were injected. All elements may already have data-testid attributes."
            );
          }
        }
      }
    } catch (error) {
      const isJson = options.json;
      if (isJson) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
      } else {
        console.error(
          "❌ Error:",
          error instanceof Error ? error.message : error
        );
      }
      process.exit(1);
    }
  });

program
  .command("pre-commit")
  .description("Check and inject data-testid in staged files (for Git hooks)")
  .action(async () => {
    try {
      const config = loadConfig(undefined, true);
      config.verbose = false;

      if (!config.injectOnCommit) {
        console.log(
          "ℹ️ injectOnCommit is disabled - skipping pre-commit check"
        );
        process.exit(0);
      }

      const stats = await injectStagedFiles();
      if (stats.errors > 0) {
        console.error("\n❌ Errors occurred during pre-commit injection:");
        stats.errorMessages.forEach(msg => console.error(`  - ${msg}`));
        process.exit(1);
      }
     
    } catch (error) {
      console.error("❌ Pre-commit check failed:", error);
      process.exit(1);
    }
  });

program
  .command("setup")
  .description("Setup Git hooks for automatic injection")
  .action(() => {
    try {
      setupGitHooks();
      console.log("✅ Setup completed successfully");
      console.log(
        "📋 Git hooks configured for automatic data-testid injection"
      );
      console.log(
        "💡 Run 'proteus inject --watch' for development auto-injection"
      );
    } catch (error) {
      console.error("❌ Setup failed:", error);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Create default config file")
  .action(() => {
    const defaultConfig = {
      injectOnCommit: true,
      injectOnSave: true,
      include: [
        "src/**/*.tsx",
        "src/**/*.jsx",
      ],
      exclude: ["node_modules/**", "dist/**"],
      strategy: "functional",
    };

    fs.writeFileSync(
      "proteus.config.json",
      JSON.stringify(defaultConfig, null, 2)
    );
    console.log("✅ Created proteus.config.json");
    console.log("💡 Run 'proteus setup' to configure Git hooks");
  });

program.parse();
