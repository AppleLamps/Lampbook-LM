import React, { useState, useEffect, useRef, Fragment } from 'react';
import type { ChatMessage, Source, SynthesisFormat } from '../types';
import { SendIcon } from './icons/SendIcon';
import { UserIcon } from './icons/UserIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { Spinner } from './icons/Spinner';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  sources: Source[];
  onSelectSource: (source: Source | null) => void;
  onSynthesize: (format: SynthesisFormat) => void;
  onStopGenerating: () => void;
}

const SynthesisButton: React.FC<{
  format: SynthesisFormat;
  label: string;
  onClick: (format: SynthesisFormat) => void;
  disabled: boolean;
}> = ({ format, label, onClick, disabled }) => (
    <button 
      onClick={() => onClick(format)}
      disabled={disabled}
      className="px-4 py-1.5 text-sm bg-white/70 hover:bg-white border border-black/10 rounded-full transition-all disabled:bg-gray-100/50 disabled:text-gray-400 disabled:cursor-not-allowed shadow-soft hover:shadow-md"
    >
      {label}
    </button>
);

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, isLoading, isStreaming, sources, onSelectSource, onSynthesize, onStopGenerating }) => {
  const [input, setInput] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleCopy = (text: string, messageId: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text.');
    });
  };
  
  const parseAndRenderText = (text: string, activeSourcesContext: Source[] = []) => {
    const renderLineContent = (content: string, keyPrefix: string) => {
      const boldRegex = /\*\*(.*?)\*\*/g;
  
      return content.split(boldRegex).map((part, boldIndex) => {
        // Render bold text
        if (boldIndex % 2 === 1) {
          return <strong key={`${keyPrefix}-b-${boldIndex}`}>{part}</strong>;
        }
  
        // Parse for numbered citations in non-bold text
        const citationRegex = /\[(\d+)\]/g;
        return part.split(citationRegex).map((textPart, citeIndex) => {
          if (citeIndex % 2 === 1) { // This is the citation number
            const citationNumber = parseInt(textPart, 10);
            const source = activeSourcesContext[citationNumber - 1];
            return (
              <button
                key={`${keyPrefix}-c-${boldIndex}-${citeIndex}`}
                onClick={() => source && onSelectSource(source)}
                disabled={!source}
                className={`inline-block align-baseline bg-brand-blue/10 text-brand-blue font-semibold px-1.5 py-0.5 rounded-md text-xs mx-0.5 transition-colors ${source ? 'hover:bg-brand-blue/20 cursor-pointer' : 'cursor-default opacity-70'}`}
                title={source ? `Source: ${source.name}` : 'Source not available for this message'}
              >
                {citationNumber}
              </button>
            );
          }
          return textPart;
        });
      });
    };
  
    return text.split('\n').map((line, lineIndex) => {
      const trimmedLine = line.trim();
  
      if (trimmedLine === '') {
        return <div key={lineIndex} className="h-4" />;
      }
  
      if (trimmedLine.startsWith('• ') || trimmedLine.startsWith('- ')) {
        const lineContent = trimmedLine.substring(2);
        return (
          <div key={lineIndex} className="flex items-start">
            <span className="mr-2 mt-1 shrink-0">•</span>
            <span className="flex-1">{renderLineContent(lineContent, `li-${lineIndex}`)}</span>
          </div>
        );
      }
  
      return <div key={lineIndex}>{renderLineContent(line, `p-${lineIndex}`)}</div>;
    });
  };


  return (
    <div className="flex-1 flex flex-col bg-white/60 backdrop-blur-xl rounded-2xl shadow-soft-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map(message => (
          <div key={message.id} className={`flex gap-4 items-start group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className={`max-w-2xl prose prose-p:text-gray-700 prose-strong:text-gray-800 shadow-md ${message.role === 'user' ? 'bg-brand-blue text-white rounded-2xl rounded-br-lg p-4' : 'bg-white/80 rounded-2xl rounded-bl-lg p-4'}`}>
                {parseAndRenderText(message.text, message.activeSourcesContext)}
            </div>
             {message.role === 'model' && (
                <button 
                    onClick={() => handleCopy(message.text, message.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-500 hover:text-brand-blue rounded-full hover:bg-white/50 self-center"
                    aria-label="Copy response"
                    title={copiedMessageId === message.id ? "Copied!" : "Copy response"}
                >
                    {copiedMessageId === message.id ? (
                        <CheckIcon className="w-4 h-4 text-green-500" />
                    ) : (
                        <ClipboardIcon className="w-4 h-4" />
                    )}
                </button>
            )}
             {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <UserIcon className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && !isStreaming && messages.length > 0 && (
            <div className="flex gap-4 items-start justify-start">
                 <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                    <SparklesIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-2 text-gray-500 bg-white/80 rounded-2xl rounded-bl-lg p-4 shadow-md">
                    <Spinner className="w-5 h-5" />
                    <span>Generating...</span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 border-t border-black/10 bg-transparent">
        <div className="flex items-center justify-center gap-2 md:gap-4 mb-4 flex-wrap">
            <SynthesisButton format="summary" label="Synthesize Summary" onClick={onSynthesize} disabled={isLoading || sources.length === 0} />
            <SynthesisButton format="outline" label="Create Outline" onClick={onSynthesize} disabled={isLoading || sources.length === 0} />
            <SynthesisButton format="flashcards" label="Make Flashcards" onClick={onSynthesize} disabled={isLoading || sources.length === 0} />
        </div>
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder={sources.length > 0 ? "Ask a question about your sources..." : "Please add a source to begin"}
            rows={1}
            disabled={isLoading || sources.length === 0}
            className="w-full bg-white/70 border border-black/10 text-gray-900 rounded-xl p-4 pr-16 resize-none focus:ring-2 focus:ring-brand-blue focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-200/50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGenerating}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center gap-2"
            >
              <span className="w-4 h-4 bg-white"></span>
              <span className="text-sm font-semibold">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !input.trim() || sources.length === 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-brand-blue hover:bg-brand-blue/80 text-white disabled:bg-gray-300 transition-transform hover:scale-105"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};