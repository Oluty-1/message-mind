// Google Gemini AI Integration for MessageMind
interface GeminiConfig {
  apiKey?: string;
  model?: 'gemini-pro' | 'gemini-pro-vision';
  maxTokens?: number;
  temperature?: number;
}

interface GeminiResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GeminiAI {
  private apiKey: string;
  private config: GeminiConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config?: GeminiConfig) {
    this.apiKey = config?.apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    this.config = {
      model: 'gemini-pro',
      maxTokens: 512,
      temperature: 0.2,
      ...config
    };
  }

  // Check if Gemini is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // Summarize conversation using Gemini (now uses retry + strict prompt)
  async summarizeConversation(messages: Array<{ sender: string; content: string }>): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');

      const prompt = `Please analyze this conversation and return ONLY a concise JSON object exactly matching the schema:\n{ "summary": "..." }\n\nConversation:\n${conversationText}\n\nRespond with valid JSON and nothing else.`;

      console.log('=======================================');
      console.log('Gemini summarize prompt:', prompt);
      console.log('=======================================');
      
      const response = await this.callGeminiWithRetry(prompt, { temperature: 0.1, maxOutputTokens: 220 });
      console.log('=======================================');
      console.log('Gemini summarize response:', response);
      console.log('=======================================');
      
      // Parse strict JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          console.log('=======================================');
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('=======================================');
          console.log('Parsed Gemini JSON:', parsed);
          if (parsed && typeof parsed.summary === 'string') return parsed.summary.trim();
        } catch (e) {
          // fallthrough to returning raw text trimmed
          console.error('Failed to parse Gemini JSON in summarizeConversation:', e);
        }
      }

      return response.content.trim();
    } catch (error) {
      console.error('Gemini summarization failed:', error);
      throw error;
    }
  }

  // Generate daily summary with insights (strict JSON + retry)
  async generateDailySummary(conversationText: string, participants: string[], messageCount: number): Promise<{
    summary: string;
    keyTopics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    priority: 'high' | 'medium' | 'low';
    insights: string[];
    patterns: string[];
    actionItems: string[];
  }> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Analyze this conversation and respond with a single valid JSON object only. Do not include any explanatory text.\n\nConversation (${messageCount} messages between ${participants.join(', ')}):\n${conversationText}\n\nReturn JSON with keys: summary (string), keyTopics (array of strings), sentiment (positive|neutral|negative), priority (high|medium|low), insights (array of strings), patterns (array of strings), actionItems (array of strings).`;

      const response = await this.callGeminiWithRetry(prompt, { temperature: 0.1, maxOutputTokens: 600 });

      // Strict JSON parse with defensive checks
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: typeof parsed.summary === 'string' ? parsed.summary : 'Conversation summary not available',
            keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 5) : [],
            sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
            priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
            insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 5) : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 5) : []
          };
        } catch (parseError) {
          console.error('Failed to parse Gemini JSON in generateDailySummary:', parseError);
        }
      }

      // Fallback parsing from free text
      return this.parseAnalysisFromText(response.content);
    } catch (error) {
      console.error('Gemini daily summary failed:', error);
      throw error;
    }
  }

  // Analyze message priority using Gemini (strict JSON + retry)
  async analyzeMessagePriority(message: string, context?: string): Promise<{
    priority: 'high' | 'medium' | 'low';
    urgency: number;
    reasoning: string;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Analyze the priority of this message and respond with ONLY valid JSON. Do not include any extra text.\n\nMessage: "${message}"\n${context ? `Context: ${context}\n` : ''}\nReturn JSON: { "priority": "high|medium|low", "urgency": number, "reasoning": "short string" }`;

      const response = await this.callGeminiWithRetry(prompt, { temperature: 0.0, maxOutputTokens: 80 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
            urgency: typeof parsed.urgency === 'number' ? Math.max(0, Math.min(1, parsed.urgency)) : 0.5,
            reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Priority assessment completed'
          };
        } catch (parseError) {
          console.error('Failed to parse priority JSON:', parseError);
        }
      }

      return this.analyzePriorityFallback(message);
    } catch (error) {
      console.error('Gemini priority analysis failed:', error);
      throw error;
    }
  }

  // Extract topics using Gemini (return JSON array)
  async extractTopics(text: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Extract the main topics from this conversation and return ONLY a JSON array of strings (e.g. ["topic1","topic2"]).\n\nConversation:\n${text}`;

      const response = await this.callGeminiWithRetry(prompt, { temperature: 0.0, maxOutputTokens: 160 });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) return parsed.map(String).slice(0, 5);
        } catch (e) {
          console.error('Failed to parse topics array:', e);
        }
      }

      // Fallback to previous comma-split behavior if JSON fails
      const topics = response.content
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .slice(0, 5);

      return topics;
    } catch (error) {
      console.error('Gemini topic extraction failed:', error);
      throw error;
    }
  }

  // Generate insights using Gemini (numbered list or JSON, with retry)
  async generateInsights(conversationText: string, messageCount: number): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Analyze this conversation and return 2-3 key insights as a JSON array of strings only.\n\nConversation (${messageCount} messages):\n${conversationText}`;

      const response = await this.callGeminiWithRetry(prompt, { temperature: 0.15, maxOutputTokens: 220 });

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) return parsed.map(String).slice(0, 3);
        } catch (e) {
          // fallthrough to numbered-list parsing
        }
      }

      // Try numbered-list parsing as fallback
      const insights = response.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\./, '').trim())
        .filter(i => i.length > 6)
        .slice(0, 3);

      return insights;
    } catch (error) {
      console.error('Gemini insights generation failed:', error);
      throw error;
    }
  }

  // New: call Gemini with retries and optional overrides for deterministic behavior
  private async callGeminiWithRetry(prompt: string, overrides: { temperature?: number; maxOutputTokens?: number; attempts?: number } = {}): Promise<GeminiResponse> {
    const attempts = overrides.attempts || 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < attempts) {
      try {
        // Use the low-level callGemini but pass in overrides to control generationConfig
        const response = await this.callGemini(prompt, { temperature: overrides.temperature, maxOutputTokens: overrides.maxOutputTokens });
        return response;
      } catch (err) {
        lastError = err;
        attempt++;
        const backoff = Math.pow(2, attempt) * 200; // exponential backoff
        await new Promise(res => setTimeout(res, backoff));
      }
    }

    throw lastError || new Error('Gemini call failed after retries');
  }

  // Call Gemini API (extended to accept overrides for generationConfig)
  private async callGemini(prompt: string, overrides?: { temperature?: number; maxOutputTokens?: number }): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.apiKey}`;
    const genConfig = {
      temperature: typeof overrides?.temperature === 'number' ? overrides.temperature : this.config.temperature,
      maxOutputTokens: typeof overrides?.maxOutputTokens === 'number' ? overrides.maxOutputTokens : this.config.maxTokens,
      topP: 0.8,
      topK: 40
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: genConfig
      })
    });

    if (!response.ok) {
      let errorBody: any = {};
      try { errorBody = await response.json(); } catch (e) { /* ignore */ }
      throw new Error(`Gemini API error: ${errorBody.error?.message || response.status}`);
    }

    const data = await response.json().catch(() => null);
    if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const content = data.candidates[0].content.parts[0].text;

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  // Parse analysis from text response (fallback)
  private parseAnalysisFromText(text: string): any {
    const lowerText = text.toLowerCase();
    
    // Extract sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (lowerText.includes('positive') || lowerText.includes('good') || lowerText.includes('happy')) {
      sentiment = 'positive';
    } else if (lowerText.includes('negative') || lowerText.includes('bad') || lowerText.includes('frustrated')) {
      sentiment = 'negative';
    }

    // Extract priority
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (lowerText.includes('urgent') || lowerText.includes('important') || lowerText.includes('high priority')) {
      priority = 'high';
    } else if (lowerText.includes('low priority') || lowerText.includes('routine')) {
      priority = 'low';
    }

    return {
      summary: text.substring(0, 200) + '...',
      keyTopics: [],
      sentiment,
      priority,
      insights: [],
      patterns: [],
      actionItems: []
    };
  }

  // Fallback priority analysis
  private analyzePriorityFallback(message: string): {
    priority: 'high' | 'medium' | 'low';
    urgency: number;
    reasoning: string;
  } {
    const lowerMessage = message.toLowerCase();
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let urgency = 0.5;
    let reasoning = 'Standard message priority';

    // Check for urgency indicators
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'immediately', 'important', 'critical'];
    const hasUrgentKeywords = urgentKeywords.some(keyword => lowerMessage.includes(keyword));

    if (hasUrgentKeywords) {
      priority = 'high';
      urgency = 0.9;
      reasoning = 'Contains urgency indicators';
    } else if (lowerMessage.includes('?')) {
      priority = 'medium';
      urgency = 0.6;
      reasoning = 'Contains question requiring response';
    } else if (lowerMessage.length < 20) {
      priority = 'low';
      urgency = 0.3;
      reasoning = 'Short message, likely routine';
    }

    return { priority, urgency, reasoning };
  }

  // Get usage statistics
  getUsageStats(): { totalTokens: number; totalCost: number } {
    // This would track usage over time in a real implementation
    return {
      totalTokens: 0,
      totalCost: 0
    };
  }

  // Test connection to Gemini
  async testConnection(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.callGemini('Hello, this is a test message. Please respond with "Test successful".');
      return true;
    } catch (error) {
      console.error('Gemini connection test failed:', error);
      return false;
    }
  }
}

// Exported helper: Generate embeddings using Gemini embedding endpoint
export async function callGeminiEmbedding(text: string, apiKey: string, url?: string): Promise<number[]> {
  // Default endpoint (can be overridden with GEMINI_EMBEDDINGS_URL)
  let endpoint = url || 'https://generativelanguage.googleapis.com/v1beta2/models/textembedding-gecko-001:embed';

  // Google API keys (like those starting with "AIza") must be passed as ?key=API_KEY
  // OAuth access tokens should be passed as Bearer tokens in Authorization header.
  const isApiKey = typeof apiKey === 'string' && apiKey.startsWith('AIza');

  if (isApiKey) {
    endpoint += endpoint.includes('?') ? '&' : '?';
    endpoint += `key=${encodeURIComponent(apiKey)}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!isApiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: text })
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => null);
    throw new Error(`Gemini embedding request failed: ${resp.status} ${body}`);
  }

  const data = await resp.json().catch(() => null);

  // Defensive parsing for common response shapes
  const maybeEmbedding = data?.embedding || data?.embeddings?.[0]?.embedding || data?.results?.[0]?.embedding || data?.data?.[0]?.embedding || null;
  if (Array.isArray(maybeEmbedding)) {
    return maybeEmbedding as number[];
  }

  // Try to locate any numeric array in response JSON as a last resort
  const found = JSON.stringify(data).match(/\[\s*-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*\s*\]/);
  if (found) {
    try {
      return JSON.parse(found[0]) as number[];
    } catch (e) {
      throw new Error('Unable to parse Gemini embedding from response');
    }
  }

  throw new Error('Gemini embedding response did not contain an embedding array');
}