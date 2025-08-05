import { HfInference } from '@huggingface/inference';

interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    sender: string;
    roomName: string;
    timestamp: Date;
    messageType: 'whatsapp' | 'matrix';
  };
}

interface SearchResult {
  content: string;
  similarity: number;
  metadata: VectorEntry['metadata'];
}

export class MessageMindVectorStorage {
  private hf?: HfInference;
  private vectors: VectorEntry[] = [];
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    if (this.apiKey) {
      this.hf = new HfInference(this.apiKey);
    }
  }

  // Generate embedding for text using Hugging Face
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      console.warn('No API key for embeddings - using mock vectors');
      // Return mock embedding for demo purposes
      return Array(384).fill(0).map(() => Math.random() - 0.5);
    }

    try {
      console.log('🔍 Generating embedding for text:', text.substring(0, 50) + '...');
      
      const embedding = await this.hf!.featureExtraction({
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        inputs: text
      });

      // Ensure we get a flat array of numbers
      const flatEmbedding = Array.isArray(embedding[0]) ? embedding[0] : embedding;
      console.log('✅ Embedding generated, dimension:', flatEmbedding.length);
      
      return flatEmbedding as number[];
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      // Fallback to mock embedding
      return Array(384).fill(0).map(() => Math.random() - 0.5);
    }
  }

  // Add message to vector storage
  async addMessage(
    id: string,
    content: string,
    sender: string,
    roomName: string,
    timestamp: Date,
    messageType: 'whatsapp' | 'matrix' = 'whatsapp'
  ): Promise<void> {
    try {
      // Skip very short or system messages
      if (content.length < 10 || content.startsWith('!') || content.includes('bridged')) {
        return;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      const vectorEntry: VectorEntry = {
        id,
        content,
        embedding,
        metadata: {
          sender: sender.split(':')[0].replace('@', '').replace('whatsapp_', ''),
          roomName: roomName.replace(/\s*\(WA\)\s*$/, '').trim(),
          timestamp,
          messageType
        }
      };

      // Add to in-memory storage
      this.vectors.push(vectorEntry);
      console.log(`📦 Added message to vector storage. Total: ${this.vectors.length}`);
      
    } catch (error) {
      console.error('Failed to add message to vector storage:', error);
    }
  }

  // Batch add multiple messages
  async addMessages(messages: Array<{
    id: string;
    content: string;
    sender: string;
    roomName: string;
    timestamp: Date;
    messageType?: 'whatsapp' | 'matrix';
  }>): Promise<void> {
    console.log(`🔄 Processing ${messages.length} messages for vector storage...`);
    
    for (const msg of messages) {
      await this.addMessage(
        msg.id,
        msg.content,
        msg.sender,
        msg.roomName,
        msg.timestamp,
        msg.messageType || 'whatsapp'
      );
    }
    
    console.log(`✅ Finished processing. Vector storage now contains ${this.vectors.length} entries.`);
  }

  // Cosine similarity calculation
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Semantic search through messages
  async semanticSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (this.vectors.length === 0) {
      console.warn('No vectors in storage for search');
      return [];
    }

    try {
      console.log(`🔍 Searching for: "${query}" in ${this.vectors.length} messages`);
      
      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarities
      const results = this.vectors.map(vector => ({
        content: vector.content,
        similarity: this.cosineSimilarity(queryEmbedding, vector.embedding),
        metadata: vector.metadata
      }));

      // Sort by similarity and return top results
      const sortedResults = results
        .filter(result => result.similarity > 0.1) // Filter out very low similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`✅ Found ${sortedResults.length} relevant messages`);
      return sortedResults;
      
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  // Find similar messages to a given message
  async findSimilarMessages(messageId: string, limit: number = 5): Promise<SearchResult[]> {
    const targetVector = this.vectors.find(v => v.id === messageId);
    if (!targetVector) return [];

    const results = this.vectors
      .filter(v => v.id !== messageId)
      .map(vector => ({
        content: vector.content,
        similarity: this.cosineSimilarity(targetVector.embedding, vector.embedding),
        metadata: vector.metadata
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  // Get storage statistics
  getStats(): {
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesByRoom: Record<string, number>;
    oldestMessage: Date | null;
    newestMessage: Date | null;
  } {
    const messagesByType: Record<string, number> = {};
    const messagesByRoom: Record<string, number> = {};
    let oldestMessage: Date | null = null;
    let newestMessage: Date | null = null;

    this.vectors.forEach(vector => {
      // Count by type
      messagesByType[vector.metadata.messageType] = 
        (messagesByType[vector.metadata.messageType] || 0) + 1;
      
      // Count by room
      messagesByRoom[vector.metadata.roomName] = 
        (messagesByRoom[vector.metadata.roomName] || 0) + 1;
      
      // Track date range
      if (!oldestMessage || vector.metadata.timestamp < oldestMessage) {
        oldestMessage = vector.metadata.timestamp;
      }
      if (!newestMessage || vector.metadata.timestamp > newestMessage) {
        newestMessage = vector.metadata.timestamp;
      }
    });

    return {
      totalMessages: this.vectors.length,
      messagesByType,
      messagesByRoom,
      oldestMessage,
      newestMessage
    };
  }

  // Clear all vectors (for testing)
  clear(): void {
    this.vectors = [];
    console.log('🗑️ Cleared all vectors from storage');
  }
}