import React, { useState } from 'react';

const BENEFITS = [
  'Structured case lifecycle with governance checkpoints',
  'Role-based access control with audit trails',
  'Enterprise-grade multi-tenant architecture',
  'Designed for CA, CS, and legal service firms',
];

const initialForm = {
  firmName: '',
  practiceType: 'CA',
  teamMembers: '',
  currentWorkflowSystem: '',
  compliancePainPoint: '',
  goLiveTimeline: '',
};

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors duration-150 focus:border-gray-900 focus:shadow-[0_0_0_3px_rgba(17,24,39,0.08)] bg-white';

const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

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
    <section className="w-full marketing-section">
      <div className="marketing-container">
        <div className="grid gap-16 lg:grid-cols-[1fr_480px]">

          {/* Left column — explanation */}
          <div className="flex flex-col justify-center">
            <h1 className="type-section text-gray-900">
              Request Early Access
            </h1>
            <p className="mt-4 type-body max-w-[480px]">
              Docketra is in controlled early access for professional service firms.
              Share your operational profile for a qualification review.
            </p>
            <ul className="mt-8 space-y-3">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <span className="mt-0.5 text-gray-900 font-medium select-none">✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — form card */}
          <div className="signup-form-card p-8">
            <h2 className="type-card-title text-base text-gray-900">Qualification Form</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Review typically takes 2–3 business days.
            </p>

            {status === 'success' && (
              <div
                role="alert"
                className="mt-6 marketing-fade-in rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"
              >
                Thank you. Our team will review your request and schedule a walkthrough.
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-6 marketing-fade-in rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="signup-firmName" className={labelClass}>Firm Name</label>
                <input
                  id="signup-firmName"
                  name="firmName"
                  value={form.firmName}
                  onChange={onChange}
                  placeholder="e.g. Agarwal & Associates"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-practiceType" className={labelClass}>Practice Type</label>
                <select
                  id="signup-practiceType"
                  name="practiceType"
                  value={form.practiceType}
                  onChange={onChange}
                  className={inputClass}
                  required
                >
                  <option value="CA">Chartered Accountant (CA)</option>
                  <option value="CS">Company Secretary (CS)</option>
                  <option value="Law">Law Firm</option>
                </select>
              </div>

              <div>
                <label htmlFor="signup-teamMembers" className={labelClass}>Number of Team Members</label>
                <input
                  id="signup-teamMembers"
                  name="teamMembers"
                  type="number"
                  min="1"
                  value={form.teamMembers}
                  onChange={onChange}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="e.g. 25"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-currentWorkflowSystem" className={labelClass}>Current Workflow System</label>
                <textarea
                  id="signup-currentWorkflowSystem"
                  name="currentWorkflowSystem"
                  value={form.currentWorkflowSystem}
                  onChange={onChange}
                  placeholder="e.g. Spreadsheets, WhatsApp, internal tools"
                  className={`${inputClass} min-h-[80px] resize-none`}
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-compliancePainPoint" className={labelClass}>Biggest Compliance Pain Point</label>
                <textarea
                  id="signup-compliancePainPoint"
                  name="compliancePainPoint"
                  value={form.compliancePainPoint}
                  onChange={onChange}
                  placeholder="Describe your primary operational challenge"
                  className={`${inputClass} min-h-[80px] resize-none`}
                  required
                />
              </div>

              <div>
                <label htmlFor="signup-goLiveTimeline" className={labelClass}>Expected Go-Live Timeline</label>
                <input
                  id="signup-goLiveTimeline"
                  name="goLiveTimeline"
                  value={form.goLiveTimeline}
                  onChange={onChange}
                  placeholder="e.g. Q2 2026"
                  className={inputClass}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full mt-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'submitting' ? 'Submitting…' : 'Submit Qualification'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
};
