# v1.1.1 - Hotfix

## Fixed
- **Improved reusable component detection**: Now only skips **simple wrapper components** (single element with forwardRef + {...props})
- **Complex components are processed normally**: Components with multiple elements in `/ui/` folders are no longer skipped
- **Better detection logic**: Checks for single component export pattern to avoid false positives

## Why this fix?
The v1.1.0 logic was too aggressive - it skipped entire files in `/ui/` folders, which could leave some elements without data-testid if they were complex components or if components were used within other UI components.

Now, Proteus only skips **simple wrappers** like:
```tsx
const Button = forwardRef(({ ...props }, ref) => <button {...props} ref={ref} />);
```

But processes **complex components** normally:
```tsx
const Card = forwardRef(({ ...props }, ref) => (
  <div ref={ref}>
    <Header /> {/* ← Gets data-testid */}
    <Content {...props} /> {/* ← Gets data-testid */}
  </div>
));
```

This ensures **every element gets a data-testid**, either from the component definition or from the usage site.
