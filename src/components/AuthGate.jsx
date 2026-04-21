import { LockKeyhole, ShieldCheck, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { loginSchema, validateForm } from '../lib/validation';

export default function AuthGate({ isHydrating, isSubmitting, error, onSubmit }) {
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    const validation = validateForm(loginSchema, credentials);

    if (!validation.success) {
      setValidationErrors(validation.errors);
      return;
    }

    setValidationErrors({});
    await onSubmit(validation.data);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="panel-card relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-brandBlue/15 via-brandSun/15 to-brandBlue/10" />
        <div className="relative flex flex-col gap-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-brandBlue/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brandBlue dark:bg-brandBlue/20 dark:text-cyan-200">
              Secure Clinical Workspace
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight text-brandInk dark:text-white">
              SymptomSense
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Production-grade symptom triage for deterministic ranking, risk-aware red-flag
              detection, and server-side AI insight generation.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Protected Sessions',
                description: 'JWT-backed access with encrypted browser persistence.',
              },
              {
                icon: Stethoscope,
                title: 'Explainable Analysis',
                description: 'Weighted evidence, confidence scoring, and red-flag rationale.',
              },
              {
                icon: LockKeyhole,
                title: 'Backend-Only Secrets',
                description: 'All external AI provider calls are isolated behind the API.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
              >
                <item.icon className="mb-4 h-6 w-6 text-brandBlue dark:text-cyan-300" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
              Sign In
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
              Access the triage console
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Authenticate with the credentials configured in your backend `.env` file to begin a
              secure analysis session.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="label-text" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                className="input-shell"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="clinician@symptomsense.local"
              />
              {validationErrors.email ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-300">{validationErrors.email}</p>
              ) : null}
            </div>

            <div>
              <label className="label-text" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className="input-shell"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter your configured password"
              />
              {validationErrors.password ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                  {validationErrors.password}
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isHydrating || isSubmitting}
              className="primary-button w-full"
            >
              {isHydrating ? 'Restoring session...' : isSubmitting ? 'Signing in...' : 'Start Secure Session'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
