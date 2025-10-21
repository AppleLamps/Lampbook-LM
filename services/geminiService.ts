import { GoogleGenAI, Type } from "@google/genai";
import type { SynthesisFormat } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateInitialAnalysis = async (content: string): Promise<{ summary: string, keyPoints: string[] }> => {
    const model = 'gemini-2.5-flash';
    const prompt = `Analyze the following document and provide a concise one-paragraph summary and a list of up to 5 key points. The document content is between the triple dashes.
---
${content}
---
`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: {
                            type: Type.STRING,
                            description: "A concise one-paragraph summary of the document."
                        },
                        keyPoints: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                            },
                            description: "A list of up to 5 key points from the document."
                        },
                    }
                }
            }
        });
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        return {
            summary: result.summary || "No summary could be generated.",
            keyPoints: result.keyPoints || [],
        };
    } catch (error) {
        console.error("Error in generateInitialAnalysis:", error);
        return {
            summary: "Could not generate summary due to an error.",
            keyPoints: [],
        };
    }
};

// Chat session management for conversational memory
export const createChatSession = (context: string) => {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a helpful research assistant. Based ONLY on the provided sources, answer the user's questions. Your answers should synthesize information from multiple sources if needed. After each statement or paragraph, you MUST cite the source document it came from using its corresponding number, like [1]. If the information comes from multiple sources, cite them all, like [1][2]. Do not use any information outside of the provided sources.

SOURCES:
---
${context}
---`;

    return ai.models.startChat({
        model,
        systemInstruction,
        history: []
    });
};

// Legacy function - kept for compatibility with non-chat flows
export const answerQuestion = async (context: string, question: string): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `You are a helpful research assistant. Based ONLY on the provided sources, answer the user's question. Your answer should synthesize information from multiple sources if the question requires it. After each statement or paragraph, you MUST cite the source document it came from using its corresponding number, like [1]. If the information comes from multiple sources, cite them all, like [1][2]. Do not use any information outside of the provided sources.

SOURCES:
---
${context}
---

QUESTION:
${question}`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error in answerQuestion:", error);
        throw new Error("Failed to get an answer from the AI model.");
    }
};

// Chat-based answer function with conversational memory
export const answerQuestionWithChat = async (chatSession: any, question: string): Promise<string> => {
    try {
        const response = await chatSession.sendMessage(question);
        return response.text;
    } catch (error) {
        console.error("Error in answerQuestionWithChat:", error);
        throw new Error("Failed to get an answer from the AI model.");
    }
};

// Chat session with RAG - creates a chat with only relevant context
export const createChatSessionWithRAG = (relevantContext: string) => {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a helpful research assistant. Based ONLY on the provided relevant excerpts from sources, answer the user's questions. Your answers should synthesize information from multiple sources if needed. After each statement or paragraph, you MUST cite the source document it came from using its corresponding number, like [1]. If the information comes from multiple sources, cite them all, like [1][2]. Do not use any information outside of the provided sources.

RELEVANT EXCERPTS:
---
${relevantContext}
---`;

    return ai.models.startChat({
        model,
        systemInstruction,
        history: []
    });
};

// Streaming response with chat
export const streamChatResponse = async (
    chatSession: any,
    question: string,
    onChunk: (text: string) => void,
    abortSignal?: AbortSignal
): Promise<string> => {
    try {
        const stream = await chatSession.sendMessageStream(question);
        let fullText = '';

        for await (const chunk of stream) {
            if (abortSignal?.aborted) {
                break;
            }
            const chunkText = chunk.text;
            fullText += chunkText;
            onChunk(fullText);
        }

        return fullText;
    } catch (error) {
        console.error("Error in streamChatResponse:", error);
        throw new Error("Failed to stream response from the AI model.");
    }
};


export const synthesizeNotes = async (context: string, format: SynthesisFormat): Promise<string> => {
    const model = 'gemini-2.5-flash';
    let instruction = '';

    switch (format) {
        case 'summary':
            instruction = 'Generate a comprehensive summary of all the provided documents combined. Synthesize the key information into a coherent overview.';
            break;
        case 'flashcards':
            instruction = 'Create a set of flashcards from the provided documents. Each flashcard should have a "front" (a question or term) and a "back" (the answer or definition). Format each flashcard clearly.';
            break;

        case 'outline':
            instruction = 'Create a structured outline of the key topics, sub-topics, and important points from across all the provided documents. Use nested bullet points for hierarchy.';
            break;
    }

    const prompt = `You are a helpful study assistant. ${instruction} After each piece of information, cite the source document(s) using its corresponding number, like [1]. If the information comes from multiple sources, cite them all, like [1][2].

SOURCES:
---
${context}
---
`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        return response.text;

    } catch (error) {
        console.error(`Error in synthesizeNotes for format ${format}:`, error);
        throw new Error(`Failed to generate ${format} from the AI model.`);
    }
};