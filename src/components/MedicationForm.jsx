import { CalendarDays, Clock3, Pill, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { medicationFormSchema, validateForm } from '../lib/validation';

const suggestedTimes = ['09:00', '13:00', '18:00', '21:00'];

function deriveFrequencyLabel(timesCount) {
  if (timesCount <= 1) {
    return 'once daily';
  }

  if (timesCount === 2) {
    return 'twice daily';
  }

  return `${timesCount} times daily`;
}

function getBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export default function MedicationForm({ isSubmitting, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    durationDays: 5,
    times: ['09:00'],
    timezone: getBrowserTimeZone(),
  });
  const [errors, setErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    const validation = validateForm(medicationFormSchema, form);

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    const normalizedTimes = [...validation.data.times].sort((left, right) => left.localeCompare(right));

    const wasSaved = await onSubmit({
      ...validation.data,
      times: normalizedTimes,
      timezone: form.timezone,
      frequency: deriveFrequencyLabel(normalizedTimes.length),
    });

    if (!wasSaved) {
      return;
    }

    setForm({
      name: '',
      dosage: '',
      durationDays: 5,
      times: ['09:00'],
      timezone: getBrowserTimeZone(),
    });
    setErrors({});
  }

  function handleTimeChange(index, value) {
    setForm((current) => ({
      ...current,
      times: current.times.map((time, entryIndex) => (entryIndex === index ? value : time)),
    }));
  }

  function handleAddTime() {
    if (form.times.length >= 4) {
      return;
    }

    const nextSuggestedTime =
      suggestedTimes.find((time) => !form.times.includes(time)) || form.times.at(-1) || '09:00';

    setForm((current) => ({
      ...current,
      times: [...current.times, nextSuggestedTime],
    }));
  }

  function handleRemoveTime(index) {
    if (form.times.length === 1) {
      return;
    }

    setForm((current) => ({
      ...current,
      times: current.times.filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  return (
    <section className="panel-card">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
          Medication Planner
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-brandInk dark:text-white">
          Capture prescribed doses and reminder times
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Medication schedules are stored on the backend and checked by the reminder engine so the
          browser never decides on its own when a dose is due.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
            <label className="label-text flex items-center gap-2" htmlFor="medication-name">
              <Pill className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
              Medication Name
            </label>
            <input
              id="medication-name"
              className="input-shell mt-3"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Paracetamol"
            />
            {errors.name ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.name}</p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
            <label className="label-text flex items-center gap-2" htmlFor="medication-dosage">
              <Pill className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
              Dosage
            </label>
            <input
              id="medication-dosage"
              className="input-shell mt-3"
              value={form.dosage}
              onChange={(event) => setForm((current) => ({ ...current, dosage: event.target.value }))}
              placeholder="500mg"
            />
            {errors.dosage ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.dosage}</p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
            <label className="label-text flex items-center gap-2" htmlFor="medication-duration">
              <CalendarDays className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
              Duration (Days)
            </label>
            <input
              id="medication-duration"
              type="number"
              min="1"
              max="365"
              className="input-shell mt-3"
              value={form.durationDays}
              onChange={(event) =>
                setForm((current) => ({ ...current, durationDays: event.target.value }))
              }
            />
            <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
              Current frequency: <span className="font-semibold">{deriveFrequencyLabel(form.times.length)}</span>
            </p>
            {errors.durationDays ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.durationDays}</p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
            <p className="label-text flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
              Daily Reminder Times
            </p>
            <div className="mt-4 space-y-3">
              {form.times.map((time, index) => (
                <div key={`${index}-${time}`} className="flex items-center gap-3">
                  <input
                    aria-label={`Reminder time ${index + 1}`}
                    type="time"
                    className="input-shell"
                    value={time}
                    onChange={(event) => handleTimeChange(index, event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button px-4 py-3"
                    onClick={() => handleRemoveTime(index)}
                    disabled={form.times.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddTime}
                disabled={form.times.length >= 4}
              >
                <Plus className="h-4 w-4" />
                Add Time Slot
              </button>
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                Browser timezone: <span className="font-semibold">{form.timezone}</span>
              </p>
            </div>
            {errors.times ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.times}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <button type="submit" disabled={isSubmitting} className="primary-button">
            {isSubmitting ? 'Saving Schedule...' : 'Save Medication Schedule'}
          </button>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The backend stores the schedule and generates reminder copy when a dose becomes due.
          </p>
        </div>
      </form>
    </section>
  );
}
