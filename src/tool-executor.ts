import { spawn } from "child_process";

interface ProteusCLIArgs {
  files?: string[];
  include?: string[];
  exclude?: string[];
  strategy?: "safe-hash" | "functional";
  json_output: boolean; // Always required for tool calling
}

/**
 * Executes the Proteus CLI as a child process and returns the parsed JSON output.
 * This function is designed to be universally compatible with any agent.
 * @param args - The arguments to pass to the 'proteus inject' command.
 * @returns A promise that resolves with the JSON output from the CLI.
 */
export async function executeProteusCLI(args: ProteusCLIArgs): Promise<any> {
  return new Promise((resolve, reject) => {
    const cliArgs: string[] = ["inject"];

    // Ensure json_output is always true for tool calling
    if (args.json_output) {
      cliArgs.push("--json");
    } else {
      reject(new Error("The 'json_output' argument must be true for tool calling."));
      return;
    }

    if (args.files && args.files.length > 0) cliArgs.push(...args.files);
    if (args.include && args.include.length > 0) cliArgs.push("--include", ...args.include);
    if (args.exclude && args.exclude.length > 0) cliArgs.push("--exclude", ...args.exclude);
    if (args.strategy) cliArgs.push("--strategy", args.strategy);

    const proteusProcess = spawn("proteus", cliArgs, { shell: true });

    let stdoutData = "";
    let stderrData = "";

    proteusProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    proteusProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    proteusProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Proteus CLI exited with code ${code}: ${stderrData}`)
        );
      }
      try {
        const jsonOutput = JSON.parse(stdoutData);
        resolve(jsonOutput);
      } catch (error) {
        reject(new Error(`Failed to parse Proteus CLI JSON output: ${error}`));
      }
    });

    proteusProcess.on("error", (err) => {
      reject(new Error(`Failed to start Proteus CLI process: ${err.message}`));
    });
  });
}
