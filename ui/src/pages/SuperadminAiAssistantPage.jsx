import React, { useState, useRef, useEffect } from 'react';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { superadminService } from '../services/superadminService';
import { generateUUID } from '../utils/crypto';

const ADVISOR_MODES = [
  {
    name: 'Product Advisor',
    icon: '🎯',
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
    icon: '💻',
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
    icon: '📢',
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
              SuperAdmin AI Assistant <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider border border-slate-200">MVP</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Private platform copilot to reason about product, roadmap, security, and growth. responses are static advice only.
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleClearChat} className="self-start sm:self-center">
              Clear conversation
            </Button>
          )}
        </div>

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
                className={`text-left rounded-xl p-4 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                  isSelected 
                    ? 'border-gray-900 bg-white shadow-md shadow-gray-100 ring-1 ring-gray-900' 
                    : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <span className="text-xl" role="img" aria-label={mode.name}>{mode.icon}</span>
                  {mode.name}
                </div>
                <p className="text-xs text-gray-600 font-medium mt-1">{mode.tagline}</p>
              </button>
            );
          })}
        </div>

        {/* Main Work Area */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-h-[450px]">
          
          {/* Active Mode Guide Ribbon */}
          <div className="bg-slate-50 border-b border-gray-100 px-6 py-3 flex items-center justify-between gap-4">
            <div className="text-xs text-gray-600 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active Advisor: <strong className="text-gray-900">{selectedMode}</strong>
            </div>
            <p className="hidden md:block text-xs text-gray-500 italic max-w-lg truncate">
              {currentModeData.description}
            </p>
          </div>

          {/* Chat / Messages Panel */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[500px]">
            
            {messages.length === 0 ? (
              /* Beautiful Empty State with Suggestions */
              <div className="h-full flex flex-col justify-center items-center py-8 max-w-2xl mx-auto text-center space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 text-3xl shadow-sm">
                  {currentModeData.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Consult your {selectedMode}</h2>
                  <p className="text-sm text-gray-500 mt-2">
                    {currentModeData.description} Start by clicking one of the suggested prompts below or ask anything.
                  </p>
                </div>

                <div className="w-full grid grid-cols-1 gap-2.5 text-left mt-4">
                  {currentModeData.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="text-xs text-gray-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900 flex items-start gap-2.5"
                    >
                      <span className="text-slate-400 font-bold">Q{index + 1}:</span>
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
                          ? 'bg-gray-900 text-white shadow-sm' 
                          : 'bg-slate-50 border border-slate-200/80 text-gray-800'
                      }`}>
                        
                        {/* Advisor Identification Header */}
                        {!isUser && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            <span>{currentModeData.icon}</span>
                            <span>{selectedMode} Advice</span>
                          </div>
                        )}

                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Advisor Disclaimer footer */}
                        {!isUser && (
                          <div className="mt-4 pt-3 border-t border-slate-200/50 text-[10px] text-slate-500 flex items-start gap-1">
                            <span className="font-semibold text-slate-600">⚠️ Advice Only:</span>
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
                  <span>❌</span> Request Error
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
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white disabled:bg-gray-100 disabled:text-gray-500"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="rounded-xl bg-gray-900 text-white px-5 py-3 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:hover:bg-gray-900 flex items-center gap-1.5 shadow-sm"
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
    </SuperAdminLayout>
  );
};

export default SuperadminAiAssistantPage;
