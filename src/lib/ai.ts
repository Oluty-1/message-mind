// Updated lib/ai.ts with more reliable HF models
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
  private useApiRoute: boolean;
  private hfFailed: boolean = false;

  constructor(hfApiKey?: string, gptApiKey?: string) {
    this.hfApiKey = hfApiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    this.gptApiKey = ''; // Disabled due to quota
    
    // Use API routes to avoid CORS issues
    this.useApiRoute = true;
    
    console.log('🔍 Checking API keys...');
    console.log('HF Key present:', !!this.hfApiKey);
    console.log('Using reliable HF models via API routes');
    
    if (this.hfApiKey) {
      console.log('🤖 MessageMind AI: Using Hugging Face via API routes with reliable models');
    } else {
      console.log('🧠 MessageMind AI: Using local processing (no API keys found)');
    }
  }

  // Call Hugging Face via API route with reliable models
  private async callHuggingFaceAPI(model: string, inputs: string, task: string, parameters: any = {}): Promise<any> {
    try {
      const response = await fetch('/api/ai/huggingface', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          inputs,
          task,
          parameters
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `API route error: ${response.status}`);
      }

      const data = await response.json();
      return data.result;

    } catch (error: any) {
      console.error(`❌ API route call failed for ${task}:`, error);
      throw error;
    }
  }

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
        
        // Create fallback summary
        summaries.push({
          date,
          roomName,
          messageCount: roomMessages.length,
          participants: this.extractParticipants(roomMessages),
          summary: this.generateLocalSummary(roomMessages),
          keyTopics: this.extractTopicsLocal(this.formatMessagesForAI(roomMessages)),
          sentiment: this.analyzeLocalSentiment(this.formatMessagesForAI(roomMessages)),
          priority: 'medium'
        });
      }
    }

    return summaries.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  // Use more reliable summarization models
  private async summarizeText(text: string): Promise<string> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        if (text.length < 30) {
          return "Conversation too brief to summarize";
        }

        console.log('🤖 Using reliable HF models for summarization...');
        
        // Try reliable summarization models in order of preference
        const summarizationModels = [
          'facebook/bart-large-cnn',
          'sshleifer/distilbart-cnn-12-6',
          't5-small'
        ];

        for (const model of summarizationModels) {
          try {
            console.log(`🔄 Trying summarization model: ${model}`);
            
            const result = await this.callHuggingFaceAPI(
              model,
              text.slice(0, 1000),
              'summarization',
              {
                max_length: 100,
                min_length: 20,
                do_sample: false
              }
            );
            
            const summary = result.summary_text || result[0]?.summary_text || '';
            if (summary && summary.length > 10) {
              console.log(`✅ ${model} summary generated:`, summary);
              return summary;
            }
          } catch (modelError) {
            console.log(`❌ Model ${model} failed:`, modelError.message);
            continue;
          }
        }
        
        // If all summarization models fail, try text generation
        console.log('🔄 Trying text generation for summarization...');
        try {
          const prompt = `Summarize this conversation in 1-2 sentences:\n\n${text.slice(0, 800)}\n\nSummary:`;
          
          const result = await this.callHuggingFaceAPI(
            'gpt2',
            prompt,
            'text-generation',
            {
              max_length: prompt.length + 50,
              temperature: 0.7,
              do_sample: true
            }
          );

          const generated = result[0]?.generated_text || '';
          const summary = generated.replace(prompt, '').trim();
          
          if (summary && summary.length > 10) {
            console.log('✅ GPT-2 summary generated:', summary);
            return summary;
          }
        } catch (genError) {
          console.log('❌ Text generation also failed:', genError.message);
        }
        
      } catch (error: any) {
        console.error('❌ All HF summarization methods failed:', error);
        this.hfFailed = true;
      }
    }

    // Fallback to enhanced local processing
    console.log('🧠 Using enhanced local summarization...');
    return this.generateLocalSummary(this.parseTextToMessages(text));
  }

  // Use more reliable sentiment models
  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        console.log('🤖 Using reliable HF models for sentiment analysis...');
        
        // Try reliable sentiment models
        const sentimentModels = [
          'cardiffnlp/twitter-roberta-base-sentiment-latest',
          'distilbert-base-uncased-finetuned-sst-2-english',
          'nlptown/bert-base-multilingual-uncased-sentiment'
        ];
        
        for (const model of sentimentModels) {
          try {
            console.log(`🔄 Trying sentiment model: ${model}`);
            
            const result = await this.callHuggingFaceAPI(
              model,
              text.slice(0, 500),
              'text-classification',
              {}
            );

            const sentiment = result[0]?.label?.toLowerCase() || '';
            console.log(`✅ ${model} sentiment detected:`, sentiment);
            
            // Handle different label formats
            if (sentiment.includes('positive') || sentiment.includes('pos') || sentiment === 'label_2') return 'positive';
            if (sentiment.includes('negative') || sentiment.includes('neg') || sentiment === 'label_0') return 'negative';
            if (sentiment === 'label_1') return 'neutral';
            
            return 'neutral';
            
          } catch (modelError) {
            console.log(`❌ Sentiment model ${model} failed:`, modelError.message);
            continue;
          }
        }
        
      } catch (error: any) {
        console.error('❌ All HF sentiment models failed:', error);
        this.hfFailed = true;
      }
    }

    // Fallback to local sentiment analysis
    console.log('🧠 Using enhanced local sentiment analysis...');
    return this.analyzeLocalSentiment(text);
  }

  // Simplified topic extraction using local processing
  private async extractTopics(text: string): Promise<string[]> {
    // For now, use local extraction for reliability
    console.log('🧠 Using enhanced local topic extraction...');
    return this.extractTopicsLocal(text);
  }

  // Enhanced local processing methods
  private generateLocalSummary(messages: any[]): string {
    if (messages.length < 2) return "Brief conversation";
    
    const messageCount = messages.length;
    const participants = new Set(messages.map(m => m.sender)).size;
    const allText = messages.map(m => m.content).join(' ').toLowerCase();
    
    // Smart pattern recognition for better summaries
    const patterns = [
      { keywords: ['help', 'please', 'can you', 'could you'], summary: 'assistance request' },
      { keywords: ['meeting', 'work', 'project', 'task'], summary: 'work discussion' },
      { keywords: ['thanks', 'thank you', 'great', 'awesome'], summary: 'positive exchange' },
      { keywords: ['problem', 'issue', 'error', 'fix'], summary: 'problem solving' },
      { keywords: ['plan', 'schedule', 'time', 'when'], summary: 'planning discussion' },
      { keywords: ['question', 'what', 'how', 'why'], summary: 'Q&A session' },
      { keywords: ['update', 'news', 'info', 'tell'], summary: 'information sharing' }
    ];
    
    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => allText.includes(keyword))) {
        return `${pattern.summary.charAt(0).toUpperCase() + pattern.summary.slice(1)} with ${messageCount} messages between ${participants} participants`;
      }
    }
    
    return `General conversation with ${messageCount} messages between ${participants} participants`;
  }

  private analyzeLocalSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy', 'thanks', 'excellent', 'amazing', 'perfect', 'wonderful', '😊', '😄', '👍', '❤️', 'lol', 'haha', 'yes', 'sure', 'okay', 'nice', 'cool', 'fine', 'alright', 'exactly', 'correct'];
    const negativeWords = ['bad', 'awful', 'hate', 'angry', 'sad', 'terrible', 'horrible', 'annoying', 'frustrated', 'upset', '😭', '😔', '😡', '👎', 'no', 'can\'t', 'won\'t', 'problem', 'issue', 'error', 'wrong', 'fail', 'difficult', 'hard', 'trouble'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
      if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
    });
    
    // Context-based adjustments
    if (text.includes('thank') && text.includes('help')) positiveScore += 2;
    if (text.includes('sorry') && text.includes('problem')) negativeScore += 1;
    if (text.includes('solved') || text.includes('fixed') || text.includes('working')) positiveScore += 1;
    if (text.includes('broken') || text.includes('failed')) negativeScore += 1;
    
    const sentimentDiff = positiveScore - negativeScore;
    if (sentimentDiff > 1) return 'positive';
    if (sentimentDiff < -1) return 'negative';
    return 'neutral';
  }

  private extractTopicsLocal(text: string): string[] {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'do', 'did', 'does', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those', 'just', 'not', 'now', 'get', 'go', 'see', 'know', 'think', 'say', 'come', 'want', 'like', 'time', 'way', 'make', 'look', 'take', 'use', 'well', 'also', 'back', 'after', 'first', 'new', 'good', 'high', 'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'same', 'able'];
    
    // Enhanced topic extraction with better patterns
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .filter(word => !['messagemind', 'duckdns', 'whatsapp', 'matrix', 'bridge', 'bridged'].includes(word));
    
    const wordCount: Record<string, number> = {};
    const importantTopics = ['work', 'help', 'meeting', 'project', 'question', 'problem', 'solution', 'update', 'plan', 'task', 'issue', 'request', 'support', 'discussion', 'planning', 'development', 'system', 'application', 'feature', 'user', 'data', 'process'];
    
    words.forEach(word => {
      let weight = 1;
      
      // Give more weight to longer words
      if (word.length > 6) weight = 2;
      if (word.length > 8) weight = 3;
      
      // Give extra weight to important topics
      if (importantTopics.includes(word)) weight = 5;
      
      // Give weight to tech/business terms
      if (word.includes('app') || word.includes('tech') || word.includes('system')) weight = 3;
      
      wordCount[word] = (wordCount[word] || 0) + weight;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)
      .filter(word => word.length > 2);
  }

  // Keep all other methods the same...
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

  prioritizeMessages(messages: ProcessedMessage[]): ProcessedMessage[] {
    return messages
      .map(msg => ({
        ...msg,
        priority: this.calculateMessagePriority(msg)
      }))
      .sort((a, b) => (b as any).priority - (a as any).priority);
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return [];
  }

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

  // All helper methods remain the same...
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

    return groups.filter(group => group.length >= 3);
  }

  private formatMessagesForAI(messages: ProcessedMessage[]): string {
    return messages
      .slice(-20)
      .map(msg => {
        const roomBasedName = msg.roomName.replace(/\s*\(WA\)\s*$/, '').trim();
        return `${roomBasedName}: ${msg.content}`;
      })
      .join('\n');
  }

  private parseTextToMessages(text: string): any[] {
    const lines = text.split('\n').filter(line => line.includes(':'));
    return lines.map((line, index) => {
      const [sender, ...contentParts] = line.split(':');
      return {
        id: `temp-${index}`,
        content: contentParts.join(':').trim(),
        sender: sender.trim(),
        timestamp: new Date(),
        roomName: 'temp',
        isWhatsApp: false
      };
    });
  }

  private extractParticipants(messages: ProcessedMessage[]): string[] {
    const participants = new Set<string>();
    
    messages.forEach(msg => {
      const cleanName = msg.roomName.replace(/\s*\(WA\)\s*$/, '').trim();
      if (cleanName && cleanName !== 'Contact') {
        participants.add(cleanName);
      }
    });
    
    return Array.from(participants);
  }

  private detectIntent(content: string): { type: string; confidence: number; category: MessageIntent['category'] } {
    const text = content.toLowerCase();
    
    if (text.includes('?') || text.startsWith('what') || text.startsWith('how') || text.startsWith('when')) {
      return { type: 'question', confidence: 0.8, category: 'question' };
    }
    
    if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
      return { type: 'urgent_request', confidence: 0.9, category: 'urgent' };
    }
    
    if (text.includes('please') || text.includes('can you') || text.includes('could you')) {
      return { type: 'request', confidence: 0.7, category: 'request' };
    }
    
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
    
    const hoursSinceMessage = (Date.now() - message.timestamp.getTime()) / (1000 * 60 * 60);
    priority += Math.max(0, 24 - hoursSinceMessage) / 24 * 10;
    
    if (content.includes('?')) priority += 5;
    if (content.includes('urgent') || content.includes('important')) priority += 15;
    if (content.includes('please') || content.includes('help')) priority += 8;
    if (content.length > 100) priority += 3;
    
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

  getAIStatus(): { hf: boolean; local: boolean; quotaExceeded: boolean } {
    return {
      hf: this.useApiRoute && !!this.hfApiKey && !this.hfFailed,
      local: this.hfFailed || !this.hfApiKey,
      quotaExceeded: false
    };
  }
}