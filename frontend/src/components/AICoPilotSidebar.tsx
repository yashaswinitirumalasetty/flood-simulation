import React, { useState } from 'react';
import { Bot, Send, Sparkles, X, CornerDownLeft, ShieldAlert } from 'lucide-react';
import { ChatMessage, SimulationParameters } from '../types';

interface AICoPilotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

export const AICoPilotSidebar: React.FC<AICoPilotSidebarProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isProcessing
}) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const suggestions = [
    "Configure 100-Year Design Flood",
    "Increase rainfall intensity by 35%",
    "Which hospitals lose road access first?",
    "Show total economic damage and displaced population",
    "Set 500-Year Extreme Storm"
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-[#0f172a]/95 border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Top Bar */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">HydroForge Co-Pilot</h3>
            <span className="text-[10px] text-purple-300 font-mono">Physics-Grounded AI Agent</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl ${
                msg.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
              }`}
            >
              <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
              {msg.applied_actions && msg.applied_actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-500/30 flex flex-col space-y-1 text-[11px] text-purple-300">
                  {msg.applied_actions.map((act, idx) => (
                    <span key={idx}>⚙️ {act}</span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center space-x-2 text-xs text-purple-400 p-2">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Reasoning across hydrodynamic state...</span>
          </div>
        )}
      </div>

      {/* Suggestion Pills */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex flex-wrap gap-1.5">
        {suggestions.map((sug, i) => (
          <button
            key={i}
            onClick={() => onSendMessage(sug)}
            className="text-[10px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900 flex items-center space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or configure a scenario..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-all shadow-md shadow-purple-600/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
