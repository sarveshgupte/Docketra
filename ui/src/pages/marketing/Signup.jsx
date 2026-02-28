import React, { useState } from 'react';

const initialForm = {
  firmName: '',
  practiceType: 'CA',
  teamMembers: '',
  currentWorkflowSystem: '',
  compliancePainPoint: '',
  goLiveTimeline: '',
};

export const SignupPage = () => {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    setError('');

    try {
      const payload = {
        firmName: form.firmName,
        practiceType: form.practiceType,
        teamMembers: form.teamMembers,
        currentWorkflowSystem: form.currentWorkflowSystem,
        compliancePainPoint: form.compliancePainPoint,
        goLiveTimeline: form.goLiveTimeline,
      };

      const response = await fetch('/api/public/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to submit early access request. Please try again.');
      }

      setStatus('success');
      setForm(initialForm);
    } catch (submitError) {
      setStatus('error');
      setError(submitError.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h2 className="type-card-title">Request Early Access</h2>
        <p className="mt-6 type-body">Share your operational profile for qualification review.</p>

        {status === 'success' && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Thank you. Our team will review your request and schedule a walkthrough.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <input
            name="firmName"
            value={form.firmName}
            onChange={onChange}
            placeholder="Firm Name"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]"
            required
          />
          <select
            name="practiceType"
            value={form.practiceType}
            onChange={onChange}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]"
            required
          >
            <option value="CA">Practice Type: CA</option>
            <option value="CS">Practice Type: CS</option>
            <option value="Law">Practice Type: Law</option>
          </select>
          <input
            name="teamMembers"
            type="number"
            min="1"
            value={form.teamMembers}
            onChange={onChange}
            placeholder="Number of Team Members"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]"
            required
          />
          <textarea
            name="currentWorkflowSystem"
            value={form.currentWorkflowSystem}
            onChange={onChange}
            placeholder="Current Workflow System"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] min-h-20"
            required
          />
          <textarea
            name="compliancePainPoint"
            value={form.compliancePainPoint}
            onChange={onChange}
            placeholder="Biggest Compliance Pain Point"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] min-h-20"
            required
          />
          <input
            name="goLiveTimeline"
            value={form.goLiveTimeline}
            onChange={onChange}
            placeholder="Expected Go-Live Timeline"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-all duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)]"
            required
          />

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full mt-4 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.01] hover:-translate-y-0.5 hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit Qualification'}
          </button>
        </form>
      </div>
    </div>
  );
};
