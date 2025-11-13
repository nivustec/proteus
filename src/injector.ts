import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { glob } from "glob";
import { ProteuConfig } from "./types.js";
import { parseAndInject } from "./parser.js";

export interface InjectionStats {
  filesProcessed: number;
  totalInjected: number;
  errors: number;
  errorMessages: string[];
}

export async function injectTestIds(
  config: ProteuConfig,
  specificFiles?: string[]
): Promise<InjectionStats> {
  const stats: InjectionStats = {
    filesProcessed: 0,
    totalInjected: 0,
    errors: 0,
    errorMessages: [],
  };

  let filesToProcess: string[] = [];

  // If we have specific files, process ONLY them (ignore include/exclude)
  if (specificFiles && specificFiles.length > 0) {
    filesToProcess = specificFiles.filter((file) => {
      const exists = existsSync(file);

      return exists;
    });
  } else {
    // If there are no specific files, use include/exclude
    for (const pattern of config.include || []) {
      const matches = await glob(pattern, {
        ignore: config.exclude,
        nodir: true,
      });
      filesToProcess.push(...matches);
    }
    filesToProcess = [...new Set(filesToProcess)];
  }

  for (const filePath of filesToProcess) {
    const code = readFileSync(filePath, "utf-8");
    if (config.verbose) {
      console.log("🌊 Proteus is transforming your components...");
    }
    const result = parseAndInject(filePath, code, config);

    if (result.error) {
      stats.errors++;
      stats.errorMessages.push(`Error processing ${filePath}: ${result.error.message}`);
    }

    if (result.injectedCount > 0) {
      writeFileSync(filePath, result.code);
      stats.totalInjected += result.injectedCount;
    }

    stats.filesProcessed++;
  }

  return stats;
}

export async function injectStagedFiles(): Promise<InjectionStats> {
  const stats: InjectionStats = {
    filesProcessed: 0,
    totalInjected: 0,
    errors: 0,
    errorMessages: [],
  };

  try {
    
    const stagedBackup = execSync("git diff --cached --name-only", {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

   
    execSync("git reset --mixed", { stdio: "pipe" });

   
    const filesToProcess = stagedBackup.filter(
      (file) =>
        file.match(/\.(jsx|tsx)$/) &&
        !file.includes("node_modules") &&
        existsSync(file)
    );

    const cfg = loadConfig(undefined, true);
    cfg.verbose = false;
    if (cfg.verbose) {
      console.log(`🔧 Files to process: ${filesToProcess.length} files`);
    }

    if (filesToProcess.length === 0) {
      if (stagedBackup.length > 0) {
        execSync(`git add ${stagedBackup.join(" ")}`, { stdio: "pipe" });
      }
      if (cfg.verbose) {
        console.log("💡 No React files in commit");
      }
      return stats;
    }

    const config = cfg;

    for (const filePath of filesToProcess) {
      const code = readFileSync(filePath, "utf-8");
      const result = parseAndInject(filePath, code, config);

      if (result.error) {
        stats.errors++;
        stats.errorMessages.push(`Error processing ${filePath}: ${result.error.message}`);
      }

      if (result.injectedCount > 0) {
        writeFileSync(filePath, result.code);
        if (config.verbose) {
          console.log("🌊 Proteus is transforming your components...");
          console.log(`✅ Injected ${result.injectedCount} test IDs in ${filePath}`);
        }
        stats.totalInjected += result.injectedCount;
      }

      stats.filesProcessed++;
    }

    // 4. Re-stage all files (including modifications)
    if (stagedBackup.length > 0) {
      execSync(`git add ${stagedBackup.join(" ")}`, { stdio: "pipe" });
    }

    if (config.verbose) {
      if (stats.totalInjected > 0) {
        console.log(`🎉 Added ${stats.totalInjected} test IDs to the commit`);
        console.log(
          "💡 Review the changes with 'git diff --cached' before committing"
        );
      } else {
        console.log("✅ All files already have data-testid");
      }
    }

    return stats;
  } catch (error) {
    stats.errors++;
    stats.errorMessages.push(error instanceof Error ? error.message : String(error));
    return stats;
  }
}


export function setupGitHooks(): void {
  const packageJsonPath = "./package.json";
  const huskyDir = "./.husky";

  if (existsSync(huskyDir)) {
    try {
      const preCommitPath = `${huskyDir}/pre-commit`;
      const script = `#!/usr/bin/env sh\n. "$(dirname "$0")/_/husky.sh"\nproteus pre-commit\n`;
      writeFileSync(preCommitPath, script, { encoding: "utf8" });
      console.log("✓ Husky pre-commit configured at .husky/pre-commit");
      return;
    } catch (error) {
      console.error("Error configuring Husky pre-commit:", error);
    }
  }

  if (!existsSync(packageJsonPath)) {
    console.warn("Warning: package.json not found, cannot setup Git hooks");
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    packageJson.scripts["proteus:pre-commit"] = "proteus pre-commit";

    if (!packageJson.husky) packageJson.husky = {};
    if (!packageJson.husky.hooks) packageJson.husky.hooks = {};
    packageJson.husky.hooks["pre-commit"] = "npm run proteus:pre-commit";

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("✓ Legacy Git hooks configured in package.json");
    console.log("💡 Added pre-commit hook for automatic data-testid injection");
  } catch (error) {
    console.error("Error setting up Git hooks:", error);
  }
}

import { loadConfig } from "./config.js";
