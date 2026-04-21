import { Calendar, UserRound } from 'lucide-react';
import { useState } from 'react';
import { patientSchema, validateForm } from '../lib/validation';

const sexOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function PatientInfoForm({ initialValue, onComplete }) {
  const [form, setForm] = useState({
    age: initialValue?.age ?? '',
    sex: initialValue?.sex ?? '',
  });
  const [errors, setErrors] = useState({});

  function handleSubmit(event) {
    event.preventDefault();
    const validation = validateForm(patientSchema, form);

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    onComplete(validation.data);
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brandBlue dark:text-cyan-200">
          Patient Intake
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-brandInk dark:text-white">
          Capture patient context before triage
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Age and biological sex are used to structure the symptom review and the educational
          insight returned by the backend. They do not replace clinician judgment or formal
          diagnostic evaluation.
        </p>
      </div>

      <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <label className="label-text flex items-center gap-2" htmlFor="patient-age">
            <Calendar className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
            Age
          </label>
          <input
            id="patient-age"
            type="number"
            min="0"
            max="120"
            className="input-shell mt-3"
            value={form.age}
            onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
            placeholder="Enter patient age"
          />
          <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
            Accepts whole numbers from 0 to 120.
          </p>
          {errors.age ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.age}</p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
          <label className="label-text flex items-center gap-2" htmlFor="patient-sex">
            <UserRound className="h-4 w-4 text-brandBlue dark:text-cyan-300" />
            Biological Sex
          </label>
          <select
            id="patient-sex"
            className="input-shell mt-3"
            value={form.sex}
            onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
          >
            <option value="">Select a value</option>
            {sexOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
            Stored only within the authenticated browser session and sent to the backend for
            structured analysis.
          </p>
          {errors.sex ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-300">{errors.sex}</p>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="primary-button w-full md:w-auto">
            Continue to Symptom Selection
          </button>
        </div>
      </form>
    </section>
  );
}
