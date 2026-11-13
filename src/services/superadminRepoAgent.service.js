'use strict';

const fs = require('fs');
const path = require('path');
const log = require('../utils/log');
const geminiProvider = require('./ai/providers/gemini.provider');

const REPO_ROOT = path.resolve(__dirname, '../../');
const JULES_DIR = path.join(REPO_ROOT, '.jules');

/**
 * Parse a markdown file inside .jules/ extracting learnings and prevention rules.
 */
function parseJulesMarkdown(filename) {
  const filePath = path.join(JULES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return { entryCount: 0, lastUpdated: null, recentLearnings: [] };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const entries = [];
    const blocks = content.split(/(?=^## \d{4}-\d{2}-\d{2})/m);

    for (const block of blocks) {
      const match = block.match(/^## (\d{4}-\d{2}-\d{2})\s*-\s*([^\r\n]+)/);
      if (!match) continue;

      const date = match[1];
      const title = match[2].trim();

      const vulnMatch = block.match(/\*\*Vulnerability:\*\*\s*([^\r\n]+)/);
      const learningMatch = block.match(/\*\*Learning:\*\*\s*([^\r\n]+)/);
      const actionMatch = block.match(/\*\*(?:Prevention|Action):\*\*\s*([^\r\n]+)/);

      entries.push({
        date,
        title,
        problem: (vulnMatch ? vulnMatch[1] : learningMatch ? learningMatch[1] : '').trim(),
        prevention: (actionMatch ? actionMatch[1] : '').trim(),
      });
    }

    return {
      entryCount: entries.length,
      lastUpdated: entries.length > 0 ? entries[0].date : null,
      recentLearnings: entries.slice(0, 5),
    };
  } catch (error) {
    log.warn('[REPO_AGENT] Failed to parse .jules file:', { filename, error: error.message });
    return { entryCount: 0, lastUpdated: null, recentLearnings: [] };
  }
}

/**
 * Scan directory recursively for files matching extension.
 */
function scanFiles(dir, ext, callback) {
  const fullDir = path.resolve(REPO_ROOT, dir);
  if (!fs.existsSync(fullDir)) return;

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const f of files) {
      if (f === 'node_modules' || f === '.git' || f === 'build' || f === 'dist') continue;
      const fullPath = path.join(currentDir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (f.endsWith(ext)) {
        const relPath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf8');
        callback(relPath, content);
      }
    }
  }

  walk(fullDir);
}

/**
 * Get comprehensive agent status including .jules memory and GitHub connection.
 */
function getRepoStatus() {
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '';
  const githubRepo = process.env.GITHUB_REPO || 'Docketra/Docketra-main';
  const defaultBranch = process.env.GITHUB_DEFAULT_BRANCH || 'main';

  const sentinel = parseJulesMarkdown('sentinel.md');
  const bolt = parseJulesMarkdown('bolt.md');
  const palette = parseJulesMarkdown('palette.md');

  return {
    github: {
      configured: Boolean(githubToken),
      repo: githubRepo,
      branch: defaultBranch,
      mode: githubToken ? 'cloud_live' : 'preview_only',
    },
    agents: {
      sentinel: {
        id: 'sentinel',
        name: 'Sentinel',
        icon: '🛡️',
        specialty: 'Security, SAST & Vulnerability Defense',
        entryCount: sentinel.entryCount,
        lastUpdated: sentinel.lastUpdated,
        recentLearnings: sentinel.recentLearnings,
      },
      bolt: {
        id: 'bolt',
        name: 'Bolt',
        icon: '⚡',
        specialty: 'Performance, Query Latency & N+1 Elimination',
        entryCount: bolt.entryCount,
        lastUpdated: bolt.lastUpdated,
        recentLearnings: bolt.recentLearnings,
      },
      palette: {
        id: 'palette',
        name: 'Palette',
        icon: '🎨',
        specialty: 'UI/UX Polish, Accessibility & Token Alignment',
        entryCount: palette.entryCount,
        lastUpdated: palette.lastUpdated,
        recentLearnings: palette.recentLearnings,
      },
    },
  };
}

/**
 * Run deterministic static audit checks based on .jules rules.
 */
function runCodebaseAudit(targetAgent = 'all') {
  const findings = [];

  // 1. Sentinel Security Checks
  if (targetAgent === 'all' || targetAgent === 'sentinel') {
    scanFiles('src/controllers', '.js', (relPath, content) => {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Regex without escape
        if (line.includes('new RegExp(') && !line.includes('escapeRegExp') && !line.includes('// safe-regex')) {
          findings.push({
            id: `sentinel-regex-${relPath}-${idx + 1}`,
            agent: 'sentinel',
            agentName: 'Sentinel',
            title: 'Dynamic RegExp constructor without escapeRegExp',
            severity: 'HIGH',
            filePath: relPath,
            lineNumber: idx + 1,
            snippet: line.trim(),
            recommendation: 'Wrap user/dynamic variables with escapeRegExp from src/utils/regexp.utils.js to prevent ReDoS.',
            ruleReference: '.jules/sentinel.md (Prevent ReDoS by Escaping Regex Variables)',
          });
        }
      });
    });

    scanFiles('src/utils', '.js', (relPath, content) => {
      if (relPath.includes('test') || relPath.includes('spec')) return;
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('Math.random()') && !line.includes('crypto.random') && !line.includes('// non-crypto')) {
          findings.push({
            id: `sentinel-random-${relPath}-${idx + 1}`,
            agent: 'sentinel',
            agentName: 'Sentinel',
            title: 'Insecure Pseudo-Random Number Generator (Math.random)',
            severity: 'MEDIUM',
            filePath: relPath,
            lineNumber: idx + 1,
            snippet: line.trim(),
            recommendation: 'Use Node.js crypto module (crypto.randomInt or crypto.randomBytes) instead of Math.random().',
            ruleReference: '.jules/sentinel.md (Secure Random Number Generation)',
          });
        }
      });
    });
  }

  // 2. Bolt Performance Checks
  if (targetAgent === 'all' || targetAgent === 'bolt') {
    scanFiles('src/controllers', '.js', (relPath, content) => {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('countDocuments(') && (line.includes('> 0') || line.includes('=== 0') || line.includes('>= 1'))) {
          findings.push({
            id: `bolt-count-docs-${relPath}-${idx + 1}`,
            agent: 'bolt',
            agentName: 'Bolt',
            title: 'Suboptimal countDocuments() used for boolean presence check',
            severity: 'MEDIUM',
            filePath: RelPath(relPath),
            lineNumber: idx + 1,
            snippet: line.trim(),
            recommendation: 'Replace countDocuments() > 0 with Model.exists(query) for O(1) early-return scan.',
            ruleReference: '.jules/bolt.md (Optimize Boolean Presence Checks in MongoDB)',
          });
        }
      });
    });
  }

  // 3. Palette UI/UX & Accessibility Checks
  if (targetAgent === 'all' || targetAgent === 'palette') {
    scanFiles('ui/src/components', '.jsx', (relPath, content) => {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Raw inline hex colors instead of Tailwind classes
        const hexMatch = line.match(/#[0-9a-fA-F]{3,6}/);
        if (hexMatch && !relPath.includes('ColorPicker') && !line.includes('// color-literal')) {
          findings.push({
            id: `palette-color-hex-${relPath}-${idx + 1}`,
            agent: 'palette',
            agentName: 'Palette',
            title: `Hardcoded hex color literal (${hexMatch[0]}) in component`,
            severity: 'LOW',
            filePath: relPath,
            lineNumber: idx + 1,
            snippet: line.trim(),
            recommendation: 'Replace raw hex code with Docketra semantic design tokens or Tailwind color classes.',
            ruleReference: '.jules/palette.md (UI/UX Palette Conformance)',
          });
        }
      });
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    agent: targetAgent,
    totalFindings: findings.length,
    findings: findings.slice(0, 20),
  };
}

function RelPath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Dispatch an autonomous code task via Gemini and optionally create a GitHub PR.
 */
async function dispatchCodeTask({ agent, prompt, mode = 'preview', targetFile }) {
  const status = getRepoStatus();
  const agentInfo = status.agents[agent] || status.agents.sentinel;

  // Read the specific .jules rule file as ground truth context
  let ruleContext = '';
  const julesFile = path.join(JULES_DIR, `${agent}.md`);
  if (fs.existsSync(julesFile)) {
    ruleContext = fs.readFileSync(julesFile, 'utf8');
  }

  // If a target file is specified and exists, load its content safely within repository bounds
  let targetFileContent = '';
  if (targetFile) {
    const fullTarget = path.resolve(REPO_ROOT, targetFile);
    const normalizedRepoRoot = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : `${REPO_ROOT}${path.sep}`;
    if (!fullTarget.startsWith(normalizedRepoRoot)) {
      throw new Error('Target file must reside within repository root');
    }
    const relativeTarget = path.relative(REPO_ROOT, fullTarget);
    if (/^\.env/i.test(relativeTarget) || /(^|\/|\\)\.env/i.test(relativeTarget)) {
      throw new Error('Access to sensitive configuration files is restricted');
    }
    if (fs.existsSync(fullTarget) && fs.statSync(fullTarget).isFile()) {
      targetFileContent = `\n--- Target File Content (${targetFile}) ---\n` + fs.readFileSync(fullTarget, 'utf8').slice(0, 4000);
    }
  }

  const systemInstruction = [
    `You are ${agentInfo.name}, the specialized repository agent for Docketra.`,
    `Your specialty is: ${agentInfo.specialty}.`,
    `Your institutional guidelines from .jules/${agent}.md:\n${ruleContext.slice(0, 2500)}`,
    '',
    'Strict instructions:',
    '1. Produce clean, minimal, production-ready code. Do NOT over-engineer.',
    '2. Follow Docketra conventions (Node.js backend, React frontend, Tailwind CSS, clean architecture).',
    '3. Provide your response with these exact markdown sections:',
    '### Rationale',
    '<Explain what was found and why the fix preserves stability>',
    '### Proposed Changes',
    '<High-level summary of edits>',
    '### Unified Diff',
    '```diff',
    '<Provide the unified diff here>',
    '```',
    '### PR Summary',
    'Title: <Concise PR title under 60 chars>',
    '<PR description body>',
  ].join('\n');

  const fullPrompt = `${prompt}${targetFileContent}`;

  const aiResult = await geminiProvider.generateChatResponse(fullPrompt, systemInstruction, {
    temperature: 0.2,
    maxOutputTokens: 2500,
  });

  const responseText = aiResult.text || '';

  // Extract PR Title if present
  const titleMatch = responseText.match(/Title:\s*([^\r\n]+)/);
  const prTitle = titleMatch ? titleMatch[1].trim() : `[${agentInfo.name}] ${prompt.slice(0, 50)}...`;

  // If live cloud mode and user requested PR creation
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  let prResult = null;

  if (mode === 'create_pr' && githubToken) {
    try {
      prResult = await createGitHubPullRequest({
        title: prTitle,
        agent,
        body: responseText,
      });
    } catch (err) {
      log.error('[REPO_AGENT] Failed to create GitHub PR:', { error: err.message });
      prResult = {
        created: false,
        error: `GitHub API error: ${err.message}. Diff preview is available below.`,
      };
    }
  }

  return {
    agent,
    agentName: agentInfo.name,
    mode,
    prTitle,
    analysis: responseText,
    prResult: prResult || {
      created: false,
      message: githubToken 
        ? 'Preview generated. Click "Create GitHub PR" to commit and open PR.' 
        : 'Preview generated. To enable 1-click cloud PR creation, add GITHUB_TOKEN to your environment.',
    },
  };
}

/**
 * Create branch and pull request directly via GitHub REST API without GitHub Actions.
 */
async function createGitHubPullRequest({ title, agent, body }) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO || 'Docketra/Docketra-main';
  const defaultBranch = process.env.GITHUB_DEFAULT_BRANCH || 'main';

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Docketra-SuperAdmin-RepoAgent',
  };

  // 1. Get base branch commit SHA
  const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${defaultBranch}`, { headers });
  if (!refRes.ok) {
    throw new Error(`Failed to fetch default branch reference: HTTP ${refRes.status}`);
  }
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Create new branch
  const branchName = `agent/${agent}-${Date.now().toString(36)}`;
  const createBranchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });

  if (!createBranchRes.ok) {
    throw new Error(`Failed to create branch: HTTP ${createBranchRes.status}`);
  }

  // 3. Create Pull Request
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title,
      head: branchName,
      base: defaultBranch,
      body: `### Autonomous Agent PR (${agent.toUpperCase()})\n\n${body}\n\n---\n*Created by Docketra SuperAdmin Repo Agent*`,
    }),
  });

  if (!prRes.ok) {
    const errorBody = await prRes.text();
    throw new Error(`Failed to create PR: HTTP ${prRes.status} - ${errorBody}`);
  }

  const prData = await prRes.json();

  return {
    created: true,
    prNumber: prData.number,
    prUrl: prData.html_url,
    branch: branchName,
  };
}

/**
 * Fetch pull requests from GitHub repository.
 */
async function fetchRepoPullRequests(state = 'open') {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO || 'Docketra/Docketra-main';

  if (!token) {
    return {
      configured: false,
      pullRequests: [],
      message: 'GITHUB_TOKEN is not configured. Add it in your deployment environment variables to view live PRs.',
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=10`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Docketra-SuperAdmin-RepoAgent',
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const prs = await res.json();
    return {
      configured: true,
      pullRequests: (prs || []).map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        url: pr.html_url,
        createdAt: pr.created_at,
        isAgentPR: pr.title.includes('[Sentinel]') || pr.title.includes('[Bolt]') || pr.title.includes('[Palette]') || (pr.head?.ref || '').startsWith('agent/'),
      })),
    };
  } catch (err) {
    log.warn('[REPO_AGENT] Failed to list PRs from GitHub:', { error: err.message });
    return {
      configured: true,
      pullRequests: [],
      error: err.message,
    };
  }
}

module.exports = {
  getRepoStatus,
  runCodebaseAudit,
  dispatchCodeTask,
  fetchRepoPullRequests,
};
