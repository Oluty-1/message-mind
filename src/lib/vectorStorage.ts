// lib/vectorStorage.ts - Updated to use API routes for embeddings
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
  private vectors: VectorEntry[] = [];
  private apiKey: string;
  private useApiRoute: boolean = true;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    console.log('🔍 Vector Storage initialized with API route support');
  }

  // Generate embedding using API route (avoids CORS)
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.useApiRoute) {
      try {
        console.log('🔍 Generating embedding via API route for:', text.substring(0, 50) + '...');
        
        const response = await fetch('/api/ai/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: [text]
          })
        });

        if (!response.ok) {
          throw new Error(`API route failed: ${response.status}`);
        }

        const data = await response.json();
        const embedding = data.embeddings[0];
        
        console.log('✅ Embedding generated via API route, dimension:', embedding.length);
        return embedding;
        
      } catch (error) {
        console.error('❌ API route embedding failed:', error);
        console.log('🔄 Falling back to mock embeddings');
      }
    }

    // Fallback to mock embedding
    console.log('🎲 Using mock embedding for:', text.substring(0, 30) + '...');
    return Array(384).fill(0).map(() => Math.random() - 0.5);
  }

  // Batch generate embeddings for multiple texts
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.useApiRoute && texts.length > 0) {
      try {
        console.log(`🔍 Generating ${texts.length} embeddings via API route...`);
        
        const response = await fetch('/api/ai/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts
          })
        });

        if (!response.ok) {
          throw new Error(`API route failed: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Generated ${data.embeddings.length} embeddings via API route`);
        return data.embeddings;
        
      } catch (error) {
        console.error('❌ Batch embeddings failed:', error);
        console.log('🔄 Falling back to mock embeddings');
      }
    }

    // Fallback to mock embeddings
    return texts.map(() => Array(384).fill(0).map(() => Math.random() - 0.5));
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
      // Skip system messages and very short messages
      if (content.startsWith('!') || content.includes('bridged') || content.includes('WhatsApp bridge bot')) {
        console.log(`🚫 Skipping system message: ${content.substring(0, 50)}...`);
        return;
      }

      if (!content.trim() || content.trim().length < 3) {
        console.log(`🚫 Skipping very short message: "${content}"`);
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

  // Batch add multiple messages (optimized)
  async addMessages(messages: Array<{
    id: string;
    content: string;
    sender: string;
    roomName: string;
    timestamp: Date;
    messageType?: 'whatsapp' | 'matrix';
  }>): Promise<void> {
    console.log(`🔄 Processing ${messages.length} messages for vector storage...`);
    
    // Filter out system messages first
    const validMessages = messages.filter(msg => {
      const content = msg.content.trim();
      return content.length >= 3 && 
             !content.startsWith('!') && 
             !content.includes('bridged') && 
             !content.includes('WhatsApp bridge bot');
    });

    console.log(`📝 ${validMessages.length} valid messages after filtering`);

    if (validMessages.length === 0) {
      console.log('No valid messages to process');
      return;
    }

    try {
      // Extract texts for batch embedding generation
      const texts = validMessages.map(msg => msg.content);
      
      // Generate embeddings in batch
      const embeddings = await this.generateEmbeddings(texts);
      
      // Create vector entries
      validMessages.forEach((msg, index) => {
        const vectorEntry: VectorEntry = {
          id: msg.id,
          content: msg.content,
          embedding: embeddings[index],
          metadata: {
            sender: msg.sender.split(':')[0].replace('@', '').replace('whatsapp_', ''),
            roomName: msg.roomName.replace(/\s*\(WA\)\s*$/, '').trim(),
            timestamp: msg.timestamp,
            messageType: msg.messageType || 'whatsapp'
          }
        };
        
        this.vectors.push(vectorEntry);
      });
      
      console.log(`✅ Finished processing. Vector storage now contains ${this.vectors.length} entries.`);
      
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Fallback to individual processing
      console.log('🔄 Falling back to individual message processing...');
      for (const msg of validMessages.slice(0, 50)) { // Limit for performance
        await this.addMessage(
          msg.id,
          msg.content,
          msg.sender,
          msg.roomName,
          msg.timestamp,
          msg.messageType || 'whatsapp'
        );
      }
    }
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
    
    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
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
        .filter(result => result.similarity > 0.1) // Reasonable threshold
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

  // Check if embeddings are working
  async testEmbeddings(): Promise<boolean> {
    try {
      const testEmbedding = await this.generateEmbedding("test message");
      return testEmbedding.length > 0;
    } catch (error) {
      return false;
    }
  }
}