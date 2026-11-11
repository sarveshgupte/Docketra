import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardBody } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { superadminService } from '../../../services/superadminService';

const AGENT_META = {
  sentinel: {
    name: 'Sentinel',
    icon: '🛡️',
    title: 'Security & Vulnerability Defense',
    color: 'border-red-200 bg-red-50/40 text-red-700',
    badge: 'bg-red-100 text-red-800 border-red-200',
    suggestions: [
      'Audit controllers for dynamic RegExp constructors and apply escapeRegExp',
      'Check for insecure Math.random() usage in token and auth utilities',
      'Verify strict path containment checks on file download endpoints',
    ],
  },
  bolt: {
    name: 'Bolt',
    icon: '⚡',
    title: 'Performance & Query Latency',
    color: 'border-amber-200 bg-amber-50/40 text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    suggestions: [
      'Replace countDocuments() > 0 with Model.exists() in user and client controllers',
      'Find any MongoDB findOne queries executed inside loops and batch with $in',
      'Optimize threshold checks with limit(N) to short-circuit index scans',
    ],
  },
  palette: {
    name: 'Palette',
    icon: '🎨',
    title: 'UI/UX Polish & Accessibility',
    color: 'border-blue-200 bg-blue-50/40 text-blue-700',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    suggestions: [
      'Add native title tooltips and aria-labels to all icon-only buttons in common components',
      'Scan UI components for unmapped hardcoded hex color literals',
      'Ensure dropdown and toggle buttons have linked aria-controls and useId',
    ],
  },
};

export const SuperadminRepoAgentView = () => {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');

  // Audit state
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [auditError, setAuditError] = useState('');

  // Dispatch task state
  const [selectedAgent, setSelectedAgent] = useState('sentinel');
  const [taskPrompt, setTaskPrompt] = useState('');
  const [targetFile, setTargetFile] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchError, setDispatchError] = useState('');

  // PRs state
  const [prs, setPrs] = useState([]);
  const [loadingPrs, setLoadingPrs] = useState(false);

  const consoleRef = useRef(null);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      setStatusError('');
      const res = await superadminService.getRepoAgentStatus();
      if (res?.success) {
        setStatus(res.data);
      }
    } catch (err) {
      setStatusError(err?.response?.data?.message || err?.message || 'Failed to load repo agent status.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchPRs = async () => {
    try {
      setLoadingPrs(true);
      const res = await superadminService.getRepoAgentPRs({ state: 'all' });
      if (res?.success && Array.isArray(res.data?.pullRequests)) {
        setPrs(res.data.pullRequests);
      }
    } catch {
      // Graceful silence for optional PR list
    } finally {
      setLoadingPrs(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPRs();
  }, []);

  const handleRunAudit = async (agent = 'all') => {
    try {
      setAuditing(true);
      setAuditError('');
      const res = await superadminService.runRepoAgentAudit(agent);
      if (res?.success) {
        setAuditResult(res.data);
      }
    } catch (err) {
      setAuditError(err?.response?.data?.message || err?.message || 'Audit execution failed.');
    } finally {
      setAuditing(false);
    }
  };

  const handleDispatchTask = async (mode = 'preview') => {
    if (!taskPrompt || !taskPrompt.trim() || dispatching) return;
    try {
      setDispatching(true);
      setDispatchError('');
      setDispatchResult(null);

      const res = await superadminService.dispatchRepoAgentTask({
        agent: selectedAgent,
        prompt: taskPrompt.trim(),
        mode,
        targetFile: targetFile.trim() || undefined,
      });

      if (res?.success) {
        setDispatchResult(res.data);
        if (mode === 'create_pr' && res.data?.prResult?.created) {
          fetchPRs();
        }
      }
    } catch (err) {
      setDispatchError(err?.response?.data?.message || err?.message || 'Task dispatch failed.');
    } finally {
      setDispatching(false);
    }
  };

  const handlePreloadFinding = (finding) => {
    setSelectedAgent(finding.agent);
    setTaskPrompt(`Fix finding in ${finding.filePath} (line ${finding.lineNumber}): ${finding.title}. Recommendation: ${finding.recommendation}`);
    setTargetFile(finding.filePath);
    consoleRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Repo & Cloud Connection State */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-mono text-sm">
            ⌥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm tracking-tight">
                {status?.github?.repo || 'Docketra/Docketra-main'}
              </span>
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
                branch: {status?.github?.branch || 'main'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Autonomous repository watchdog powered by .jules rules & Gemini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status?.github?.configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Cloud Live (1-Click PR Ready)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Preview Mode (Diffs Enabled)
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRunAudit('all')}
            disabled={auditing}
            title="Scan entire codebase across Sentinel, Bolt, and Palette"
          >
            {auditing ? 'Scanning...' : 'Scan All Watchdogs'}
          </Button>
        </div>
      </div>

      {statusError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
          {statusError}
        </div>
      )}

      {/* The 3 Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['sentinel', 'bolt', 'palette'].map((agentId) => {
          const meta = AGENT_META[agentId];
          const agentData = status?.agents?.[agentId];
          const isSelected = selectedAgent === agentId;

          return (
            <div
              key={agentId}
              className={`rounded-xl border p-4 transition-all duration-150 bg-white ${
                isSelected
                  ? 'border-gray-900 ring-1 ring-gray-900 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl" role="img" aria-label={meta.name}>
                    {meta.icon}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{meta.name}</h2>
                    <p className="text-[11px] text-gray-500 leading-tight">{meta.title}</p>
                  </div>
                </div>
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${meta.badge}`}>
                  {agentData?.entryCount ?? 0} rules
                </span>
              </div>

              {/* Recent Learnings Snippets */}
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Institutional Memory (.jules/{agentId}.md)
                </p>
                <div className="space-y-1">
                  {(agentData?.recentLearnings || []).slice(0, 2).map((item, idx) => (
                    <div key={idx} className="rounded bg-gray-50 p-1.5 text-[11px] text-gray-700 leading-snug">
                      <span className="font-semibold text-gray-900">{item.title}:</span>{' '}
                      <span className="text-gray-600 line-clamp-1">{item.prevention || item.problem}</span>
                    </div>
                  ))}
                  {(!agentData?.recentLearnings || agentData.recentLearnings.length === 0) && (
                    <p className="text-[11px] text-gray-400 italic">No rules loaded yet.</p>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-4 flex items-center gap-2 pt-2 border-t border-gray-100">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleRunAudit(agentId)}
                  disabled={auditing}
                  className="flex-1"
                >
                  Audit {meta.name}
                </Button>
                <Button
                  size="xs"
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedAgent(agentId);
                    consoleRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex-1"
                >
                  Select Agent
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Findings Panel */}
      {auditResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">
                Codebase Audit Results ({auditResult.totalFindings} findings)
              </h2>
              <span className="text-xs text-gray-500">
                scanned {new Date(auditResult.scannedAt).toLocaleTimeString()}
              </span>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setAuditResult(null)}>
              Dismiss
            </Button>
          </div>

          {auditResult.findings.length === 0 ? (
            <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-4 text-center">
              <p className="text-xs font-semibold text-emerald-800">
                ✅ Zero violations detected for {auditResult.agent === 'all' ? 'all watchdogs' : auditResult.agent}!
              </p>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Codebase is conforming to current .jules security, performance, and accessibility standards.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {auditResult.findings.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          f.severity === 'HIGH'
                            ? 'bg-red-100 text-red-800'
                            : f.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-semibold text-gray-900">{f.title}</span>
                      <span className="font-mono text-[11px] text-gray-500">
                        {f.filePath}:{f.lineNumber}
                      </span>
                    </div>
                    {f.snippet && (
                      <pre className="font-mono text-[11px] text-gray-600 bg-white border border-gray-200 rounded p-1.5 overflow-x-auto">
                        {f.snippet}
                      </pre>
                    )}
                    <p className="text-[11px] text-gray-600">
                      <strong className="text-gray-700">Fix:</strong> {f.recommendation}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handlePreloadFinding(f)}
                    className="shrink-0 self-start sm:self-center"
                    title="Load this finding into the task console for automated remediation"
                  >
                    Dispatch Fix →
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {auditError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
          {auditError}
        </div>
      )}

      {/* Autonomous Code Task Console */}
      <div ref={consoleRef} className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span>{AGENT_META[selectedAgent].icon}</span>
              Dispatch Task to {AGENT_META[selectedAgent].name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Natural language prompt will be analyzed against .jules/{selectedAgent}.md to generate production-ready fixes.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {['sentinel', 'bolt', 'palette'].map((agentId) => (
              <button
                key={agentId}
                type="button"
                onClick={() => setSelectedAgent(agentId)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedAgent === agentId
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {AGENT_META[agentId].name}
              </button>
            ))}
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Suggested {AGENT_META[selectedAgent].name} Prompts
          </p>
          <div className="flex flex-wrap gap-2">
            {AGENT_META[selectedAgent].suggestions.map((sugg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTaskPrompt(sugg)}
                className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors"
              >
                {sugg}
              </button>
            ))}
          </div>
        </div>

        {/* Target File Input (Optional) */}
        <div>
          <label htmlFor="target-file-input" className="block text-xs font-medium text-gray-700 mb-1">
            Target File (Optional - e.g. <span className="font-mono text-gray-500">src/controllers/admin.controller.js</span>)
          </label>
          <input
            id="target-file-input"
            type="text"
            value={targetFile}
            onChange={(e) => setTargetFile(e.target.value)}
            placeholder="src/controllers/case.controller.js"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        {/* Task Prompt Textarea */}
        <div>
          <label htmlFor="task-prompt-input" className="block text-xs font-medium text-gray-700 mb-1">
            Task Instruction
          </label>
          <textarea
            id="task-prompt-input"
            rows={3}
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder={`Describe what you want ${AGENT_META[selectedAgent].name} to inspect or fix in the repository...`}
            className="w-full rounded-lg border border-gray-200 p-3 text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        {/* Console Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-gray-500">
            {status?.github?.configured
              ? '💡 Cloud mode is enabled: You can open a real PR directly to GitHub with zero Actions config.'
              : '💡 Preview mode: You will receive a clean unified diff to review before applying.'}
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDispatchTask('preview')}
              disabled={dispatching || !taskPrompt.trim()}
              className="flex-1 sm:flex-none"
            >
              {dispatching ? 'Analyzing...' : 'Preview Fix & Diff'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDispatchTask('create_pr')}
              disabled={dispatching || !taskPrompt.trim()}
              className="flex-1 sm:flex-none"
            >
              {dispatching ? 'Dispatching...' : 'Commit & Open PR'}
            </Button>
          </div>
        </div>
      </div>

      {dispatchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
          {dispatchError}
        </div>
      )}

      {/* Task Output / Unified Diff Display */}
      {dispatchResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span>{AGENT_META[dispatchResult.agent]?.icon}</span>
                {dispatchResult.prTitle}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Generated by {dispatchResult.agentName} in {dispatchResult.mode} mode.
              </p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => setDispatchResult(null)}>
              Clear
            </Button>
          </div>

          {/* PR Result Status Alert */}
          {dispatchResult.prResult?.created ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-900">
                  🎉 Pull Request #{dispatchResult.prResult.prNumber} opened on GitHub!
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Branch: <span className="font-mono">{dispatchResult.prResult.branch}</span>
                </p>
              </div>
              <a
                href={dispatchResult.prResult.prUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-800 transition-colors"
              >
                View PR on GitHub →
              </a>
            </div>
          ) : (
            dispatchResult.prResult?.message && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {dispatchResult.prResult.message}
              </div>
            )
          )}

          {/* Formatted Analysis & Diff */}
          <div className="rounded-lg bg-gray-900 text-gray-100 p-4 overflow-x-auto text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-96">
            {dispatchResult.analysis}
          </div>
        </div>
      )}

      {/* Repository Pull Requests Feed */}
      {prs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Active Repository Pull Requests ({prs.length})
            </h2>
            <Button size="xs" variant="ghost" onClick={fetchPRs} disabled={loadingPrs}>
              {loadingPrs ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="space-y-2">
            {prs.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50 transition-colors text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      pr.state === 'open'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pr.state}
                  </span>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gray-900 hover:underline"
                  >
                    #{pr.number}: {pr.title}
                  </a>
                  {pr.isAgentPR && (
                    <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.2 text-[10px] font-semibold">
                      Agent PR
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-[11px]">
                  by {pr.author} • {new Date(pr.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default SuperadminRepoAgentView;
