export interface ProteuConfig {
  injectOnCommit?: boolean;
  injectOnSave?: boolean;
  include?: string[];
  exclude?: string[];
  // Only two strategies are allowed
  strategy?: "safe-hash" | "functional";
  verbose?: boolean;
  json?: boolean;
}

export interface ElementInfo {
  elementName: string;
  fileName: string;
  lineNumber: number;
  key?: string;
  index?: number;
  isDynamic?: boolean;
  // Optional additional semantic context (e.g., parent component names)
  componentPath?: string[];
  // Optional descriptor for functional strategy (e.g., placeholder, alt, text)
  descriptor?: string;
}

// Lean types only; remove unused records
