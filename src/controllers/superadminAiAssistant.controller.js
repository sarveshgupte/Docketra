'use strict';

const geminiProvider = require('../services/ai/providers/gemini.provider');
const log = require('../utils/log');

const CONTEXT_DOCKETRA = [
  'Docketra is a professional B2B SaaS platform specifically designed for CS (Company Secretary) firms, law firms, CA (Chartered Accountant) firms, and professional services firms.',
  'Current core focus is task and docket workflow management (compliance deadlines, document tracing, status lifecycles).',
  'Tech stack: React frontend, Node.js backend, MongoDB, Redis, Render, GitHub.',
  'The founder is solo and pre-launch. Therefore, it is critical to prioritize launch readiness, system stability, customer onboarding, and early revenue over overengineering or complex multi-agent architectures.',
].join(' ');

const ADVISOR_PROMPTS = {
  'Product Advisor': [
    'You are the Platform Product Advisor for Docketra.',
    'Your goal is to help the solo founder prioritize the product roadmap, define MVP scope, refine user workflows, increase customer value, and achieve launch readiness.',
    'Be extremely strict about avoiding overengineering. Suggest simple, high-impact features.',
    'Keep your advice extremely actionable, clear, and direct. Focus on getting the product in front of users as quickly and stably as possible.',
    'Your responses are advice only; make it clear that you cannot execute any changes autonomously.',
  ].join(' '),

  'Developer Advisor': [
    'You are the Technical Developer Advisor for Docketra.',
    'Your goal is to assist with backend/frontend architecture, debugging, PR planning, unit/integration testing strategies, security boundaries, env variables, deployment config, and code review prompts.',
    'Prefer small, incremental, safe PRs over large refactors.',
    'Strict rule: NEVER suggest weakening authentication, session tracking, authorization check, or general security rules. Always advocate for defense-in-depth.',
    'Your responses are technical drafts/advice only; you cannot run commands, create PRs, or modify customer data.',
  ].join(' '),

  'Marketing Advisor': [
    'You are the Marketing and Growth Advisor for Docketra.',
    'Your goal is to help with positioning, website landing page copy, LinkedIn growth strategies, cold outreach scripts, customer onboarding tutorials, and early discovery scripts.',
    'Your primary target audience is Indian CS, law, CA, and boutique professional service firms. Speak directly to their specific compliance bottlenecks (e.g. MCA filings, GST timelines, tax audits).',
    'Prioritize low-cost, high-velocity customer acquisition channels.',
    'Your responses are copy/positioning ideas and advice only; you cannot send actual emails or run real campaigns.',
  ].join(' '),
};

/**
 * Handle SuperAdmin AI Assistant chat requests
 * POST /api/superadmin/ai-assistant/chat
 */
const getSuperadminAiAssistantChat = async (req, res) => {
  try {
    const { mode, message } = req.body;

    if (!mode || !ADVISOR_PROMPTS[mode]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing advisor mode.',
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required.',
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 4000) {
      return res.status(400).json({
        success: false,
        message: 'Message exceeds maximum length of 4000 characters.',
      });
    }

    // Defensive system instruction construction
    const systemInstruction = `${CONTEXT_DOCKETRA}\n\n${ADVISOR_PROMPTS[mode]}\n\nIMPORTANT: You are a private platform assistant. Your responses must be displayed strictly as advice or drafts for the SuperAdmin owner. You have NO autonomous actions, NO access to customer database records, and NO ability to mutate production data.`;

    const start = Date.now();
    log.info('[AI_ASSISTANT] Invoking Gemini provider chat...', {
      mode,
      messageLength: trimmedMessage.length,
      performedBy: req.user?.email || req.user?.xID || 'SuperAdmin',
    });

    const result = await geminiProvider.generateChatResponse(trimmedMessage, systemInstruction, {
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    log.info('[AI_ASSISTANT] Gemini response generated successfully', {
      mode,
      latencyMs: Date.now() - start,
      model: result.model,
    });

    return res.json({
      success: true,
      data: {
        text: result.text,
      },
    });
  } catch (error) {
    // Defensively log error details safely without leaking prompt text, keys, or internal PII
    log.error('[AI_ASSISTANT] Error generating response from Gemini:', {
      message: error.message,
      code: error.code || null,
      status: error.status || null,
      provider: error.provider || null,
      details: error.details ? String(error.details).slice(0, 150) : null,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to generate advice. Please verify your GEMINI_API_KEY environment variable is set up correctly.',
    });
  }
};

module.exports = {
  getSuperadminAiAssistantChat,
};
