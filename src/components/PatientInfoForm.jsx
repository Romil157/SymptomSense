import React, { useState } from 'react';
import { User, Calendar } from 'lucide-react';

const PatientInfoForm = ({ onComplete }) => {
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (age && gender) {
      onComplete({ age, gender });
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">
          Tell us about yourself
        </h1>
        <p className="text-lg text-gray-500">
          This helps us provide more accurate predictions and tailored medical explanations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brandBlue" /> Age
          </label>
          <input
            type="number"
            min="0"
            max="120"
            required
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-brandBlue transition-all outline-none"
            placeholder="e.g. 34"
          />
        </div>

        <div>
           <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-brandBlue" /> Biological Sex
          </label>
          <select
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-brandBlue transition-all outline-none bg-white"
          >
            <option value="" disabled>Select option...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={!age || !gender}
            className={`w-full py-4 rounded-full font-bold text-lg shadow-md transition-all ${
              age && gender
                ? 'bg-brandBlue text-white hover:bg-blue-700 transform hover:scale-105'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientInfoForm;
