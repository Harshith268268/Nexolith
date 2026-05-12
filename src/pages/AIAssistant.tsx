import React, { useEffect, useRef, useState } from 'react';
import { useFamily } from '../lib/FamilyContext';
import { Send, Bot, User, Sparkles, Loader2, FileText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED = [
  "What is my latest glucose level?",
  "Are there any abnormal values in my reports?",
  "Summarize my overall health status.",
  "What was my most recent HbA1c reading?",
  "Which parameters have been improving?",
];

export function AIAssistant() {
  const { activeMember, members, reports, auth } = useFamily();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getWelcome = () =>
    `Hello! I'm your HealthAI assistant. I have access to ${activeMember?.name || 'your family'}'s medical records — ${memberReports.length} report(s) with ${totalLabValues} lab values. Ask me anything!`;

  const memberReports = activeMember
    ? reports.filter(r => r.memberId === activeMember.id)
    : reports;

  const totalLabValues = memberReports.reduce((acc, r) => acc + (r.labValues?.length || 0), 0);

  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: getWelcome(), timestamp: new Date() }
  ]);

  // Reset chat when member changes
  useEffect(() => {
    setMessages([{ id: Date.now().toString(), role: 'assistant', content: getWelcome(), timestamp: new Date() }]);
  }, [activeMember?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    const historyBeforeSend = [...messages];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build rich context from real reports
      const context = memberReports.map(r => ({
        reportTitle: r.title,
        date: r.date,
        type: r.type,
        abnormality: r.abnormality,
        summary: r.summary,
        member: members.find(m => m.id === r.memberId)?.name || 'Unknown',
        labValues: (r.labValues || []).map((lv: any) => ({
          parameter: lv.parameter,
          value: lv.value,
          unit: lv.unit,
          status: lv.status,
          referenceRange: lv.referenceRange
        }))
      }));

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          memberName: activeMember?.name || 'the family',
          chatHistory: historyBeforeSend.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response || "I couldn't generate a response.",
        timestamp: new Date()
      }]);
    } catch (err) {
      toast.error('Could not connect to AI. Please try again later.');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to the backend right now. I'll be back online soon!",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-600" />
            AI Health Assistant
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Ask questions about {activeMember ? `${activeMember.name}'s` : 'your family\'s'} medical records.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-2 text-xs text-primary-700 font-medium">
          <FileText className="w-3.5 h-3.5" />
          {memberReports.length} reports · {totalLabValues} values
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                msg.role === 'assistant' ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 size={14} className="animate-spin text-primary-500" />
                  <span className="text-sm">Analyzing your records...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length <= 2 && !isTyping && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400 mb-2 font-medium">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="px-3 py-1.5 bg-white text-primary-700 border border-primary-200 hover:bg-primary-50 rounded-full text-xs font-medium transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No reports warning */}
        {memberReports.length === 0 && (
          <div className="px-4 py-3 border-t border-amber-100 bg-amber-50 flex items-center gap-2 text-sm text-amber-700">
            <FileText className="w-4 h-4 shrink-0" />
            <span>No reports found. <Link to="/reports/upload" className="font-semibold underline">Upload a report</Link> so I can answer questions about your health data.</span>
          </div>
        )}

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={e => { e.preventDefault(); handleSend(input); }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your lab results, trends, or health advice..."
              disabled={isTyping}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-slate-50 focus:bg-white transition-all text-sm disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-12 shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
