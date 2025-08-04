// src/lib/ai.ts
import { HfInference } from '@huggingface/inference';

interface ProcessedMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  roomName: string;
  isWhatsApp: boolean;
}

interface ConversationSummary {
  date: string;
  roomName: string;
  messageCount: number;
  participants: string[];
  summary: string;
  keyTopics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'high' | 'medium' | 'low';
}

interface MessageIntent {
  intent: string;
  confidence: number;
  category: 'question' | 'request' | 'information' | 'social' | 'urgent';
}

export class MessageMindAI {
  private hf: HfInference;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    this.hf = new HfInference(this.apiKey);
  }

  // Summarize conversation for a specific day
  async generateDailySummary(messages: ProcessedMessage[], date: string): Promise<ConversationSummary[]> {
    const messagesByRoom = this.groupMessagesByRoom(messages, date);
    const summaries: ConversationSummary[] = [];

    for (const [roomName, roomMessages] of Object.entries(messagesByRoom)) {
      if (roomMessages.length === 0) continue;

      try {
        const conversationText = this.formatMessagesForAI(roomMessages);
        const summary = await this.summarizeText(conversationText);
        const sentiment = await this.analyzeSentiment(conversationText);
        const topics = await this.extractTopics(conversationText);
        
        summaries.push({
          date,
          roomName,
          messageCount: roomMessages.length,
          participants: [...new Set(roomMessages.map(m => m.sender))],
          summary,
          keyTopics: topics,
          sentiment,
          priority: this.calculatePriority(roomMessages, sentiment)
        });
      } catch (error) {
        console.error(`Failed to process room ${roomName}:`, error);
      }
    }

    return summaries.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  // Analyze intent of individual messages
  async analyzeMessageIntent(message: ProcessedMessage): Promise<MessageIntent> {
    try {
      const result = await this.hf.textClassification({
        model: 'microsoft/DialoGPT-medium',
        inputs: message.content
      });

      // Simplified intent detection based on content analysis
      const intent = this.detectIntent(message.content);
      return {
        intent: intent.type,
        confidence: intent.confidence,
        category: intent.category
      };
    } catch (error) {
      console.error('Intent analysis failed:', error);
      return {
        intent: 'unknown',
        confidence: 0,
        category: 'information'
      };
    }
  }

  // Prioritize messages based on content and context
  prioritizeMessages(messages: ProcessedMessage[]): ProcessedMessage[] {
    return messages
      .map(msg => ({
        ...msg,
        priority: this.calculateMessagePriority(msg)
      }))
      .sort((a, b) => (b as any).priority - (a as any).priority);
  }

  // Generate embeddings for semantic search
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        texts.map(text => 
          this.hf.featureExtraction({
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            inputs: text
          })
        )
      );
      return embeddings as number[][];
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return [];
    }
  }

  // Create knowledge base entries from conversations
  async createKnowledgeBase(messages: ProcessedMessage[]): Promise<any[]> {
    const knowledge = [];
    const messageGroups = this.groupMessagesByConversation(messages);

    for (const group of messageGroups) {
      try {
        const summary = await this.summarizeText(this.formatMessagesForAI(group));
        const topics = await this.extractTopics(this.formatMessagesForAI(group));
        
        knowledge.push({
          id: `kb_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          participants: [...new Set(group.map(m => m.sender))],
          roomName: group[0].roomName,
          summary,
          topics,
          messageCount: group.length,
          rawMessages: group.map(m => ({
            sender: m.sender,
            content: m.content,
            timestamp: m.timestamp
          }))
        });
      } catch (error) {
        console.error('Knowledge base creation failed:', error);
      }
    }

    return knowledge;
  }

  // Private helper methods
  private groupMessagesByRoom(messages: ProcessedMessage[], date: string): Record<string, ProcessedMessage[]> {
    const targetDate = new Date(date);
    return messages
      .filter(msg => 
        msg.timestamp.toDateString() === targetDate.toDateString()
      )
      .reduce((groups, msg) => {
        if (!groups[msg.roomName]) {
          groups[msg.roomName] = [];
        }
        groups[msg.roomName].push(msg);
        return groups;
      }, {} as Record<string, ProcessedMessage[]>);
  }

  private groupMessagesByConversation(messages: ProcessedMessage[]): ProcessedMessage[][] {
    // Group messages by room and time windows (1 hour gaps indicate new conversation)
    const groups: ProcessedMessage[][] = [];
    const sortedMessages = messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let currentGroup: ProcessedMessage[] = [];
    let lastTimestamp = 0;
    let lastRoom = '';

    for (const msg of sortedMessages) {
      const timeDiff = msg.timestamp.getTime() - lastTimestamp;
      const oneHour = 60 * 60 * 1000;

      if (timeDiff > oneHour || msg.roomName !== lastRoom) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }

      lastTimestamp = msg.timestamp.getTime();
      lastRoom = msg.roomName;
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups.filter(group => group.length >= 3); // Only meaningful conversations
  }

  private formatMessagesForAI(messages: ProcessedMessage[]): string {
    return messages
      .slice(-20) // Last 20 messages to avoid token limits
      .map(msg => `${msg.sender}: ${msg.content}`)
      .join('\n');
  }

  private async summarizeText(text: string): Promise<string> {
    try {
      if (text.length < 50) {
        return "Conversation too short to summarize.";
      }

      const result = await this.hf.summarization({
        model: 'facebook/bart-large-cnn',
        inputs: text.slice(0, 1000), // Limit input length
        parameters: {
          max_length: 150,
          min_length: 30
        }
      });

      return result.summary_text || "Could not generate summary.";
    } catch (error) {
      console.error('Summarization failed:', error);
      return "Summary unavailable.";
    }
  }

  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      const result = await this.hf.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: text.slice(0, 500)
      });

      const sentiment = result[0]?.label?.toLowerCase();
      if (sentiment?.includes('positive')) return 'positive';
      if (sentiment?.includes('negative')) return 'negative';
      return 'neutral';
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return 'neutral';
    }
  }

  private async extractTopics(text: string): Promise<string[]> {
    // Simple keyword extraction based on frequency and importance
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private detectIntent(content: string): { type: string; confidence: number; category: MessageIntent['category'] } {
    const text = content.toLowerCase();
    
    // Question patterns
    if (text.includes('?') || text.startsWith('what') || text.startsWith('how') || text.startsWith('when')) {
      return { type: 'question', confidence: 0.8, category: 'question' };
    }
    
    // Urgent patterns
    if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
      return { type: 'urgent_request', confidence: 0.9, category: 'urgent' };
    }
    
    // Request patterns
    if (text.includes('please') || text.includes('can you') || text.includes('could you')) {
      return { type: 'request', confidence: 0.7, category: 'request' };
    }
    
    // Social patterns
    if (text.includes('hello') || text.includes('hi') || text.includes('thanks') || text.includes('bye')) {
      return { type: 'social', confidence: 0.6, category: 'social' };
    }
    
    return { type: 'information', confidence: 0.5, category: 'information' };
  }

  private calculatePriority(messages: ProcessedMessage[], sentiment: string): 'high' | 'medium' | 'low' {
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'important'];
    const hasUrgentContent = messages.some(msg => 
      urgentKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
    );
    
    if (hasUrgentContent || sentiment === 'negative') return 'high';
    if (messages.length > 10 || sentiment === 'positive') return 'medium';
    return 'low';
  }

  private calculateMessagePriority(message: ProcessedMessage): number {
    let priority = 0;
    const content = message.content.toLowerCase();
    
    // Time-based priority (newer = higher)
    const hoursSinceMessage = (Date.now() - message.timestamp.getTime()) / (1000 * 60 * 60);
    priority += Math.max(0, 24 - hoursSinceMessage) / 24 * 10;
    
    // Content-based priority
    if (content.includes('?')) priority += 5; // Questions
    if (content.includes('urgent') || content.includes('important')) priority += 15;
    if (content.includes('please') || content.includes('help')) priority += 8;
    if (content.length > 100) priority += 3; // Longer messages
    
    return priority;
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}