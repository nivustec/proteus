import { ElementInfo, ProteuConfig } from "./types.js";

// Generate a base id for the selected strategy
export function generateTestId(
  config: ProteuConfig,
  info: ElementInfo
): string {
  const cleanedFileSlug = info.fileName
    .replace(/\.(tsx|jsx|ts|js)$/, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const cleanedElement = info.elementName.toLowerCase();

  const suffixDynamic = (() => {
    if (info.isDynamic && info.key) return `${info.key}`;
    if (info.isDynamic && info.index !== undefined) return `${info.index}`;
    return `L${info.lineNumber}`;
  })();

  const qaPrefix = "qa_";

  if (config.strategy === "functional") {
    const componentPath = (info.componentPath || [])
      .filter(Boolean)
      .join("-")
      .toLowerCase();

    const parts = [qaPrefix, componentPath || cleanedFileSlug, cleanedElement, suffixDynamic]
      .filter(Boolean)
      .join("-");
    return parts;
  }

  // default to safe-hash
  const hashInput = `${info.fileName}::${info.elementName}::${info.lineNumber}`;
  const hash = shortStableHash(hashInput);
  return `${qaPrefix}${hash}`;
}

export function shortStableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  const unsigned = h >>> 0;
  return unsigned.toString(36);
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
