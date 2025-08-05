// AI Testing and Validation Suite
import { MessageMindAI } from './ai';
import { MessageMindVectorStorage } from './vectorStorage';
import { EnhancedIntentParser } from './enhancedIntentParser';
import { ModelFineTuner } from './modelFineTuner';

interface TestResult {
  testName: string;
  passed: boolean;
  score: number; // 0-100
  duration: number;
  details: string;
  error?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalScore: number;
  averageScore: number;
  passedTests: number;
  totalTests: number;
}

interface PerformanceMetrics {
  responseTime: number;
  accuracy: number;
  throughput: number; // requests per second
  memoryUsage: number;
  errorRate: number;
}

export class AITestingSuite {
  private ai: MessageMindAI;
  private vectorStorage: MessageMindVectorStorage;
  private intentParser: EnhancedIntentParser;
  private modelFineTuner: ModelFineTuner;
  private testResults: TestSuite[] = [];

  constructor() {
    this.ai = new MessageMindAI();
    this.vectorStorage = new MessageMindVectorStorage();
    this.intentParser = new EnhancedIntentParser();
    this.modelFineTuner = new ModelFineTuner();
  }

  // Run comprehensive test suite
  async runFullTestSuite(): Promise<TestSuite[]> {
    console.log('🧪 Starting comprehensive AI testing suite...');
    
    const startTime = Date.now();
    
    // Run all test categories
    const testSuites = await Promise.all([
      this.testSummarization(),
      this.testIntentParsing(),
      this.testVectorStorage(),
      this.testPrioritization(),
      this.testKnowledgeBase(),
      this.testPerformance(),
      this.testModelFineTuning()
    ]);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Testing completed in ${totalTime}ms`);
    
    this.testResults = testSuites;
    return testSuites;
  }

  // Test conversation summarization accuracy
  private async testSummarization(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const testData = this.getSummarizationTestData();
    
    for (const testCase of testData) {
      const startTime = Date.now();
      
      try {
        const summary = await this.ai.generateDailySummary(testCase.messages, testCase.date);
        const duration = Date.now() - startTime;
        
        // Evaluate summary quality
        const score = this.evaluateSummaryQuality(summary[0]?.summary || '', testCase.expectedSummary);
        
        tests.push({
          testName: `Summarization: ${testCase.name}`,
          passed: score >= 70,
          score,
          duration,
          details: `Generated: "${summary[0]?.summary?.substring(0, 100)}..."`
        });
      } catch (error) {
        tests.push({
          testName: `Summarization: ${testCase.name}`,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createTestSuite('Summarization Tests', tests);
  }

  // Test intent parsing accuracy
  private async testIntentParsing(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const testData = this.getIntentTestData();
    
    for (const testCase of testData) {
      const startTime = Date.now();
      
      try {
        const intent = await this.intentParser.parseIntent(testCase.input);
        const duration = Date.now() - startTime;
        
        // Evaluate intent accuracy
        const score = this.evaluateIntentAccuracy(intent, testCase.expectedIntent);
        
        tests.push({
          testName: `Intent Parsing: ${testCase.name}`,
          passed: score >= 80,
          score,
          duration,
          details: `Detected: ${intent.intent} (${(intent.confidence * 100).toFixed(1)}% confidence)`
        });
      } catch (error) {
        tests.push({
          testName: `Intent Parsing: ${testCase.name}`,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createTestSuite('Intent Parsing Tests', tests);
  }

  // Test vector storage and retrieval
  private async testVectorStorage(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const testData = this.getVectorStorageTestData();
    
    // Clear storage before testing
    this.vectorStorage.clear();
    
    for (const testCase of testData) {
      const startTime = Date.now();
      
      try {
        // Add test messages
        await this.vectorStorage.addMessages(testCase.messages);
        
        // Test search functionality
        const searchResults = await this.vectorStorage.semanticSearch(testCase.query, 5);
        const duration = Date.now() - startTime;
        
        // Evaluate search relevance
        const score = this.evaluateSearchRelevance(searchResults, testCase.expectedResults);
        
        tests.push({
          testName: `Vector Search: ${testCase.name}`,
          passed: score >= 75,
          score,
          duration,
          details: `Found ${searchResults.length} relevant results`
        });
      } catch (error) {
        tests.push({
          testName: `Vector Search: ${testCase.name}`,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createTestSuite('Vector Storage Tests', tests);
  }

  // Test message prioritization
  private async testPrioritization(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const testData = this.getPrioritizationTestData();
    
    for (const testCase of testData) {
      const startTime = Date.now();
      
      try {
        const prioritized = this.ai.prioritizeMessages(testCase.messages);
        const duration = Date.now() - startTime;
        
        // Evaluate prioritization accuracy
        const score = this.evaluatePrioritization(prioritized, testCase.expectedOrder);
        
        tests.push({
          testName: `Prioritization: ${testCase.name}`,
          passed: score >= 70,
          score,
          duration,
          details: `Top priority: "${prioritized[0]?.content?.substring(0, 50)}..."`
        });
      } catch (error) {
        tests.push({
          testName: `Prioritization: ${testCase.name}`,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createTestSuite('Prioritization Tests', tests);
  }

  // Test knowledge base generation
  private async testKnowledgeBase(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    const testData = this.getKnowledgeBaseTestData();
    
    for (const testCase of testData) {
      const startTime = Date.now();
      
      try {
        const kb = await this.ai.createKnowledgeBase(testCase.messages);
        const duration = Date.now() - startTime;
        
        // Evaluate knowledge base quality
        const score = this.evaluateKnowledgeBaseQuality(kb, testCase.expectedTopics);
        
        tests.push({
          testName: `Knowledge Base: ${testCase.name}`,
          passed: score >= 75,
          score,
          duration,
          details: `Generated ${kb.length} knowledge entries`
        });
      } catch (error) {
        tests.push({
          testName: `Knowledge Base: ${testCase.name}`,
          passed: false,
          score: 0,
          duration: Date.now() - startTime,
          details: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return this.createTestSuite('Knowledge Base Tests', tests);
  }

  // Test performance and scalability
  private async testPerformance(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    
    // Test response time
    const responseTimeTest = await this.testResponseTime();
    tests.push(responseTimeTest);
    
    // Test throughput
    const throughputTest = await this.testThroughput();
    tests.push(throughputTest);
    
    // Test memory usage
    const memoryTest = await this.testMemoryUsage();
    tests.push(memoryTest);
    
    // Test error handling
    const errorTest = await this.testErrorHandling();
    tests.push(errorTest);
    
    return this.createTestSuite('Performance Tests', tests);
  }

  // Test model fine-tuning
  private async testModelFineTuning(): Promise<TestSuite> {
    const tests: TestResult[] = [];
    
    try {
      // Generate training data
      const trainingData = this.getFineTuningTestData();
      this.modelFineTuner.addTrainingData(trainingData);
      
      // Test fine-tuning process
      const startTime = Date.now();
      const result = await this.modelFineTuner.fineTuneModel();
      const duration = Date.now() - startTime;
      
      tests.push({
        testName: 'Model Fine-tuning',
        passed: result.accuracy >= 0.8,
        score: result.accuracy * 100,
        duration,
        details: `Accuracy: ${(result.accuracy * 100).toFixed(1)}%, Loss: ${result.loss.toFixed(3)}`
      });
      
      // Test model evaluation
      const evaluation = await this.modelFineTuner.evaluateModel(trainingData.slice(0, 5));
      
      tests.push({
        testName: 'Model Evaluation',
        passed: evaluation.accuracy >= 0.75,
        score: evaluation.accuracy * 100,
        duration: 0,
        details: `F1 Score: ${evaluation.f1Score.toFixed(3)}, Precision: ${evaluation.precision.toFixed(3)}`
      });
      
    } catch (error) {
      tests.push({
        testName: 'Model Fine-tuning',
        passed: false,
        score: 0,
        duration: 0,
        details: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return this.createTestSuite('Model Fine-tuning Tests', tests);
  }

  // Helper methods for test data
  private getSummarizationTestData() {
    return [
      {
        name: 'Help Request Conversation',
        messages: [
          { id: '1', content: 'Are you around?', sender: 'Deborah', timestamp: new Date(), roomName: 'Deborah', isWhatsApp: true },
          { id: '2', content: 'Can you please help me check if my tap is open?', sender: 'Deborah', timestamp: new Date(), roomName: 'Deborah', isWhatsApp: true },
          { id: '3', content: 'Yes, I can help you with that', sender: 'User', timestamp: new Date(), roomName: 'Deborah', isWhatsApp: true }
        ],
        date: new Date().toDateString(),
        expectedSummary: 'Deborah asking for help checking water tap'
      }
    ];
  }

  private getIntentTestData() {
    return [
      {
        name: 'Question Intent',
        input: 'Can you help me check if my tap is open?',
        expectedIntent: 'request'
      },
      {
        name: 'Urgent Intent',
        input: 'This is urgent! I need help ASAP!',
        expectedIntent: 'urgent'
      },
      {
        name: 'Social Intent',
        input: 'Hello! How are you doing today?',
        expectedIntent: 'social'
      }
    ];
  }

  private getVectorStorageTestData() {
    return [
      {
        name: 'Help-related Search',
        messages: [
          { id: '1', content: 'I need help with my tap', sender: 'User', timestamp: new Date(), roomName: 'Test', messageType: 'whatsapp' as const },
          { id: '2', content: 'Can you check if it\'s working?', sender: 'User', timestamp: new Date(), roomName: 'Test', messageType: 'whatsapp' as const }
        ],
        query: 'help with tap',
        expectedResults: ['tap', 'help']
      }
    ];
  }

  private getPrioritizationTestData() {
    return [
      {
        name: 'Urgent Message Priority',
        messages: [
          { id: '1', content: 'Hello there', sender: 'User', timestamp: new Date(), roomName: 'Test', isWhatsApp: true },
          { id: '2', content: 'URGENT: I need immediate help!', sender: 'User', timestamp: new Date(), roomName: 'Test', isWhatsApp: true }
        ],
        expectedOrder: ['2', '1'] // Urgent message should be first
      }
    ];
  }

  private getKnowledgeBaseTestData() {
    return [
      {
        name: 'Technical Discussion',
        messages: [
          { id: '1', content: 'The AI summary feature is working well', sender: 'User', timestamp: new Date(), roomName: 'Test', isWhatsApp: true },
          { id: '2', content: 'We should implement more features', sender: 'User', timestamp: new Date(), roomName: 'Test', isWhatsApp: true }
        ],
        expectedTopics: ['AI', 'features', 'implementation']
      }
    ];
  }

  private getFineTuningTestData() {
    return [
      {
        input: 'Can you help me?',
        output: 'request',
        category: 'intent_classification',
        confidence: 0.9
      },
      {
        input: 'This is urgent!',
        output: 'urgent',
        category: 'intent_classification',
        confidence: 0.95
      }
    ];
  }

  // Performance test methods
  private async testResponseTime(): Promise<TestResult> {
    const startTime = Date.now();
    const testMessage = 'This is a test message for performance testing';
    
    try {
      await this.intentParser.parseIntent(testMessage);
      const duration = Date.now() - startTime;
      
      return {
        testName: 'Response Time',
        passed: duration < 5000, // Should be under 5 seconds
        score: Math.max(0, 100 - (duration / 50)), // Score decreases with time
        duration,
        details: `Response time: ${duration}ms`
      };
    } catch (error) {
      return {
        testName: 'Response Time',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testThroughput(): Promise<TestResult> {
    const startTime = Date.now();
    const testMessages = Array(10).fill('Test message for throughput testing');
    
    try {
      const promises = testMessages.map(msg => this.intentParser.parseIntent(msg));
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      const throughput = (testMessages.length / duration) * 1000; // requests per second
      
      return {
        testName: 'Throughput',
        passed: throughput > 1, // Should handle at least 1 request per second
        score: Math.min(100, throughput * 50), // Score based on throughput
        duration,
        details: `Throughput: ${throughput.toFixed(2)} requests/second`
      };
    } catch (error) {
      return {
        testName: 'Throughput',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testMemoryUsage(): Promise<TestResult> {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    try {
      // Perform memory-intensive operations
      const largeDataset = Array(1000).fill('Test message for memory testing');
      await this.intentParser.parseBatchIntents(largeDataset);
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      return {
        testName: 'Memory Usage',
        passed: memoryIncrease < 50 * 1024 * 1024, // Should use less than 50MB
        score: Math.max(0, 100 - (memoryIncrease / (1024 * 1024))), // Score decreases with memory usage
        duration: 0,
        details: `Memory increase: ${(memoryIncrease / (1024 * 1024)).toFixed(2)}MB`
      };
    } catch (error) {
      return {
        testName: 'Memory Usage',
        passed: false,
        score: 0,
        duration: 0,
        details: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    try {
      // Test with invalid input
      await this.intentParser.parseIntent('');
      await this.intentParser.parseIntent('a'.repeat(10000)); // Very long input
      
      return {
        testName: 'Error Handling',
        passed: true,
        score: 100,
        duration: 0,
        details: 'Successfully handled edge cases'
      };
    } catch (error) {
      return {
        testName: 'Error Handling',
        passed: false,
        score: 0,
        duration: 0,
        details: 'Failed to handle edge cases',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Evaluation methods
  private evaluateSummaryQuality(generated: string, expected: string): number {
    const generatedWords = generated.toLowerCase().split(/\s+/);
    const expectedWords = expected.toLowerCase().split(/\s+/);
    
    const commonWords = generatedWords.filter(word => expectedWords.includes(word));
    const similarity = commonWords.length / Math.max(generatedWords.length, expectedWords.length);
    
    return similarity * 100;
  }

  private evaluateIntentAccuracy(intent: any, expected: string): number {
    if (intent.intent === expected) return 100;
    if (intent.category === expected) return 80;
    return 0;
  }

  private evaluateSearchRelevance(results: any[], expected: string[]): number {
    if (results.length === 0) return 0;
    
    const resultText = results.map(r => r.content).join(' ').toLowerCase();
    const expectedWords = expected.map(word => word.toLowerCase());
    
    const foundWords = expectedWords.filter(word => resultText.includes(word));
    return (foundWords.length / expectedWords.length) * 100;
  }

  private evaluatePrioritization(prioritized: any[], expectedOrder: string[]): number {
    if (prioritized.length === 0) return 0;
    
    let correctOrder = 0;
    for (let i = 0; i < Math.min(prioritized.length, expectedOrder.length); i++) {
      if (prioritized[i].id === expectedOrder[i]) {
        correctOrder++;
      }
    }
    
    return (correctOrder / expectedOrder.length) * 100;
  }

  private evaluateKnowledgeBaseQuality(kb: any[], expectedTopics: string[]): number {
    if (kb.length === 0) return 0;
    
    const kbText = kb.map(entry => entry.summary).join(' ').toLowerCase();
    const expectedWords = expectedTopics.map(topic => topic.toLowerCase());
    
    const foundTopics = expectedWords.filter(topic => kbText.includes(topic));
    return (foundTopics.length / expectedTopics.length) * 100;
  }

  // Create test suite summary
  private createTestSuite(name: string, tests: TestResult[]): TestSuite {
    const totalScore = tests.reduce((sum, test) => sum + test.score, 0);
    const averageScore = totalScore / tests.length;
    const passedTests = tests.filter(test => test.passed).length;
    
    return {
      name,
      tests,
      totalScore,
      averageScore,
      passedTests,
      totalTests: tests.length
    };
  }

  // Get comprehensive test report
  getTestReport(): {
    overallScore: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    testSuites: TestSuite[];
    recommendations: string[];
  } {
    const totalTests = this.testResults.reduce((sum, suite) => sum + suite.totalTests, 0);
    const passedTests = this.testResults.reduce((sum, suite) => sum + suite.passedTests, 0);
    const failedTests = totalTests - passedTests;
    const overallScore = this.testResults.reduce((sum, suite) => sum + suite.totalScore, 0) / totalTests;
    
    const recommendations: string[] = [];
    
    if (overallScore < 80) {
      recommendations.push('Consider improving AI model accuracy');
    }
    if (failedTests > 0) {
      recommendations.push('Fix failing tests to improve reliability');
    }
    if (overallScore < 70) {
      recommendations.push('Review and enhance AI feature implementation');
    }
    
    return {
      overallScore,
      totalTests,
      passedTests,
      failedTests,
      testSuites: this.testResults,
      recommendations
    };
  }
} 