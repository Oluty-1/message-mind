// Enhanced Intent Parser using advanced NLP techniques
import { HfInference } from '@huggingface/inference';

interface IntentResult {
  intent: string;
  confidence: number;
  category: 'question' | 'request' | 'information' | 'social' | 'urgent' | 'business' | 'personal';
  entities: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: number; // 0-1 scale
}

interface Entity {
  text: string;
  type: 'person' | 'location' | 'time' | 'action' | 'object';
  confidence: number;
}

export class EnhancedIntentParser {
  private hf?: HfInference;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    if (this.apiKey) {
      this.hf = new HfInference(this.apiKey);
    }
  }

  // Main intent parsing method using multiple NLP techniques
  async parseIntent(text: string): Promise<IntentResult> {
    try {
      // Use Hugging Face for advanced intent classification if available
      if (this.hf) {
        return await this.parseWithAI(text);
      } else {
        return this.parseWithRules(text);
      }
    } catch (error) {
      console.error('Intent parsing failed:', error);
      return this.parseWithRules(text);
    }
  }

  // Advanced AI-powered intent parsing
  private async parseWithAI(text: string): Promise<IntentResult> {
    const cleanText = this.preprocessText(text);
    
    // Use multiple models for comprehensive analysis
    const [intentClassification, sentimentAnalysis, entityExtraction] = await Promise.all([
      this.classifyIntent(cleanText),
      this.analyzeSentiment(cleanText),
      this.extractEntities(cleanText)
    ]);

    return {
      intent: intentClassification.intent,
      confidence: intentClassification.confidence,
      category: this.mapIntentToCategory(intentClassification.intent),
      entities: entityExtraction.map(e => e.text),
      sentiment: sentimentAnalysis,
      urgency: this.calculateUrgency(text, intentClassification.intent)
    };
  }

  // Rule-based fallback intent parsing
  private parseWithRules(text: string): IntentResult {
    const cleanText = text.toLowerCase();
    
    // Enhanced pattern matching
    const patterns = {
      question: /(\?|^(what|how|when|where|why|who|which|can|could|would|will|do|does|is|are|was|were))/i,
      urgent: /(urgent|asap|emergency|immediately|now|quick|fast|hurry|important)/i,
      request: /(please|can you|could you|would you|help|need|want|require|request)/i,
      social: /(hello|hi|hey|thanks|thank you|bye|goodbye|see you|nice|good|great)/i,
      business: /(meeting|work|project|deadline|client|customer|business|professional)/i,
      personal: /(family|friend|home|personal|private|feel|emotion|love|care)/i
    };

    let bestMatch = { intent: 'information', confidence: 0.5, category: 'information' as IntentResult['category'] };
    
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(cleanText)) {
        const confidence = this.calculatePatternConfidence(cleanText, pattern);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent,
            confidence,
            category: this.mapIntentToCategory(intent)
          };
        }
      }
    }

    return {
      ...bestMatch,
      entities: this.extractEntitiesRuleBased(cleanText),
      sentiment: this.analyzeSentimentRuleBased(cleanText),
      urgency: this.calculateUrgency(text, bestMatch.intent)
    };
  }

  // AI-powered intent classification
  private async classifyIntent(text: string): Promise<{ intent: string; confidence: number }> {
    try {
      const result = await this.hf!.textClassification({
        model: 'facebook/bart-large-mnli',
        inputs: text
      });

      return {
        intent: result[0].label,
        confidence: result[0].score
      };
    } catch (error) {
      console.error('AI intent classification failed:', error);
      throw error;
    }
  }

  // AI-powered sentiment analysis
  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      const result = await this.hf!.textClassification({
        model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
        inputs: text
      });

      const label = result[0].label.toLowerCase();
      if (label.includes('positive')) return 'positive';
      if (label.includes('negative')) return 'negative';
      return 'neutral';
    } catch (error) {
      console.error('AI sentiment analysis failed:', error);
      return 'neutral';
    }
  }

  // AI-powered entity extraction
  private async extractEntities(text: string): Promise<Entity[]> {
    try {
      const result = await this.hf!.tokenClassification({
        model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
        inputs: text
      });

      return result
        .filter(token => token.score > 0.5)
        .map(token => ({
          text: token.word,
          type: this.mapEntityType(token.entity_group),
          confidence: token.score
        }));
    } catch (error) {
      console.error('AI entity extraction failed:', error);
      return [];
    }
  }

  // Rule-based entity extraction
  private extractEntitiesRuleBased(text: string): string[] {
    const entities: string[] = [];
    
    // Extract names (capitalized words)
    const names = text.match(/\b[A-Z][a-z]+\b/g) || [];
    entities.push(...names);
    
    // Extract times
    const times = text.match(/\b\d{1,2}:\d{2}\b|\b(today|tomorrow|yesterday|morning|afternoon|evening|night)\b/gi) || [];
    entities.push(...times);
    
    // Extract actions (verbs)
    const actions = text.match(/\b(help|check|open|close|send|receive|meet|call|text|message)\b/gi) || [];
    entities.push(...actions);
    
    return Array.from(new Set(entities)); // Remove duplicates
  }

  // Rule-based sentiment analysis
  private analyzeSentimentRuleBased(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing', 'wonderful', 'happy', 'love', 'like', 'thanks', 'thank you'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'angry', 'sad', 'upset', 'problem', 'issue', 'wrong'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Calculate urgency score
  private calculateUrgency(text: string, intent: string): number {
    let urgency = 0;
    const lowerText = text.toLowerCase();
    
    // Intent-based urgency
    if (intent === 'urgent') urgency += 0.8;
    if (intent === 'request') urgency += 0.3;
    if (intent === 'question') urgency += 0.2;
    
    // Keyword-based urgency
    const urgentKeywords = ['urgent', 'asap', 'emergency', 'immediately', 'now', 'quick', 'fast'];
    const urgentCount = urgentKeywords.filter(word => lowerText.includes(word)).length;
    urgency += urgentCount * 0.2;
    
    // Punctuation-based urgency
    if (text.includes('!')) urgency += 0.1;
    if (text.includes('??')) urgency += 0.2;
    
    return Math.min(urgency, 1.0);
  }

  // Calculate pattern confidence
  private calculatePatternConfidence(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    if (!matches) return 0;
    
    let confidence = 0.5;
    
    // Multiple matches increase confidence
    if (matches.length > 1) confidence += 0.2;
    
    // Position in text affects confidence
    if (text.indexOf(matches[0]) < text.length * 0.3) confidence += 0.1;
    
    // Text length affects confidence
    if (text.length > 50) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  // Map intent to category
  private mapIntentToCategory(intent: string): IntentResult['category'] {
    const mapping: Record<string, IntentResult['category']> = {
      question: 'question',
      request: 'request',
      urgent: 'urgent',
      social: 'social',
      business: 'business',
      personal: 'personal',
      information: 'information'
    };
    
    return mapping[intent] || 'information';
  }

  // Map entity types
  private mapEntityType(entityGroup: string): Entity['type'] {
    const mapping: Record<string, Entity['type']> = {
      'PER': 'person',
      'LOC': 'location',
      'TIME': 'time',
      'MISC': 'object'
    };
    
    return mapping[entityGroup] || 'object';
  }

  // Preprocess text for better analysis
  private preprocessText(text: string): string {
    return text
      .replace(/[^\w\s?!.,]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Batch process multiple messages
  async parseBatchIntents(texts: string[]): Promise<IntentResult[]> {
    const results: IntentResult[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.parseIntent(text);
        results.push(result);
      } catch (error) {
        console.error(`Failed to parse intent for text: ${text.substring(0, 50)}...`, error);
        results.push({
          intent: 'information',
          confidence: 0,
          category: 'information',
          entities: [],
          sentiment: 'neutral',
          urgency: 0
        });
      }
    }
    
    return results;
  }

  // Get intent statistics
  getIntentStats(intents: IntentResult[]): {
    intentDistribution: Record<string, number>;
    averageConfidence: number;
    urgencyDistribution: { low: number; medium: number; high: number };
    sentimentDistribution: Record<string, number>;
  } {
    const intentDistribution: Record<string, number> = {};
    const sentimentDistribution: Record<string, number> = {};
    let totalConfidence = 0;
    let lowUrgency = 0, mediumUrgency = 0, highUrgency = 0;

    intents.forEach(intent => {
      // Intent distribution
      intentDistribution[intent.intent] = (intentDistribution[intent.intent] || 0) + 1;
      
      // Sentiment distribution
      sentimentDistribution[intent.sentiment] = (sentimentDistribution[intent.sentiment] || 0) + 1;
      
      // Confidence
      totalConfidence += intent.confidence;
      
      // Urgency distribution
      if (intent.urgency < 0.3) lowUrgency++;
      else if (intent.urgency < 0.7) mediumUrgency++;
      else highUrgency++;
    });

    return {
      intentDistribution,
      averageConfidence: totalConfidence / intents.length,
      urgencyDistribution: { low: lowUrgency, medium: mediumUrgency, high: highUrgency },
      sentimentDistribution
    };
  }
} 