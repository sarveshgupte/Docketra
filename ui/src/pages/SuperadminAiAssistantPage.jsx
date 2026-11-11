import React, { useState, useRef, useEffect } from 'react';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { superadminService } from '../services/superadminService';
import { generateUUID } from '../utils/crypto';
import { SuperadminRepoAgentView } from './admin/components/SuperadminRepoAgentView';

const ModeIcon = ({ name, className = 'w-5 h-5' }) => {
  if (name === 'Product Advisor') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M9 14l2 2 4-4" />
      </svg>
    );
  }
  if (name === 'Developer Advisor') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <path d="M12 2v20" strokeDasharray="3 3" />
      </svg>
    );
  }
  // Marketing Advisor
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
};

const ADVISOR_MODES = [
  {
    name: 'Product Advisor',
    tagline: 'Prioritize roadmap, MVP scope, and solo-launch workflows.',
    description: 'Use this mode to validate product scope, focus on launch readiness, map high-impact features, and avoid overengineering.',
    suggestions: [
      'How do I cut down features for our pre-launch MVP?',
      'Draft a workflow for tracking compliance tasks in a CS firm.',
      'What are the highest impact onboarding steps for solo founders?'
    ]
  },
  {
    name: 'Developer Advisor',
    tagline: 'Architect, plan tests, plan safe PRs, and review security.',
    description: 'Use this mode to plan small safe PRs, plan integrations, structure security bounds, and draft code review guidelines.',
    suggestions: [
      'Suggest a safe testing strategy for our superadmin endpoints.',
      'How should I securely handle third-party BYOS credentials?',
      'Draft a guideline for creating safe incremental PRs.'
    ]
  },
  {
    name: 'Marketing Advisor',
    tagline: 'Position, draft outreach, and scale Indian professional services.',
    description: 'Use this mode to refine website copy, draft cold outreach scripts, and map growth campaigns targeting CS/law/CA firms.',
    suggestions: [
      'Draft a cold email sequence targeting boutique Indian CA firms.',
      'What are key pain points for CS firms filing MCA documents?',
      'Suggest three LinkedIn post topics for a solo pre-launch founder.'
    ]
  }
];

export const SuperadminAiAssistantPage = () => {
  const [activeTab, setActiveTab] = useState('repo-agents');
  const [selectedMode, setSelectedMode] = useState('Product Advisor');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const currentModeData = ADVISOR_MODES.find(m => m.name === selectedMode);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage;
    if (!text || !text.trim() || loading) return;

    setError('');
    const userMsg = {
      id: `msg-${Date.now()}-${generateUUID()}`,
      role: 'user',
      content: text.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const response = await superadminService.sendChatMessage({
        mode: selectedMode,
        message: userMsg.content
      });

      if (response?.success && response?.data?.text) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-${generateUUID()}`,
          role: 'assistant',
          content: response.data.text
        }]);
      } else {
        throw new Error(response?.message || 'Failed to generate advice.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to connect to the Gemini backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const handleClearChat = () => {
    setMessages([]);
    setError('');
  };

  return (
    <SuperAdminLayout>
      <div className="mx-auto w-full max-w-7xl flex flex-col min-h-[calc(100vh-8rem)] space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              SuperAdmin AI Assistant <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider border border-slate-200">Ops Hub</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Autonomous repository watchdogs (Sentinel, Bolt, Palette) and platform strategic copilot.
            </p>
          </div>
          {activeTab === 'advisory' && messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleClearChat} className="self-start sm:self-center">
              Clear conversation
            </Button>
          )}
        </div>

        {/* Primary Workspace Tab Switcher */}
        <div className="flex border-b border-gray-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('repo-agents')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
              activeTab === 'repo-agents'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span>🛡️</span>
            Repo Agent Ops (Sentinel • Bolt • Palette)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advisory')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
              activeTab === 'advisory'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span>💬</span>
            Advisory Copilot (Product • Dev • Marketing)
          </button>
        </div>

        {/* Tab 1: Repo Coding Agent Ops */}
        {activeTab === 'repo-agents' && (
          <SuperadminRepoAgentView />
        )}

        {/* Tab 2: Advisory Copilot */}
        {activeTab === 'advisory' && (
          <div className="space-y-6">
            {/* Advisor Mode Selector Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ADVISOR_MODES.map((mode) => {
                const isSelected = selectedMode === mode.name;
                return (
                  <button
                    key={mode.name}
                    type="button"
                    onClick={() => {
                      setSelectedMode(mode.name);
                      setError('');
                    }}
                    className={`text-left rounded-xl p-4 border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                      isSelected 
                        ? 'border-gray-900 bg-white shadow-xs ring-1 ring-gray-900' 
                        : 'border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 font-semibold text-gray-900">
                      <div className={`p-1.5 rounded-lg border transition-colors ${
                        isSelected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
                      }`}>
                        <ModeIcon name={mode.name} className="w-4 h-4" />
                      </div>
                      <span>{mode.name}</span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium mt-2">{mode.tagline}</p>
                  </button>
                );
              })}
            </div>

            {/* Main Work Area */}
            <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden min-h-[450px]">
              
              {/* Active Mode Guide Ribbon */}
              <div className="bg-slate-50 border-b border-gray-100 px-6 py-3 flex items-center justify-between gap-4">
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Advisor: <strong className="text-gray-900">{selectedMode}</strong>
                </div>
                <p className="hidden md:block text-xs text-gray-500 italic max-w-lg truncate">
                  {currentModeData.description}
                </p>
              </div>

              {/* Chat / Messages Panel */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[500px]">
                
                {messages.length === 0 ? (
                  /* Empty State with Suggestions */
                  <div className="h-full flex flex-col justify-center items-center py-10 max-w-2xl mx-auto text-center space-y-5">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-200 text-gray-900 shadow-xs">
                      <ModeIcon name={selectedMode} className="w-7 h-7 text-gray-900" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Consult your {selectedMode}</h2>
                      <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                        {currentModeData.description} Select a prompt below or type your question.
                      </p>
                    </div>

                    <div className="w-full grid grid-cols-1 gap-2 text-left mt-2">
                      {currentModeData.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 p-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900 flex items-start gap-2.5"
                        >
                          <span className="text-gray-400 font-bold shrink-0">Q{index + 1}:</span>
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Message History Bubble List */
                  <div className="space-y-6">
                    {messages.map((msg) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-3xl rounded-2xl px-5 py-4 ${
                            isUser 
                              ? 'bg-gray-900 text-white shadow-xs' 
                              : 'bg-slate-50 border border-slate-200/80 text-gray-800'
                          }`}>
                            
                            {!isUser && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                <ModeIcon name={selectedMode} className="w-3.5 h-3.5 text-gray-500" />
                                <span>{selectedMode} Advice</span>
                              </div>
                            )}

                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </div>

                            {!isUser && (
                              <div className="mt-4 pt-3 border-t border-slate-200/50 text-[10px] text-slate-500 flex items-start gap-1">
                                <span className="font-semibold text-slate-600">Advice Only:</span>
                                <span>This response is an AI draft. docketra does not authorize autonomous executions. Verify logic independently.</span>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Skeletons Loaders */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-4 max-w-xl w-full space-y-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="animate-spin text-xs">⏳</span>
                        <span>Gemini is thinking...</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200/80 rounded animate-pulse w-full"></div>
                        <div className="h-4 bg-slate-200/80 rounded animate-pulse w-5/6"></div>
                        <div className="h-4 bg-slate-200/80 rounded animate-pulse w-2/3"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* General Alert Error Block */}
                {error && (
                  <div className="border border-red-200 bg-red-50 text-red-700 p-4 rounded-xl text-sm flex flex-col gap-2 max-w-3xl">
                    <div className="font-bold flex items-center gap-1.5">
                      Request Error
                    </div>
                    <div>{error}</div>
                    <Button variant="secondary" size="sm" onClick={() => handleSendMessage()} className="self-start text-xs bg-white hover:bg-slate-100 text-red-700 border-red-200 mt-1">
                      Retry send
                    </Button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Form / Message Input Panel */}
              <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex flex-col gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-3"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value.slice(0, 4000))}
                    disabled={loading}
                    placeholder={`Ask ${selectedMode} anything... (max 4000 chars)`}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputMessage.trim()}
                    className="rounded-xl bg-gray-900 text-white px-5 py-2.5 text-xs font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:hover:bg-gray-900 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Send</span>
                    <span>➔</span>
                  </button>
                </form>
                
                <div className="flex justify-between items-center text-[10px] text-gray-500 px-1 mt-0.5">
                  <span>Security Guard: customer data will never be sent to Gemini.</span>
                  <span className={inputMessage.length > 3500 ? 'text-amber-700 font-bold' : ''}>
                    {inputMessage.length} / 4000
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </SuperAdminLayout>
  );
};

export default SuperadminAiAssistantPage;
