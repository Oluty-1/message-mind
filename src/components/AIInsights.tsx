'use client';

import { useState, useEffect } from 'react';
import { MessageMindMatrix } from '@/lib/matrix';
import { MessageMindAI } from '@/lib/ai';
import { Brain, TrendingUp, MessageCircle, Clock, AlertCircle, Sparkles } from 'lucide-react';

interface ProcessedMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  roomName: string;
  isWhatsApp: boolean;
}

interface AIInsightsProps {
  client: MessageMindMatrix;
  messages: ProcessedMessage[];
}

export default function AIInsights({ client, messages }: AIInsightsProps) {
  const [ai] = useState(() => new MessageMindAI());
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);
  const [prioritizedMessages, setPrioritizedMessages] = useState<ProcessedMessage[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [apiStatus, setApiStatus] = useState<'local' | 'api' | 'checking'>('checking');

  // Check API status on component mount
  useEffect(() => {
    const hasApiKey = process.env.NEXT_PUBLIC_HF_API_KEY;
    setApiStatus(hasApiKey ? 'api' : 'local');
  }, []);

  // Process messages with AI
  const processWithAI = async () => {
    if (messages.length === 0) return;
    
    setLoading(true);
    setProcessingStatus('Analyzing conversations...');

    try {
      // Generate daily summary for today
      const today = new Date().toISOString().split('T')[0];
      setProcessingStatus('Generating daily summaries...');
      const summaries = await ai.generateDailySummary(messages, today);
      setDailySummaries(summaries);

      // Prioritize messages
      setProcessingStatus('Prioritizing messages...');
      const prioritized = ai.prioritizeMessages(messages.slice(0, 50)); // Limit for performance
      setPrioritizedMessages(prioritized);

      // Create knowledge base
      setProcessingStatus('Building knowledge base...');
      const kb = await ai.createKnowledgeBase(messages.slice(0, 100));
      setKnowledgeBase(kb);

      setProcessingStatus('Analysis complete!');
    } catch (error) {
      console.error('AI processing failed:', error);
      setProcessingStatus('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => setProcessingStatus(''), 3000);
    }
  };

  const formatSender = (sender: string) => {
    // Clean up sender name for display
    let cleanSender = sender.split(':')[0].replace('@', '').replace('whatsapp_', '').replace('_', ' ');
    
    // Handle WhatsApp bridge user IDs
    if (cleanSender.startsWith('lid-')) {
      return `Contact (${cleanSender.substring(4, 10)}...)`;
    }
    
    // Handle phone numbers - make them more readable
    if (/^\d+$/.test(cleanSender)) {
      return `+${cleanSender}`;
    }
    
    // Handle system users
    if (cleanSender.includes('whatsappbot')) {
      return 'WhatsApp Bot';
    }
    
    return cleanSender.charAt(0).toUpperCase() + cleanSender.slice(1);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😔';
      default: return '😐';
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Processing Controls */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold">AI Insights</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  apiStatus === 'api' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {apiStatus === 'api' ? '🌐 Cloud AI' : '🧠 Local AI'}
                </span>
              </div>
              <p className="text-purple-100">
                {apiStatus === 'api' 
                  ? 'Powered by Hugging Face models for advanced analysis'
                  : 'Using local processing for privacy and speed'
                }
              </p>
            </div>
          </div>
          <button
            onClick={processWithAI}
            disabled={loading || messages.length === 0}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Sparkles className="h-5 w-5" />
            <span>{loading ? 'Processing...' : 'Analyze Messages'}</span>
          </button>
        </div>
        
        {processingStatus && (
          <div className="mt-4 bg-white/20 rounded-lg p-3">
            <p className="text-sm">{processingStatus}</p>
          </div>
        )}
      </div>

      {/* Daily Summaries */}
      {dailySummaries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Daily Conversation Summaries</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {dailySummaries.map((summary, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{summary.roomName}</h4>
                    <span className="text-sm text-gray-500">
                      {getSentimentEmoji(summary.sentiment)} {summary.messageCount} messages
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(summary.priority)}`}>
                    {summary.priority} priority
                  </span>
                </div>
                
                <p className="text-gray-700 text-sm mb-3 leading-relaxed">{summary.summary}</p>
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Participants: {summary.participants.map(formatSender).join(', ')}</span>
                  {summary.keyTopics.length > 0 && (
                    <span>Topics: {summary.keyTopics.filter(topic => !['messagemind', 'duckdns', 'whatsapp'].includes(topic.toLowerCase())).slice(0, 3).join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized Messages */}
      {prioritizedMessages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Priority Messages</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {prioritizedMessages.slice(0, 10).map(message => (
                <div key={message.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {formatSender(message.sender)}
                        </p>
                        <p className="text-xs text-gray-500">{message.roomName}</p>
                        {message.isWhatsApp && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            WhatsApp
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm">
                        {message.content.length > 100 
                          ? message.content.substring(0, 100) + '...'
                          : message.content
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {message.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      {knowledgeBase.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Knowledge Base</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-4">
              {knowledgeBase.slice(0, 5).map((entry, index) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{entry.roomName}</h4>
                    <span className="text-xs text-gray-500">
                      {entry.messageCount} messages
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{entry.summary}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>
                      Participants: {entry.participants.map(formatSender).join(', ')}
                    </span>
                    {entry.topics.length > 0 && (
                      <span>Topics: {entry.topics.filter(topic => !['messagemind', 'duckdns', 'whatsapp'].includes(topic.toLowerCase())).slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && messages.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Messages to Analyze</h3>
          <p className="text-gray-500">
            Messages will appear here once they sync from your Matrix server.
          </p>
        </div>
      )}
    </div>
  );
}