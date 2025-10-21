import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Types for RAG
export interface Chunk {
    id: string;
    sourceId: string;
    sourceName: string;
    text: string;
    embedding?: number[];
    index: number;
}

interface VectorStore {
    chunks: Chunk[];
}

// In-memory vector store
const vectorStore: VectorStore = {
    chunks: []
};

/**
 * Chunk a document into smaller, overlapping segments
 * @param text - The document text to chunk
 * @param chunkSize - Target size of each chunk in characters
 * @param overlap - Number of characters to overlap between chunks
 */
export const chunkDocument = (text: string, chunkSize = 1000, overlap = 200): string[] => {
    const chunks: string[] = [];
    let start = 0;

    // Clean up text first
    const cleanText = text.replace(/\s\s+/g, ' ').trim();

    while (start < cleanText.length) {
        let end = start + chunkSize;

        // If not at the end, try to break at sentence boundary
        if (end < cleanText.length) {
            // Look for sentence endings near the chunk boundary
            const searchWindow = cleanText.slice(end - 100, end + 100);
            const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];

            let bestBreak = -1;
            let bestDistance = Infinity;

            sentenceEndings.forEach(ending => {
                const index = searchWindow.lastIndexOf(ending);
                if (index !== -1) {
                    const absoluteIndex = end - 100 + index + ending.length;
                    const distance = Math.abs(absoluteIndex - end);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestBreak = absoluteIndex;
                    }
                }
            });

            if (bestBreak !== -1) {
                end = bestBreak;
            }
        }

        const chunk = cleanText.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        // Move start position with overlap
        start = end - overlap;
        if (start <= 0 || start >= cleanText.length) break;
    }

    return chunks;
};

/**
 * Generate embeddings for a text using Gemini Embeddings API
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    try {
        const model = 'text-embedding-004';
        const result = await ai.models.embedContent({
            model,
            content: text
        });

        return result.embedding.values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        throw new Error("Failed to generate embedding");
    }
};

/**
 * Generate embeddings for multiple texts in batch
 */
export const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
    try {
        const model = 'text-embedding-004';
        const embeddings: number[][] = [];

        // Process in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text =>
                ai.models.embedContent({
                    model,
                    content: text
                })
            );

            const results = await Promise.all(batchPromises);
            embeddings.push(...results.map(r => r.embedding.values));
        }

        return embeddings;
    } catch (error) {
        console.error("Error generating embeddings batch:", error);
        throw new Error("Failed to generate embeddings");
    }
};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) {
        throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Add a document to the vector store
 */
export const addDocumentToVectorStore = async (
    sourceId: string,
    sourceName: string,
    content: string
): Promise<void> => {
    // Remove any existing chunks for this source
    vectorStore.chunks = vectorStore.chunks.filter(c => c.sourceId !== sourceId);

    // Chunk the document
    const textChunks = chunkDocument(content);

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddingsBatch(textChunks);

    // Create chunk objects with embeddings
    const chunks: Chunk[] = textChunks.map((text, index) => ({
        id: `${sourceId}_chunk_${index}`,
        sourceId,
        sourceName,
        text,
        embedding: embeddings[index],
        index
    }));

    // Add to vector store
    vectorStore.chunks.push(...chunks);
};

/**
 * Remove a document from the vector store
 */
export const removeDocumentFromVectorStore = (sourceId: string): void => {
    vectorStore.chunks = vectorStore.chunks.filter(c => c.sourceId !== sourceId);
};

/**
 * Search for relevant chunks based on a query
 */
export const searchRelevantChunks = async (
    query: string,
    topK = 5,
    sourceIds?: string[]
): Promise<Chunk[]> => {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Filter chunks by source IDs if provided
    let searchableChunks = vectorStore.chunks;
    if (sourceIds && sourceIds.length > 0) {
        searchableChunks = searchableChunks.filter(c => sourceIds.includes(c.sourceId));
    }

    // Calculate similarity scores
    const chunksWithScores = searchableChunks.map(chunk => ({
        chunk,
        score: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
    }));

    // Sort by score and return top K
    chunksWithScores.sort((a, b) => b.score - a.score);

    return chunksWithScores.slice(0, topK).map(item => item.chunk);
};

/**
 * Format chunks for context in the prompt
 */
export const formatChunksForContext = (chunks: Chunk[]): string => {
    // Group chunks by source
    const chunksBySource = new Map<string, Chunk[]>();

    chunks.forEach(chunk => {
        if (!chunksBySource.has(chunk.sourceId)) {
            chunksBySource.set(chunk.sourceId, []);
        }
        chunksBySource.get(chunk.sourceId)!.push(chunk);
    });

    // Format as context string
    let context = '';
    let sourceIndex = 1;

    chunksBySource.forEach((sourceChunks, sourceId) => {
        const sourceName = sourceChunks[0].sourceName;
        context += `Source [${sourceIndex}] ${sourceName}:\n`;

        sourceChunks.forEach(chunk => {
            context += `${chunk.text}\n\n`;
        });

        context += '---\n\n';
        sourceIndex++;
    });

    return context;
};

/**
 * Get vector store statistics
 */
export const getVectorStoreStats = () => {
    const uniqueSources = new Set(vectorStore.chunks.map(c => c.sourceId));
    return {
        totalChunks: vectorStore.chunks.length,
        uniqueSources: uniqueSources.size,
        sourceIds: Array.from(uniqueSources)
    };
};

/**
 * Clear the entire vector store
 */
export const clearVectorStore = (): void => {
    vectorStore.chunks = [];
};
