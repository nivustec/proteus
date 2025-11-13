
<div align="center">

<img src="https://proteus.nivustec.com.br/icons/proteus.png" title="Proteus" alt="Proteus logo" width="128">

# Proteus

[🌍 Website](https://proteus.nivustec.com)


<p align="center">
  <a href="https://www.npmjs.com/package/@nivustec/proteus"><img alt="npm" src="https://img.shields.io/npm/v/%40nivustec%2Fproteus.svg?color=2ea44f&label=npm" /></a>
  <a href="https://www.npmjs.com/package/@nivustec/proteus"><img alt="downloads" src="https://img.shields.io/npm/dm/%40nivustec%2Fproteus.svg?color=2ea44f" /></a>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18.0.0-2ea44f" />
  <img alt="ts" src="https://img.shields.io/badge/TypeScript-5.x-2ea44f" />
  <a href="#license"><img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f" /></a>
</p>

Automated data-testid injection for React (JS/TS). 
Proteus “surfs” your codebase and transforms it on save/commit, enforcing qa_prefixed, unique, and semantic test IDs across your components.
<br/>
</div>

### Why Proteus?
- Consistent, predictable, and unique test IDs
- Zero-runtime: IDs are injected at build/dev time
- Works with JSX/TSX and plain JS/TS React projects
- Safe defaults, with flexible strategies

### Features
- Two strategies only:
  - safe-hash: compact ids like `qa_abc123`; in maps: ``qa_abc123_${item.id}``
  - functional: semantic ids like ``qa_products_image_${item.id}``
- Uniqueness enforcement with sibling-indexing for repeated tags
- Map-awareness: automatically appends key/index for dynamic lists
- Watch mode (inject on save)
- Pre-commit integration (inject before commit)
- Default strategy: functional
- Default include: React frontend files only (`src/**/*.tsx`, `src/**/*.jsx`)

---

## Installation

```bash
npm i -D @nivustec/proteus
# or
yarn add -D @nivustec/proteus
```

For local development of Proteus itself:
```bash
# in the Proteus repo
npm run build
npm link

# in your app repo
npm link @nivustec/proteus
```

---

## Quick Start

1) Initialize a config in your project root:
```bash
proteus init
```

2) Inject once:
```bash
proteus inject
# or specific files
proteus inject src/components/Button.tsx
```

3) Watch mode (auto-inject on save):
```bash
proteus inject --watch
```

4) Git pre-commit (Husky optional):
```bash
proteus setup        # adds a pre-commit hook
git commit -m "feat: ..."  # Proteus injects before commit
```

---

## Configuration

Create or edit `proteus.config.json` in your project root.

```json
{
  "injectOnCommit": true,
  "injectOnSave": true,
  "include": ["src/**/*.tsx", "src/**/*.jsx"],
  "exclude": ["node_modules/**", "dist/**"],
  "strategy": "functional",
  "verbose": false,
  "detectReusableComponents": true,
  "autoExcludePatterns": ["**/ui/**", "**/common/**"]
}
```

- injectOnCommit: enable pre-commit injection
- injectOnSave: enable watch mode injection
- include/exclude: glob patterns for files
- strategy: `safe-hash` or `functional`
- verbose: enable additional logs in CLI mode
- **detectReusableComponents**: auto-detect and skip reusable UI components (default: `true`)
- **autoExcludePatterns**: glob patterns to auto-exclude (e.g., `["**/ui/**", "**/common/**"]`)

### 🆕 Reusable Components Detection (v1.1.0)

Proteus now automatically detects reusable components (like Button, Input, Card from UI libraries) and skips injecting data-testid directly in them. Instead, it injects at the usage sites, ensuring unique IDs for each instance.

**Detection criteria:**
- File is in a UI/common/shared folder (e.g., `/ui/`, `/common/`, `/shared/`)
- Uses `React.forwardRef` or `forwardRef<>`
- Has `{...props}` spread operator

**Example:**

```tsx
// src/components/ui/button.tsx (auto-skipped by Proteus)
const Button = React.forwardRef(({ ...props }, ref) => {
  return <button {...props} ref={ref} />; // ✅ No fixed data-testid
});

// src/components/Hero.tsx (Proteus injects here)
<Button onClick={handleClick} data-testid="qa_hero_button_1_abc123">
  Get Started
</Button>
<Button variant="outline" data-testid="qa_hero_button_2_def456">
  View on GitHub
</Button>
```

**Benefits:**
- ✅ No duplicate data-testid across multiple Button instances
- ✅ Each usage gets a unique, contextual ID
- ✅ Works with any UI library (shadcn, MUI, Ant Design, etc.)
- ✅ Zero configuration required (auto-detection enabled by default)

---

## Strategies

### functional (semantic, recommended)

Rules (simplified):
- Prefix: `qa_`
- Base: `qa_<component>_<role>_[<siblingIndex>]_[<descriptor>]`
- Dynamic lists (map): append key/index as the last segment

Examples:
```jsx
// Map wrapper element
<div className="item" key={item.id} data-testid={`qa_products_item_${item.id}`} />

// Image inside map
<img data-testid={`qa_products_image_${item.id}`} />

// Text containers inside map
<div data-testid={`qa_products_container_name_${item.id}`}>{item.name}</div>
<div data-testid={`qa_products_container_price_${item.id}`}>{formatCurrency(item.price)}</div>

// Duplicate siblings get indexed
<h1 data-testid={`qa_products_h1_1_${item.id}`}>One</h1>
<h1 data-testid={`qa_products_h1_2_${item.id}`}>Two</h1>

// Outside map, unique suffix may be added to avoid collisions
<div className="header" data-testid="qa_products_header_<uniq>" />
```

#### Before/After (functional)

```jsx
// Before
export function ProductCard({ item }) {
  return (
    <div className="card">
      <img alt={item.name} />
      <h2>{item.name}</h2>
      <button className="add-to-cart">Add</button>
    </div>
  );
}

// After (auto-injected)
export function ProductCard({ item }) {
  return (
    <div className="card" data-testid="qa_productcard_container_<uniq>">
      <img alt={item.name} data-testid="qa_productcard_image_img-item-name_<uniq>" />
      <h2 data-testid="qa_productcard_container_1_item-name_<uniq>">{item.name}</h2>
      <button className="add-to-cart" data-testid="qa_productcard_button_add-to-cart_<uniq>">Add</button>
    </div>
  );
}
```

### safe-hash (compact)

Rules:
- Prefix: `qa_`
- Base: `qa_<hash>` (stable per location)
- In maps: append key/index: ``qa_<hash>_${item.id}``

Examples:
```jsx
// Single element
<div data-testid="qa_ab12cd" />

// Inside map
<div data-testid={`qa_ab12cd_${item.id}`} />
```

---

## CLI

```bash
proteus inject [files...] [options]

Options:
  -c, --config <path>     Path to config file
      --include <paths>   Files to include
      --exclude <paths>   Files to exclude
      --strategy <type>   safe-hash | functional
      --verbose           Enable verbose logs
      --json              Enable machine-readable JSON output
  -w, --watch             Watch mode for development

proteus pre-commit         # injects on staged files (used by Husky)
proteus setup              # configures Husky pre-commit hook
proteus init               # writes default proteus.config.json
```

Husky (Git hooks):
- Modern Husky (v7+): if `.husky/` exists, `proteus setup` writes `.husky/pre-commit` with `proteus pre-commit`.
- Legacy fallback: if `.husky/` is not detected, `proteus setup` configures `package.json` scripts/hooks.

- Pre-commit processes only staged React files (`*.jsx`, `*.tsx`).
- Watch mode observes the configured include patterns; defaults to `src/**/*.tsx` and `src/**/*.jsx`.

---

## Agent-Friendly CLI (MCP Support)

Proteus can be used by AI agents and other automated systems via its machine-readable JSON output. Use the `--json` flag with the `inject` command to suppress human-readable logs and receive a structured JSON response.

### Usage with --json

```bash
proteus inject --json
```

### Example JSON Output

```json
{
  "filesProcessed": 5,
  "totalInjected": 12,
  "errors": 0,
  "errorMessages": []
}
```

If errors occur, they will be included in the `errorMessages` array:

```json
{
  "filesProcessed": 1,
  "totalInjected": 0,
  "errors": 1,
  "errorMessages": [
    "Error processing src/components/BrokenComponent.tsx: Parser Error: Unexpected token (1:10)"
  ]
}
```

---

## Universal Agent (Tool Calling) Support

To enable any AI agent (Gemini, OpenAI, Anthropic, etc.) to interact with Proteus, we provide a universal JSON Schema for the `proteus_inject_tool` and a dedicated executor function. This approach removes any direct dependency on specific AI SDKs within the Proteus CLI itself.

### 1. Universal Contract (JSON Schema)

The `proteus_inject_tool`'s function declaration is available as a pure JSON Schema file at the root of the project:

*   **`proteus-tool-schema.json`**: This file defines the structure and parameters of the `proteus_inject_tool` in a standard Open API/JSON Schema format, allowing any agent to understand how to call the tool.

### 2. Universal Executor

The `executeProteusCLI` function provides a clean API for executing the Proteus CLI and receiving its output in a machine-readable format.

*   **`src/tool-executor.ts`**: This module exports the `executeProteusCLI` function.

### Example Consumer Agent Usage

Here's how a consumer agent (using any AI SDK) would typically integrate with Proteus:

1.  **Load the JSON Schema:** The agent loads `proteus-tool-schema.json` to understand the tool's capabilities.
2.  **Model Interaction:** The agent's model receives a user prompt and, based on the loaded schema, decides to call `proteus_inject_tool` with specific arguments.
3.  **Execute the Tool:** The agent then calls the `executeProteusCLI` function from `src/tool-executor.ts` with the arguments provided by its model.
4.  **Process Output:** The agent receives the JSON output from `executeProteusCLI` and can then use its model to generate a natural language response for the user.

```typescript
// Example of a consumer agent (conceptual, using a generic AI SDK)
import { readFileSync } from 'fs';
import { executeProteusCLI } from './src/tool-executor.js'; // Adjust path as needed

// 1. Load the Proteus tool schema
const proteusToolSchema = JSON.parse(readFileSync('proteus-tool-schema.json', 'utf-8'));

// Assume your AI SDK has a way to register tools and get model responses
async function runConsumerAgent(userPrompt: string) {
  // --- Conceptual: AI Model decides to call the tool ---
  // In a real scenario, your AI SDK would handle this based on the userPrompt
  // and the registered proteusToolSchema.
  // For demonstration, we'll simulate a tool call from the model.

  const simulatedToolCallArgs = {
    files: ['src/components/MyComponent.tsx'],
    strategy: 'functional',
    json_output: true, // Always true for tool calling
  };

  console.log(`Agent: Simulating tool call to proteus_inject_tool with args:`, simulatedToolCallArgs);

  try {
    // 2. Execute the Proteus CLI via the universal executor
    const toolOutput = await executeProteusCLI(simulatedToolCallArgs);

    console.log(`Agent: Proteus CLI returned:`, toolOutput);

    // --- Conceptual: AI Model processes tool output and generates response ---
    // Your AI model would take toolOutput and generate a natural language response.
    if (toolOutput.errors > 0) {
      console.log(`Agent: I encountered ${toolOutput.errors} errors while injecting test IDs. Please check the logs.`);
    } else {
      console.log(`Agent: Successfully injected ${toolOutput.totalInjected} test IDs into ${toolOutput.filesProcessed} files.`);
    }

  } catch (error) {
    console.error("Agent: Error executing Proteus CLI:", error);
  }
}

// Example usage
runConsumerAgent("Inject test IDs into src/components/MyComponent.tsx using the functional strategy.");
```

---

## Best Practices
- Commit generated IDs; they are part of your source (zero runtime)
- Choose one strategy per repo; we recommend `functional`
- Ensure `qa_` prefix uniqueness across layers and components
- Always append a key/index for dynamic maps

---

## Troubleshooting

1) npx proteus not found / CLI not running
- Ensure the package is installed in your project
- For local dev: build + `npm link` in Proteus repo, then `npm link @nivustec/proteus` in your app

2) Duplicate logs in watch mode
- Proteus debounces its own writes; if you still see duplicates, increase the debounce window in `watcher.ts`

3) Pre-commit too verbose
- Set `verbose: false` (default). Pre-commit runs in silent mode by design.

4) Pre-commit not injecting on non-React files
- By default, only `*.jsx` and `*.tsx` staged files are processed. Adjust `include` if you need other patterns.

5) IDs are inserted in the wrong place
- We use AST positions; if you find an edge-case, open an issue with a code sample.

6) Partial staging lost in pre-commit
- Current hook re-stages full files after injection. If you rely on partial staging (`git add -p`), consider disabling `injectOnCommit` and running `proteus inject` manually.

---

## License

MIT © Nivustec


