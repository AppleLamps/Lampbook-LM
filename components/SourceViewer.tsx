import React from 'react';
import type { Source } from '../types';
import { Spinner } from './icons/Spinner';

interface SourceViewerProps {
  source: Source;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ source }) => {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 bg-transparent">
      <div className="pb-4 border-b border-black/10 mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900 truncate">{source.name}</h3>
      </div>
      
      {source.generating ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <Spinner className="w-8 h-8 mb-4" />
          <p>Analyzing source...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 bg-black/5 rounded-xl">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans p-4">
            {source.content}
          </pre>
        </div>
      )}
    </div>
  );
};