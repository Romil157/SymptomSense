import { BellRing, X } from 'lucide-react';
import { formatDateTime } from '../lib/formatters';

export default function ReminderBanner({ reminders, onDismiss }) {
  if (!reminders.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      {reminders.map((reminder) => (
        <div
          key={reminder.id}
          className="rounded-3xl border border-amber-200 bg-amber-50/95 px-5 py-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellRing className="mt-1 h-5 w-5 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                  Medication Reminder
                </p>
                <p className="mt-2 text-sm leading-7 text-amber-700 dark:text-amber-100">
                  {reminder.message}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-700/80 dark:text-amber-200/80">
                  Due {formatDateTime(reminder.dueAt)} / {reminder.medication.name} /{' '}
                  {reminder.medication.frequency}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label={`Dismiss reminder for ${reminder.medication.name}`}
              className="rounded-full border border-amber-300/80 p-2 text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              onClick={() => onDismiss(reminder.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
