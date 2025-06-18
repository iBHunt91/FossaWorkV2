import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { Button, ButtonProps } from "./button"
import { cva, type VariantProps } from "class-variance-authority"

// Responsive button with mobile-optimized touch targets
const responsiveButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] px-4 py-2",
        sm: "min-h-[36px] px-3 py-1.5 text-xs",
        lg: "min-h-[52px] px-6 py-3 text-base",
        icon: "h-[44px] w-[44px]",
        mobile: "min-h-[48px] px-5 py-3 text-base", // Mobile-optimized size
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  }
)

export interface ResponsiveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof responsiveButtonVariants> {
  asChild?: boolean
}

export const ResponsiveButton = React.forwardRef<HTMLButtonElement, ResponsiveButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(responsiveButtonVariants({ variant, size, fullWidth, className }))}
        {...props}
      />
    )
  }
)
ResponsiveButton.displayName = "ResponsiveButton"

// Responsive form field wrapper
interface FormFieldProps {
  label?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  children,
  className
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {children}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  )
}

// Responsive input with mobile-optimized sizing
export const ResponsiveInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <Input
      type={type}
      className={cn(
        "min-h-[44px] px-3 py-2 text-base sm:text-sm sm:min-h-[36px]",
        "touch-manipulation",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
ResponsiveInput.displayName = "ResponsiveInput"

// Responsive textarea with mobile-optimized sizing
export const ResponsiveTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <Textarea
      className={cn(
        "min-h-[88px] px-3 py-2 text-base sm:text-sm",
        "touch-manipulation resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
ResponsiveTextarea.displayName = "ResponsiveTextarea"

// Responsive form layout
interface FormLayoutProps {
  children: React.ReactNode
  className?: string
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
}

export const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  className,
  onSubmit
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("space-y-4 sm:space-y-6", className)}
    >
      {children}
    </form>
  )
}

// Mobile-friendly checkbox
interface ResponsiveCheckboxProps {
  id?: string
  label: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

export const ResponsiveCheckbox: React.FC<ResponsiveCheckboxProps> = ({
  id,
  label,
  checked,
  onCheckedChange,
  className
}) => {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        "min-h-[44px] py-2 px-1 -mx-1",
        "hover:bg-accent/50 rounded-md transition-colors",
        "touch-manipulation select-none",
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
      />
      <span className="text-sm sm:text-base flex-1">{label}</span>
    </label>
  )
}

// Mobile-friendly radio group
interface ResponsiveRadioOption {
  value: string
  label: string
}

interface ResponsiveRadioGroupProps {
  name: string
  options: ResponsiveRadioOption[]
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export const ResponsiveRadioGroup: React.FC<ResponsiveRadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  className
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-center gap-3 cursor-pointer",
            "min-h-[44px] py-2 px-3 -mx-3",
            "hover:bg-accent/50 rounded-md transition-colors",
            "touch-manipulation select-none"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-5 w-5 border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm sm:text-base flex-1">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

// Form actions container with responsive spacing
interface FormActionsProps {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right' | 'between'
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  className,
  align = 'right'
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  }

  return (
    <div className={cn(
      "flex flex-col-reverse sm:flex-row gap-3 sm:gap-4",
      "pt-4 sm:pt-6",
      alignClasses[align],
      className
    )}>
      {children}
    </div>
  )
}

// Mobile-friendly select dropdown (placeholder - would need a proper implementation)
export const ResponsiveSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full min-h-[44px] px-3 py-2",
        "text-base sm:text-sm",
        "rounded-md border border-input bg-background",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "touch-manipulation",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
ResponsiveSelect.displayName = "ResponsiveSelect"