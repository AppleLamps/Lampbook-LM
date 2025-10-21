import React from 'react';
import { SourcePanel } from './components/SourcePanel';
import { ChatPanel } from './components/ChatPanel';
import { useLampbook } from './hooks/useLampbook';
import { LampIcon } from './components/icons/LampIcon';
import { TrashIcon } from './components/icons/TrashIcon';

const App: React.FC = () => {
  const lampbook = useLampbook();

  return (
    <div className="h-screen font-sans text-gray-800 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col w-full h-full gap-4 md:gap-6">
        <header className="h-20 flex-shrink-0 bg-white/60 backdrop-blur-xl rounded-2xl shadow-soft-lg ring-1 ring-black ring-opacity-5 flex items-center px-6 md:px-8">
          <div className="flex items-center gap-3">
              <LampIcon className="w-8 h-8 text-brand-blue" />
              <h1 className="text-2xl font-bold text-gray-900 tracking-tighter">LampbookLM</h1>
          </div>
          <div className="flex-1" />
          <button
              onClick={lampbook.clearHistory}
              disabled={lampbook.sources.length === 0 && lampbook.chatMessages.length === 0}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-red-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-all rounded-full hover:bg-red-500/10 px-4 py-2"
              aria-label="Clear history"
          >
              <TrashIcon className="w-4 h-4" />
              Clear
          </button>
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
            sources={lampbook.sources}
            onSelectSource={lampbook.setSelectedSource}
            onSynthesize={lampbook.synthesizeNotes}
          />
        </main>
      </div>
    </div>
  );
};

export default App;