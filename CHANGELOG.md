# Changelog

All notable changes to Proteus will be documented in this file.

## [1.0.2] - 2025-01-13

### Fixed
- **Critical bug fix**: Duplicate data-testid in `.map()` iterations
  - Elements inside `.map()` were receiving literal string `"index"` instead of the actual index value
  - Now correctly generates dynamic template strings: `data-testid={\`qa_component_element_${index}\`}`
  - Added unique hash suffix to elements within maps to prevent collisions between similar structures
  - All data-testid are now guaranteed to be unique across the entire application

### Technical Details
- Enhanced `getMapInfo()` to extract the index variable name from map callbacks
- Modified `buildAttributeForElement()` to generate template string expressions for dynamic IDs
- Added line-based hash generation for elements inside maps to ensure uniqueness
- Updated type definitions to support string-based index tracking

### Example
```tsx
// Before (Bug - all elements had same ID)
{items.map((item, index) => (
  <div key={index} data-testid="qa_component_container_index">
    <span data-testid="qa_component_span_index">{item}</span>
  </div>
))}

// After (Fixed - unique IDs)
{items.map((item, index) => (
  <div key={index} data-testid={`qa_component_container_a8f3_${index}`}>
    <span data-testid={`qa_component_span_b2d4_${index}`}>{item}</span>
  </div>
))}
```

## [1.0.0] - 2025-11-13

### Initial Release

#### Features
- **Automatic data-testid injection** for React components (JSX/TSX)
- **Two injection strategies:**
  - `functional`: Semantic IDs like `qa_hero_button_1_abc123`
  - `safe-hash`: Compact IDs like `qa_abc123`
- **Smart reusable component detection:**
  - Automatically detects and skips wrapper components (Button, Input, etc.)
  - Uses `ref={ref}` + `{...props}` + `forwardRef` pattern detection
  - Injects at usage sites for unique IDs per instance
- **Dynamic list support:**
  - Detects `.map()` functions
  - Automatically appends key/index to IDs
  - Template literals: `data-testid={`qa_product_${item.id}`}`
- **Git integration:**
  - Pre-commit hook support
  - Automatic injection before commits
- **Watch mode:**
  - Auto-inject on file save during development
- **Flexible configuration:**
  - `detectReusableComponents`: Auto-detect UI components (default: true)
  - `autoExcludePatterns`: Glob patterns for exclusion
  - `include/exclude`: File pattern matching
  - `strategy`: Choose injection strategy
  - `verbose`: Detailed logging

#### How It Works

**Reusable Component Detection:**
Proteus detects wrapper components by checking if an element has:
1. `ref={ref}` attribute
2. `{...props}` spread operator
3. Is inside a `forwardRef` function

When detected, Proteus skips injecting in the component definition and injects at usage sites instead.

**Example:**

```tsx
// src/components/ui/button.tsx (skipped)
const Button = forwardRef(({ ...props }, ref) => {
  return <button {...props} ref={ref} />; // ← No data-testid injected here
});

// src/components/Hero.tsx (injected at usage)
<Button onClick={handleClick} data-testid="qa_hero_button_1_abc123">
  Get Started
</Button>
<Button variant="outline" data-testid="qa_hero_button_2_def456">
  View on GitHub
</Button>
```

**Dynamic Lists:**

```tsx
// Before
{products.map((product) => (
  <div key={product.id}>
    <h2>{product.name}</h2>
    <Button>Add to Cart</Button>
  </div>
))}

// After (Proteus injected)
{products.map((product) => (
  <div key={product.id} data-testid={`qa_productlist_container_${product.id}`}>
    <h2 data-testid={`qa_productlist_h2_${product.id}`}>{product.name}</h2>
    <Button data-testid={`qa_productlist_button_${product.id}`}>Add to Cart</Button>
  </div>
))}
```

#### Configuration

```json
{
  "strategy": "functional",
  "include": ["src/**/*.tsx", "src/**/*.jsx"],
  "exclude": ["node_modules/**", "dist/**"],
  "detectReusableComponents": true,
  "autoExcludePatterns": [],
  "verbose": false
}
```

#### CLI Commands

```bash
# Initialize config
proteus init

# Inject once
proteus inject

# Inject specific files
proteus inject src/components/Button.tsx

# Watch mode
proteus inject --watch

# Setup Git hooks
proteus setup

# Pre-commit (used by Git hooks)
proteus pre-commit
```

#### Benefits
- ✅ **Zero runtime overhead**: Injection happens at build/dev time
- ✅ **Consistent IDs**: Enforced naming convention across codebase
- ✅ **No duplicates**: Unique IDs for every element instance
- ✅ **Works with UI libraries**: Compatible with shadcn, MUI, Ant Design, etc.
- ✅ **Smart detection**: Automatically handles reusable components
- ✅ **Dynamic lists**: Seamless support for mapped elements
- ✅ **Developer friendly**: Minimal configuration required

---

## Future Releases

See [GitHub Releases](https://github.com/nivustec/proteus/releases) for upcoming features and improvements.
