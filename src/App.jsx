import {
  Activity,
  AlertTriangle,
  ClipboardPlus,
  LogOut,
  Pill,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Suspense, lazy, startTransition, useEffect, useEffectEvent, useState } from 'react';
import AuthGate from './components/AuthGate';
import DarkModeToggle from './components/DarkModeToggle';
import ReminderBanner from './components/ReminderBanner';
import { useAuthSession } from './hooks/useAuthSession';
import { useTheme } from './hooks/useTheme';
import { symptomSelectionSchema } from './lib/validation';
import { analyzeSymptoms, getSymptomCatalog } from './services/analysisService';
import {
  createMedication,
  deleteMedication as deleteMedicationSchedule,
  getMedications,
  triggerReminderCheck,
} from './services/medicationService';
import { secureStorage } from './services/secureStorage';

const MedicationForm = lazy(() => import('./components/MedicationForm'));
const MedicationList = lazy(() => import('./components/MedicationList'));
const PatientInfoForm = lazy(() => import('./components/PatientInfoForm'));
const ResultsPanel = lazy(() => import('./components/ResultsPanel'));
const SymptomSelector = lazy(() => import('./components/SymptomSelector'));

const DISCLAIMER_STORAGE_KEY = 'disclaimer';
const REMINDER_POLL_INTERVAL_MS = 60 * 1000;

const steps = [
  { id: 1, label: 'Patient Profile' },
  { id: 2, label: 'Symptoms' },
  { id: 3, label: 'Results' },
];

const suspenseFallback = (
  <div className="rounded-3xl border border-slate-200/80 bg-white/80 px-6 py-8 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
    Loading workflow component...
  </div>
);

const initialMedicationState = {
  loading: false,
  submitting: false,
  checkingReminders: false,
  deletingMedicationId: null,
  error: null,
  reminderError: null,
  lastCheckedAt: null,
};

function sortMedicationSchedules(medications) {
  return [...medications].sort((left, right) => {
    if (!left.nextDueAt && !right.nextDueAt) {
      return left.name.localeCompare(right.name);
    }

    if (!left.nextDueAt) {
      return 1;
    }

    if (!right.nextDueAt) {
      return -1;
    }

    return left.nextDueAt.localeCompare(right.nextDueAt);
  });
}

function mergeReminderQueue(currentReminders, nextReminders) {
  const reminderMap = new Map(currentReminders.map((reminder) => [reminder.id, reminder]));

  for (const reminder of nextReminders) {
    reminderMap.set(reminder.id, reminder);
  }

  return Array.from(reminderMap.values()).sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

function App() {
  const { session, isHydrating, authError, login, logout, clearAuthError } = useAuthSession();
  const { theme, isThemeReady, toggleTheme } = useTheme();

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isPreferenceReady, setIsPreferenceReady] = useState(false);
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState({ age: '', sex: '' });
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState({
    loading: false,
    error: null,
  });
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [symptomError, setSymptomError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisState, setAnalysisState] = useState({
    loading: false,
    error: null,
  });
  const [medications, setMedications] = useState([]);
  const [medicationState, setMedicationState] = useState(initialMedicationState);
  const [reminders, setReminders] = useState([]);
  const [loginPending, setLoginPending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydratePreferenceState() {
      try {
        const accepted = await secureStorage.getItem(DISCLAIMER_STORAGE_KEY);
        if (isMounted) {
          setDisclaimerAccepted(Boolean(accepted));
        }
      } finally {
        if (isMounted) {
          setIsPreferenceReady(true);
        }
      }
    }

    hydratePreferenceState();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshMedicationSchedules = useEffectEvent(async (token, { silent = false } = {}) => {
    if (!token) {
      return null;
    }

    if (!silent) {
      setMedicationState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));
    }

    try {
      const payload = await getMedications(token);
      setMedications(sortMedicationSchedules(payload.medications));
      setMedicationState((current) => ({
        ...current,
        loading: false,
        error: null,
      }));

      return payload.medications;
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return null;
      }

      setMedicationState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));

      return null;
    }
  });

  const checkMedicationReminders = useEffectEvent(
    async ({ token, silent = false, now = undefined, refreshSchedules = false } = {}) => {
      if (!token) {
        return null;
      }

      setMedicationState((current) => ({
        ...current,
        checkingReminders: true,
        reminderError: silent ? current.reminderError : null,
      }));

      try {
        const payload = await triggerReminderCheck(token, now ? { now } : {});

        setReminders((current) => mergeReminderQueue(current, payload.reminders));
        setMedicationState((current) => ({
          ...current,
          checkingReminders: false,
          reminderError: null,
          lastCheckedAt: payload.checkedAt,
        }));

        if (payload.reminders.length > 0 || refreshSchedules) {
          await refreshMedicationSchedules(token, { silent: true });
        }

        return payload;
      } catch (error) {
        if (error.status === 401) {
          await logout();
          return null;
        }

        setMedicationState((current) => ({
          ...current,
          checkingReminders: false,
          reminderError: error.message,
        }));

        return null;
      }
    }
  );

  async function handleCatalogReload() {
    if (!session?.token) {
      return;
    }

    setCatalogState({
      loading: true,
      error: null,
    });

    try {
      const payload = await getSymptomCatalog(session.token);
      setCatalog(payload.symptoms);
      setCatalogState({
        loading: false,
        error: null,
      });
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return;
      }

      setCatalogState({
        loading: false,
        error: error.message,
      });
    }
  }

  async function handleMedicationReload() {
    if (!session?.token) {
      return;
    }

    setMedicationState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const payload = await getMedications(session.token);
      setMedications(sortMedicationSchedules(payload.medications));
      setMedicationState((current) => ({
        ...current,
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return;
      }

      setMedicationState((current) => ({
        ...current,
        loading: false,
        error: error.message,
      }));
    }
  }

  useEffect(() => {
    if (session?.token) {
      let isMounted = true;

      async function loadCatalog() {
        setCatalogState({
          loading: true,
          error: null,
        });

        try {
          const payload = await getSymptomCatalog(session.token);
          if (!isMounted) {
            return;
          }

          setCatalog(payload.symptoms);
          setCatalogState({
            loading: false,
            error: null,
          });
        } catch (error) {
          if (!isMounted) {
            return;
          }

          if (error.status === 401) {
            await logout();
            return;
          }

          setCatalogState({
            loading: false,
            error: error.message,
          });
        }
      }

      loadCatalog();

      return () => {
        isMounted = false;
      };
    }

    setCatalog([]);
    setSelectedSymptoms([]);
    setAnalysis(null);
    setStep(1);
  }, [session?.token, logout]);

  useEffect(() => {
    if (session?.token) {
      refreshMedicationSchedules(session.token);
      return;
    }

    setMedications([]);
    setReminders([]);
    setMedicationState(initialMedicationState);
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) {
      setReminders([]);
      return undefined;
    }

    let isCancelled = false;
    let isChecking = false;

    async function pollReminders() {
      if (isCancelled || isChecking) {
        return;
      }

      isChecking = true;

      try {
        await checkMedicationReminders({
          token: session.token,
          silent: true,
        });
      } finally {
        isChecking = false;
      }
    }

    pollReminders();
    const intervalId = setInterval(pollReminders, REMINDER_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [session?.token]);

  async function handleLogin(credentials) {
    setLoginPending(true);

    try {
      await login(credentials);
    } finally {
      setLoginPending(false);
    }
  }

  async function handleAcceptDisclaimer() {
    await secureStorage.setItem(DISCLAIMER_STORAGE_KEY, true);
    setDisclaimerAccepted(true);
  }

  async function handleMedicationCreate(payload) {
    if (!session?.token) {
      return false;
    }

    setMedicationState((current) => ({
      ...current,
      submitting: true,
      error: null,
    }));

    try {
      const response = await createMedication(payload, session.token);
      setMedications((current) => sortMedicationSchedules([response.medication, ...current]));
      setMedicationState((current) => ({
        ...current,
        submitting: false,
        error: null,
      }));
      return true;
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return false;
      }

      setMedicationState((current) => ({
        ...current,
        submitting: false,
        error: error.message,
      }));

      return false;
    }
  }

  async function handleReminderRefresh() {
    if (!session?.token) {
      return;
    }

    setMedicationState((current) => ({
      ...current,
      checkingReminders: true,
      reminderError: null,
    }));

    try {
      const payload = await triggerReminderCheck(session.token);

      setReminders((current) => mergeReminderQueue(current, payload.reminders));
      setMedicationState((current) => ({
        ...current,
        checkingReminders: false,
        reminderError: null,
        lastCheckedAt: payload.checkedAt,
      }));

      await handleMedicationReload();
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return;
      }

      setMedicationState((current) => ({
        ...current,
        checkingReminders: false,
        reminderError: error.message,
      }));
    }
  }

  async function handleMedicationDelete(medication) {
    if (!session?.token || !medication?.id) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete reminder schedule for ${medication.name}? This will stop future reminders for this course.`
    );

    if (!shouldDelete) {
      return;
    }

    setMedicationState((current) => ({
      ...current,
      deletingMedicationId: medication.id,
      error: null,
    }));

    try {
      await deleteMedicationSchedule(medication.id, session.token);
      setMedications((current) => current.filter((entry) => entry.id !== medication.id));
      setReminders((current) =>
        current.filter((reminder) => reminder.medicationId !== medication.id)
      );
      setMedicationState((current) => ({
        ...current,
        deletingMedicationId: null,
        error: null,
      }));
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return;
      }

      setMedicationState((current) => ({
        ...current,
        deletingMedicationId: null,
        error: error.message,
      }));
    }
  }

  function handleDismissReminder(reminderId) {
    setReminders((current) => current.filter((reminder) => reminder.id !== reminderId));
  }

  function handlePatientComplete(nextPatient) {
    setPatient(nextPatient);
    setStep(2);
  }

  function handleAddSymptom(symptom) {
    if (selectedSymptoms.some((entry) => entry.name === symptom.name)) {
      return;
    }

    setSelectedSymptoms((current) => [
      ...current,
      {
        name: symptom.name,
        label: symptom.label,
        severity: 3,
        durationDays: 1,
      },
    ]);
    setSymptomError(null);
  }

  function handleUpdateSymptom(name, field, value) {
    setSelectedSymptoms((current) =>
      current.map((entry) => (entry.name === name ? { ...entry, [field]: value } : entry))
    );
  }

  function handleRemoveSymptom(name) {
    setSelectedSymptoms((current) => current.filter((entry) => entry.name !== name));
  }

  async function handleAnalyze() {
    const validation = symptomSelectionSchema.safeParse(selectedSymptoms);

    if (!validation.success) {
      setSymptomError(validation.error.issues[0]?.message || 'Select at least one symptom.');
      return;
    }

    setSymptomError(null);
    setAnalysisState({
      loading: true,
      error: null,
    });

    try {
      const payload = await analyzeSymptoms(
        {
          patient,
          symptoms: selectedSymptoms.map((symptom) => ({
            name: symptom.name,
            severity: symptom.severity,
            durationDays: symptom.durationDays,
          })),
        },
        session.token
      );

      startTransition(() => {
        setAnalysis(payload);
        setStep(3);
      });

      setAnalysisState({
        loading: false,
        error: null,
      });
    } catch (error) {
      if (error.status === 401) {
        await logout();
        return;
      }

      setAnalysisState({
        loading: false,
        error: error.message,
      });
    }
  }

  function handleStartOver() {
    setAnalysis(null);
    setSelectedSymptoms([]);
    setStep(2);
  }

  if (!isThemeReady || !isPreferenceReady) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="panel-card max-w-xl text-center">
          <Activity className="mx-auto h-10 w-10 animate-pulse text-brandBlue dark:text-cyan-300" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Preparing the secure SymptomSense workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!disclaimerAccepted && session ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md">
          <div className="panel-card max-w-2xl">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-brandBlue dark:text-cyan-300" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Clinical Safety Notice
              </h2>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <p>
                SymptomSense is an informational screening aid. It is not a medically validated
                diagnostic device and must not be used to delay emergency care, specialist review,
                or clinician judgment.
              </p>
              <p>
                Disease rankings are produced by weighted symptom overlap. AI-generated text is
                strictly explanatory and may be incomplete or incorrect.
              </p>
              <p>
                Medication reminders are educational support only and must not override clinician
                instructions or pharmacy labeling.
              </p>
            </div>
            <button
              type="button"
              id="disclaimer-accept"
              onClick={handleAcceptDisclaimer}
              className="primary-button mt-6"
            >
              I Understand and Accept
            </button>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl dark:border-slate-900/70 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brandBlue/10 p-3 text-brandBlue dark:bg-cyan-500/10 dark:text-cyan-200">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
                SymptomSense
              </p>
              <h1 className="font-display text-2xl font-bold text-brandInk dark:text-white">
                Secure Symptom Triage
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DarkModeToggle theme={theme} onToggle={toggleTheme} />
            {session ? (
              <>
                <div className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                  Signed in as <span className="font-semibold">{session.user.email}</span>
                </div>
                <button type="button" onClick={logout} className="secondary-button">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {!session ? (
          <AuthGate
            isHydrating={isHydrating}
            isSubmitting={loginPending}
            error={authError}
            onSubmit={async (credentials) => {
              clearAuthError();
              await handleLogin(credentials);
            }}
          />
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="panel-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brandBlue/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-brandBlue dark:bg-cyan-500/10 dark:text-cyan-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      Production Workflow
                    </span>
                    <h2 className="text-3xl font-bold tracking-tight text-brandInk dark:text-white">
                      Server-side triage with medication adherence support
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                      The frontend authenticates through JWT, loads backend-governed symptom and
                      medication data, and renders both explainable triage output and backend-driven
                      reminder prompts without relying on browser notification APIs.
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm dark:bg-slate-900/70">
                      <p className="font-semibold text-slate-900 dark:text-white">Step {step} of 3</p>
                      <p>Patient intake, symptom capture, and ranked output.</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm dark:bg-slate-900/70">
                      <p className="font-semibold text-slate-900 dark:text-white">Catalog Size</p>
                      <p>{catalog.length || 0} backend-driven symptoms loaded.</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm dark:bg-slate-900/70">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Medication Schedules
                      </p>
                      <p>{medications.length} active backend-managed courses.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel-card">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
                  Workflow Status
                </p>
                <div className="mt-5 space-y-4">
                  {steps.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          step >= entry.id
                            ? 'bg-brandBlue text-white'
                            : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {entry.id}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          step >= entry.id
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {entry.label}
                      </span>
                    </div>
                  ))}
                  <div className="rounded-3xl border border-brandBlue/15 bg-brandBlue/5 px-4 py-4 dark:border-cyan-500/20 dark:bg-cyan-500/5">
                    <div className="flex items-start gap-3">
                      <Pill className="mt-1 h-5 w-5 text-brandBlue dark:text-cyan-300" />
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Medication reminders are live
                        </p>
                        <p className="mt-1">
                          The backend checks due doses every minute and the app polls for reminder
                          banners while your session is active.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <ReminderBanner reminders={reminders} onDismiss={handleDismissReminder} />

            <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Suspense fallback={suspenseFallback}>
                <MedicationForm
                  isSubmitting={medicationState.submitting}
                  onSubmit={handleMedicationCreate}
                />
              </Suspense>

              <Suspense fallback={suspenseFallback}>
                <MedicationList
                  medications={medications}
                  loading={medicationState.loading}
                  error={medicationState.error}
                  reminderError={medicationState.reminderError}
                  isCheckingReminders={medicationState.checkingReminders}
                  deletingMedicationId={medicationState.deletingMedicationId}
                  lastCheckedAt={medicationState.lastCheckedAt}
                  onRefresh={handleMedicationReload}
                  onCheckReminders={handleReminderRefresh}
                  onDeleteMedication={handleMedicationDelete}
                />
              </Suspense>
            </section>

            <section className="panel-card">
              {catalogState.error ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-5 dark:border-red-500/40 dark:bg-red-950/40">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 h-5 w-5 text-red-600 dark:text-red-300" />
                    <div>
                      <h2 className="text-lg font-semibold text-red-700 dark:text-red-200">
                        Symptom catalog unavailable
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-red-700 dark:text-red-200">
                        {catalogState.error}
                      </p>
                      <button
                        type="button"
                        className="secondary-button mt-4"
                        onClick={handleCatalogReload}
                      >
                        Retry Catalog Load
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Suspense fallback={suspenseFallback}>
                  {step === 1 ? (
                    <PatientInfoForm initialValue={patient} onComplete={handlePatientComplete} />
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
                          Symptom Selection
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight text-brandInk dark:text-white">
                          Build the symptom profile
                        </h2>
                        <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                          Search the backend catalog, add every active symptom, and rate severity
                          and duration to drive the weighted scoring engine.
                        </p>
                      </div>

                      {catalogState.loading ? (
                        <div className="rounded-3xl border border-slate-200/80 bg-white/80 px-6 py-8 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                          Loading the backend symptom catalog...
                        </div>
                      ) : (
                        <SymptomSelector
                          catalog={catalog}
                          selectedSymptoms={selectedSymptoms}
                          onAddSymptom={handleAddSymptom}
                          onUpdateSymptom={handleUpdateSymptom}
                          onRemoveSymptom={handleRemoveSymptom}
                          validationError={symptomError}
                        />
                      )}

                      {analysisState.error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                          {analysisState.error}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
                        <button
                          type="button"
                          id="check-symptoms-btn"
                          disabled={analysisState.loading || catalogState.loading}
                          onClick={handleAnalyze}
                          className="primary-button"
                        >
                          <ClipboardPlus className="h-4 w-4" />
                          {analysisState.loading ? 'Analyzing Symptoms...' : 'Analyze Symptoms'}
                        </button>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Results are generated by the backend scoring engine and may be cached for
                          repeated identical requests.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 && analysis ? (
                    <ResultsPanel
                      analysis={analysis}
                      patient={patient}
                      token={session.token}
                      onStartOver={handleStartOver}
                      onUnauthorized={logout}
                    />
                  ) : null}
                </Suspense>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-white/40 bg-white/70 py-6 backdrop-blur-xl dark:border-slate-900/70 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-slate-600 sm:px-6 lg:px-8 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white">Medical Disclaimer</p>
          <p>
            SymptomSense is provided for informational screening support only. It does not provide
            diagnosis, treatment, or emergency clearance. Always refer urgent or uncertain cases to
            qualified medical professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
