import { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { Source, ChatMessage, SynthesisFormat } from '../types';
import { parseDocument, parseUrl } from '../services/documentParser';
import { generateInitialAnalysis, answerQuestionWithChat, createChatSessionWithRAG, streamChatResponse, synthesizeNotes as synthesize } from '../services/geminiService';
import { addDocumentToVectorStore, removeDocumentFromVectorStore, searchRelevantChunks, formatChunksForContext, clearVectorStore } from '../services/ragService';

const MAX_SOURCES = 20;

export const useLampbook = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  // Chat session for conversational memory (will be recreated with RAG context)
  const chatSessionRef = useRef<any>(null);
  const [useRAG, setUseRAG] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addSourcesFromFiles = useCallback(async (files: File[]) => {
    if (sources.length + files.length > MAX_SOURCES) {
        toast.error(`You can only have a maximum of ${MAX_SOURCES} sources.`);
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

            // Add document to vector store for RAG
            if (useRAG && result.finalSource.content && !result.finalSource.content.startsWith('Error:')) {
                addDocumentToVectorStore(
                    result.finalSource.id,
                    result.finalSource.name,
                    result.finalSource.content
                ).catch(err => console.error('Failed to add to vector store:', err));
            }
        }
    });

    setSources(prev => prev.map(s => finalSourcesMap.get(s.id) || s));
    setChatMessages(prev => [...prev, ...analysisMessages]);

    // Show success/error toasts
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const errorCount = results.filter(r => r.status === 'rejected').length;

    if (successCount > 0) {
      toast.success(`Successfully added ${successCount} ${successCount === 1 ? 'document' : 'documents'}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to process ${errorCount} ${errorCount === 1 ? 'document' : 'documents'}`);
    }

    setIsLoading(false);
  }, [sources.length]);

  const addSourceFromUrl = useCallback(async (url: string) => {
    if (!url.trim()) return;
     if (sources.length >= MAX_SOURCES) {
        toast.error(`You can only have a maximum of ${MAX_SOURCES} sources.`);
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

        // Add document to vector store for RAG
        if (useRAG && content) {
            addDocumentToVectorStore(newSourceId, name, content)
                .catch(err => console.error('Failed to add to vector store:', err));
        }

        toast.success(`Successfully added: ${name}`);
    } catch (error) {
        const errorContent = error instanceof Error ? error.message : "An unknown error occurred.";
        setSources(prev => prev.map(s => s.id === newSourceId ? { ...s, name: "Error", content: `Error: ${errorContent}`, generating: false } : s));
        toast.error(`Failed to fetch URL: ${errorContent}`);
    } finally {
        setIsLoading(false);
    }
  }, [sources.length]);

  const sendMessage = useCallback(async (message: string) => {
    const activeSources = sources.filter(s => !s.excluded && !s.generating);
    if (!message.trim() || activeSources.length === 0) return;

    setIsLoading(true);
    setIsStreaming(true);

    const userMessage: ChatMessage = { id: `msg_${Date.now()}`, role: 'user', text: message };
    setChatMessages(prev => [...prev, userMessage]);

    // Create a placeholder message for streaming
    const modelMessageId = `msg_${Date.now() + 1}`;
    const placeholderMessage: ChatMessage = {
      id: modelMessageId,
      role: 'model',
      text: '',
      activeSourcesContext: activeSources
    };
    setChatMessages(prev => [...prev, placeholderMessage]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      if (useRAG) {
        // Use RAG to find relevant chunks
        const activeSourceIds = activeSources.map(s => s.id);
        const relevantChunks = await searchRelevantChunks(message, 5, activeSourceIds);

        // Format chunks for context
        const relevantContext = formatChunksForContext(relevantChunks);

        // Create or update chat session with relevant context
        if (!chatSessionRef.current || chatMessages.filter(m => m.role === 'user').length === 0) {
          // First message or new session - create fresh chat
          chatSessionRef.current = createChatSessionWithRAG(relevantContext);
        }

        // Stream the response
        await streamChatResponse(
          chatSessionRef.current,
          message,
          (currentText) => {
            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === modelMessageId
                  ? { ...msg, text: currentText }
                  : msg
              )
            );
          },
          abortControllerRef.current.signal
        );
      } else {
        // Fallback to non-RAG mode (full context)
        const context = activeSources.map((s, index) =>
          `Source [${index + 1}] ${s.name}:\n${s.content}`
        ).join('\n\n---\n\n');

        if (!chatSessionRef.current) {
          const { createChatSession } = await import('../services/geminiService');
          chatSessionRef.current = createChatSession(context);
        }

        await streamChatResponse(
          chatSessionRef.current,
          message,
          (currentText) => {
            setChatMessages(prev =>
              prev.map(msg =>
                msg.id === modelMessageId
                  ? { ...msg, text: currentText }
                  : msg
              )
            );
          },
          abortControllerRef.current.signal
        );
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      // Update the placeholder with error message
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === modelMessageId
            ? { ...msg, text: 'Sorry, I encountered an error while processing your request.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [sources, chatMessages, useRAG]);
  
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

  const clearChat = useCallback(() => {
    setChatMessages([]);
    chatSessionRef.current = null;
    toast.success('Chat cleared');
  }, []);

  const clearWorkspace = useCallback(() => {
    setSources([]);
    setSelectedSource(null);
    setChatMessages([]);
    chatSessionRef.current = null;
    if (useRAG) {
      clearVectorStore();
    }
    toast.success('Workspace cleared');
  }, [useRAG]);

  const deleteSource = useCallback((sourceId: string) => {
    setSources(prev => prev.filter(s => s.id !== sourceId));
    if (selectedSource?.id === sourceId) {
      setSelectedSource(null);
    }
    if (useRAG) {
      removeDocumentFromVectorStore(sourceId);
    }
    // Reset chat session when sources change
    chatSessionRef.current = null;
  }, [selectedSource, useRAG]);

  const toggleSourceExclusion = useCallback((sourceId: string) => {
    setSources(prev => prev.map(s =>
      s.id === sourceId ? { ...s, excluded: !s.excluded } : s
    ));
  }, []);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
      toast('Generation stopped', { icon: '⏹️' });
    }
  }, []);

  return {
    sources,
    selectedSource,
    chatMessages,
    isLoading: isLoading || isSynthesizing,
    isStreaming,
    addSourcesFromFiles,
    addSourceFromUrl,
    setSelectedSource,
    sendMessage,
    synthesizeNotes,
    clearChat,
    clearWorkspace,
    deleteSource,
    toggleSourceExclusion,
    stopGenerating,
  };
};