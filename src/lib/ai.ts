// src/lib/ai.ts
import { HfInference } from '@huggingface/inference';
import { GPTAI } from './gptAI';

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
  private hf?: HfInference;
  private gpt?: GPTAI;
  private hfApiKey: string;
  private gptApiKey: string;

  constructor(hfApiKey?: string, gptApiKey?: string) {
    this.hfApiKey = hfApiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    this.gptApiKey = gptApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    
    if (this.gptApiKey) {
      this.gpt = new GPTAI({ apiKey: this.gptApiKey });
      console.log('🤖 MessageMind AI: Using GPT for maximum reliability');
    } else if (this.hfApiKey) {
      this.hf = new HfInference(this.hfApiKey);
      console.log('🤖 MessageMind AI: Using Hugging Face API for advanced processing');
    } else {
      console.log('🧠 MessageMind AI: Using local processing (no API keys found)');
    }
  }

  // Summarize conversation for a specific day (Local processing fallback)
  async generateDailySummary(messages: ProcessedMessage[], date: string): Promise<ConversationSummary[]> {
    const messagesByRoom = this.groupMessagesByRoom(messages, date);
    const summaries: ConversationSummary[] = [];

    for (const [roomName, roomMessages] of Object.entries(messagesByRoom)) {
      if (roomMessages.length === 0) continue;

      try {
        const conversationText = this.formatMessagesForAI(roomMessages);
        
        // Let the AI handle everything intelligently
        const summary = await this.summarizeText(conversationText);
        const sentiment = await this.analyzeSentiment(conversationText);
        
        const topics = await this.extractTopics(conversationText);
        const participants = this.extractParticipants(roomMessages);
        
        summaries.push({
          date,
          roomName,
          messageCount: roomMessages.length,
          participants,
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
      if (!this.hfApiKey || !this.hf) {
        return []; // No embeddings without API key
      }
      
      const embeddings = await Promise.all(
        texts.map(text => 
          this.hf!.featureExtraction({
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
        const conversationText = this.formatMessagesForAI(group);
        const summary = await this.summarizeText(conversationText);
        const topics = await this.extractTopics(conversationText);
        
        knowledge.push({
          id: `kb_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          participants: this.extractParticipants(group),
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
      .map(msg => {
        // Use the room name as the speaker name for AI processing
        // Since each WhatsApp room typically represents one contact
        const roomBasedName = msg.roomName.replace(/\s*\(WA\)\s*$/, '').trim();
        return `${roomBasedName}: ${msg.content}`;
      })
      .join('\n');
  }

  private cleanSenderName(sender: string): string {
    let clean = sender.split(':')[0].replace('@', '').replace('whatsapp_', '');
    
    if (clean.startsWith('lid-')) {
      return `Contact`;
    }
    
    if (/^\d+$/.test(clean)) {
      // This will be handled by the component's automatic name extraction
      return 'Contact';
    }
    
    if (clean.includes('whatsappbot')) {
      return 'WhatsAppBot';
    }
    
    return clean;
  }

  private async summarizeText(text: string): Promise<string> {
    // Try GPT first for maximum reliability
    if (this.gpt && this.gpt.isAvailable()) {
      try {
        console.log('🤖 Using GPT for summarization...');
        const messages = this.parseTextToMessages(text);
        const summary = await this.gpt.summarizeConversation(messages);
        console.log('✅ GPT Summary generated:', summary);
        return summary;
      } catch (error) {
        console.error('❌ GPT summarization failed, falling back to Hugging Face:', error);
      }
    }

    // Fallback to Hugging Face
    if (!this.hfApiKey || !this.hf) {
      return "AI summary unavailable - no API key configured";
    }

    try {
      if (text.length < 30) {
        return "Conversation too brief to summarize";
      }

      console.log('🤖 Calling Hugging Face API for conversation summarization...');
      
      // Use a better model for conversation summarization
      const result = await this.hf.summarization({
        model: 'facebook/bart-large-cnn',
        inputs: text.slice(0, 2000), // Increased for better context
        parameters: {
          max_length: 150,
          min_length: 30
        }
      });

      let summary = result.summary_text || "Could not generate summary";
      
      // If the summary is too generic, try with a different approach
      if (summary.length < 20 || summary.includes("Could not generate")) {
        console.log('🔄 Trying alternative summarization approach...');
        
        // Use text generation with a conversation-specific prompt
        const prompt = `Summarize this conversation in a clear, concise way:\n\n${text.slice(0, 1500)}\n\nSummary:`;
        
        const altResult = await this.hf.textGeneration({
          model: 'microsoft/DialoGPT-medium',
          inputs: prompt,
          parameters: {
            max_length: 200,
            temperature: 0.7,
            do_sample: true,
            top_p: 0.9
          }
        });
        
        summary = altResult.generated_text?.replace(prompt, '').trim() || summary;
      }
      
      console.log('✅ AI Summary generated:', summary);
      return summary;
      
    } catch (error: any) {
      console.error('❌ Hugging Face API summarization failed:', error);
      
      // Try fallback with a simpler model
      try {
        console.log('🔄 Trying fallback summarization...');
        const fallbackResult = await this.hf.summarization({
          model: 'sshleifer/distilbart-cnn-12-6',
          inputs: text.slice(0, 1000),
          parameters: {
            max_length: 100,
            min_length: 20
          }
        });
        
        return fallbackResult.summary_text || "Summary generation failed";
      } catch (fallbackError) {
        return `API Error: ${error.message || 'Summary generation failed'}`;
      }
    }
  }

  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    // Try GPT first for better sentiment analysis
    if (this.gpt && this.gpt.isAvailable()) {
      try {
        console.log('🤖 Using GPT for sentiment analysis...');
        const intent = await this.gpt.analyzeIntent(text);
        console.log('✅ GPT Sentiment detected:', intent.sentiment);
        return intent.sentiment;
      } catch (error) {
        console.error('❌ GPT sentiment analysis failed, falling back to Hugging Face:', error);
      }
    }

    // Fallback to Hugging Face
    if (!this.hfApiKey || !this.hf) {
      return 'neutral';
    }

    try {
      console.log('🤖 Calling Hugging Face API for sentiment analysis...');
      
      const result = await this.hf.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: text.slice(0, 500)
      });

      const sentiment = result[0]?.label?.toLowerCase();
      console.log('✅ Sentiment detected:', sentiment);
      
      if (sentiment?.includes('positive')) return 'positive';
      if (sentiment?.includes('negative')) return 'negative';
      return 'neutral';
    } catch (error) {
      console.error('❌ Hugging Face API sentiment analysis failed:', error);
      return 'neutral';
    }
  }

  // Helper to convert text back to messages for local processing
  private parseTextToMessages(text: string): ProcessedMessage[] {
    const lines = text.split('\n').filter(line => line.includes(':'));
    return lines.map((line, index) => {
      const [sender, ...contentParts] = line.split(':');
      return {
        id: `temp-${index}`,
        content: contentParts.join(':').trim(),
        sender: sender.trim(),
        timestamp: new Date(),
        roomName: 'temp',
        roomId: 'temp',
        isWhatsApp: false
      };
    });
  }

  // Enhanced local summarization with pattern recognition
  private generateLocalSummary(messages: ProcessedMessage[]): string {
    if (messages.length < 2) return "Brief conversation";
    
    // Simple fallback when AI is not available
    return `Conversation with ${messages.length} messages exchanged.`;
  }

  private detectUrgency(text: string): boolean {
    const urgentWords = ['urgent', 'asap', 'emergency', 'quickly', 'fast', 'immediately', 'help', 'please', 'need', '😭', '🥺', '🙏'];
    return urgentWords.some(word => text.includes(word));
  }

  private detectEmotion(text: string): string | null {
    if (text.includes('😂') || text.includes('😄') || text.includes('lol') || text.includes('haha')) return 'humorous';
    if (text.includes('😭') || text.includes('😔') || text.includes('sad') || text.includes('upset')) return 'concerned';
    if (text.includes('😊') || text.includes('thanks') || text.includes('great') || text.includes('awesome')) return 'positive';
    if (text.includes('angry') || text.includes('mad') || text.includes('frustrated')) return 'frustrated';
    return null;
  }

  private detectHelpRequest(text: string): boolean {
    const helpWords = ['help', 'can you', 'could you', 'please', 'assist', 'support', 'check', '?'];
    return helpWords.filter(word => text.includes(word)).length >= 2;
  }

  private detectSocialPattern(text: string): boolean {
    const socialWords = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'how are you', 'good morning', 'good night', 'lol', '😂', '😊'];
    return socialWords.some(word => text.includes(word));
  }

  private detectBusinessPattern(text: string): boolean {
    const businessWords = ['work', 'project', 'meeting', 'deadline', 'report', 'task', 'job', 'office', 'client', 'business'];
    return businessWords.some(word => text.includes(word));
  }

  private extractMainTopic(text: string): string {
    const keywords = this.extractTopicsLocal(text);
    const meaningfulKeywords = keywords.filter(word => 
      !['messagemind', 'duckdns', 'whatsapp'].includes(word.toLowerCase()) &&
      word.length > 2
    );
    
    return meaningfulKeywords.length > 0 ? meaningfulKeywords[0] : 'general discussion';
  }

  // Enhanced local sentiment analysis
  private analyzeLocalSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy', 'thanks', 'excellent', 'amazing', 'perfect', 'wonderful', '😊', '😄', '👍', '❤️', 'lol', 'haha'];
    const negativeWords = ['bad', 'awful', 'hate', 'angry', 'sad', 'terrible', 'horrible', 'annoying', 'frustrated', 'upset', '😭', '😔', '😡', '👎', 'damn', 'shit'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
      if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
    });
    
    // Check for context-based sentiment
    if (text.includes('thank god') || text.includes('finally')) positiveScore += 2;
    if (text.includes('help') && text.includes('please')) {
      // Help requests can be neutral to slightly negative
      negativeScore += 0.5;
    }
    
    const sentimentDiff = positiveScore - negativeScore;
    if (sentimentDiff > 1) return 'positive';
    if (sentimentDiff < -1) return 'negative';
    return 'neutral';
  }

  private extractTopicsLocal(text: string): string[] {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'do', 'did', 'does', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those', 'just', 'not', 'now', 'get', 'go', 'see', 'know', 'think', 'say', 'come', 'want', 'like', 'time', 'way', 'make', 'look', 'take', 'use'];
    
    // Enhanced topic extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .filter(word => !['messagemind', 'duckdns'].includes(word)); // Filter out system words
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      // Give more weight to meaningful words
      let weight = 1;
      if (word.length > 6) weight = 2;
      if (['work', 'help', 'tap', 'check', 'around', 'question', 'problem'].includes(word)) weight = 3;
      
      wordCount[word] = (wordCount[word] || 0) + weight;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private async extractTopics(text: string): Promise<string[]> {
    // Try GPT first for better topic extraction
    if (this.gpt && this.gpt.isAvailable()) {
      try {
        console.log('🤖 Using GPT for topic extraction...');
        const topics = await this.gpt.extractTopics(text);
        console.log('✅ GPT Topics extracted:', topics);
        return topics;
      } catch (error) {
        console.error('❌ GPT topic extraction failed, falling back to Hugging Face:', error);
      }
    }

    // Fallback to Hugging Face
    if (!this.hfApiKey || !this.hf) {
      return this.extractTopicsLocal(text);
    }

    try {
      console.log('🤖 Calling Hugging Face API for topic extraction...');
      
      // Use text classification to identify topics
      const result = await this.hf.textClassification({
        model: 'facebook/bart-large-mnli',
        inputs: text.slice(0, 1000)
      });

      // Extract meaningful topics from the classification
      const topics = result
        .filter(r => r.score > 0.3)
        .map(r => r.label)
        .slice(0, 5);

      if (topics.length > 0) {
        console.log('✅ AI Topics extracted:', topics);
        return topics;
      }
      
      // Fallback to local extraction
      return this.extractTopicsLocal(text);
      
    } catch (error) {
      console.error('❌ AI topic extraction failed, using local fallback:', error);
      return this.extractTopicsLocal(text);
    }
  }

  private extractParticipants(messages: ProcessedMessage[]): string[] {
    const participants = new Set<string>();
    
    messages.forEach(msg => {
      const cleanName = this.cleanSenderName(msg.sender);
      if (cleanName && cleanName !== 'Contact') {
        participants.add(cleanName);
      }
    });
    
    return Array.from(participants);
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