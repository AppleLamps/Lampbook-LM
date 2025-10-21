import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { SourcePanel } from './components/SourcePanel';
import { ChatPanel } from './components/ChatPanel';
import { useLampbook } from './hooks/useLampbook';
import { LampIcon } from './components/icons/LampIcon';
import { TrashIcon } from './components/icons/TrashIcon';

const App: React.FC = () => {
  const lampbook = useLampbook();
  const [showClearMenu, setShowClearMenu] = useState(false);
  const clearMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clearMenuRef.current && !clearMenuRef.current.contains(event.target as Node)) {
        setShowClearMenu(false);
      }
    };

    if (showClearMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClearMenu]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="h-screen font-sans text-gray-800 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col w-full h-full gap-4 md:gap-6">
          <header className="h-20 flex-shrink-0 bg-white/60 backdrop-blur-xl rounded-2xl shadow-soft-lg ring-1 ring-black ring-opacity-5 flex items-center px-6 md:px-8">
          <div className="flex items-center gap-3">
              <LampIcon className="w-8 h-8 text-brand-blue" />
              <h1 className="text-2xl font-bold text-gray-900 tracking-tighter">LampbookLM</h1>
          </div>
          <div className="flex-1" />
          <div className="relative" ref={clearMenuRef}>
            <button
              onClick={() => setShowClearMenu(!showClearMenu)}
              disabled={lampbook.sources.length === 0 && lampbook.chatMessages.length === 0}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-red-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all rounded-full hover:bg-red-500/10 px-4 py-2"
              aria-label="Clear options"
            >
              <TrashIcon className="w-4 h-4" />
              Clear
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showClearMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 overflow-hidden z-10">
                <button
                  onClick={() => {
                    lampbook.clearChat();
                    setShowClearMenu(false);
                  }}
                  disabled={lampbook.chatMessages.length === 0}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="font-semibold">Clear Chat</div>
                  <div className="text-xs text-gray-500">Remove conversation history</div>
                </button>
                <div className="border-t border-gray-100"></div>
                <button
                  onClick={() => {
                    lampbook.clearWorkspace();
                    setShowClearMenu(false);
                  }}
                  disabled={lampbook.sources.length === 0 && lampbook.chatMessages.length === 0}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="font-semibold">Clear Workspace</div>
                  <div className="text-xs text-red-500">Remove all sources and chat</div>
                </button>
              </div>
            )}
          </div>
        </header>
        
        <main className="flex flex-col md:flex-row flex-1 overflow-hidden gap-4 md:gap-6">
          <SourcePanel 
            sources={lampbook.sources}
            selectedSource={lampbook.selectedSource}
            onSelectSource={lampbook.setSelectedSource}
            onAddSources={lampbook.addSourcesFromFiles}
            onAddSourceUrl={lampbook.addSourceFromUrl}
            isLoading={lampbook.isLoading}
            onDeleteSource={lampbook.deleteSource}
            onToggleSourceExclusion={lampbook.toggleSourceExclusion}
          />
          <ChatPanel
            messages={lampbook.chatMessages}
            onSendMessage={lampbook.sendMessage}
            isLoading={lampbook.isLoading}
            isStreaming={lampbook.isStreaming}
            sources={lampbook.sources}
            onSelectSource={lampbook.setSelectedSource}
            onSynthesize={lampbook.synthesizeNotes}
            onStopGenerating={lampbook.stopGenerating}
          />
        </main>
      </div>
    </div>
    </>
  );
};

export default App;