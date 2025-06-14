# Vite Documentation Reference

This documentation was fetched from Context7 for the Vite library (`/vitejs/vite`).

## Table of Contents

1. [Basic Configuration](#basic-configuration)
2. [Plugins](#plugins)
3. [Build Configuration](#build-configuration)
4. [Development Server](#development-server)
5. [Environment and Modes](#environment-and-modes)
6. [TypeScript Integration](#typescript-integration)
7. [API Reference](#api-reference)
8. [React Integration](#react-integration)

---

## Basic Configuration

### Basic Vite Config Structure

```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  // Configuration options
})
```

### Conditional Configuration

```javascript
export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
  if (command === 'serve') {
    return {
      // dev specific config
    }
  } else {
    // command === 'build'
    return {
      // build specific config
    }
  }
})
```

### TypeScript Configuration

```typescript
import type { UserConfig } from 'vite'

export default {
  // ...
} satisfies UserConfig
```

---

## Plugins

### Plugin Array Configuration

```javascript
import vitePlugin from 'vite-plugin-feature'
import rollupPlugin from 'rollup-plugin-feature'

export default defineConfig({
  plugins: [vitePlugin(), rollupPlugin()],
})
```

### Conditional Plugin Application

```javascript
import typescript2 from 'rollup-plugin-typescript2'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      ...typescript2(),
      apply: 'build',  // Only apply during build
    },
  ],
})
```

### Plugin Hooks

#### Config Hook
```javascript
const partialConfigPlugin = () => ({
  name: 'return-partial',
  config: () => ({
    resolve: {
      alias: {
        foo: 'bar',
      },
    },
  }),
})
```

#### ConfigResolved Hook
```javascript
const examplePlugin = () => {
  let config

  return {
    name: 'read-config',
    configResolved(resolvedConfig) {
      // store the resolved config
      config = resolvedConfig
    },
    transform(code, id) {
      if (config.command === 'serve') {
        // dev: plugin invoked by dev server
      } else {
        // build: plugin invoked by Rollup
      }
    },
  }
}
```

#### ConfigureServer Hook
```javascript
const myPlugin = () => ({
  name: 'configure-server',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // custom handle request...
    })
  },
})
```

### Environment-Specific Plugins

```javascript
import { perEnvironmentPlugin } from 'vite'

export default defineConfig({
  plugins: [
    perEnvironmentPlugin('per-environment-plugin', (environment) =>
      nonShareablePlugin({ outputName: environment.name }),
    ),
  ],
})
```

---

## Build Configuration

### Basic Build Options

```javascript
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2015',
  },
})
```

### Library Mode

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/main.js'),
      name: 'MyLib',
      fileName: (format) => `my-lib.${format}.js`
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
```

### Multiple Entry Library

```javascript
export default defineConfig({
  build: {
    lib: {
      entry: {
        'my-lib': resolve(__dirname, 'lib/main.js'),
        secondary: resolve(__dirname, 'lib/secondary.js'),
      },
      name: 'MyLib',
    },
  },
})
```

### Advanced Build Options

```javascript
export default defineConfig({
  build: {
    // Source maps
    sourcemap: true, // or 'inline' or 'hidden'
    
    // CSS minification
    cssMinify: 'lightningcss',
    
    // Asset inlining
    assetsInlineLimit: 4096,
    
    // Module preload
    modulePreload: {
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        return deps.filter(condition)
      },
    },
    
    // SSR
    ssr: true,
    ssrManifest: true,
  },
})
```

---

## Development Server

### Creating a Dev Server

```typescript
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  root: __dirname,
  server: {
    port: 1337,
  },
})

await server.listen()
server.printUrls()
server.bindCLIShortcuts({ print: true })
```

### Middleware Mode

```typescript
import http from 'http'
import { createServer } from 'vite'

const parentServer = http.createServer()

const vite = await createServer({
  server: {
    middlewareMode: {
      server: parentServer,
    },
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})

parentServer.use(vite.middlewares)
```

### ViteDevServer Interface

```typescript
interface ViteDevServer {
  config: ResolvedConfig
  middlewares: Connect.Server
  httpServer: http.Server | null
  watcher: FSWatcher
  ws: WebSocketServer
  pluginContainer: PluginContainer
  moduleGraph: ModuleGraph
  resolvedUrls: ResolvedServerUrls | null
  
  transformRequest(url: string, options?: TransformOptions): Promise<TransformResult | null>
  transformIndexHtml(url: string, html: string, originalUrl?: string): Promise<string>
  ssrLoadModule(url: string, options?: { fixStacktrace?: boolean }): Promise<Record<string, any>>
  ssrFixStacktrace(e: Error): void
  reloadModule(module: ModuleNode): Promise<void>
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>
  restart(forceOptimize?: boolean): Promise<void>
  close(): Promise<void>
  bindCLIShortcuts(options?: BindCLIShortcutsOptions<ViteDevServer>): void
  waitForRequestsIdle(ignoredId?: string): Promise<void>
}
```

---

## Environment and Modes

### Environment Variables

```typescript
// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### Mode-Specific Configuration

```bash
# .env.testing
NODE_ENV=development
```

```bash
# Build with specific mode
NODE_ENV=development vite build --mode development
```

### Multi-Environment Configuration

```typescript
interface UserConfig extends EnvironmentOptions {
  environments: Record<string, EnvironmentOptions>
}

interface EnvironmentOptions {
  define?: Record<string, any>
  resolve?: EnvironmentResolveOptions
  optimizeDeps: DepOptimizationOptions
  consumer?: 'client' | 'server'
  dev: DevOptions
  build: BuildOptions
}
```

---

## TypeScript Integration

### ESLint Configuration for React + TypeScript

```javascript
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      // Or for stricter rules:
      ...tseslint.configs.strictTypeChecked,
      // Optionally for stylistic rules:
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

### TypeScript Performance Options

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "types": ["vite/client"]
  }
}
```

---

## API Reference

### Build Function

```typescript
async function build(
  inlineConfig?: InlineConfig,
): Promise<RollupOutput | RollupOutput[]>
```

### ResolveConfig Function

```typescript
async function resolveConfig(
  inlineConfig: InlineConfig,
  command: 'build' | 'serve',
  defaultMode = 'development',
  defaultNodeEnv = 'development',
  isPreview = false,
): Promise<ResolvedConfig>
```

### LoadConfigFromFile Function

```typescript
async function loadConfigFromFile(
  configEnv: ConfigEnv,
  configFile?: string,
  configRoot: string = process.cwd(),
  logLevel?: LogLevel,
  customLogger?: Logger,
): Promise<{
  path: string
  config: UserConfig
  dependencies: string[]
} | null>
```

### MergeConfig Function

```typescript
function mergeConfig(
  defaults: Record<string, any>,
  overrides: Record<string, any>,
  isRoot = true,
): Record<string, any>
```

---

## React Integration

### React Refresh Preamble (for backend integration)

```html
<script type="module">
  import RefreshRuntime from 'http://localhost:5173/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>
```

### JSX Configuration

```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsxInject: "import React from 'react'",
  },
})
```

### React ESLint Plugins

```javascript
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
  },
])
```

---

## Performance Best Practices

1. **Use TypeScript `moduleResolution: "bundler"`** for better performance
2. **Enable `allowImportingTsExtensions`** when using TypeScript
3. **Use `esbuild` for minification** (default) - 20-40x faster than terser
4. **Configure asset inlining threshold** to balance HTTP requests vs bundle size
5. **Use Lightning CSS** for faster CSS processing when possible

---

## Additional Resources

- Trust Score: 8.3/10
- Code Snippets Available: 654
- Source: Vite Official Documentation (vitejs/vite)