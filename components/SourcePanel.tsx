import React, { useRef, useState } from 'react';
import type { Source } from '../types';
import { SourceViewer } from './SourceViewer';
import { UploadIcon } from './icons/UploadIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { FilePdfIcon } from './icons/FilePdfIcon';
import { LinkIcon } from './icons/LinkIcon';
import { Spinner } from './icons/Spinner';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { XIcon } from './icons/XIcon';

interface SourcePanelProps {
  sources: Source[];
  selectedSource: Source | null;
  onSelectSource: (source: Source | null) => void;
  onAddSources: (files: File[]) => void;
  onAddSourceUrl: (url: string) => void;
  isLoading: boolean;
  onDeleteSource: (sourceId: string) => void;
  onToggleSourceExclusion: (sourceId: string) => void;
}

const MAX_SOURCES = 20;

const SourceItem: React.FC<{ 
    source: Source; 
    isSelected: boolean; 
    onSelect: () => void;
    onDelete: () => void;
    onToggleExclusion: () => void;
}> = ({ source, isSelected, onSelect, onDelete, onToggleExclusion }) => {
    let Icon;
    switch(source.type) {
        case 'pdf': Icon = FilePdfIcon; break;
        case 'url': Icon = LinkIcon; break;
        default: Icon = FileTextIcon;
    }

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation(); // Prevent onSelect from firing
        action();
    }

    return (
        <div
            onClick={onSelect}
            className={`w-full text-left p-3 flex items-center gap-3 rounded-xl transition-all duration-200 group cursor-pointer ${isSelected ? 'bg-brand-blue/20 text-brand-blue font-semibold scale-105 shadow-md' : 'hover:bg-white/60 hover:shadow-md hover:-translate-y-px'} ${source.excluded ? 'opacity-50' : ''}`}
        >
            <Icon className="w-5 h-5 flex-shrink-0 text-gray-500" />
            <span className={`truncate flex-1 ${source.excluded ? 'line-through' : ''}`}>{source.name}</span>
            {source.generating ? (
                <Spinner className="w-4 h-4" />
            ) : (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => handleActionClick(e, onToggleExclusion)} 
                        className="p-1.5 text-gray-500 hover:text-brand-blue rounded-full hover:bg-gray-200/50"
                        title={source.excluded ? 'Include in analysis' : 'Exclude from analysis'}
                        aria-label={source.excluded ? 'Include source in analysis' : 'Exclude source from analysis'}
                    >
                        {source.excluded ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                     <button 
                        onClick={(e) => handleActionClick(e, onDelete)} 
                        className="p-1.5 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-200/50"
                        title="Delete source"
                        aria-label="Delete source"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

export const SourcePanel: React.FC<SourcePanelProps> = ({ sources, selectedSource, onSelectSource, onAddSources, onAddSourceUrl, isLoading, onDeleteSource, onToggleSourceExclusion }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      if (sources.length + files.length > MAX_SOURCES) {
        alert(`Cannot add ${files.length} file(s). You can have a maximum of ${MAX_SOURCES} sources in total.`);
        return;
      }
      onAddSources(files);
      event.target.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onAddSourceUrl(urlInput);
      setUrlInput('');
    }
  }

  const handleDelete = (source: Source) => {
    if (window.confirm(`Are you sure you want to delete "${source.name}"? This action cannot be undone.`)) {
        onDeleteSource(source.id);
    }
  }

  return (
    <div className="w-full md:w-[40%] md:max-w-[500px] flex flex-col bg-white/60 backdrop-blur-xl rounded-2xl shadow-soft-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-black/10">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Sources</h2>
            <span className="text-sm font-medium text-gray-500">{sources.length} / {MAX_SOURCES}</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept=".txt,.pdf"
          multiple
        />
        <button
          onClick={handleUploadClick}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-px"
        >
          <UploadIcon className="w-5 h-5" />
          Add Source Files
        </button>
        <form onSubmit={handleAddUrl} className="flex items-center gap-2 mt-3">
            <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Or paste a URL..."
                disabled={isLoading}
                className="flex-1 bg-white/70 border border-black/10 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none disabled:bg-gray-200/50"
            />
            <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                Add
            </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2 md:p-4">
        {sources.length === 0 ? (
            <div className="text-center text-gray-500 p-8 flex flex-col items-center justify-center h-full">
                <UploadIcon className="w-12 h-12 text-gray-300 mb-4" />
                <p className="font-semibold">Your workspace is empty</p>
                <p className="text-sm mt-2">Upload documents or add a URL to get started.</p>
                <p className="text-xs mt-2 text-gray-400">Supports up to 20 files (.txt, .pdf, links).</p>
            </div>
        ) : (
          <div className="space-y-1">
            {sources.map(source => (
              <SourceItem 
                key={source.id} 
                source={source} 
                isSelected={selectedSource?.id === source.id}
                onSelect={() => onSelectSource(source)}
                onDelete={() => handleDelete(source)}
                onToggleExclusion={() => onToggleSourceExclusion(source.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedSource && (
        <div className="h-[50%] border-t border-black/10 overflow-hidden flex flex-col">
          <SourceViewer source={selectedSource} />
        </div>
      )}
    </div>
  );
};