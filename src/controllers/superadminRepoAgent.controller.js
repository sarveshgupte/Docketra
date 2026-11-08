'use strict';

const repoAgentService = require('../services/superadminRepoAgent.service');
const log = require('../utils/log');

/**
 * GET /api/superadmin/repo-agent/status
 * Get current repository AI agent status, .jules rules count, and GitHub credentials status
 */
const getRepoAgentStatus = async (req, res) => {
  try {
    const status = repoAgentService.getRepoStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    log.error('[REPO_AGENT] Failed to get repo status:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve repository agent status.',
    });
  }
};

/**
 * POST /api/superadmin/repo-agent/audit
 * Run static deterministic codebase audits for Sentinel, Bolt, or Palette
 */
const runRepoAgentAudit = async (req, res) => {
  try {
    const { agent = 'all' } = req.body || {};
    const auditResult = repoAgentService.runCodebaseAudit(agent);

    log.info('[REPO_AGENT] Codebase audit executed', {
      agent,
      findingsCount: auditResult.totalFindings,
      performedBy: req.user?.email || req.user?.xID || 'SuperAdmin',
    });

    return res.json({
      success: true,
      data: auditResult,
    });
  } catch (error) {
    log.error('[REPO_AGENT] Codebase audit failed:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to run codebase audit.',
    });
  }
};

/**
 * POST /api/superadmin/repo-agent/dispatch
 * Dispatch an autonomous coding task to Gemini and optionally open a GitHub PR
 */
const dispatchRepoAgentTask = async (req, res) => {
  try {
    const { agent, prompt, mode = 'preview', targetFile } = req.body;

    if (!agent || !['sentinel', 'bolt', 'palette'].includes(agent)) {
      return res.status(400).json({
        success: false,
        message: 'Valid agent (sentinel, bolt, or palette) is required.',
      });
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task prompt is required.',
      });
    }

    log.info('[REPO_AGENT] Dispatching code task to agent', {
      agent,
      mode,
      targetFile: targetFile || null,
      promptLength: prompt.length,
      performedBy: req.user?.email || req.user?.xID || 'SuperAdmin',
    });

    const result = await repoAgentService.dispatchCodeTask({
      agent,
      prompt: prompt.trim(),
      mode,
      targetFile: targetFile ? String(targetFile).trim() : null,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('[REPO_AGENT] Task dispatch failed:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to dispatch code task.',
    });
  }
};

/**
 * GET /api/superadmin/repo-agent/prs
 * List recent Pull Requests from the repository
 */
const getRepoAgentPRs = async (req, res) => {
  try {
    const { state = 'open' } = req.query;
    const prs = await repoAgentService.fetchRepoPullRequests(state);
    return res.json({
      success: true,
      data: prs,
    });
  } catch (error) {
    log.error('[REPO_AGENT] Failed to list PRs:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pull requests.',
    });
  }
};

module.exports = {
  getRepoAgentStatus,
  runRepoAgentAudit,
  dispatchRepoAgentTask,
  getRepoAgentPRs,
};
