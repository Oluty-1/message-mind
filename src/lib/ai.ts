import { HfInference } from '@huggingface/inference';
import { GPTAI } from './gptAI';
import { GeminiAI } from './geminiAI';

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
  insights: string[];
  patterns: string[];
  actionItems: string[];
}

interface MessageIntent {
  intent: string;
  confidence: number;
  category: 'question' | 'request' | 'information' | 'social' | 'urgent';
}

export class MessageMindAI {
  private hf?: HfInference;
  private gpt?: GPTAI;
  private gemini?: GeminiAI;
  private geminiApiKey?: string;
  private hfApiKey: string;
  private gptApiKey: string;
  private useApiRoute: boolean;
  private hfFailed: boolean = false;

  constructor(hfApiKey?: string, gptApiKey?: string) {
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    this.hfApiKey = hfApiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    this.gptApiKey = gptApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    
    this.useApiRoute = true;
    
    console.log('🔍 Initializing Generative AI...');
    console.log('HF Key present:', !!this.hfApiKey, 'GPT Key present:', !!this.gptApiKey, 'Gemini Key present:', !!this.geminiApiKey);
    
    // Initialize Gemini first (highest priority)
    if (this.geminiApiKey) {
      try {
        this.gemini = new GeminiAI({ apiKey: this.geminiApiKey });
        console.log('✅ Gemini AI initialized');
      } catch (e) {
        console.warn('⚠️ Failed to initialize Gemini AI:', e);
      }
    }
    
    if (this.gptApiKey) {
      try {
        this.gpt = new GPTAI({ apiKey: this.gptApiKey });
        console.log('✅ GPTAI initialized');
      } catch (e) {
        console.warn('⚠️ Failed to initialize GPTAI:', e);
      }
    }
    
    if (this.hfApiKey) {
      console.log('🤖 MessageMind AI: Using Hugging Face for fallback processing');
    } else {
      console.log('🧠 MessageMind AI: Using local generative processing');
    }
  }

  private async callHuggingFaceAPI(model: string, inputs: string, task: string, parameters: any = {}): Promise<any> {
    try {
      // Add a timeout to avoid hanging requests and abort if taking too long
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s

      const response = await fetch('/api/ai/huggingface', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, inputs, task, parameters }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // Defensive parsing of error body
        let errBody: any = {};
        try { errBody = await response.json(); } catch (e) { errBody = { status: response.status, text: await response.text().catch(() => '') }; }
        // Mark Hugging Face as failed so we stop issuing more calls
        this.hfFailed = true;
        throw new Error(errBody?.error || `API route error: ${response.status}`);
      }

      const data = await response.json().catch(err => {
        this.hfFailed = true;
        throw new Error('Invalid JSON from Hugging Face API route');
      });

      return data.result;

    } catch (error: any) {
      // Mark HF as failed to switch to local heuristics and avoid flooding failing endpoint
      this.hfFailed = true;
      console.error(`❌ API route call failed for ${task}:`, error?.message || error);
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

        if (this.useApiRoute && (this.hfFailed || !this.hfApiKey) && !this.gpt) {
          const summary = await this.generateFallbackSummary(roomMessages);
          const sentiment = await this.generateSentimentAnalysis(conversationText);
          const topics = await this.generateFallbackTopics(roomMessages);
          const insights = this.generateContextualInsights(conversationText, roomMessages);
          const patterns = this.analyzeConversationPatterns(roomMessages);
          const actionItems = this.extractActionItemsHeuristic(conversationText);
          const priority = this.calculatePriorityHeuristic(conversationText, roomMessages);

          summaries.push({ date, roomName, messageCount: roomMessages.length, participants: this.extractParticipants(roomMessages), summary, keyTopics: topics, sentiment, priority, insights, patterns, actionItems });
          continue;
        }

        // Try Gemini first (highest priority)
        if (this.gemini && this.gemini.isAvailable()) {
          try {
            console.log('🤖 Using Gemini AI for conversation analysis...');
            const geminiAnalysis = await this.gemini.generateDailySummary(
              conversationText,
              this.extractParticipants(roomMessages),
              roomMessages.length
            );
            
            summaries.push({
              date,
              roomName,
              messageCount: roomMessages.length,
              participants: this.extractParticipants(roomMessages),
              ...geminiAnalysis
            });
            continue;
          } catch (geminiError) {
            console.warn('Gemini analysis failed, falling back to other methods:', geminiError);
          }
        }

        let summary: string;
        try { summary = await this.generateSummary(roomMessages as ProcessedMessage[]); } catch (err) { console.error('Summary generation failed, falling back to heuristic:', err); summary = await this.generateFallbackSummary(roomMessages); }

        let sentiment: 'positive' | 'neutral' | 'negative';
        try { sentiment = await this.analyzeSentiment(conversationText); } catch (err) { console.error('Sentiment analysis failed, using heuristic:', err); sentiment = this.generateSentimentAnalysis(conversationText); }

        let topics: string[];
        try { topics = await this.extractTopics(conversationText); } catch (err) { console.error('Topic extraction failed, using heuristic:', err); topics = await this.generateFallbackTopics(roomMessages); }

        let insights: string[];
        try { insights = await this.generateInsights(conversationText, roomMessages); } catch (err) { console.error('Insights generation failed, using heuristic:', err); insights = this.generateContextualInsights(conversationText, roomMessages); }

        let patterns: string[];
        try { patterns = await this.identifyPatterns(conversationText, roomMessages); } catch (err) { console.error('Pattern identification failed, using heuristic:', err); patterns = this.analyzeConversationPatterns(roomMessages); }

        let actionItems: string[];
        try { actionItems = await this.extractActionItems(conversationText); } catch (err) { console.error('Action item extraction failed, using heuristic:', err); actionItems = this.extractActionItemsHeuristic(conversationText); }

        let priority: 'high' | 'medium' | 'low';
        try { priority = await this.calculatePriorityGenerative(conversationText, roomMessages); } catch (err) { console.error('Priority calculation failed, using heuristic:', err); priority = this.calculatePriorityHeuristic(conversationText, roomMessages); }

        summaries.push({ date, roomName, messageCount: roomMessages.length, participants: this.extractParticipants(roomMessages), summary, keyTopics: topics, sentiment, priority, insights, patterns, actionItems });
      } catch (error) {
        console.error(`Failed to process room ${roomName}:`, error);
        summaries.push({ date, roomName, messageCount: roomMessages.length, participants: this.extractParticipants(roomMessages), summary: await this.generateFallbackSummary(roomMessages), keyTopics: await this.generateFallbackTopics(roomMessages), sentiment: 'neutral', priority: 'medium', insights: [], patterns: [], actionItems: [] });
      }
    }

    return summaries.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  private async generateSummary(conversationOrMessages: string | ProcessedMessage[]): Promise<string> {
    // Priority order: Gemini > GPT > HF > Local
    
    // Try Gemini first
    try {
      if (Array.isArray(conversationOrMessages) && this.gemini && this.gemini.isAvailable()) {
        const msgs = (conversationOrMessages as ProcessedMessage[]).map(m => ({ sender: m.sender, content: m.content }));
        try {
          const geminiSummary = await this.gemini.summarizeConversation(msgs);
          if (geminiSummary && geminiSummary.length > 10) return this.cleanGeneratedText(geminiSummary);
        } catch (geminiErr) {
          console.warn('Gemini summarization failed, falling back to GPT/HF:', (geminiErr as any)?.message || geminiErr);
        }
      }

      // If input is string, try to parse into messages and attempt Gemini if available
      if (typeof conversationOrMessages === 'string' && this.gemini && this.gemini.isAvailable()) {
        const lines = conversationOrMessages.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
        const msgs = lines.map(line => {
          const parts = line.split(':');
          return { sender: parts[0].trim(), content: parts.slice(1).join(':').trim() };
        });
        if (msgs.length > 0) {
          try {
            const geminiSummary = await this.gemini.summarizeConversation(msgs);
            if (geminiSummary && geminiSummary.length > 10) return this.cleanGeneratedText(geminiSummary);
          } catch (geminiErr) {
            console.warn('Gemini summarization (from string) failed, continuing to GPT/HF:', (geminiErr as any)?.message || geminiErr);
          }
        }
      }
    } catch (err) {
      console.warn('Error while attempting Gemini summarization:', err);
    }

    // If a message array is provided and GPT is available, try GPT next
    try {
      if (Array.isArray(conversationOrMessages) && this.gpt && this.gpt.isAvailable()) {
        const msgs = (conversationOrMessages as ProcessedMessage[]).map(m => ({ sender: m.sender, content: m.content }));
        try {
          const gptSummary = await this.gpt.summarizeConversation(msgs);
          if (gptSummary && gptSummary.length > 10) return this.cleanGeneratedText(gptSummary);
        } catch (gptErr) {
          console.warn('GPT summarization failed, falling back to HF/local:', (gptErr as any)?.message || gptErr);
        }
      }

      // If input is string, try to parse into messages and attempt GPT if available
      if (typeof conversationOrMessages === 'string' && this.gpt && this.gpt.isAvailable()) {
        const lines = conversationOrMessages.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
        const msgs = lines.map(line => {
          const parts = line.split(':');
          return { sender: parts[0].trim(), content: parts.slice(1).join(':').trim() };
        });
        if (msgs.length > 0) {
          try {
            const gptSummary = await this.gpt.summarizeConversation(msgs);
            if (gptSummary && gptSummary.length > 10) return this.cleanGeneratedText(gptSummary);
          } catch (gptErr) {
            console.warn('GPT summarization (from string) failed, continuing to HF/local:', (gptErr as any)?.message || gptErr);
          }
        }
      }
    } catch (err) {
      console.warn('Error while attempting GPT summarization:', err);
    }

    // Existing HF + heuristic behavior (unchanged)
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        console.log('🤖 Generating dynamic summary with AI...');
        
        // Try summarization models first
        const summarizationModels = [
          'facebook/bart-large-cnn',
          'sshleifer/distilbart-cnn-12-6',
          'google/pegasus-xsum'
        ];

        for (const model of summarizationModels) {
          try {
            console.log(`🔄 Trying summarization model: ${model}`);
            
            const result = await this.callHuggingFaceAPI(
              model,
              (typeof conversationOrMessages === 'string' ? conversationOrMessages : this.formatMessagesForAI(conversationOrMessages as ProcessedMessage[])).slice(0, 1000), // Limit input length
              'summarization',
              {
                max_length: 80,
                min_length: 20,
                do_sample: false
              }
            );
            
            let summary = result[0]?.summary_text || '';
            
            if (summary && summary.length > 20 && summary.length < 200) {
              return this.cleanGeneratedText(summary);
            }
          } catch (modelError) {
            const errMsg = (modelError as any)?.message || String(modelError);
            console.log(`❌ Summarization model failed:`, errMsg);
            continue;
          }
        }

        // Fallback to text generation with a simpler model
        const conversationSnippet = (typeof conversationOrMessages === 'string' ? conversationOrMessages : this.formatMessagesForAI(conversationOrMessages as ProcessedMessage[])).slice(0, 500);
        const prompt = `Summarize: ${conversationSnippet}

Summary:`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 50,
            temperature: 0.3,
            do_sample: true,
            pad_token_id: 50256
          }
        );

        let summary = result[0]?.generated_text || '';
        
        const summaryStart = summary.indexOf('Provide a single paragraph summary');
        if (summaryStart !== -1) {
          summary = summary.substring(summaryStart + 'Provide a single paragraph summary that captures the main points and context:'.length).trim();
        }

        if (summary && summary.length > 20 && summary.length < 300) {
          return this.cleanGeneratedText(summary);
        }
        
      } catch (error) {
        console.error('❌ AI summary generation failed:', error);
        this.hfFailed = true;
      }
    }

    return this.generateNaturalLanguageSummary(typeof conversationOrMessages === 'string' ? conversationOrMessages : this.formatMessagesForAI(conversationOrMessages as ProcessedMessage[]));
  }

  private async generateInsights(conversationText: string, messages: ProcessedMessage[]): Promise<string[]> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        console.log('🧠 Generating dynamic insights...');
        
        const prompt = `Based on this conversation, list 3 key insights:

${conversationText.slice(0, 800)}

Insights:
1.`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 100,
            temperature: 0.5,
            do_sample: true,
            pad_token_id: 50256
          }
        );

        const generated = result[0]?.generated_text || '';
        const insights = this.extractListFromGenerated(generated, 'Insights:');
        
        if (insights.length > 0) {
          return insights.slice(0, 3);
        }
        
      } catch (error) {
        console.error('❌ AI insights generation failed:', error);
      }
    }

    return this.generateContextualInsights(conversationText, messages);
  }

  private async identifyPatterns(conversationText: string, messages: ProcessedMessage[]): Promise<string[]> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        console.log('🔍 Identifying communication patterns...');
        
        const prompt = `Analyze communication patterns in this conversation:

${conversationText.slice(0, 800)}

Patterns:
-`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 80,
            temperature: 0.4,
            do_sample: true,
            pad_token_id: 50256
          }
        );

        const generated = result[0]?.generated_text || '';
        const patterns = this.extractListFromGenerated(generated, 'Patterns:');
        
        if (patterns.length > 0) {
          return patterns.slice(0, 3);
        }
        
      } catch (error) {
        console.error('❌ Pattern identification failed:', error);
      }
    }

    return this.analyzeConversationPatterns(messages);
  }

  private async extractActionItems(conversationText: string): Promise<string[]> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        console.log('📋 Extracting action items...');
        
        const prompt = `Extract action items from this conversation:

${conversationText.slice(0, 800)}

Action items:
-`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 60,
            temperature: 0.2,
            do_sample: true,
            pad_token_id: 50256
          }
        );

        const generated = result[0]?.generated_text || '';
        const actionItems = this.extractListFromGenerated(generated, 'Action items:');
        
        return actionItems.slice(0, 3);
        
      } catch (error) {
        console.error('❌ Action item extraction failed:', error);
      }
    }

    return this.extractActionItemsHeuristic(conversationText);
  }

  private async calculatePriorityGenerative(conversationText: string, messages: ProcessedMessage[]): Promise<'high' | 'medium' | 'low'> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        const prompt = `Rate this conversation priority (high/medium/low):

${conversationText.slice(0, 500)}

Priority:`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 10,
            temperature: 0.1,
            do_sample: false,
            pad_token_id: 50256
          }
        );

        const generated = result[0]?.generated_text?.toLowerCase() || '';
        
        if (generated.includes('high priority') || generated.includes('urgent') || generated.includes('important')) {
          return 'high';
        } else if (generated.includes('low priority') || generated.includes('routine') || generated.includes('casual')) {
          return 'low';
        }
        
        return 'medium';
        
      } catch (error) {
        console.error('❌ Priority calculation failed:', error);
      }
    }

    return this.calculatePriorityHeuristic(conversationText, messages);
  }

  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        const sentimentModels = [
          'cardiffnlp/twitter-roberta-base-sentiment-latest',
          'distilbert-base-uncased-finetuned-sst-2-english'
        ];
        
        for (const model of sentimentModels) {
          try {
            const result = await this.callHuggingFaceAPI(
              model,
              text.slice(0, 500),
              'text-classification',
              {}
            );

            const sentiment = result[0]?.label?.toLowerCase() || '';
            
            if (sentiment.includes('positive') || sentiment.includes('pos') || sentiment === 'label_2') return 'positive';
            if (sentiment.includes('negative') || sentiment.includes('neg') || sentiment === 'label_0') return 'negative';
            
            return 'neutral';
            
          } catch (modelError) {
            continue;
          }
        }
        
      } catch (error) {
        console.error('❌ Sentiment analysis failed:', error);
        this.hfFailed = true;
      }
    }

    return this.generateSentimentAnalysis(text);
  }

  private async extractTopics(text: string): Promise<string[]> {
    if (this.useApiRoute && this.hfApiKey && !this.hfFailed) {
      try {
        const prompt = `Extract main topics from this conversation:

${text.slice(0, 800)}

Topics:
-`;

        const result = await this.callHuggingFaceAPI(
          'gpt2',
          prompt,
          'text-generation',
          {
            max_new_tokens: 60,
            temperature: 0.3,
            do_sample: true,
            pad_token_id: 50256
          }
        );

        const generated = result[0]?.generated_text || '';
        const topics = this.extractListFromGenerated(generated, 'Topics:');
        
        return topics.slice(0, 5);
        
      } catch (error) {
        console.error('❌ Topic extraction failed:', error);
      }
    }

    return this.generateTopicsNaturally(text);
  }

  private extractListFromGenerated(generated: string, marker: string): string[] {
    const items: string[] = [];
    const lines = generated.split('\n');
    let foundMarker = false;
    let itemCount = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes(marker)) {
        foundMarker = true;
        const afterMarker = trimmed.substring(trimmed.indexOf(marker) + marker.length).trim();
        if (afterMarker && afterMarker !== '-' && afterMarker.length > 3) {
          items.push(this.cleanGeneratedText(afterMarker));
          itemCount++;
        }
        continue;
      }
      
      if (foundMarker && itemCount < 3) {
        if (trimmed.startsWith('-') || trimmed.match(/^\d+\./) || trimmed.length > 10) {
          let cleaned = trimmed.replace(/^[-\d.]\s*/, '').trim();
          
          // Stop at certain patterns that indicate end of list
          if (cleaned.includes('Based on') || cleaned.includes('The conversation') || 
              cleaned.includes('Overall') || cleaned.includes('In summary')) {
            break;
          }
          
          if (cleaned && cleaned.length > 5 && cleaned.length < 150) {
            items.push(this.cleanGeneratedText(cleaned));
            itemCount++;
          }
        }
      }
      
      // Stop if we've found enough items or hit obvious end markers
      if (itemCount >= 3 || trimmed.includes('###') || trimmed.includes('---')) {
        break;
      }
    }
    
    return items.filter(item => item.length > 8 && item.length < 150);
  }

  private cleanGeneratedText(text: string): string {
    return text
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^\w]+/, '')
      .replace(/[^\w\s.,!?-]+$/, '');
  }

  private generateNaturalLanguageSummary(conversationText: string): string {
    const lines = conversationText.split('\n').filter(line => line.includes(':'));
    const messageCount = lines.length;
    const participants = new Set(lines.map(line => line.split(':')[0])).size;
    
    if (messageCount < 3) return "Brief conversation exchange.";
    
    const allText = lines.map(line => line.split(':').slice(1).join(':')).join(' ').toLowerCase();
    
    const contentAnalysis = this.analyzeContentNaturally(allText);
    const interactionStyle = this.analyzeInteractionStyle(lines);
    
    let summary = `${interactionStyle} between ${participants} participant${participants > 1 ? 's' : ''} `;
    
    if (contentAnalysis.primaryTopic) {
      summary += `focusing on ${contentAnalysis.primaryTopic}`;
    } else {
      summary += 'covering various topics';
    }
    
    if (contentAnalysis.tone !== 'neutral') {
      summary += ` with a ${contentAnalysis.tone} tone`;
    }
    
    if (messageCount > 20) {
      summary += `. Extended discussion with ${messageCount} messages.`;
    } else {
      summary += '.';
    }
    
    return summary;
  }

  private analyzeContentNaturally(text: string): { primaryTopic: string | null; tone: string } {
    const words = text.split(/\s+/);
    const wordFreq: Record<string, number> = {};
    
    const meaningfulWords = words.filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'would', 'could', 'should'].includes(word)
    );
    
    meaningfulWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    const topWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);
    
    let primaryTopic: string | null = null;
    if (topWords.length > 0 && wordFreq[topWords[0]] > 2) {
      primaryTopic = topWords[0];
    }
    
    const positiveIndicators = ['good', 'great', 'thanks', 'love', 'happy', 'excellent'];
    const negativeIndicators = ['bad', 'problem', 'issue', 'wrong', 'difficult', 'frustrated'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveIndicators.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });
    
    negativeIndicators.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });
    
    let tone = 'neutral';
    if (positiveCount > negativeCount + 1) tone = 'positive';
    else if (negativeCount > positiveCount + 1) tone = 'negative';
    
    return { primaryTopic, tone };
  }

  private analyzeInteractionStyle(lines: string[]): string {
    const avgLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    const questionCount = lines.filter(line => line.includes('?')).length;
    const shortResponses = lines.filter(line => line.split(':').slice(1).join(':').trim().length < 20).length;
    
    if (questionCount > lines.length * 0.3) {
      return "Q&A session";
    } else if (shortResponses > lines.length * 0.6) {
      return "Quick exchange";
    } else if (avgLength > 100) {
      return "Detailed discussion";
    } else {
      return "Conversation";
    }
  }

  private generateContextualInsights(conversationText: string, messages: ProcessedMessage[]): string[] {
    const insights: string[] = [];
    const messageCount = messages.length;
    const timeSpan = messages.length > 1 ? 
      messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime() : 0;
    
    if (timeSpan > 0) {
      const hours = timeSpan / (1000 * 60 * 60);
      if (hours < 1) {
        insights.push("Rapid-fire conversation with quick responses");
      } else if (hours > 24) {
        insights.push("Extended conversation spanning multiple days");
      }
    }
    
    const avgMessageLength = conversationText.length / messageCount;
    if (avgMessageLength > 100) {
      insights.push("Participants tend to send detailed messages");
    } else if (avgMessageLength < 30) {
      insights.push("Brief, concise communication style");
    }
    
    const questionCount = (conversationText.match(/\?/g) || []).length;
    if (questionCount > messageCount * 0.3) {
      insights.push("High level of inquiry and information seeking");
    }
    
    return insights.slice(0, 3);
  }

  private analyzeConversationPatterns(messages: ProcessedMessage[]): string[] {
    const patterns: string[] = [];
    
    if (messages.length < 2) return patterns;
    
    const timeGaps = messages.slice(1).map((msg, i) => 
      msg.timestamp.getTime() - messages[i].timestamp.getTime()
    );
    
    const avgGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;
    
    if (avgGap < 60000) {
      patterns.push("Real-time conversation with immediate responses");
    } else if (avgGap > 3600000) {
      patterns.push("Asynchronous communication with delayed responses");
    }
    
    const participants = new Set(messages.map(m => m.sender));
    if (participants.size === 1) {
      patterns.push("Monologue or series of messages from single sender");
    } else if (participants.size > 3) {
      patterns.push("Multi-participant group discussion");
    }
    
    return patterns.slice(0, 3);
  }

  private extractActionItemsHeuristic(conversationText: string): string[] {
    const actionItems: string[] = [];
    const lines = conversationText.split('\n');
    
    const actionIndicators = [
      'need to', 'should', 'will', 'going to', 'plan to', 'have to',
      'let me', 'i\'ll', 'we\'ll', 'can you', 'could you', 'please'
    ];
    
    lines.forEach(line => {
      const content = line.split(':').slice(1).join(':').toLowerCase();
      actionIndicators.forEach(indicator => {
        if (content.includes(indicator) && content.length > 20 && content.length < 100) {
          actionItems.push(content.trim());
        }
      });
    });
    
    return actionItems.slice(0, 3);
  }

  private calculatePriorityHeuristic(conversationText: string, messages: ProcessedMessage[]): 'high' | 'medium' | 'low' {
    let priorityScore = 0;
    
    const urgentWords = ['urgent', 'asap', 'emergency', 'important', 'critical'];
    const text = conversationText.toLowerCase();
    
    urgentWords.forEach(word => {
      if (text.includes(word)) priorityScore += 2;
    });
    
    if (messages.length > 20) priorityScore += 1;
    if ((conversationText.match(/\?/g) || []).length > 3) priorityScore += 1;
    
    const recentMessages = messages.filter(m => 
      Date.now() - m.timestamp.getTime() < 24 * 60 * 60 * 1000
    ).length;
    
    if (recentMessages > 10) priorityScore += 1;
    
    if (priorityScore >= 3) return 'high';
    if (priorityScore >= 1) return 'medium';
    return 'low';
  }

  private generateSentimentAnalysis(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy', 'thanks', 'excellent', 'amazing', 'perfect'];
    const negativeWords = ['bad', 'awful', 'hate', 'angry', 'sad', 'terrible', 'horrible', 'frustrated', 'upset'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
      if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
    });
    
    if (positiveScore > negativeScore + 1) return 'positive';
    if (negativeScore > positiveScore + 1) return 'negative';
    return 'neutral';
  }

  private generateTopicsNaturally(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private async generateFallbackSummary(messages: ProcessedMessage[]): Promise<string> {
    const conversationText = this.formatMessagesForAI(messages);
    return this.generateNaturalLanguageSummary(conversationText);
  }

  private async generateFallbackTopics(messages: ProcessedMessage[]): Promise<string[]> {
    const conversationText = this.formatMessagesForAI(messages);
    return this.generateTopicsNaturally(conversationText);
  }

  async analyzeMessageIntent(message: ProcessedMessage): Promise<MessageIntent> {
    try {
      // Try Gemini for intent analysis first
      if (this.gemini && this.gemini.isAvailable()) {
        try {
          const priorityAnalysis = await this.gemini.analyzeMessagePriority(message.content);
          return {
            intent: priorityAnalysis.priority === 'high' ? 'urgent' : 'information',
            confidence: priorityAnalysis.urgency,
            category: priorityAnalysis.priority === 'high' ? 'urgent' : 'information'
          };
        } catch (geminiError) {
          console.warn('Gemini intent analysis failed, using fallback:', geminiError);
        }
      }
      
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
    // Use Gemini for enhanced message prioritization if available
    if (this.gemini && this.gemini.isAvailable()) {
      return messages
        .map(msg => ({
          ...msg,
          priority: this.calculateMessagePriorityWithGemini(msg)
        }))
        .sort((a, b) => (b as any).priority - (a as any).priority);
    }
    
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
        const summary = await this.generateSummary(conversationText);
        const topics = await this.extractTopics(conversationText);
        const insights = await this.generateInsights(conversationText, group);
        
        knowledge.push({
          id: `kb_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          participants: this.extractParticipants(group),
          roomName: group[0].roomName,
          summary,
          topics,
          insights,
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
    const recentMessages = messages.slice(-15);
    
    return recentMessages
      .map(msg => {
        let content = msg.content.trim();
        
        if (content.startsWith('!') || content.includes('bridged') || content.length < 3) {
          return null;
        }
        
        const senderName = msg.roomName.replace(/\s*\(WA\)\s*$/, '').trim() || 'User';
        
        return `${senderName}: ${content}`;
      })
      .filter(line => line !== null)
      .join('\n');
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

  // Enhanced message priority calculation using Gemini
  private calculateMessagePriorityWithGemini(message: ProcessedMessage): number {
    // This would be called asynchronously in a real implementation
    // For now, we'll use the standard calculation with Gemini-inspired logic
    let priority = 0;
    const content = message.content.toLowerCase();
    
    // Time-based priority
    const hoursSinceMessage = (Date.now() - message.timestamp.getTime()) / (1000 * 60 * 60);
    priority += Math.max(0, 24 - hoursSinceMessage) / 24 * 10;
    
    // Enhanced keyword analysis (Gemini-inspired)
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'immediately', 'important', 'critical', 'help'];
    const questionKeywords = ['?', 'what', 'how', 'when', 'where', 'why', 'can you', 'could you'];
    const actionKeywords = ['please', 'need', 'require', 'must', 'should'];
    
    urgentKeywords.forEach(keyword => {
      if (content.includes(keyword)) priority += 15;
    });
    
    questionKeywords.forEach(keyword => {
      if (content.includes(keyword)) priority += 8;
    });
    
    actionKeywords.forEach(keyword => {
      if (content.includes(keyword)) priority += 5;
    });
    
    // Message length and complexity
    if (content.length > 100) priority += 3;
    if (content.split(' ').length > 20) priority += 2;
    
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
      hf: (this.useApiRoute && !!this.hfApiKey && !this.hfFailed) || (!!this.gemini && this.gemini.isAvailable()) || (!!this.gpt && this.gpt.isAvailable()),
      local: this.hfFailed || !this.hfApiKey,
      quotaExceeded: false
    };
  }
}