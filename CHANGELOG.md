# Changelog

All notable changes to Proteus will be documented in this file.

## [1.1.0] - 2024-11-13

### Added
- **Auto-detection of simple reusable components**: Proteus now automatically detects and skips **simple reusable UI components** (like Button, Input, etc.) to prevent duplicate data-testid injection
- New config option `detectReusableComponents` (default: `true`) to enable/disable automatic detection
- New config option `autoExcludePatterns` to specify glob patterns for auto-exclusion (e.g., `["**/ui/**", "**/common/**"]`)

### How it works
Proteus detects **simple reusable component definitions** by checking:
1. File location (e.g., `/ui/`, `/common/`, `/shared/` folders)
2. Use of `React.forwardRef` or `forwardRef<>`
3. Presence of `{...props}` spread operator
4. Single component export (simple wrapper pattern)

When a simple reusable component is detected, Proteus skips injecting data-testid directly in the component definition. **However, it ALWAYS injects at usage sites**, ensuring every element gets a unique ID.

### Important
- ✅ **Usage sites are ALWAYS processed**: Even if a file is in `/ui/`, Proteus will inject data-testid on JSX elements that USE components
- ✅ **Only simple wrappers are skipped**: Complex components with multiple elements are still processed normally
- ✅ **No elements are left without IDs**: Every rendered element will have a data-testid

### Example

**Before (v1.0.0):**
```tsx
// src/components/ui/button.tsx
const Button = ({ ...props }) => {
  return <button {...props} data-testid="qa_button_comp_xxx" />; // ❌ Same ID everywhere
};
```

**After (v1.1.0):**
```tsx
// src/components/ui/button.tsx (skipped by Proteus)
const Button = ({ ...props }) => {
  return <button {...props} />; // ✅ No fixed ID
};

// src/components/Hero.tsx (Proteus injects here)
<Button data-testid="qa_hero_button_1_xxx">Get Started</Button>
<Button data-testid="qa_hero_button_2_yyy">GitHub</Button>
```

### Configuration

```json
{
  "strategy": "functional",
  "detectReusableComponents": true,
  "autoExcludePatterns": [
    "**/ui/**",
    "**/common/**",
    "**/shared/**"
  ]
}
```

## [1.0.0] - 2025-11-13

### Initial Release
- Automatic data-testid injection for React components
- Two strategies: `functional` and `safe-hash`
- Support for dynamic lists with map keys
- Git pre-commit hook integration
- Watch mode for development
