import { BellRing, CalendarClock, RefreshCcw, Trash2 } from 'lucide-react';
import { formatCalendarDate, formatDateTime } from '../lib/formatters';

function getLocalDateString(date = new Date()) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
    value.getDate()
  ).padStart(2, '0')}`;
}

function getCourseStatus(endsOn) {
  const today = getLocalDateString();
  const currentDate = new Date(`${today}T00:00:00Z`);
  const endDate = new Date(`${endsOn}T00:00:00Z`);
  const dayDifference = Math.round((endDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDifference <= 0) {
    return 'Final day of the current course';
  }

  if (dayDifference === 1) {
    return '1 day remaining after today';
  }

  return `${dayDifference} days remaining after today`;
}

export default function MedicationList({
  medications,
  loading,
  error,
  isCheckingReminders,
  onRefresh,
  onCheckReminders,
  onDeleteMedication,
  deletingMedicationId,
  reminderError,
  lastCheckedAt,
}) {
  return (
    <section className="panel-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
            Active Medications
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-brandInk dark:text-white">
            Review backend-managed schedules
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Every next-dose timestamp comes from the API so the UI only renders the schedule state
            it receives from the backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onRefresh} className="secondary-button">
            <RefreshCcw className="h-4 w-4" />
            Refresh Schedule
          </button>
          <button
            type="button"
            id="check-reminders-btn"
            onClick={onCheckReminders}
            disabled={isCheckingReminders}
            className="primary-button"
          >
            <BellRing className="h-4 w-4" />
            {isCheckingReminders ? 'Checking Reminders...' : 'Check Reminders Now'}
          </button>
        </div>
      </div>

      {lastCheckedAt ? (
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Last reminder check: {formatDateTime(lastCheckedAt)}
        </p>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {reminderError ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          {reminderError}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white/80 px-6 py-8 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          Loading medication schedules from the backend...
        </div>
      ) : medications.length ? (
        <div className="mt-6 grid gap-4">
          {medications.map((medication) => (
            <article
              key={medication.id}
              className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {medication.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {medication.dosage} / {medication.frequency}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="rounded-2xl bg-slate-50/90 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {medication.nextDueAt
                        ? `Next dose ${formatDateTime(medication.nextDueAt)}`
                        : 'No remaining doses scheduled'}
                    </p>
                    <p className="mt-1">{getCourseStatus(medication.endsOn)}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-900/50"
                    onClick={() => onDeleteMedication(medication)}
                    disabled={deletingMedicationId === medication.id}
                    aria-label={`Delete reminder schedule for ${medication.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingMedicationId === medication.id ? 'Deleting...' : 'Delete Reminder'}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <p className="label-text">Daily Times</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {medication.times.map((time) => (
                      <span
                        key={`${medication.id}-${time}`}
                        className="rounded-full border border-brandBlue/20 bg-brandBlue/10 px-3 py-1 text-xs font-semibold text-brandBlue dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-1 h-5 w-5 text-brandBlue dark:text-cyan-300" />
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p>
                        Course started{' '}
                        <span className="font-semibold">{formatCalendarDate(medication.startsOn)}</span>
                      </p>
                      <p>
                        Course ends{' '}
                        <span className="font-semibold">{formatCalendarDate(medication.endsOn)}</span>
                      </p>
                      <p>
                        Reminder timezone{' '}
                        <span className="font-semibold">{medication.timezone}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-8 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
          No active medications are stored yet. Add a prescribed medication schedule to activate
          backend reminder checks.
        </div>
      )}
    </section>
  );
}
