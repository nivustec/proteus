import { readFileSync, existsSync } from "fs";
import { ProteuConfig } from "./types.js";

const defaultConfig: ProteuConfig = {
  injectOnCommit: true,
  injectOnSave: true,
  include: ["src/**/*.tsx", "src/**/*.jsx"],
  exclude: ["node_modules/**", "dist/**"],
  strategy: "functional",
  verbose: false,
  detectReusableComponents: true,
  autoExcludePatterns: [],
};

export function loadConfig(configPath?: string, silent: boolean = false): ProteuConfig {
  const configFile = configPath || "proteus.config.json";

  if (existsSync(configFile)) {
    try {
      const userConfig = JSON.parse(readFileSync(configFile, "utf-8"));
      if (!silent) console.log(`✅ Loaded config from ${configFile}`);
      return { ...defaultConfig, ...userConfig };
    } catch (error) {
      if (!silent) console.warn(`Warning: Could not parse ${configFile}, using defaults`);
    }
  } else {
    if (!silent) console.log(`ℹ️ Config file ${configFile} not found, using defaults`);
  }

  return defaultConfig;
}

export function validateConfig(config: ProteuConfig, silent: boolean = false): boolean {
  const validStrategies = ["safe-hash", "functional"];

  if (config.strategy && !validStrategies.includes(config.strategy)) {
    throw new Error(`Invalid strategy: ${config.strategy}`);
  }

  if (!silent) {
    console.log(`✅ Config validated:`);
    console.log(`   - injectOnCommit: ${config.injectOnCommit}`);
    console.log(`   - injectOnSave: ${config.injectOnSave}`);
    console.log(`   - strategy: ${config.strategy}`);
  }

  return true;
}
