# FossaWork V2 Styling Guide

## Overview

FossaWork V2 uses a modern styling architecture built on **Tailwind CSS v4** and **Shadcn/ui** components. This guide provides comprehensive instructions for developers working with the styling system.

## Technology Stack

- **Tailwind CSS v4**: Utility-first CSS framework with new `@theme` directive syntax
- **Shadcn/ui**: Copy-paste component library built on Radix UI primitives
- **Radix UI**: Accessible, unstyled component primitives
- **Lucide React**: Consistent icon library
- **Class Variance Authority (CVA)**: Component variant management
- **Tailwind Merge**: Intelligent class merging utility

## Quick Start

### 1. Using Existing Components

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Order Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge variant="default">In Progress</Badge>
          <Button size="sm">View Details</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. Adding New Shadcn/ui Components

```bash
# Install new components
npx shadcn@canary add dialog dropdown-menu sheet

# Available components: button, card, input, label, textarea, badge, 
# table, progress, alert, dialog, dropdown-menu, sheet, checkbox, 
# select, separator, skeleton, toast, tooltip, and more
```

### 3. Custom Styling with Tailwind Classes

```tsx
// Use Tailwind utility classes directly
<div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
  <h3 className="text-primary-900 font-semibold mb-2">Fuel Dispenser Status</h3>
  <p className="text-primary-700">Ready for automation</p>
</div>
```

## Design System

### Color Palette

#### Primary Colors (Blue Scale)
- `primary-50` to `primary-900`: Main brand colors
- Used for: Primary actions, links, focus states, brand elements

#### Neutral Colors (Slate Scale)  
- `slate-50` to `slate-900`: Grayscale palette
- Used for: Text, borders, backgrounds, subtle elements

#### Semantic Colors
- `background`: Main page background
- `foreground`: Primary text color
- `card`: Card/panel background
- `border`: Border color
- `primary`: Primary action color
- `secondary`: Secondary action color
- `destructive`: Error/danger color
- `muted`: Muted text/elements

### Typography

```tsx
// Headings
<h1 className="text-4xl font-bold">Page Title</h1>
<h2 className="text-3xl font-semibold">Section Title</h2>
<h3 className="text-2xl font-semibold">Subsection Title</h3>
<h4 className="text-xl font-medium">Component Title</h4>

// Body Text
<p className="text-base">Regular paragraph text</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<p className="text-xs text-muted-foreground">Caption text</p>
```

### Spacing & Layout

```tsx
// Consistent spacing scale (0.25rem increments)
<div className="p-4">       {/* 1rem padding */}
<div className="m-6">       {/* 1.5rem margin */}
<div className="space-y-4"> {/* 1rem vertical spacing between children */}
<div className="gap-3">     {/* 0.75rem gap in flex/grid */}

// Layout patterns
<div className="container mx-auto px-6"> {/* Centered container */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Responsive grid */}
```

## Component Usage Guidelines

### 1. Buttons

```tsx
import { Button } from '@/components/ui/button';

// Variants
<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="ghost">Ghost Button</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon className="h-4 w-4" /></Button>
```

### 2. Cards

```tsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Work Order #2024-001</CardTitle>
    <CardDescription>Station A - Downtown Location</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>Take Action</Button>
  </CardFooter>
</Card>
```

### 3. Forms

```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">Email Address</Label>
    <Input id="email" type="email" placeholder="Enter email..." />
  </div>
  <div className="space-y-2">
    <Label htmlFor="notes">Notes</Label>
    <Textarea id="notes" placeholder="Additional notes..." />
  </div>
</div>
```

### 4. Status Indicators

```tsx
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Status badges
<Badge variant="default">In Progress</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge className="bg-green-100 text-green-800">Completed</Badge>

// Progress indicators
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Progress</span>
    <span>75%</span>
  </div>
  <Progress value={75} />
</div>
```

### 5. Data Tables

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Work Order</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Progress</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>WO-2024-001</TableCell>
      <TableCell><Badge>In Progress</Badge></TableCell>
      <TableCell><Progress value={75} className="w-20" /></TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Custom Component Development

### 1. Using the `cn` Utility

```tsx
import { cn } from '@/lib/utils';

function CustomComponent({ className, variant, ...props }) {
  return (
    <div 
      className={cn(
        // Base styles
        "rounded-lg border p-4",
        // Conditional styles
        variant === "success" && "bg-green-50 border-green-200",
        variant === "error" && "bg-red-50 border-red-200",
        // Additional classes
        className
      )}
      {...props}
    />
  );
}
```

### 2. Creating Variant-Based Components

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  "rounded-lg border p-4", // base styles
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        success: "bg-green-50 text-green-900 border-green-200",
        warning: "bg-amber-50 text-amber-900 border-amber-200",
        destructive: "bg-red-50 text-red-900 border-red-200",
      },
      size: {
        sm: "p-3 text-sm",
        default: "p-4",
        lg: "p-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

function Alert({ className, variant, size, ...props }: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant, size }), className)} {...props} />
  );
}
```

## Migration from Legacy CSS

### 1. Replace Custom CSS Classes

```tsx
// Old approach
<div className="card clickable">
  <div className="work-order-header">
    <h3 className="work-order-title">Title</h3>
    <span className="status-badge pending">Pending</span>
  </div>
</div>

// New approach
<Card className="cursor-pointer hover:shadow-md transition-all">
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>Title</CardTitle>
      <Badge variant="secondary">Pending</Badge>
    </div>
  </CardHeader>
</Card>
```

### 2. Update Color References

```tsx
// Old
<div className="bg-primary-600 text-white">

// New (same result, but using semantic tokens)
<div className="bg-primary text-primary-foreground">
```

## Best Practices

### 1. Component Composition

```tsx
// Good - Compose small, reusable components
function WorkOrderCard({ workOrder }) {
  return (
    <Card>
      <CardHeader>
        <WorkOrderHeader workOrder={workOrder} />
      </CardHeader>
      <CardContent>
        <WorkOrderProgress progress={workOrder.progress} />
        <WorkOrderDetails details={workOrder.details} />
      </CardContent>
      <CardFooter>
        <WorkOrderActions workOrder={workOrder} />
      </CardFooter>
    </Card>
  );
}
```

### 2. Consistent Spacing

```tsx
// Use consistent spacing scale
<div className="space-y-4">  {/* Consistent vertical spacing */}
  <div className="space-y-2">  {/* Smaller spacing for related elements */}
    <Label>Title</Label>
    <Input />
  </div>
  <div className="space-y-2">
    <Label>Description</Label>
    <Textarea />
  </div>
</div>
```

### 3. Responsive Design

```tsx
// Mobile-first responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards automatically stack on mobile, 2 cols on tablet, 3 on desktop */}
</div>

<div className="text-sm md:text-base lg:text-lg">
  {/* Responsive typography */}
</div>
```

### 4. Accessibility

```tsx
// Use semantic HTML and ARIA attributes
<Button
  aria-label="Delete work order"
  variant="destructive"
  size="sm"
>
  <Trash2 className="h-4 w-4" />
</Button>

// Proper form labeling
<div className="space-y-2">
  <Label htmlFor="workOrderId">Work Order ID</Label>
  <Input 
    id="workOrderId" 
    aria-describedby="workOrderId-help"
    required
  />
  <p id="workOrderId-help" className="text-xs text-muted-foreground">
    Enter the 10-digit work order identifier
  </p>
</div>
```

## Configuration Files

### Tailwind Config (`tailwind.config.js`)
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { /* Custom primary colors */ },
        slate: { /* Custom neutral colors */ },
      },
      fontFamily: {
        sans: [/* Custom font stack */],
      },
    },
  },
  plugins: [],
}
```

### Shadcn/ui Config (`components.json`)
```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Development Workflow

### 1. Adding New Features
1. Check if existing Shadcn/ui components meet your needs
2. If not, install additional components: `npx shadcn@canary add [component]`
3. Compose components using the `cn` utility for custom styling
4. Test responsive behavior across breakpoints
5. Verify accessibility with screen readers

### 2. Customizing Existing Components
1. Never modify files in `src/components/ui/` directly
2. Create wrapper components that extend base components
3. Use the `cn` utility to merge classes safely
4. Follow the variant pattern for reusable customizations

### 3. Performance Considerations
- Tailwind CSS automatically purges unused styles in production
- Use dynamic classes sparingly (prefer variants when possible)
- Bundle size is optimized through tree-shaking and CSS optimization

## Troubleshooting

### Common Issues

1. **Classes not applying**: Check if Tailwind is processing the file (verify `content` array in config)
2. **TypeScript errors**: Ensure `@/` path alias is configured in `tsconfig.json` and `vite.config.ts`
3. **Component not found**: Verify component is installed: `npx shadcn@canary add [component]`
4. **Styling conflicts**: Use `cn` utility to merge classes properly
5. **Build errors**: Check for Tailwind v4 syntax compatibility

### Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/)
- [Shadcn/ui Component Library](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)

## Examples

See `src/pages/DesignSystem.tsx` for comprehensive examples of all components and patterns in use.