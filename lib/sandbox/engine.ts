import type { GeneratedFile } from "../types"

export interface SandboxConfig {
  theme?: "light" | "dark"
  tailwindCdn?: boolean
  reactVersion?: string
}

const DEFAULT_CONFIG: SandboxConfig = {
  theme: "dark",
  tailwindCdn: true,
  reactVersion: "18.2.0",
}

/**
 * Generates a complete HTML document that can be rendered in an iframe
 * for previewing React components with Tailwind CSS
 */
export function generateSandboxHtml(
  files: GeneratedFile[],
  config: SandboxConfig = {}
): string {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Find the main component file
  const mainFile = files.find(
    (f) =>
      f.path.includes("page.tsx") ||
      f.path.includes("index.tsx") ||
      f.path.includes("App.tsx")
  ) || files[0]

  if (!mainFile) {
    return generateEmptyPreview()
  }

  // Transform the React code for browser execution
  const transformedCode = transformReactCode(mainFile.content, files)

  return `
<!DOCTYPE html>
<html lang="en" class="${mergedConfig.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  
  <!-- Tailwind CSS -->
  ${mergedConfig.tailwindCdn ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
  
  <!-- Tailwind Config -->
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            card: 'var(--card)',
            'card-foreground': 'var(--card-foreground)',
            primary: 'var(--primary)',
            'primary-foreground': 'var(--primary-foreground)',
            secondary: 'var(--secondary)',
            'secondary-foreground': 'var(--secondary-foreground)',
            muted: 'var(--muted)',
            'muted-foreground': 'var(--muted-foreground)',
            accent: 'var(--accent)',
            'accent-foreground': 'var(--accent-foreground)',
            destructive: 'var(--destructive)',
            'destructive-foreground': 'var(--destructive-foreground)',
            border: 'var(--border)',
            input: 'var(--input)',
            ring: 'var(--ring)',
          },
          borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
          }
        }
      }
    }
  </script>
  
  <!-- CSS Variables -->
  <style>
    :root {
      --background: #0a0a0a;
      --foreground: #fafafa;
      --card: #141414;
      --card-foreground: #fafafa;
      --primary: #fafafa;
      --primary-foreground: #0a0a0a;
      --secondary: #1f1f1f;
      --secondary-foreground: #fafafa;
      --muted: #262626;
      --muted-foreground: #a3a3a3;
      --accent: #10b981;
      --accent-foreground: #fafafa;
      --destructive: #ef4444;
      --destructive-foreground: #fafafa;
      --border: #262626;
      --input: #1f1f1f;
      --ring: #525252;
      --radius: 0.5rem;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--background);
      color: var(--foreground);
      min-height: 100vh;
    }
    
    /* Button styles */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: var(--radius);
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    
    .btn-primary {
      background-color: var(--primary);
      color: var(--primary-foreground);
    }
    
    .btn-primary:hover {
      opacity: 0.9;
    }
    
    .btn-secondary {
      background-color: var(--secondary);
      color: var(--secondary-foreground);
    }
    
    .btn-secondary:hover {
      background-color: var(--muted);
    }
    
    /* Card styles */
    .card {
      background-color: var(--card);
      color: var(--card-foreground);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    
    /* Input styles */
    input, textarea {
      background-color: var(--input);
      color: var(--foreground);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
    }
    
    input:focus, textarea:focus {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
  </style>
  
  <!-- React -->
  <script crossorigin src="https://unpkg.com/react@${mergedConfig.reactVersion}/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@${mergedConfig.reactVersion}/umd/react-dom.development.js"></script>
  
  <!-- Babel for JSX -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    
    // Simple UI Components
    function Button({ children, variant = "primary", className = "", onClick, disabled, ...props }) {
      const variants = {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        outline: "border border-border bg-transparent hover:bg-secondary",
        ghost: "bg-transparent hover:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      };
      
      return (
        <button
          className={\`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed \${variants[variant] || variants.primary} \${className}\`}
          onClick={onClick}
          disabled={disabled}
          {...props}
        >
          {children}
        </button>
      );
    }
    
    function Input({ className = "", ...props }) {
      return (
        <input
          className={\`flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 \${className}\`}
          {...props}
        />
      );
    }
    
    function Textarea({ className = "", ...props }) {
      return (
        <textarea
          className={\`flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 \${className}\`}
          {...props}
        />
      );
    }
    
    function Card({ children, className = "", ...props }) {
      return (
        <div className={\`rounded-lg border border-border bg-card text-card-foreground shadow-sm \${className}\`} {...props}>
          {children}
        </div>
      );
    }
    
    function CardHeader({ children, className = "", ...props }) {
      return (
        <div className={\`flex flex-col space-y-1.5 p-6 \${className}\`} {...props}>
          {children}
        </div>
      );
    }
    
    function CardTitle({ children, className = "", ...props }) {
      return (
        <h3 className={\`text-2xl font-semibold leading-none tracking-tight \${className}\`} {...props}>
          {children}
        </h3>
      );
    }
    
    function CardDescription({ children, className = "", ...props }) {
      return (
        <p className={\`text-sm text-muted-foreground \${className}\`} {...props}>
          {children}
        </p>
      );
    }
    
    function CardContent({ children, className = "", ...props }) {
      return (
        <div className={\`p-6 pt-0 \${className}\`} {...props}>
          {children}
        </div>
      );
    }
    
    function CardFooter({ children, className = "", ...props }) {
      return (
        <div className={\`flex items-center p-6 pt-0 \${className}\`} {...props}>
          {children}
        </div>
      );
    }
    
    function Badge({ children, variant = "default", className = "", ...props }) {
      const variants = {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      };
      
      return (
        <div
          className={\`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors \${variants[variant] || variants.default} \${className}\`}
          {...props}
        >
          {children}
        </div>
      );
    }

    function __swiftMissingComponent(name) {
      return function MissingComponent({ children, ...props }) {
        return (
          <div
            className="rounded-md border border-dashed border-border bg-secondary/50 p-2 text-xs text-muted-foreground"
            data-swift-missing={name}
            {...props}
          >
            {children ?? \`[missing component: \${name}]\`}
          </div>
        );
      };
    }

    function __swiftNoopFunction() {
      return undefined;
    }

    function __swiftNamespace(source) {
      return new Proxy(
        {},
        {
          get(_target, key) {
            const name = String(key);
            return __swiftResolve(name, name, source);
          },
        }
      );
    }

    function __swiftResolve(importedName, localName, source) {
      const name = localName || importedName;
      const builtins = {
        React,
        useState: React.useState,
        useEffect: React.useEffect,
        useRef: React.useRef,
        useCallback: React.useCallback,
        useMemo: React.useMemo,
        useReducer: React.useReducer,
        useContext: React.useContext,
        useLayoutEffect: React.useLayoutEffect,
        useId: React.useId,
        useTransition: React.useTransition,
        useDeferredValue: React.useDeferredValue,
        Button,
        Input,
        Textarea,
        Card,
        CardHeader,
        CardTitle,
        CardDescription,
        CardContent,
        CardFooter,
        Badge,
        Link: ({ children, href = "#", ...props }) => (
          <a href={href} {...props}>
            {children}
          </a>
        ),
        Image: ({ alt = "", ...props }) => <img alt={alt} {...props} />,
        useRouter: () => ({
          push: () => {},
          replace: () => {},
          back: () => {},
          prefetch: async () => {},
        }),
        usePathname: () => "/",
        useSearchParams: () => new URLSearchParams(),
      };

      if (name in builtins) {
        return builtins[name];
      }

      if (importedName in builtins) {
        return builtins[importedName];
      }

      if (name && /^[A-Z]/.test(name)) {
        return __swiftMissingComponent(name);
      }

      return __swiftNoopFunction;
    }
    
    // User's Generated Component
    ${transformedCode}
    
    // Render
    const rootElement = document.getElementById('root');
    const root = ReactDOM.createRoot(rootElement);
    function __swiftRenderRuntimeFallback(errorMessage) {
      root.render(
        <div className="min-h-screen bg-background p-6 text-foreground">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Preview fallback mode</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Komponen berhasil dimuat sebagian, tapi ada error saat render.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-md bg-secondary p-3 text-xs text-muted-foreground">
{String(errorMessage || "Unknown preview runtime error")}
            </pre>
          </div>
        </div>
      );
    }

    window.addEventListener("error", (event) => {
      event.preventDefault();
      __swiftRenderRuntimeFallback(event.message || "Unhandled preview error");
    });

    try {
      root.render(<App />);
    } catch (error) {
      __swiftRenderRuntimeFallback(error?.message || String(error));
    }
  </script>
</body>
</html>
  `
}

/**
 * Transform React/Next.js code for browser execution
 */
function transformReactCode(code: string, allFiles: GeneratedFile[]): string {
  let transformed = code

  transformed = transformImportsToFallbacks(transformed)

  // Remove TypeScript types and interfaces
  transformed = transformed.replace(/(?:export\s+)?interface\s+\w+\s*\{[\s\S]*?\}\s*;?/g, "")
  transformed = transformed.replace(/(?:export\s+)?type\s+\w+\s*=\s*\{[\s\S]*?\}\s*;?/g, "")
  transformed = transformed.replace(/(?:export\s+)?type\s+\w+\s*=\s*[^;\n]+;?/g, "")
  // Remove variable type annotations: const x: Type = ...
  transformed = transformed.replace(
    /(\b(?:const|let|var)\s+[A-Za-z_$][\w$]*)\s*:\s*[^=;\n]+(?=\s*=)/g,
    "$1"
  )
  // Remove function parameter annotations: (x: Type, y: Type)
  transformed = transformed.replace(
    /([\(,]\s*[A-Za-z_$][\w$]*)\s*:\s*[^,\)\n]+/g,
    "$1"
  )
  // Remove function return annotations: (): Type => / function x(): Type {
  transformed = transformed.replace(/\)\s*:\s*[^=\{\n]+(?=\s*=>|\s*\{)/g, ")")
  transformed = transformed.replace(/\s+satisfies\s+[A-Za-z_$][\w$<>\[\]\{\}\|&,\s]*/g, "")
  transformed = transformed.replace(/\s+as\s+const\b/g, "")
  transformed = transformed.replace(/\s+as\s+[A-Za-z_$][\w$<>\[\]\{\}\|&,\s]*/g, "")
  // Remove generic annotations from hooks like useState<string>()
  // without stripping JSX tags such as <CardTitle>.
  transformed = transformed.replace(
    /(?<=[\w\)])<([A-Z]?\w+)(\s*,\s*([A-Z]?\w+))*>\(/g,
    "("
  )

  // Remove "use client" directive
  transformed = transformed.replace(/['"]use client['"];?\n?/g, "")

  // Replace export default with App component
  transformed = transformed.replace(
    /export\s+default\s+function\s+(\w+)/,
    "function App"
  )
  transformed = transformed.replace(
    /export\s+default\s+(\w+)/,
    "const App = $1"
  )

  // Remove other exports
  transformed = transformed.replace(/export\s+/g, "")

  // Handle Next.js specific components
  transformed = transformed.replace(/import\s+Link\s+from\s+['"]next\/link['"];?\n?/g, "")
  transformed = transformed.replace(/<Link\s+href=/g, "<a href=")
  transformed = transformed.replace(/<\/Link>/g, "</a>")

  transformed = transformed.replace(/import\s+Image\s+from\s+['"]next\/image['"];?\n?/g, "")
  transformed = transformed.replace(/<Image\s+/g, "<img ")

  return transformed
}

function transformImportsToFallbacks(code: string) {
  const transformed = code.replace(
    /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
    (_full, rawClause: string, rawSource: string) => {
      const clause = String(rawClause || "").trim()
      const source = String(rawSource || "").trim()
      return buildImportFallbackDeclarations(clause, source)
    }
  )

  return transformed.replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
}

function buildImportFallbackDeclarations(clause: string, source: string) {
  const statements: string[] = []
  const safeSource = JSON.stringify(source)
  const sourceLower = source.toLowerCase()
  const reactGlobals = new Set([
    "useState",
    "useEffect",
    "useRef",
    "useCallback",
    "useMemo",
    "Fragment",
    "Suspense",
  ])

  const namespaceMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/)
  if (namespaceMatch?.[1]) {
    const name = namespaceMatch[1]
    if (sourceLower === "react" && name === "React") {
      return ""
    }
    statements.push(`const ${name} = __swiftNamespace(${safeSource});`)
    return statements.join("\n")
  }

  const namedMatch = clause.match(/^\{([\s\S]+)\}$/)
  if (namedMatch?.[1]) {
    for (const item of namedMatch[1].split(",")) {
      const token = item.trim()
      if (!token) continue
      const aliasMatch = token.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
      const imported = aliasMatch?.[1] || token
      const local = aliasMatch?.[2] || imported
      if (
        sourceLower === "react" &&
        reactGlobals.has(imported) &&
        imported === local
      ) {
        continue
      }
      statements.push(`const ${local} = __swiftResolve(${JSON.stringify(imported)}, ${JSON.stringify(local)}, ${safeSource});`)
    }
    return statements.join("\n")
  }

  const mixedMatch = clause.match(/^([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]+)\}$/)
  if (mixedMatch?.[1]) {
    const defaultName = mixedMatch[1]
    if (!(sourceLower === "react" && defaultName === "React")) {
      statements.push(`const ${defaultName} = __swiftResolve("default", ${JSON.stringify(defaultName)}, ${safeSource});`)
    }
    for (const item of mixedMatch[2].split(",")) {
      const token = item.trim()
      if (!token) continue
      const aliasMatch = token.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/)
      const imported = aliasMatch?.[1] || token
      const local = aliasMatch?.[2] || imported
      if (
        sourceLower === "react" &&
        reactGlobals.has(imported) &&
        imported === local
      ) {
        continue
      }
      statements.push(`const ${local} = __swiftResolve(${JSON.stringify(imported)}, ${JSON.stringify(local)}, ${safeSource});`)
    }
    return statements.join("\n")
  }

  const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)$/)
  if (defaultMatch?.[1]) {
    const name = defaultMatch[1]
    if (sourceLower === "react" && name === "React") {
      return ""
    }
    statements.push(`const ${name} = __swiftResolve("default", ${JSON.stringify(name)}, ${safeSource});`)
    return statements.join("\n")
  }

  return `/* Unsupported import clause omitted: ${clause} from ${source} */`
}

/**
 * Generate empty preview HTML
 */
function generateEmptyPreview(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div style="text-align: center; padding: 2rem;">
    <div style="width: 48px; height: 48px; margin: 0 auto 1rem; border-radius: 50%; background: #1f1f1f; display: flex; align-items: center; justify-content: center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    </div>
    <h3 style="font-size: 1.125rem; font-weight: 600; margin: 0;">No preview available</h3>
    <p style="font-size: 0.875rem; color: #a3a3a3; margin-top: 0.5rem;">
      Start a conversation to generate your component
    </p>
  </div>
</body>
</html>
  `
}

/**
 * Get error HTML for preview
 */
export function generateErrorPreview(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .error-container {
      max-width: 400px;
      text-align: center;
    }
    .error-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      background: #451a03;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h3 {
      color: #ef4444;
      margin: 0 0 0.5rem;
    }
    pre {
      background: #1f1f1f;
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      text-align: left;
      overflow-x: auto;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <h3>Preview Error</h3>
    <p style="color: #a3a3a3; font-size: 0.875rem;">
      There was an error rendering the preview
    </p>
    <pre>${escapeHtml(error)}</pre>
  </div>
</body>
</html>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
