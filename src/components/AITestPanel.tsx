'use client';

import { useState } from 'react';
import { MessageMindAI } from '@/lib/ai';
import { EnhancedIntentParser } from '@/lib/enhancedIntentParser';
import { ModelFineTuner } from '@/lib/modelFineTuner';
import { AITestingSuite } from '@/lib/aiTestingSuite';
import { Brain, TestTube, Zap, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

export default function AITestPanel() {
  const [ai] = useState(() => new MessageMindAI());
  const [intentParser] = useState(() => new EnhancedIntentParser());
  const [modelFineTuner] = useState(() => new ModelFineTuner());
  const [testingSuite] = useState(() => new AITestingSuite());
  
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testMessage, setTestMessage] = useState('Can you help me check if my tap is open?');
  const [intentResult, setIntentResult] = useState<any>(null);

  const runAITests = async () => {
    setLoading(true);
    try {
      console.log('🧪 Starting AI test suite...');
      const results = await testingSuite.runFullTestSuite();
      const report = testingSuite.getTestReport();
      setTestResults({ suites: results, report });
      console.log('✅ AI tests completed:', report);
    } catch (error) {
      console.error('❌ AI tests failed:', error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testIntentParsing = async () => {
    setLoading(true);
    try {
      console.log('🔍 Testing intent parsing...');
      const result = await intentParser.parseIntent(testMessage);
      setIntentResult(result);
      console.log('✅ Intent parsed:', result);
    } catch (error) {
      console.error('❌ Intent parsing failed:', error);
      setIntentResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testSummarization = async () => {
    setLoading(true);
    try {
      console.log('📝 Testing summarization...');
      const testMessages = [
        {
          id: '1',
          content: 'Are you around?',
          sender: 'Deborah',
          timestamp: new Date(),
          roomName: 'Deborah',
          isWhatsApp: true
        },
        {
          id: '2',
          content: 'Can you please help me check if my tap is open?',
          sender: 'Deborah',
          timestamp: new Date(),
          roomName: 'Deborah',
          isWhatsApp: true
        },
        {
          id: '3',
          content: 'Yes, I can help you with that',
          sender: 'User',
          timestamp: new Date(),
          roomName: 'Deborah',
          isWhatsApp: true
        }
      ];
      
      const summary = await ai.generateDailySummary(testMessages, new Date().toDateString());
      console.log('✅ Summary generated:', summary);
      setTestResults({ summary });
    } catch (error) {
      console.error('❌ Summarization failed:', error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const testModelFineTuning = async () => {
    setLoading(true);
    try {
      console.log('🎯 Testing model fine-tuning...');
      
      // Add training data
      const trainingData = [
        {
          input: 'Can you help me check my tap?',
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
      
      modelFineTuner.addTrainingData(trainingData);
      const result = await modelFineTuner.fineTuneModel();
      console.log('✅ Model fine-tuning completed:', result);
      setTestResults({ fineTuning: result });
    } catch (error) {
      console.error('❌ Model fine-tuning failed:', error);
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center space-x-3">
          <TestTube className="h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold">AI Testing Panel</h2>
            <p className="text-purple-100">Test and validate AI features for the Dailyfix Challenge</p>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={runAITests}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          <Brain className="h-5 w-5" />
          <span>Run Full Test Suite</span>
        </button>

        <button
          onClick={testIntentParsing}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
        >
          <Zap className="h-5 w-5" />
          <span>Test Intent Parsing</span>
        </button>

        <button
          onClick={testSummarization}
          disabled={loading}
          className="bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center space-x-2"
        >
          <TrendingUp className="h-5 w-5" />
          <span>Test Summarization</span>
        </button>

        <button
          onClick={testModelFineTuning}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
        >
          <CheckCircle className="h-5 w-5" />
          <span>Test Fine-tuning</span>
        </button>
      </div>

      {/* Intent Test Input */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Parsing Test</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Enter a message to test intent parsing..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
          />
          <button
            onClick={testIntentParsing}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Test
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-blue-800">Running AI tests...</span>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className="space-y-6">
          {/* Intent Parsing Results */}
          {intentResult && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Parsing Results</h3>
              {intentResult.error ? (
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  <span>Error: {intentResult.error}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Intent</div>
                    <div className="font-medium">{intentResult.intent}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Confidence</div>
                    <div className="font-medium">{(intentResult.confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Category</div>
                    <div className="font-medium">{intentResult.category}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm text-gray-500">Urgency</div>
                    <div className="font-medium">{(intentResult.urgency * 100).toFixed(0)}%</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Test Suite Results */}
          {testResults.report && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Suite Results</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-sm text-blue-600">Overall Score</div>
                  <div className="text-2xl font-bold text-blue-800">{testResults.report.overallScore.toFixed(1)}%</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-sm text-green-600">Passed Tests</div>
                  <div className="text-2xl font-bold text-green-800">{testResults.report.passedTests}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-sm text-red-600">Failed Tests</div>
                  <div className="text-2xl font-bold text-red-800">{testResults.report.failedTests}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-sm text-purple-600">Total Tests</div>
                  <div className="text-2xl font-bold text-purple-800">{testResults.report.totalTests}</div>
                </div>
              </div>

              {/* Test Suites */}
              <div className="space-y-4">
                {testResults.report.testSuites.map((suite: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{suite.name}</h4>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          suite.averageScore >= 80 ? 'bg-green-100 text-green-800' :
                          suite.averageScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {suite.averageScore.toFixed(1)}%
                        </span>
                        <span className="text-sm text-gray-500">
                          {suite.passedTests}/{suite.totalTests} passed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {testResults.report.recommendations.length > 0 && (
                <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {testResults.report.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="text-sm text-yellow-700">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {testResults.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>Error: {testResults.error}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 