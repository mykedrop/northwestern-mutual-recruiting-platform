import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { UserPlus, Check, Send, Bot, User, Sparkles, TrendingUp, Users, Target } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  location?: string;
  score?: number;
  likelihood?: string;
  skills?: string[];
}

interface Metrics {
  totalCandidates: number;
  avgScore: number;
  topMatches: number;
  completedAssessments: number;
  inProgress: number;
}

const AIDashboard = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [candidateResults, setCandidateResults] = useState<Candidate[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<Candidate[]>([]);
  const [mentionPosition, setMentionPosition] = useState(0);
  const [savedCandidates, setSavedCandidates] = useState<string[]>([]);
  const [savingCandidates, setSavingCandidates] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useNotifications();

  useEffect(() => {
    loadMetrics();
    // Check if user is demo user and load saved demo mode preference
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const savedDemoMode = localStorage.getItem('demoMode') === 'true';

    if (user.email === 'demo@northwestern.com') {
      setIsDemoMode(savedDemoMode);
    } else {
      setIsDemoMode(false);
    }
  }, []);

  const toggleDemoMode = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.email === 'demo@northwestern.com') {
      const newMode = !isDemoMode;
      setIsDemoMode(newMode);
      localStorage.setItem('demoMode', String(newMode));

      // Update user object with demo_mode flag
      user.demo_mode = newMode;
      localStorage.setItem('user', JSON.stringify(user));

      // Reload metrics with new mode
      loadMetrics();

      if (newMode) {
        success('Demo mode enabled - showing simulated data');
      } else {
        success('Demo mode disabled - showing real data');
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMetrics = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v3/ai/dashboard-metrics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.demo_mode = isDemoMode;
      const token = localStorage.getItem('accessToken');

      const response = await fetch('http://localhost:3001/api/v3/ai/intelligent-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: input,
          user
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.isDemoMode ? `🎭 [Demo Mode]\n\n${data.response}` : data.response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          setCandidateResults(data.data);
        }

        if (data.actions && Array.isArray(data.actions)) {
          data.actions.forEach((action: any) => {
            if (action.type === 'email' && action.status === 'sent') {
              success('Email sent successfully!');
            } else if (action.type === 'calendar') {
              success('Calendar event created!');
            }
          });
        }
      } else {
        throw new Error(data.error || 'Failed to process query');
      }
    } catch (err: any) {
      error(err.message || 'Failed to send message');
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuery = (query: string) => {
    setInput(query);
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setInput(value);

    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && atIndex === textBeforeCursor.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
      setMentionPosition(atIndex);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v3/ai/search-candidates?q=', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setMentionSuggestions(data.candidates);
      }
    } else if (atIndex !== -1) {
      const searchText = textBeforeCursor.slice(atIndex + 1);
      if (/^[a-z\s]*$/i.test(searchText) && searchText.length < 30) {
        setShowMentions(true);
        setMentionSearch(searchText);
        setMentionPosition(atIndex);

        if (searchText.length >= 1) {
          const token = localStorage.getItem('accessToken');
          const response = await fetch(`http://localhost:3001/api/v3/ai/search-candidates?q=${encodeURIComponent(searchText)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setMentionSuggestions(data.candidates);
          }
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (candidate: Candidate) => {
    const beforeMention = input.slice(0, mentionPosition);
    const afterMention = input.slice(mentionPosition + mentionSearch.length + 1);
    const newInput = `${beforeMention}@${candidate.first_name} ${candidate.last_name} ${afterMention}`;
    setInput(newInput);
    setShowMentions(false);
    setMentionSuggestions([]);
    inputRef.current?.focus();
  };

  const saveCandidate = async (candidate: Candidate) => {
    const candidateKey = `${candidate.first_name}_${candidate.last_name}_${candidate.email}`;

    // Avoid duplicate saves
    if (savedCandidates.includes(candidateKey) || savingCandidates.has(candidateKey)) {
      return;
    }

    setSavingCandidates(prev => new Set(prev.add(candidateKey)));

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          ...(candidate.phone && { phone: candidate.phone }),
          ...(candidate.linkedin_url && { linkedin_url: candidate.linkedin_url }),
          ...(candidate.location && { location: candidate.location }),
          ...(candidate.skills && candidate.skills.length > 0 && { skills: candidate.skills }),
          source: 'ai_chat'
        })
      });

      if (response.ok) {
        setSavedCandidates(prev => [...prev, candidateKey]);
        success(`${candidate.first_name} ${candidate.last_name} saved to candidates!`);
      } else {
        throw new Error('Failed to save candidate');
      }
    } catch (err: any) {
      error(err.message || 'Failed to save candidate');
    } finally {
      setSavingCandidates(prev => {
        const newSet = new Set(prev);
        newSet.delete(candidateKey);
        return newSet;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white p-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Sparkles className="mr-3 h-8 w-8" />
          Northwestern Mutual AI Intelligence
        </h1>
        <p className="text-blue-100 mt-2">Your intelligent partner in finding exceptional talent</p>
      </div>

      {/* Demo Mode Banner & Toggle */}
      {JSON.parse(localStorage.getItem('user') || '{}').email === 'demo@northwestern.com' && (
        <div className={`mb-6 rounded-lg p-4 border-2 ${
          isDemoMode
            ? 'bg-yellow-50 border-yellow-400'
            : 'bg-green-50 border-green-400'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className={`text-lg font-semibold ${
                isDemoMode ? 'text-yellow-800' : 'text-green-800'
              }`}>
                {isDemoMode ? '🎭 DEMO MODE' : '✅ REAL DATA MODE'}
              </h3>
              <p className={`text-sm ${
                isDemoMode ? 'text-yellow-700' : 'text-green-700'
              }`}>
                {isDemoMode
                  ? 'Showing simulated data for demonstration purposes'
                  : 'Showing real data from your database'
                }
              </p>
            </div>
            <button
              onClick={toggleDemoMode}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isDemoMode
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isDemoMode ? 'Switch to Real Data' : 'Switch to Demo Mode'}
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Metrics Dashboard */}
      {metrics && (
        <div className="bg-white border-b p-4">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard icon={Users} label="Total Candidates" value={metrics.totalCandidates} color="blue" />
            <MetricCard icon={TrendingUp} label="Avg Score" value={`${metrics.avgScore}%`} color="green" />
            <MetricCard icon={Target} label="Top Matches" value={metrics.topMatches} color="purple" />
            <MetricCard icon={Sparkles} label="AI Analyzed" value={metrics.completedAssessments} color="orange" />
          </div>
        </div>
      )}

      {/* Enhanced Chat Interface */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Quick Action Buttons */}
        <div className="bg-white border-b p-4">
          <div className="flex flex-wrap gap-2">
          <button
            onClick={() => quickQuery('Show me top 5 candidates')}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
          >
            🏆 Top Candidates
          </button>
          <button
            onClick={() => quickQuery('What are the pipeline bottlenecks?')}
            className="px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
          >
            ⚠️ Pipeline Issues
          </button>
          <button
            onClick={() => quickQuery('Show candidates in Philadelphia')}
            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
          >
            📍 By Location
          </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg mb-2">👋 Hi! I'm your AI recruiting assistant</p>
              <p className="text-sm">Try asking: "Show me top 5 candidates" or use the quick actions above</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 shadow'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Candidate Results */}
          {candidateResults.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-semibold mb-3">Candidate Results:</h3>
              <div className="space-y-2">
                {candidateResults.slice(0, 5).map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`p-3 rounded border-l-4 ${
                      (candidate.score || 0) >= 90
                        ? 'border-green-500 bg-green-50'
                        : (candidate.score || 0) >= 80
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {candidate.first_name} {candidate.last_name}
                        </p>
                        {candidate.email && (
                          <p className="text-sm text-blue-600 hover:underline">
                            <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
                          </p>
                        )}
                        {candidate.phone && (
                          <p className="text-sm text-gray-600">
                            <a href={`tel:${candidate.phone}`} className="hover:underline">{candidate.phone}</a>
                          </p>
                        )}
                        {candidate.linkedin_url && (
                          <p className="text-sm text-blue-500">
                            <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              🔗 LinkedIn Profile
                            </a>
                          </p>
                        )}
                        {candidate.location && (
                          <p className="text-sm text-gray-600">📍 {candidate.location}</p>
                        )}
                        {candidate.skills && candidate.skills.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Skills: {candidate.skills.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end space-y-2">
                        <div>
                          <p className={`text-lg font-bold ${
                            (candidate.score || 0) >= 90 ? 'text-green-600' :
                            (candidate.score || 0) >= 80 ? 'text-blue-600' : 'text-yellow-600'
                          }`}>
                            {Math.round(candidate.score || 0)}%
                          </p>
                          <p className="text-xs text-gray-500">{candidate.likelihood}</p>
                        </div>
                        {(() => {
                          const candidateKey = `${candidate.first_name}_${candidate.last_name}_${candidate.email}`;
                          const isSaved = savedCandidates.includes(candidateKey);
                          const isSaving = savingCandidates.has(candidateKey);

                          return (
                            <button
                              onClick={() => saveCandidate(candidate)}
                              disabled={isSaved || isSaving}
                              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                                isSaved
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : isSaving
                                  ? 'bg-gray-100 text-gray-500 cursor-wait'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                              title={isSaved ? 'Candidate saved' : 'Save candidate to database'}
                            >
                              {isSaving ? (
                                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : isSaved ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <UserPlus className="h-3 w-3" />
                              )}
                              {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-2 shadow">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t p-4 relative">
          {/* Mention Autocomplete Dropdown */}
          {showMentions && mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {mentionSuggestions.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => selectMention(candidate)}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2 border-b last:border-b-0"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                    {candidate.first_name[0]}{candidate.last_name[0]}
                  </div>
                  <div>
                    <div className="font-medium">{candidate.first_name} {candidate.last_name}</div>
                    <div className="text-xs text-gray-500">{candidate.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !loading && !showMentions) {
                  sendMessage();
                }
              }}
              placeholder="Ask me anything about your candidates..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>,
  label: string,
  value: string | number,
  color: 'blue' | 'green' | 'purple' | 'orange'
}) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700'
  };

  return (
    <div className={`${colors[color]} rounded-lg p-3 flex items-center space-x-3`}>
      <Icon className="h-8 w-8" />
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm opacity-80">{label}</div>
      </div>
    </div>
  );
};

export default AIDashboard;