import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User as UserIcon, Mail, Lock, AlertCircle, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Live password strength calculation
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const validate = () => {
    const errors: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (!hasMinLength || !hasLetter || !hasNumber) {
      errors.password = 'Password does not meet the security requirements';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      addToast('Your account was created successfully! Welcome to TrackFlow.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.errors && err.errors.length > 0) {
        const errorMap: Record<string, string> = {};
        err.errors.forEach((e: { field: string; message: string }) => {
          errorMap[e.field] = e.message;
        });
        setFieldErrors(errorMap);
      } else {
        setFormError(err.message || 'Failed to create your account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            T
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            TrackFlow
          </span>
        </div>

        <h1 className="text-center text-xl font-bold text-slate-900">
          Create your TrackFlow account
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          Start tracking bugs, tasks, and issues with your engineering team
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-8 rounded-2xl border border-slate-200 shadow-xs">
          {formError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              required
              placeholder="e.g. Sarah Connor"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName)
                  setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              error={fieldErrors.fullName}
              leftIcon={<UserIcon className="w-4 h-4" />}
            />

            <Input
              label="Work Email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email)
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              error={fieldErrors.email}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password)
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={fieldErrors.password}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Live Password Requirements checklist */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                {hasMinLength ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  At least 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasLetter ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={hasLetter ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Contains at least one letter
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasNumber ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className={hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  Contains at least one number
                </span>
              </div>
            </div>

            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword)
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              error={fieldErrors.confirmPassword}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {confirmPassword.length > 0 && (
              <p className="text-xs flex items-center gap-1.5">
                {passwordsMatch ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Passwords do not match yet
                  </span>
                )}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Create Account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-slate-900 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
