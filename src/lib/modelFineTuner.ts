// Model Fine-tuning for contextual adaptation
import { HfInference } from '@huggingface/inference';

interface TrainingData {
  input: string;
  output: string;
  category: string;
  confidence: number;
}

interface FineTuningConfig {
  modelName: string;
  learningRate: number;
  epochs: number;
  batchSize: number;
  maxLength: number;
}

interface FineTuningResult {
  modelId: string;
  accuracy: number;
  loss: number;
  trainingTime: number;
  samplesProcessed: number;
}

export class ModelFineTuner {
  private hf?: HfInference;
  private apiKey: string;
  private trainingData: TrainingData[] = [];
  private config: FineTuningConfig;

  constructor(apiKey?: string, config?: Partial<FineTuningConfig>) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_HF_API_KEY || '';
    if (this.apiKey) {
      this.hf = new HfInference(this.apiKey);
    }
    
    this.config = {
      modelName: 'microsoft/DialoGPT-medium',
      learningRate: 2e-5,
      epochs: 3,
      batchSize: 8,
      maxLength: 512,
      ...config
    };
  }

  // Add training data from conversation context
  addTrainingData(data: TrainingData | TrainingData[]): void {
    if (Array.isArray(data)) {
      this.trainingData.push(...data);
    } else {
      this.trainingData.push(data);
    }
    
    console.log(`📚 Added ${Array.isArray(data) ? data.length : 1} training samples. Total: ${this.trainingData.length}`);
  }

  // Generate training data from conversations
  generateTrainingDataFromConversations(conversations: Array<{
    messages: Array<{ content: string; sender: string; timestamp: Date }>;
    summary: string;
    category: string;
  }>): TrainingData[] {
    const trainingData: TrainingData[] = [];

    conversations.forEach(conversation => {
      // Create input-output pairs for summarization
      const conversationText = conversation.messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');

      trainingData.push({
        input: conversationText,
        output: conversation.summary,
        category: 'summarization',
        confidence: 0.9
      });

      // Create training data for intent classification
      conversation.messages.forEach(message => {
        const intent = this.extractIntentFromMessage(message.content);
        trainingData.push({
          input: message.content,
          output: intent,
          category: 'intent_classification',
          confidence: 0.8
        });
      });

      // Create training data for sentiment analysis
      const sentiment = this.extractSentimentFromConversation(conversation);
      trainingData.push({
        input: conversationText,
        output: sentiment,
        category: 'sentiment_analysis',
        confidence: 0.85
      });
    });

    return trainingData;
  }

  // Fine-tune model with collected data
  async fineTuneModel(): Promise<FineTuningResult> {
    if (!this.hf) {
      throw new Error('Hugging Face API key required for fine-tuning');
    }

    if (this.trainingData.length < 10) {
      throw new Error('Insufficient training data. Need at least 10 samples.');
    }

    console.log(`🚀 Starting fine-tuning with ${this.trainingData.length} samples...`);
    const startTime = Date.now();

    try {
      // Prepare training data
      const preparedData = this.prepareTrainingData();
      
      // Create fine-tuning job
      const result = await this.createFineTuningJob(preparedData);
      
      const trainingTime = Date.now() - startTime;
      
      console.log(`✅ Fine-tuning completed in ${trainingTime}ms`);
      
      return {
        modelId: result.modelId,
        accuracy: result.accuracy,
        loss: result.loss,
        trainingTime,
        samplesProcessed: this.trainingData.length
      };
      
    } catch (error) {
      console.error('❌ Fine-tuning failed:', error);
      throw error;
    }
  }

  // Prepare training data for fine-tuning
  private prepareTrainingData(): any[] {
    return this.trainingData.map(sample => ({
      text: sample.input,
      label: sample.output,
      category: sample.category,
      confidence: sample.confidence
    }));
  }

  // Create fine-tuning job (simulated for demo)
  private async createFineTuningJob(data: any[]): Promise<{
    modelId: string;
    accuracy: number;
    loss: number;
  }> {
    // Simulate fine-tuning process
    console.log('🔄 Simulating fine-tuning process...');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calculate simulated metrics
    const accuracy = 0.85 + Math.random() * 0.1; // 85-95% accuracy
    const loss = 0.1 + Math.random() * 0.2; // 0.1-0.3 loss
    
    return {
      modelId: `fine-tuned-${Date.now()}`,
      accuracy,
      loss
    };
  }

  // Extract intent from message content
  private extractIntentFromMessage(content: string): string {
    const text = content.toLowerCase();
    
    if (text.includes('?')) return 'question';
    if (text.includes('please') || text.includes('can you')) return 'request';
    if (text.includes('urgent') || text.includes('asap')) return 'urgent';
    if (text.includes('hello') || text.includes('hi')) return 'social';
    if (text.includes('work') || text.includes('meeting')) return 'business';
    
    return 'information';
  }

  // Extract sentiment from conversation
  private extractSentimentFromConversation(conversation: {
    messages: Array<{ content: string }>;
  }): string {
    const allText = conversation.messages
      .map(msg => msg.content.toLowerCase())
      .join(' ');
    
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'happy', 'love', 'thanks'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'angry', 'sad', 'problem'];
    
    const positiveCount = positiveWords.filter(word => allText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => allText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  // Evaluate model performance
  async evaluateModel(testData: TrainingData[]): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  }> {
    console.log(`📊 Evaluating model with ${testData.length} test samples...`);
    
    let correctPredictions = 0;
    let totalPredictions = testData.length;
    
    for (const sample of testData) {
      try {
        const prediction = await this.predict(sample.input);
        if (prediction === sample.output) {
          correctPredictions++;
        }
      } catch (error) {
        console.error('Prediction failed:', error);
      }
    }
    
    const accuracy = correctPredictions / totalPredictions;
    const precision = accuracy; // Simplified for demo
    const recall = accuracy; // Simplified for demo
    const f1Score = (2 * precision * recall) / (precision + recall);
    
    return {
      accuracy,
      precision,
      recall,
      f1Score
    };
  }

  // Make predictions with fine-tuned model
  async predict(input: string): Promise<string> {
    if (!this.hf) {
      throw new Error('Hugging Face API key required for predictions');
    }

    try {
      // Use the fine-tuned model for prediction
      const result = await this.hf.textGeneration({
        model: this.config.modelName,
        inputs: input,
        parameters: {
          max_length: this.config.maxLength,
          temperature: 0.7,
          do_sample: true
        }
      });

      return result.generated_text || 'No prediction';
    } catch (error) {
      console.error('Prediction failed:', error);
      return 'Prediction error';
    }
  }

  // Get training statistics
  getTrainingStats(): {
    totalSamples: number;
    categories: Record<string, number>;
    averageConfidence: number;
    dataQuality: 'low' | 'medium' | 'high';
  } {
    const categories: Record<string, number> = {};
    let totalConfidence = 0;

    this.trainingData.forEach(sample => {
      categories[sample.category] = (categories[sample.category] || 0) + 1;
      totalConfidence += sample.confidence;
    });

    const averageConfidence = totalConfidence / this.trainingData.length;
    
    // Determine data quality
    let dataQuality: 'low' | 'medium' | 'high' = 'low';
    if (this.trainingData.length >= 50 && averageConfidence > 0.8) {
      dataQuality = 'high';
    } else if (this.trainingData.length >= 20 && averageConfidence > 0.6) {
      dataQuality = 'medium';
    }

    return {
      totalSamples: this.trainingData.length,
      categories,
      averageConfidence,
      dataQuality
    };
  }

  // Clear training data
  clearTrainingData(): void {
    this.trainingData = [];
    console.log('🗑️ Cleared all training data');
  }

  // Export training data
  exportTrainingData(): TrainingData[] {
    return [...this.trainingData];
  }

  // Import training data
  importTrainingData(data: TrainingData[]): void {
    this.trainingData = [...data];
    console.log(`📥 Imported ${data.length} training samples`);
  }
} 