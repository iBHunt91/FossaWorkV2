# TailwindCSS Documentation Reference

This documentation was fetched from Context7 for the TailwindCSS library (`/tailwindlabs/tailwindcss.com`).

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Configuration](#configuration)
3. [Utility Classes](#utility-classes)
4. [Responsive Design](#responsive-design)
5. [Dark Mode](#dark-mode)
6. [Custom Styles](#custom-styles)
7. [Plugins](#plugins)
8. [Component Patterns](#component-patterns)
9. [Tailwind CSS v4](#tailwind-css-v4)

---

## Core Concepts

### Utility-First Approach

Tailwind CSS uses a utility-first approach to styling, providing low-level utility classes that you compose to build custom designs:

```html
<div class="mx-auto max-w-sm rounded-xl bg-white p-6 shadow-lg">
  <div class="text-xl font-medium text-black">ChitChat</div>
  <p class="text-gray-500">You have a new message!</p>
</div>
```

### Utility Composition

```html
<!-- Combining multiple utilities -->
<button class="rounded-full border border-purple-200 px-4 py-1 text-sm font-semibold text-purple-600 hover:border-transparent hover:bg-purple-600 hover:text-white active:bg-purple-700">
  Message
</button>
```

---

## Configuration

### Basic Configuration (v3)

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        'custom-blue': '#1e40af',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'display': ['Satoshi', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### PostCSS Configuration

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}
```

### Vite Configuration (v4)

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()]
});
```

---

## Utility Classes

### Layout

```html
<!-- Container -->
<div class="container mx-auto px-4">

<!-- Flexbox -->
<div class="flex items-center justify-between gap-4">

<!-- Grid -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- Spacing -->
<div class="p-4 m-2 px-6 py-8">
```

### Typography

```html
<!-- Font Size & Weight -->
<h1 class="text-4xl font-bold">Heading</h1>
<p class="text-base font-medium">Body text</p>

<!-- Text Color -->
<p class="text-gray-900 dark:text-white">Adaptive text</p>

<!-- Line Height & Letter Spacing -->
<p class="leading-relaxed tracking-wide">Spaced text</p>
```

### Colors & Backgrounds

```html
<!-- Background Colors -->
<div class="bg-white dark:bg-gray-800">

<!-- Gradients -->
<div class="bg-gradient-to-r from-purple-500 to-pink-500">

<!-- Border Colors -->
<div class="border border-gray-300">
```

### Effects & Filters

```html
<!-- Shadows -->
<div class="shadow-lg">

<!-- Opacity -->
<div class="opacity-75 hover:opacity-100">

<!-- Filters -->
<img class="blur-sm grayscale hover:grayscale-0">

<!-- Brightness -->
<img class="brightness-110 hover:brightness-150">
```

---

## Responsive Design

### Breakpoint Prefixes

```html
<!-- Default breakpoints -->
<!-- sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px -->

<!-- Mobile-first responsive design -->
<div class="w-full sm:w-1/2 md:w-1/3 lg:w-1/4">

<!-- Responsive text -->
<p class="text-sm sm:text-base lg:text-lg">

<!-- Responsive display -->
<div class="hidden sm:block lg:flex">
```

### Container Queries

```html
<!-- Using @container queries (with plugin) -->
<div class="@container">
  <div class="@sm:flex @sm:items-center">
    <!-- Content -->
  </div>
</div>
```

### Breakpoint Ranges

```html
<!-- Apply styles only between md and xl -->
<div class="md:max-xl:flex">
  <!-- ... -->
</div>
```

---

## Dark Mode

### Media Query Strategy (Default)

```html
<!-- Automatic dark mode based on system preference -->
<div class="bg-white dark:bg-gray-800">
  <h1 class="text-gray-900 dark:text-white">Dark mode text</h1>
  <p class="text-gray-500 dark:text-gray-400">Secondary text</p>
</div>
```

### Class Strategy

```css
/* CSS configuration */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```html
<!-- Toggle dark mode with class -->
<html class="dark">
  <body>
    <div class="bg-white dark:bg-black">
      <!-- Content -->
    </div>
  </body>
</html>
```

### Data Attribute Strategy

```css
/* CSS configuration */
@import "tailwindcss";
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

```html
<!-- Toggle dark mode with data attribute -->
<html data-theme="dark">
  <body>
    <div class="bg-white dark:bg-black">
      <!-- Content -->
    </div>
  </body>
</html>
```

### JavaScript Theme Toggle

```javascript
// Three-way toggle: light, dark, system
document.documentElement.classList.toggle(
  "dark",
  localStorage.theme === "dark" ||
    (!("theme" in localStorage) && 
     window.matchMedia("(prefers-color-scheme: dark)").matches)
);

// Set themes
localStorage.theme = "light";  // Force light
localStorage.theme = "dark";   // Force dark
localStorage.removeItem("theme"); // Use system
```

---

## Custom Styles

### Adding Component Classes

```css
@layer components {
  .card {
    @apply bg-white rounded-lg p-6 shadow-xl;
  }
  
  .btn {
    @apply px-4 py-2 rounded font-semibold;
  }
}
```

### Adding Custom Utilities

```css
/* Simple utility */
@utility content-auto {
  content-visibility: auto;
}

/* Complex utility with nesting */
@utility scrollbar-hidden {
  &::-webkit-scrollbar {
    display: none;
  }
}
```

### Using CSS Variables

```jsx
// Dynamic theming with CSS variables
export function BrandedButton({ buttonColor, textColor, children }) {
  return (
    <button
      style={{
        "--bg-color": buttonColor,
        "--text-color": textColor,
      }}
      className="bg-(--bg-color) text-(--text-color) hover:opacity-90"
    >
      {children}
    </button>
  );
}
```

---

## Plugins

### Official Plugins

```javascript
// tailwind.config.js
module.exports = {
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/container-queries'),
  ]
}
```

### Plugin Examples

#### Forms Plugin
```javascript
plugins: [require("@tailwindcss/forms")]
```

```html
<!-- Automatically styled form elements -->
<input type="text" class="rounded-md border-gray-300">
<select class="rounded-md border-gray-300">
  <option>Option 1</option>
</select>
```

#### Typography Plugin
```html
<article class="prose lg:prose-lg">
  <h1>Article Title</h1>
  <p>Article content with beautiful typography...</p>
</article>
```

### Creating Custom Plugins

```javascript
// Custom plugin example
plugin(function({ addComponents, addUtilities, theme }) {
  // Add component with variants
  addComponents({
    '.card': {
      backgroundColor: theme('colors.white'),
      borderRadius: theme('borderRadius.lg'),
      padding: theme('spacing.6'),
      boxShadow: theme('boxShadow.xl'),
    }
  }, {
    variants: ['responsive', 'hover']
  })
  
  // Add utilities
  addUtilities({
    '.content-auto': {
      contentVisibility: 'auto'
    }
  })
})
```

---

## Component Patterns

### Card Component

```html
<div class="mx-auto max-w-sm space-y-2 rounded-xl bg-white px-8 py-8 shadow-lg">
  <img class="mx-auto block h-24 rounded-full" src="avatar.jpg" alt="">
  <div class="space-y-2 text-center">
    <div class="space-y-0.5">
      <p class="text-lg font-semibold text-black">Erin Lindford</p>
      <p class="font-medium text-gray-500">Product Engineer</p>
    </div>
    <button class="rounded-full border border-purple-200 px-4 py-1 text-sm font-semibold text-purple-600 hover:border-transparent hover:bg-purple-600 hover:text-white">
      Message
    </button>
  </div>
</div>
```

### Responsive Card with Dark Mode

```html
<div class="mx-auto max-w-sm rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
  <div class="flex items-center gap-x-4">
    <img class="size-12 shrink-0" src="logo.svg" alt="">
    <div>
      <div class="text-xl font-medium text-black dark:text-white">
        ChitChat
      </div>
      <p class="text-gray-500 dark:text-gray-400">
        You have a new message!
      </p>
    </div>
  </div>
</div>
```

---

## Tailwind CSS v4

### New Import Syntax

```css
/* app.css */
@import "tailwindcss";

/* With prefix */
@import "tailwindcss" prefix(tw);
```

### CSS-Based Configuration

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(71.7% 0.25 360);
  --color-secondary: oklch(91.5% 0.258 129);
  
  --font-sans: "Inter", sans-serif;
  --font-display: "Satoshi", sans-serif;
  
  --breakpoint-3xl: 120rem;
}
```

### PostCSS Plugin (v4)

```javascript
// postcss.config.js
export default {
  plugins: ["@tailwindcss/postcss"]
};
```

### Migration from v3 to v4

```css
/* v3 - @layer components */
@layer components {
  .btn {
    @apply px-4 py-2 rounded;
  }
}

/* v4 - @utility */
@utility btn {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
}
```

---

## Best Practices

1. **Use Semantic HTML**: Start with proper HTML structure
2. **Mobile-First**: Design for mobile, then add responsive modifiers
3. **Extract Components**: Create reusable component classes for repeated patterns
4. **Consistent Spacing**: Use Tailwind's spacing scale consistently
5. **Dark Mode Planning**: Design with dark mode in mind from the start
6. **Performance**: Use PurgeCSS/JIT mode to remove unused styles
7. **Custom Values**: Use arbitrary values sparingly, prefer extending theme

---

## Additional Resources

- Trust Score: 8/10
- Code Snippets Available: 2078
- Source: TailwindCSS Official Documentation (tailwindlabs/tailwindcss.com)