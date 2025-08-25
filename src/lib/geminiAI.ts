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
      maxTokens: 1000,
      temperature: 0.7,
      ...config
    };
  }

  // Check if Gemini is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // Summarize conversation using Gemini
  async summarizeConversation(messages: Array<{ sender: string; content: string }>): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');

      const prompt = `Please analyze this conversation and provide a clear, concise summary. Focus on:
- Main topics discussed
- Key requests or questions
- Important outcomes or decisions
- Overall tone and context

Keep the summary under 100 words and make it actionable.

Conversation:
${conversationText}

Summary:`;

      const response = await this.callGemini(prompt);
      return response.content.trim();
    } catch (error) {
      console.error('Gemini summarization failed:', error);
      throw error;
    }
  }

  // Generate daily summary with insights
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
      const prompt = `Analyze this conversation and provide a comprehensive analysis in JSON format.

Conversation (${messageCount} messages between ${participants.join(', ')}):
${conversationText}

Please respond with a JSON object containing:
{
  "summary": "Brief summary of the conversation (2-3 sentences)",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive|neutral|negative",
  "priority": "high|medium|low",
  "insights": ["insight1", "insight2"],
  "patterns": ["pattern1", "pattern2"],
  "actionItems": ["action1", "action2"]
}

Consider:
- Urgency indicators (urgent, ASAP, important, etc.)
- Question frequency and complexity
- Emotional tone and language
- Communication patterns
- Follow-up requirements

Response:`;

      const response = await this.callGemini(prompt);
      
      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: parsed.summary || 'Conversation summary not available',
            keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
            sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
            priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
            insights: Array.isArray(parsed.insights) ? parsed.insights : [],
            patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : []
          };
        }
        
        // Fallback parsing
        return this.parseAnalysisFromText(response.content);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        return this.parseAnalysisFromText(response.content);
      }
    } catch (error) {
      console.error('Gemini daily summary failed:', error);
      throw error;
    }
  }

  // Analyze message priority using Gemini
  async analyzeMessagePriority(message: string, context?: string): Promise<{
    priority: 'high' | 'medium' | 'low';
    urgency: number;
    reasoning: string;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Analyze the priority of this message and respond in JSON format.

Message: "${message}"
${context ? `Context: ${context}` : ''}

Consider these factors:
- Urgency keywords (urgent, ASAP, emergency, important, etc.)
- Question complexity and type
- Emotional tone
- Time sensitivity
- Request type (help, information, action required)

Respond with JSON:
{
  "priority": "high|medium|low",
  "urgency": 0.0-1.0,
  "reasoning": "Brief explanation of the priority assessment"
}

Response:`;

      const response = await this.callGemini(prompt);
      
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
            urgency: typeof parsed.urgency === 'number' ? Math.max(0, Math.min(1, parsed.urgency)) : 0.5,
            reasoning: parsed.reasoning || 'Priority assessment completed'
          };
        }
      } catch (parseError) {
        console.error('Failed to parse priority response:', parseError);
      }
      
      // Fallback analysis
      return this.analyzePriorityFallback(message);
    } catch (error) {
      console.error('Gemini priority analysis failed:', error);
      throw error;
    }
  }

  // Extract topics using Gemini
  async extractTopics(text: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Extract the main topics from this conversation. Return only a comma-separated list of 3-5 key topics.

Conversation:
${text}

Topics (comma-separated):`;

      const response = await this.callGemini(prompt);
      const topics = response.content
        .split(',')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 5);

      return topics;
    } catch (error) {
      console.error('Gemini topic extraction failed:', error);
      throw error;
    }
  }

  // Generate insights using Gemini
  async generateInsights(conversationText: string, messageCount: number): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const prompt = `Analyze this conversation and provide 2-3 key insights about communication patterns, relationships, or important themes.

Conversation (${messageCount} messages):
${conversationText}

Provide insights as a numbered list:
1.
2.
3.

Insights:`;

      const response = await this.callGemini(prompt);
      
      // Extract numbered list items
      const insights = response.content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(insight => insight.length > 10)
        .slice(0, 3);

      return insights;
    } catch (error) {
      console.error('Gemini insights generation failed:', error);
      throw error;
    }
  }

  // Call Gemini API
  private async callGemini(prompt: string): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
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