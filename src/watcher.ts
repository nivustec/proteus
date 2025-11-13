import { watch } from "chokidar";
import { ProteuConfig } from "./types.js";
import { injectTestIds } from "./injector.js";

export function startWatchMode(config: ProteuConfig): void {
  if (!config.injectOnSave) {
    console.log("ℹ️ injectOnSave is disabled - watch mode inactive");
    return;
  }

  console.log("🔍 Starting development watch mode...");
  console.log("⚡ Auto-injecting on file save");

  const watcher = watch(
    config.include || [
      "src/**/*.tsx",
      "src/**/*.jsx",
    ],
    {
    ignored: config.exclude,
    ignoreInitial: true,
    persistent: true,
    }
  );

  // Debounce map to avoid reacting to our own file writes
  const lastWrittenAt: Record<string, number> = {};
  const isSelfWrite = (filePath: string) => {
    const ts = lastWrittenAt[filePath];
    if (!ts) return false;
    const now = Date.now();
    return now - ts < 1000; // 1s window
  };

  watcher.on("change", async (filePath) => {
    if (isSelfWrite(filePath)) return; // ignore our own write event
    console.log(`💾 File saved: ${filePath}`);

    try {
      const stats = await injectTestIds(config, [filePath]);
      if (stats.totalInjected > 0) {
        console.log(`✅ Auto-injected ${stats.totalInjected} test IDs`);
        lastWrittenAt[filePath] = Date.now();
      } else {
        console.log("💡 All elements already have data-testid");
      }
    } catch (error) {
      console.error(`❌ Auto-injection failed:`, error);
    }
  });

  watcher.on("add", async (filePath) => {
    console.log(`📁 New file: ${filePath}`);

    try {
      const stats = await injectTestIds(config, [filePath]);
      if (stats.totalInjected > 0) {
       lastWrittenAt[filePath] = Date.now();
      }
    } catch (error) {
      console.error(`❌ Error processing new file ${filePath}:`, error);
    }
  });

  console.log("👀 Watching for file saves... (Press Ctrl+C to stop)");
  console.log("💡 Save any React file to auto-inject data-testid");
}
