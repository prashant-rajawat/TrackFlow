import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Info, Sparkles, Eye, EyeOff, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotPasswordModalOpen, setForgotPasswordModalOpen] = useState(false);

  // Lockout / Countdown state
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (lockoutRemainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemainingSeconds]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemainingSeconds > 0) return;
    setFormError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      addToast('Login successful! Welcome back. You are now logged in.', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.status === 429 || err.code === 'LOGIN_TEMPORARILY_LOCKED') {
        const retryAfter = err.retryAfterSeconds || 300;
        setLockoutRemainingSeconds(retryAfter);
        setFormError('Too many failed login attempts. Please try again after the countdown expires.');
      } else if (err.status === 503 || (err.message && err.message.includes('Database'))) {
        setFormError('Login is temporarily unavailable because the server cannot connect to the database. Please try again later.');
      } else if (err.status === 401) {
        setFormError('Invalid email or password. Please check your details and try again.');
      } else if (err.message && err.message.includes('Network error')) {
        setFormError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setFormError(err.message || 'Something went wrong while logging in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const devDemoEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
  const devDemoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
  const showDevFill =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEMO_FILL === 'true' &&
    Boolean(devDemoEmail) &&
    Boolean(devDemoPassword);

  const handleFillDemo = () => {
    if (!showDevFill || !devDemoEmail || !devDemoPassword) return;
    setEmail(devDemoEmail);
    setPassword(devDemoPassword);
    setFieldErrors({});
    setFormError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            T
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            TrackFlow
          </span>
        </div>

        <h1 className="text-center text-xl font-bold text-slate-900">
          Sign in to your account
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          Enter your credentials to access your workspaces and issues
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

          {lockoutRemainingSeconds > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-2 animate-in fade-in">
              <div className="flex items-center justify-center gap-1.5 font-bold text-sm text-amber-900">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Login temporarily locked</span>
              </div>
              <p className="text-xs text-amber-700">
                You have reached the maximum of 5 failed login attempts. Please wait before trying again.
              </p>
              <div className="text-2xl font-mono font-bold tracking-wider text-amber-900 pt-1">
                {formatCountdown(lockoutRemainingSeconds)}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Work Email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              error={fieldErrors.email}
              leftIcon={<Mail className="w-4 h-4" />}
              disabled={lockoutRemainingSeconds > 0}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">Password</span>
                <button
                  type="button"
                  onClick={() => setForgotPasswordModalOpen(true)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  error={fieldErrors.password}
                  leftIcon={<Lock className="w-4 h-4" />}
                  disabled={lockoutRemainingSeconds > 0}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isSubmitting}
              disabled={lockoutRemainingSeconds > 0 || isSubmitting}
            >
              {lockoutRemainingSeconds > 0 ? 'Locked Out' : 'Sign in to TrackFlow'}
            </Button>
          </form>

          {showDevFill && lockoutRemainingSeconds === 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full text-xs text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Fill reviewer credentials (Development only)</span>
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account yet?{' '}
          <Link
            to="/register"
            className="font-semibold text-slate-900 hover:underline transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>

      {forgotPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Password Reset Information
                </h3>
                <p className="text-xs text-slate-500">Notice for Reviewers & Admins</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              In accordance with security standards, password reset emails require an external transactional email provider (such as SendGrid or AWS SES) to be configured in your environment.
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-6">
              To test the authentication lifecycle now, you can register a new account or sign in using any valid credentials registered in your database.
            </p>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setForgotPasswordModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
