import { useState, useCallback } from 'react';
import type { Source, ChatMessage, SynthesisFormat } from '../types';
import { parseDocument, parseUrl } from '../services/documentParser';
import { generateInitialAnalysis, answerQuestion, synthesizeNotes as synthesize } from '../services/geminiService';

const MAX_SOURCES = 20;

export const useLampbook = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const addSourcesFromFiles = useCallback(async (files: File[]) => {
    if (sources.length + files.length > MAX_SOURCES) {
        alert(`You can only have a maximum of ${MAX_SOURCES} sources.`);
        return;
    }
    setIsLoading(true);

    const newSources: Source[] = Array.from(files).map(file => ({
        id: `src_${Date.now()}_${file.name}`,
        name: file.name,
        type: file.name.endsWith('.pdf') ? 'pdf' : 'txt',
        content: 'Processing...',
        generating: true,
        excluded: false,
    }));

    setSources(prev => [...prev, ...newSources]);

    const processingPromises = newSources.map(async (tempSource, index) => {
        try {
            const file = files[index];
            const content = await parseDocument(file);
            const analysis = await generateInitialAnalysis(content);
            const finalSource: Source = { ...tempSource, content, generating: false };
            return { status: 'fulfilled', finalSource, analysis };
        } catch (error) {
            const errorContent = error instanceof Error ? error.message : "An unknown error occurred.";
            const finalSource: Source = { ...tempSource, content: `Error: ${errorContent}`, generating: false };
            return { status: 'rejected', finalSource, error: errorContent };
        }
    });

    const results = await Promise.all(processingPromises);

    const finalSourcesMap = new Map<string, Source>();
    const analysisMessages: ChatMessage[] = [];

    results.forEach(result => {
        finalSourcesMap.set(result.finalSource.id, result.finalSource);
        if (result.status === 'fulfilled' && result.analysis) {
            const { summary, keyPoints } = result.analysis;
            const keyPointsText = keyPoints && keyPoints.filter(p => p && p.trim()).length > 0
                ? `\n\n**Key Points:**\n${keyPoints.filter(p => p && p.trim()).map(p => `• ${p}`).join('\n')}`
                : '';
            const analysisText = `Analysis for **${result.finalSource.name}**:\n\n**Summary:**\n${summary}${keyPointsText}`;
            analysisMessages.push({
                id: `msg_analysis_${result.finalSource.id}`,
                role: 'model',
                text: analysisText,
            });
        }
    });

    setSources(prev => prev.map(s => finalSourcesMap.get(s.id) || s));
    setChatMessages(prev => [...prev, ...analysisMessages]);
    
    setIsLoading(false);
  }, [sources.length]);

  const addSourceFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return;
     if (sources.length >= MAX_SOURCES) {
        alert(`You can only have a maximum of ${MAX_SOURCES} sources.`);
        return;
    }
    setIsLoading(true);
    const newSourceId = `src_${Date.now()}`;

    const tempSource: Source = { id: newSourceId, name: url, type: 'url', content: 'Fetching...', generating: true, excluded: false };
    setSources(prev => [...prev, tempSource]);

    try {
        const { content, name } = await parseUrl(url);
        const { summary, keyPoints } = await generateInitialAnalysis(content);
        const finalSource: Source = { id: newSourceId, name, type: 'url', content, generating: false, excluded: false };
        const keyPointsText = keyPoints && keyPoints.filter(p => p && p.trim()).length > 0
            ? `\n\n**Key Points:**\n${keyPoints.filter(p => p && p.trim()).map(p => `• ${p}`).join('\n')}`
            : '';
        const analysisText = `Analysis for **${name}**:\n\n**Summary:**\n${summary}${keyPointsText}`;

        const analysisMessage: ChatMessage = { id: `msg_analysis_${finalSource.id}`, role: 'model', text: analysisText };

        setSources(prev => prev.map(s => s.id === newSourceId ? finalSource : s));
        setChatMessages(prev => [...prev, analysisMessage]);
    } catch (error) {
        const errorContent = error instanceof Error ? error.message : "An unknown error occurred.";
        setSources(prev => prev.map(s => s.id === newSourceId ? { ...s, name: "Error", content: `Error: ${errorContent}`, generating: false } : s));
    } finally {
        setIsLoading(false);
    }
  }, [sources.length]);

  const sendMessage = useCallback(async (message: string) => {
    const activeSources = sources.filter(s => !s.excluded);
    if (!message.trim() || activeSources.length === 0) return;
    setIsLoading(true);

    const userMessage: ChatMessage = { id: `msg_${Date.now()}`, role: 'user', text: message };
    setChatMessages(prev => [...prev, userMessage]);

    try {
      const context = activeSources.map((s, index) => `Source [${index + 1}] ${s.name}:\n${s.content}`).join('\n\n---\n\n');
      const answer = await answerQuestion(context, message);
      const modelMessage: ChatMessage = { 
          id: `msg_${Date.now() + 1}`, 
          role: 'model', 
          text: answer,
          activeSourcesContext: activeSources
      };
      setChatMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = { id: `msg_${Date.now() + 1}`, role: 'model', text: 'Sorry, I encountered an error while processing your request.' };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [sources]);
  
  const synthesizeNotes = useCallback(async (format: SynthesisFormat) => {
      const activeSources = sources.filter(s => !s.excluded);
      if (activeSources.length === 0) return;
      setIsSynthesizing(true);
      const promptText = `Please generate ${format} based on the provided documents.`;
      const userMessage: ChatMessage = { id: `msg_${Date.now()}`, role: 'user', text: promptText };
      setChatMessages(prev => [...prev, userMessage]);
      try {
          const context = activeSources.map((s, index) => `Source [${index + 1}] ${s.name}:\n${s.content}`).join('\n\n---\n\n');
          const answer = await synthesize(context, format);
          const modelMessage: ChatMessage = { 
              id: `msg_${Date.now() + 1}`,
              role: 'model',
              text: answer,
              activeSourcesContext: activeSources
          };
          setChatMessages(prev => [...prev, modelMessage]);
      } catch (error) {
          const errorMessage: ChatMessage = { id: `msg_${Date.now() + 1}`, role: 'model', text: `Sorry, I encountered an error while generating the ${format}.` };
          setChatMessages(prev => [...prev, errorMessage]);
      } finally {
          setIsSynthesizing(false);
      }
  }, [sources]);

  const clearHistory = useCallback(() => {
    setSources([]);
    setSelectedSource(null);
    setChatMessages([]);
  }, []);

  const deleteSource = useCallback((sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    if (selectedSource?.id === sourceId) {
      setSelectedSource(null);
    }
  }, [selectedSource]);

  const toggleSourceExclusion = useCallback((sourceId: string) => {
    setSources(prev => prev.map(s => 
      s.id === sourceId ? { ...s, excluded: !s.excluded } : s
    ));
  }, []);

  return {
    sources,
    selectedSource,
    chatMessages,
    isLoading: isLoading || isSynthesizing,
    addSourcesFromFiles,
    addSourceFromUrl,
    setSelectedSource,
    sendMessage,
    synthesizeNotes,
    clearHistory,
    deleteSource,
    toggleSourceExclusion,
  };
};