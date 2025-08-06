// GPT AI Integration for maximum reliability
interface GPTConfig {
  apiKey?: string;
  model?: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo';
  maxTokens?: number;
  temperature?: number;
}

interface GPTResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GPTAI {
  private apiKey: string;
  private config: GPTConfig;

  constructor(config?: GPTConfig) {
    this.apiKey = config?.apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    this.config = {
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      temperature: 0.7,
      ...config
    };
  }

  // Check if GPT is available
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  // Summarize conversation using GPT
  async summarizeConversation(messages: Array<{ sender: string; content: string }>): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('GPT API key not configured');
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');

      const prompt = `Please provide a clear, concise summary of this conversation. Focus on the main points, requests, and outcomes. Keep it under 100 words.

Conversation:
${conversationText}

Summary:`;

      const response = await this.callGPT(prompt);
      return response.content.trim();
    } catch (error) {
      console.error('GPT summarization failed:', error);
      throw error;
    }
  }

  // Analyze intent using GPT
  async analyzeIntent(text: string): Promise<{
    intent: string;
    confidence: number;
    category: 'question' | 'request' | 'information' | 'social' | 'urgent' | 'business' | 'personal';
    entities: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: number;
  }> {
    if (!this.isAvailable()) {
      throw new Error('GPT API key not configured');
    }

    try {
      const prompt = `Analyze the intent of this message and provide a structured response in JSON format.

Message: "${text}"

Please respond with a JSON object containing:
- intent: The primary intent (question, request, information, social, urgent, business, personal)
- confidence: Confidence score (0-1)
- category: Same as intent
- entities: Array of important entities (names, locations, times, actions)
- sentiment: positive, neutral, or negative
- urgency: Urgency score (0-1)

Response:`;

      const response = await this.callGPT(prompt);
      
      try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        
        // Fallback parsing
        return this.parseIntentFromText(response.content);
      } catch (parseError) {
        console.error('Failed to parse GPT response:', parseError);
        return this.parseIntentFromText(response.content);
      }
    } catch (error) {
      console.error('GPT intent analysis failed:', error);
      throw error;
    }
  }

  // Extract topics using GPT
  async extractTopics(text: string): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('GPT API key not configured');
    }

    try {
      const prompt = `Extract the main topics from this conversation. Return only a comma-separated list of 3-5 key topics.

Conversation:
${text}

Topics:`;

      const response = await this.callGPT(prompt);
      const topics = response.content
        .split(',')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
        .slice(0, 5);

      return topics;
    } catch (error) {
      console.error('GPT topic extraction failed:', error);
      throw error;
    }
  }

  // Generate knowledge base entry using GPT
  async generateKnowledgeEntry(messages: Array<{ sender: string; content: string }>): Promise<{
    summary: string;
    topics: string[];
    keyInsights: string[];
    actionItems: string[];
  }> {
    if (!this.isAvailable()) {
      throw new Error('GPT API key not configured');
    }

    try {
      const conversationText = messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');

      const prompt = `Analyze this conversation and create a knowledge base entry. Provide a JSON response with:

{
  "summary": "Brief summary of the conversation",
  "topics": ["topic1", "topic2", "topic3"],
  "keyInsights": ["insight1", "insight2"],
  "actionItems": ["action1", "action2"]
}

Conversation:
${conversationText}

Analysis:`;

      const response = await this.callGPT(prompt);
      
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        
        // Fallback
        return {
          summary: response.content,
          topics: [],
          keyInsights: [],
          actionItems: []
        };
      } catch (parseError) {
        return {
          summary: response.content,
          topics: [],
          keyInsights: [],
          actionItems: []
        };
      }
    } catch (error) {
      console.error('GPT knowledge generation failed:', error);
      throw error;
    }
  }

  // Call GPT API
  private async callGPT(prompt: string): Promise<GPTResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that analyzes conversations and provides accurate, concise responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GPT API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
    };
  }

  // Parse intent from GPT text response (fallback)
  private parseIntentFromText(text: string): any {
    const lowerText = text.toLowerCase();
    
    // Extract intent
    let intent = 'information';
    if (lowerText.includes('question') || lowerText.includes('?')) intent = 'question';
    if (lowerText.includes('request') || lowerText.includes('help')) intent = 'request';
    if (lowerText.includes('urgent') || lowerText.includes('asap')) intent = 'urgent';
    if (lowerText.includes('social') || lowerText.includes('hello')) intent = 'social';
    if (lowerText.includes('business') || lowerText.includes('work')) intent = 'business';
    if (lowerText.includes('personal') || lowerText.includes('family')) intent = 'personal';

    // Extract sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (lowerText.includes('positive') || lowerText.includes('good')) sentiment = 'positive';
    if (lowerText.includes('negative') || lowerText.includes('bad')) sentiment = 'negative';

    // Extract urgency
    let urgency = 0.5;
    if (lowerText.includes('urgent') || lowerText.includes('asap')) urgency = 0.9;
    if (lowerText.includes('important')) urgency = 0.7;

    return {
      intent,
      confidence: 0.8,
      category: intent,
      entities: [],
      sentiment,
      urgency
    };
  }

  // Get usage statistics
  getUsageStats(): { totalTokens: number; totalCost: number } {
    // This would track usage over time
    return {
      totalTokens: 0,
      totalCost: 0
    };
  }
} 