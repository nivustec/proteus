import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import { ElementInfo, ProteuConfig } from "./types.js";
import { generateTestId, shortStableHash } from "./utils.js";

// Normalize ESM/CJS interop from @babel/traverse
const traverse = (_traverse as any).default;

// Result of transforming a single file
interface InjectionResult {
  code: string;
  injectedCount: number;
  error?: Error;
}

// Detect if a file defines a reusable component (should skip ONLY the component definition)
// But still inject at usage sites (JSX elements using the component)
function isReusableComponentDefinition(filePath: string, code: string, config: ProteuConfig): boolean {
  // If detection is disabled, don't check
  if (!config.detectReusableComponents) {
    return false;
  }

  // Check auto-exclude patterns - these skip the ENTIRE file
  if (config.autoExcludePatterns && config.autoExcludePatterns.length > 0) {
    for (const pattern of config.autoExcludePatterns) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\//g, '\\/'));
      if (regex.test(filePath)) {
        return true;
      }
    }
  }

  // Detect common patterns for reusable component DEFINITIONS
  const isInUIFolder = /\/(ui|common|shared|components\/ui|components\/common)\//i.test(filePath);
  const usesForwardRef = /React\.forwardRef|forwardRef\s*</.test(code);
  const hasSpreadProps = /\{\s*\.\.\.props\s*\}/.test(code);
  
  // Only skip if ALL conditions are met AND it's a simple wrapper (single return statement)
  if (isInUIFolder && usesForwardRef && hasSpreadProps) {
    // Check if it's a simple wrapper (likely reusable)
    const hasMultipleElements = (code.match(/<[A-Z]/g) || []).length > 1;
    if (!hasMultipleElements) {
      return true; // Skip simple wrappers like Button, Input
    }
  }

  return false;
}

// Parse the source, traverse JSX, and inject data-testid attributes
export function parseAndInject(
  filePath: string,
  code: string,
  config: ProteuConfig
): InjectionResult {
  let injectedCount = 0;

  try {
    // Check if this is a simple reusable component definition that should be skipped
    if (isReusableComponentDefinition(filePath, code, config)) {
      if (config.verbose) {
        console.log(`⏭️  Skipping reusable component definition: ${filePath}`);
      }
      return { code, injectedCount: 0 };
    }

    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      tokens: true,
    });

    const lines = code.split("\n");
    let hasModifications = false;
    let elementsFound = 0;

    traverse(ast, {
      JSXOpeningElement(path: any) {
        elementsFound++;
        const node = path.node;

        if (!node.loc) return;

        const lineNumber = node.loc.start.line;
        const elementName = getElementName(node);

        if (!elementName || isExcludedElement(elementName)) return;

        const hasTestId = node.attributes.some(
          (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === "data-testid"
        );

        if (hasTestId) return;

        const mapInfo = getMapInfo(path);
        const isDynamic = isInsideMapFunction(path);
        const descriptor = getFunctionalDescriptor(node, path);
        const componentPath = getComponentPath(path);
        const classNameHint = getStaticClassName(node);
        const siblingPos = getSiblingPosition(path, elementName);

        const elementInfo: ElementInfo = {
          elementName,
          fileName: filePath,
          lineNumber,
          key: mapInfo.key,
          index: mapInfo.index,
          isDynamic,
          descriptor,
          componentPath,
        };

        const built = buildAttributeForElement(
          config,
          elementInfo,
          mapInfo,
          classNameHint,
          siblingPos
        );

        // Insert just before the closing token of the opening tag (supports multi-line and self-closing)
        const endLineIndex = node.loc.end.line - 1;
        const endCol = node.loc.end.column;
        if (endLineIndex >= lines.length) return;
        const endLine = lines[endLineIndex];
        const isSelf = (node as any).selfClosing === true;
        const insertCol = isSelf ? Math.max(0, endCol - 2) : Math.max(0, endCol - 1);
        lines[endLineIndex] =
          endLine.slice(0, insertCol) +
          ` ${built.attributeText}` +
          endLine.slice(insertCol);

        hasModifications = true;
        injectedCount++;
      },
    });

    // Quiet by default; injector controls logging verbosity

    return {
      code: hasModifications ? lines.join("\n") : code,
      injectedCount,
    };
  } catch (error) {
    return { code, injectedCount: 0, error: error as Error };
  }
}

// Helpers
function getElementName(node: t.JSXOpeningElement): string {
  if (t.isJSXIdentifier(node.name)) {
    return node.name.name;
  } else if (t.isJSXMemberExpression(node.name)) {
    let name = "";
    let current: t.JSXMemberExpression | t.JSXIdentifier = node.name;

    while (t.isJSXMemberExpression(current)) {
      name =
        "." +
        (t.isJSXIdentifier(current.property) ? current.property.name : "") +
        name;
      current = current.object as t.JSXMemberExpression | t.JSXIdentifier;
    }

    if (t.isJSXIdentifier(current)) {
      name = current.name + name;
    }

    return name;
  }

  return "";
}

function isExcludedElement(elementName: string): boolean {
  // Self-closing, non-semantic tags we never instrument
  const excluded = ["br", "hr", "meta", "link", "script", "style"];
  return excluded.includes(elementName.toLowerCase());
}

function isInsideMapFunction(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      current.isCallExpression() &&
      current.node.callee.type === "MemberExpression" &&
      current.node.callee.property.type === "Identifier" &&
      current.node.callee.property.name === "map"
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

// Returns map key/index info for elements within Array.prototype.map
function getMapInfo(path: any): { key?: string; index?: number } {
  let current = path.parentPath;

  while (current) {
    if (
      current.isCallExpression() &&
      current.node.callee.type === "MemberExpression" &&
      current.node.callee.property.type === "Identifier" &&
      current.node.callee.property.name === "map"
    ) {
      // Try current opening element
      if (path.isJSXOpeningElement()) {
        const keyAttr = path.node.attributes.find(
          (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === "key"
        );

        if (keyAttr && t.isJSXAttribute(keyAttr) && keyAttr.value) {
          if (t.isStringLiteral(keyAttr.value)) {
            return { key: keyAttr.value.value };
          } else if (
            t.isJSXExpressionContainer(keyAttr.value)
          ) {
            const expr = keyAttr.value.expression as any;
            const keyExpr = expressionToText(expr);
            if (keyExpr) return { key: keyExpr };
          }
        }
      }
      // Try nearest ancestor JSXElement's openingElement (e.g., wrapper with key)
      let ancestor = path.parentPath;
      while (ancestor) {
        if (ancestor.node && ancestor.node.type === "JSXElement") {
          const opening = (ancestor.node as t.JSXElement).openingElement;
          const keyAttr = opening.attributes.find(
            (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              attr.name.name === "key"
          ) as t.JSXAttribute | undefined;
          if (keyAttr && keyAttr.value) {
            if (t.isStringLiteral(keyAttr.value)) {
              return { key: keyAttr.value.value };
            }
            if (t.isJSXExpressionContainer(keyAttr.value)) {
              const keyExpr = expressionToText(keyAttr.value.expression as any);
              if (keyExpr) return { key: keyExpr };
            }
          }
        }
        ancestor = ancestor.parentPath;
      }
      break;
    }
    current = current.parentPath;
  }

  return {};
}

// Stringify simple identifiers/member-expressions (e.g., item.id)
function expressionToText(expr: any): string | undefined {
  if (!expr) return undefined;
  if (expr.type === "Identifier") return expr.name;
  if (expr.type === "MemberExpression") {
    const obj = expressionToText(expr.object);
    const prop = expr.property && expr.property.name ? expr.property.name : undefined;
    if (obj && prop) return `${obj}.${prop}`;
  }
  return undefined;
}

// Derive a semantic descriptor from attributes or children (e.g., placeholder, alt, or text)
function getFunctionalDescriptor(
  node: t.JSXOpeningElement,
  path: any
): string | undefined {
  // Prefer explicit semantics on common elements
  const attrValue = (name: string): string | undefined => {
    const attr = node.attributes.find(
      (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name
    ) as t.JSXAttribute | undefined;
    if (!attr || !attr.value) return undefined;
    if (t.isStringLiteral(attr.value)) return attr.value.value.toLowerCase();
    return undefined;
  };

  const name = t.isJSXIdentifier(node.name) ? node.name.name.toLowerCase() : "";
  if (name === "input") {
    const placeholder = attrValue("placeholder");
    if (placeholder) return `input-${placeholder.replace(/\s+/g, "-")}`;
    const type = attrValue("type");
    if (type) return `input-${type}`;
  }
  if (name === "img") {
    const alt = attrValue("alt");
    if (alt) return `img-${alt.replace(/\s+/g, "-")}`;
  }

  // Infer from children (text or simple expressions)
  const parentEl = path.parentPath && path.parentPath.parent;
  if (parentEl && parentEl.type === "JSXElement") {
    const children = parentEl.children || [];
    for (const c of children) {
      if (c.type === "JSXText") {
        const text = c.value.trim();
        if (text) return text.toLowerCase().replace(/\s+/g, "-");
      }
      if (c.type === "JSXExpressionContainer") {
        const d = inferDescriptorFromExpression(c.expression as any);
        if (d) return d;
      }
    }
  }

  return undefined;
}

// Resolve nearest component/function name to build an informative base id
function getComponentPath(path: any): string[] | undefined {
  const names: string[] = [];
  let current = path;
  while (current) {
    if (current.isFunctionDeclaration() || current.isFunctionExpression() || current.isArrowFunctionExpression()) {
      const id = (current.node as any).id;
      if (id && id.name) {
        names.unshift(id.name);
        break;
      }
    }
    if (current.isVariableDeclarator() && current.node.id.type === "Identifier") {
      names.unshift(current.node.id.name);
      break;
    }
    current = current.parentPath;
  }
  return names.length ? names : undefined;
}

// Read static className literals to refine role inference
function getStaticClassName(node: t.JSXOpeningElement): string | undefined {
  const cls = node.attributes.find(
    (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === "className"
  ) as t.JSXAttribute | undefined;
  if (!cls || !cls.value) return undefined;
  if (t.isStringLiteral(cls.value)) return cls.value.value;
  return undefined;
}

// If multiple identical sibling tags exist, return this element's position (1-based)
function getSiblingPosition(path: any, elementName: string): { index: number; total: number } | undefined {
  const parent = path.parentPath && path.parentPath.parent;
  if (!parent || parent.type !== 'JSXElement') return undefined;
  const children = parent.children || [];
  let indices: number[] = [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (c.type === 'JSXElement') {
      const open = c.openingElement as t.JSXOpeningElement;
      const name = getElementName(open);
      if (name === elementName) indices.push(i);
    }
  }
  if (indices.length <= 1) return undefined;
  const myIdx = children.findIndex((c: any) => c === path.parentPath.node);
  const pos = indices.indexOf(myIdx);
  if (pos === -1) return undefined;
  return { index: pos, total: indices.length };
}

// Extract a concise name from simple expressions inside JSX
function inferDescriptorFromExpression(expr: any): string | undefined {
  if (!expr) return undefined;
  if (expr.type === "MemberExpression") {
    const prop = expr.property;
    if (prop && prop.type === "Identifier") return prop.name.toLowerCase();
  }
  if (expr.type === "CallExpression") {
    for (const arg of expr.arguments || []) {
      const d = inferDescriptorFromExpression(arg);
      if (d) return d;
    }
  }
  return undefined;
}

// Map raw tag name to a coarse role
function mapRole(tag: string): string {
  const name = tag.toLowerCase();
  if (name === "div" || name === "section" || name === "article" || name === "span") return "container";
  if (name === "img") return "image";
  return name;
}

// Build the data-testid attribute text based on strategy, map context, sibling index, and descriptors
function buildAttributeForElement(
  config: ProteuConfig,
  info: ElementInfo,
  mapInfo: { key?: string; index?: number },
  classNameHint?: string,
  siblingPos?: { index: number; total: number }
): { attributeText: string; idForRecord: string } {
  if (config.strategy === "functional") {
    const component = (info.componentPath && info.componentPath[0])
      ? info.componentPath[0].toLowerCase()
      : info.fileName.replace(/\.(tsx|jsx|ts|js)$/, "").toLowerCase();
    let role = mapRole(info.elementName);
    if (classNameHint) {
      if (/\bitem\b/.test(classNameHint)) role = "item";
      else if (/\bproduct-list\b/.test(classNameHint)) role = "list";
      else if (/\bheader\b/.test(classNameHint)) role = "header";
      else if (/\badd-to-cart\b/.test(classNameHint)) role = "button";
    }
    const descriptor = info.descriptor ? info.descriptor.replace(/\s+/g, "-") : undefined;
    // Add sibling index when multiple identical tags under same parent
    const siblingIndexPart = siblingPos && siblingPos.total > 1 ? String(siblingPos.index + 1) : undefined;
    const base = ["qa_" + component, role, siblingIndexPart, descriptor]
      .filter(Boolean)
      .join("_");

    // In functional strategy, always append map key for elements inside map
    if (info.isDynamic && mapInfo && mapInfo.key) {
      if (/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(mapInfo.key)) {
        const exprAttr = `data-testid={\`${base}_\${${mapInfo.key}}\`}`;
        return { attributeText: exprAttr, idForRecord: `${base}_${mapInfo.key}` };
      }
      return { attributeText: `data-testid="${base}_${mapInfo.key}"`, idForRecord: `${base}_${mapInfo.key}` };
    }
    if (info.isDynamic && typeof mapInfo.index === "number") {
      return { attributeText: `data-testid="${base}_${mapInfo.index}"`, idForRecord: `${base}_${mapInfo.index}` };
    }
    // Ensure uniqueness for repeated tags without descriptors
    const unique = shortStableHash(`${info.fileName}:${info.lineNumber}:${role}:${descriptor || ''}`);
    return { attributeText: `data-testid="${base}_${unique}"`, idForRecord: `${base}_${unique}` };
  }

  // safe-hash fallback
  const id = generateTestId(config, info);
  if (info.isDynamic && mapInfo && mapInfo.key) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(mapInfo.key)) {
      return { attributeText: `data-testid={\`${id}_\${${mapInfo.key}}\`}`, idForRecord: `${id}_${mapInfo.key}` };
    }
    return { attributeText: `data-testid="${id}_${mapInfo.key}"`, idForRecord: `${id}_${mapInfo.key}` };
  }
  return { attributeText: `data-testid="${id}"`, idForRecord: id };
}
