import React, { useState, useEffect } from 'react'
import { Check, X, AlertCircle, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Badge } from './badge'
import { cn } from '../../lib/utils'

interface EnhancedInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  type?: 'text' | 'password' | 'email' | 'number' | 'url' | 'time'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  loading?: boolean
  success?: boolean
  error?: string | boolean
  helpText?: string
  validation?: string[]
  showCopyButton?: boolean
  showToggleVisibility?: boolean
  leftIcon?: React.ElementType
  rightIcon?: React.ElementType
  className?: string
}

const validationRules = {
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? null : 'Please enter a valid email address'
  },
  required: (value: string) => {
    return value.trim() ? null : 'This field is required'
  },
  url: (value: string) => {
    try {
      new URL(value)
      return null
    } catch {
      return 'Please enter a valid URL'
    }
  },
  port: (value: string) => {
    const port = parseInt(value)
    return (port >= 1 && port <= 65535) ? null : 'Port must be between 1 and 65535'
  },
  timeout: (value: string) => {
    const num = parseInt(value)
    return (num >= 5000 && num <= 60000) ? null : 'Timeout must be between 5000 and 60000 ms'
  },
  pushover_key: (value: string) => {
    return value.length === 30 ? null : 'Must be exactly 30 characters'
  }
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  loading = false,
  success = false,
  error,
  helpText,
  validation = [],
  showCopyButton = false,
  showToggleVisibility = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className
}) => {
  const [touched, setTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const actualType = type === 'password' && showPassword ? 'text' : type

  // Validate on value change
  useEffect(() => {
    if (touched && validation.length > 0) {
      for (const rule of validation) {
        const validationFunc = validationRules[rule as keyof typeof validationRules]
        if (validationFunc) {
          const error = validationFunc(value)
          if (error) {
            setValidationError(error)
            return
          }
        }
      }
      setValidationError(null)
    }
  }, [value, touched, validation])

  const handleBlur = () => {
    setTouched(true)
    onBlur?.()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const displayError = error === true ? validationError : (typeof error === 'string' ? error : validationError)
  const hasError = !!displayError && touched
  const isValid = touched && value && !hasError && success

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <Label 
          htmlFor={label.toLowerCase().replace(/\s+/g, '-')}
          className={cn(
            "text-sm font-medium transition-colors",
            hasError && "text-destructive",
            isValid && "text-green-600 dark:text-green-400"
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        {/* Status indicators */}
        <div className="flex items-center gap-1">
          {loading && (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
          {isValid && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Check className="w-3 h-3 mr-1" />
              Valid
            </Badge>
          )}
          {hasError && (
            <Badge variant="destructive" className="h-5 px-1.5 text-xs">
              <X className="w-3 h-3 mr-1" />
              Error
            </Badge>
          )}
        </div>
      </div>

      {/* Input Container */}
      <div className="relative">
        {/* Left Icon */}
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}

        {/* Input */}
        <Input
          id={label.toLowerCase().replace(/\s+/g, '-')}
          type={actualType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={cn(
            "transition-all duration-200",
            LeftIcon && "pl-10",
            (showCopyButton || showToggleVisibility || RightIcon) && "pr-20",
            hasError && "border-destructive focus:border-destructive ring-destructive",
            isValid && "border-green-500 focus:border-green-500 ring-green-500",
            loading && "opacity-50"
          )}
        />

        {/* Right Actions */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {/* Copy Button */}
          {showCopyButton && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>
          )}

          {/* Toggle Visibility */}
          {showToggleVisibility && type === 'password' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Eye className="w-3 h-3 text-muted-foreground" />
              )}
            </Button>
          )}

          {/* Right Icon */}
          {RightIcon && (
            <div className="text-muted-foreground">
              <RightIcon className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Help Text & Error */}
      <div className="space-y-1">
        {helpText && !hasError && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
        {hasError && (
          <div className="flex items-center gap-1 text-xs text-destructive animate-in slide-in-from-left-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface FormSectionProps {
  title: string
  description?: string
  icon?: React.ElementType
  children: React.ReactNode
  className?: string
  loading?: boolean
  error?: string | null
  actions?: React.ReactNode
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  icon: Icon,
  children,
  className,
  loading = false,
  error,
  actions
}) => {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-6 space-y-6 transition-all duration-200",
      loading && "opacity-75",
      error && "border-destructive/50 bg-destructive/5",
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-primary" />}
            <h3 className="text-lg font-semibold">{title}</h3>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className={cn("space-y-4", loading && "pointer-events-none")}>
        {children}
      </div>
    </div>
  )
}

interface ActionButtonGroupProps {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center' | 'between'
  className?: string
}

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  children,
  align = 'left',
  className
}) => {
  const alignmentClasses = {
    left: 'justify-start',
    right: 'justify-end',
    center: 'justify-center',
    between: 'justify-between'
  }

  return (
    <div className={cn(
      "flex items-center gap-3 pt-4 border-t",
      alignmentClasses[align],
      className
    )}>
      {children}
    </div>
  )
}