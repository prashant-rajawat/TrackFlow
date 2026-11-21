import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightAction,
      type = 'text',
      id,
      className = '',
      required,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? `input_${label.toLowerCase().replace(/\s+/g, '_')}` : undefined);
    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-rose-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={computedType}
            required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={`w-full h-10 px-3.5 text-sm rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 ${
              leftIcon ? 'pl-10' : ''
            } ${isPassword || rightAction ? 'pr-10' : ''} ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-slate-800 focus:ring-slate-900/10'
            } ${className}`}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}

          {!isPassword && rightAction && (
            <div className="absolute right-3 flex items-center">{rightAction}</div>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="mt-1.5 text-xs text-rose-600 flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
