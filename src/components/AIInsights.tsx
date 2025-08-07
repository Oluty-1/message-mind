'use client';

import { useState, useEffect } from 'react';
import { MessageMindMatrix } from '@/lib/matrix';
import { MessageMindAI } from '@/lib/ai';
import { MessageMindVectorStorage } from '@/lib/vectorStorage';
import SemanticSearch from './SemanticSearch';
import { Brain, TrendingUp, MessageCircle, Clock, AlertCircle, Sparkles, Search, Wifi, WifiOff, Lightbulb, Target, CheckCircle } from 'lucide-react';

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

interface AIInsightsProps {
  client: MessageMindMatrix;
  messages: ProcessedMessage[];
}

export default function AIInsights({ client, messages }: AIInsightsProps) {
  const [ai] = useState(() => new MessageMindAI());
  const [vectorStorage] = useState(() => new MessageMindVectorStorage());
  const [dailySummaries, setDailySummaries] = useState<ConversationSummary[]>([]);
  const [prioritizedMessages, setPrioritizedMessages] = useState<ProcessedMessage[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [aiStatus, setAiStatus] = useState({ hf: false, local: false, quotaExceeded: false });
  const [activeAITab, setActiveAITab] = useState<'summaries' | 'search' | 'knowledge'>('summaries');

  useEffect(() => {
    const status = ai.getAIStatus();
    setAiStatus(status);
    
    console.log('🤖 AI Status:', status);
    
    if (status.hf) {
      console.log('🤖 MessageMind: Using Generative AI with Hugging Face');
    } else if (status.local) {
      console.log('🧠 MessageMind: Using local generative processing');
    } else {
      console.log('⚠️ MessageMind: Limited AI features available');
    }
  }, [ai]);

  const processWithAI = async () => {
    if (messages.length === 0) return;
    
    setLoading(true);
    setProcessingStatus('🚀 Initializing generative AI analysis...');

    try {
      const today = new Date().toISOString().split('T')[0];
      setProcessingStatus('🧠 Generating dynamic conversation insights...');
      
      console.log('🔄 Starting generative AI processing with', messages.length, 'messages');
      const summaries = await ai.generateDailySummary(messages, today);
      console.log('✅ Generated', summaries.length, 'AI-powered summaries with insights');
      setDailySummaries(summaries);

      setProcessingStatus('🎯 Analyzing message priorities with AI...');
      const prioritized = ai.prioritizeMessages(messages.slice(0, 50));
      console.log('✅ AI-prioritized', prioritized.length, 'messages');
      setPrioritizedMessages(prioritized);

      setProcessingStatus('📚 Building intelligent knowledge base...');
      const kb = await ai.createKnowledgeBase(messages.slice(0, 100));
      console.log('✅ Created AI knowledge base with', kb.length, 'entries');
      setKnowledgeBase(kb);

      setProcessingStatus('🔍 Indexing for semantic search...');
      try {
        await vectorStorage.addMessages(
          messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender,
            roomName: msg.roomName,
            timestamp: msg.timestamp,
            messageType: msg.isWhatsApp ? 'whatsapp' : 'matrix'
          }))
        );
        console.log('✅ Indexed messages for intelligent search');
      } catch (embeddingError) {
        console.log('⚠️ Vector indexing skipped (embeddings not available)');
      }

      setProcessingStatus('✨ AI analysis complete!');
    } catch (error) {
      console.error('❌ AI processing failed:', error);
      setProcessingStatus('⚠️ Analysis completed with some limitations');
    } finally {
      setLoading(false);
      setTimeout(() => setProcessingStatus(''), 5000);
    }
  };

  const formatSender = (sender: string) => {
    let cleanSender = sender.split(':')[0].replace('@', '').replace('whatsapp_', '').replace('_', ' ');
    
    if (cleanSender.startsWith('lid-')) {
      return `Contact`;
    }
    
    if (/^\d+$/.test(cleanSender)) {
      const senderPattern = `whatsapp_${cleanSender}`;
      const senderMessage = messages.find(msg => msg.sender.includes(senderPattern));
      if (senderMessage) {
        const roomName = senderMessage.roomName;
        if (roomName && !roomName.includes('Room') && !roomName.includes('bridge') && !roomName.includes('Group')) {
          const cleanName = roomName.replace(/\s*\(WA\)\s*$/, '').trim();
          if (cleanName.length > 1 && !cleanName.match(/^\d+$/)) {
            return cleanName;
          }
        }
      }
      return 'Contact';
    }
    
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

  const getAIStatusInfo = () => {
    if (aiStatus.hf) {
      return {
        icon: <Brain className="h-4 w-4" />,
        text: '🤖 Generative AI',
        description: 'Dynamic insights powered by large language models',
        color: 'bg-purple-100 text-purple-800'
      };
    } else if (aiStatus.local) {
      return {
        icon: <Brain className="h-4 w-4" />,
        text: '🧠 Local AI',
        description: 'Intelligent local processing with natural language generation',
        color: 'bg-green-100 text-green-800'
      };
    } else {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        text: '⚠️ Basic Mode',
        description: 'Limited processing - enable AI for intelligent insights',
        color: 'bg-yellow-100 text-yellow-800'
      };
    }
  };

  const statusInfo = getAIStatusInfo();

  return (
    <div className="space-y-6">
      {/* AI Processing Controls */}
      <div className="bg-gradient-to-r from-purple-500 via-indigo-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold">Generative AI Insights</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${statusInfo.color}`}>
                  {statusInfo.icon}
                  <span>{statusInfo.text}</span>
                </span>
              </div>
              <p className="text-purple-100">
                {statusInfo.description}
              </p>
            </div>
          </div>
          <button
            onClick={processWithAI}
            disabled={loading || messages.length === 0}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg"
          >
            <Sparkles className="h-5 w-5" />
            <span>{loading ? 'Generating Insights...' : 'Generate AI Insights'}</span>
          </button>
        </div>
        
        {processingStatus && (
          <div className="mt-4 bg-white/20 rounded-lg p-3">
            <p className="text-sm">{processingStatus}</p>
            {loading && (
              <div className="mt-2 bg-white/10 rounded-full h-2">
                <div className="bg-white h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveAITab('summaries')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeAITab === 'summaries'
                ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Summaries & Insights</span>
            </div>
          </button>
          <button
            onClick={() => setActiveAITab('search')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeAITab === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Semantic Search</span>
            </div>
          </button>
          <button
            onClick={() => setActiveAITab('knowledge')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeAITab === 'knowledge'
                ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Knowledge Base</span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeAITab === 'summaries' && (
        <div className="space-y-6">
          {/* AI-Generated Summaries */}
          {dailySummaries.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AI-Generated Conversation Analysis</h3>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {dailySummaries.map((summary, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-gray-900 text-lg">{summary.roomName}</h4>
                        <span className="text-sm text-gray-500">
                          {getSentimentEmoji(summary.sentiment)} {summary.messageCount} messages
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(summary.priority)}`}>
                        {summary.priority} priority
                      </span>
                    </div>
                    
                    {/* AI Summary */}
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-800 mb-2 flex items-center space-x-2">
                        <Brain className="h-4 w-4 text-purple-600" />
                        <span>AI Summary</span>
                      </h5>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">{summary.summary}</p>
                      </div>
                    </div>

                    {/* AI Insights */}
                    {summary.insights && summary.insights.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2 flex items-center space-x-2">
                          <Lightbulb className="h-4 w-4 text-yellow-600" />
                          <span>Key Insights</span>
                        </h5>
                        <div className="space-y-2">
                          {summary.insights.map((insight, i) => (
                            <div key={i} className="bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-400">
                              <p className="text-gray-700 text-sm">{insight}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Communication Patterns */}
                    {summary.patterns && summary.patterns.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2 flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span>Communication Patterns</span>
                        </h5>
                        <div className="space-y-2">
                          {summary.patterns.map((pattern, i) => (
                            <div key={i} className="bg-blue-50 rounded-lg p-3">
                              <p className="text-gray-700 text-sm">{pattern}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {summary.actionItems && summary.actionItems.length > 0 && (
                      <div className="mb-4">
                        <h5 className="font-medium text-gray-800 mb-2 flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Action Items</span>
                        </h5>
                        <div className="space-y-2">
                          {summary.actionItems.map((item, i) => (
                            <div key={i} className="bg-green-50 rounded-lg p-3 border-l-4 border-green-400">
                              <p className="text-gray-700 text-sm">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
                      <span>Participants: {summary.participants.map(formatSender).join(', ')}</span>
                      {summary.keyTopics.length > 0 && (
                        <span>Topics: {summary.keyTopics.slice(0, 3).join(', ')}</span>
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
                  <Target className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AI-Prioritized Messages</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {prioritizedMessages.slice(0, 10).map(message => {
                    const contactName = message.roomName.replace(/\s*\(WA\)\s*$/, '').trim();
                    
                    return (
                      <div key={message.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                  <span className="text-indigo-600 font-medium text-sm">
                                    {contactName.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">
                                    {contactName}
                                  </p>
                                  <p className="text-xs text-gray-500">{message.roomName}</p>
                                </div>
                              </div>
                              {message.isWhatsApp && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  WhatsApp
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 text-sm mb-2 leading-relaxed">
                              {message.content.length > 150 
                                ? message.content.substring(0, 150) + '...'
                                : message.content
                              }
                            </p>
                            <p className="text-xs text-gray-400">
                              {message.timestamp.toLocaleString()}
                            </p>
                          </div>
                          <div className="ml-3 flex-shrink-0">
                            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Status Message when no results */}
          {!loading && dailySummaries.length === 0 && prioritizedMessages.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for AI Analysis</h3>
              <p className="text-gray-500 mb-4">
                Click "Generate AI Insights" to create dynamic, intelligent summaries of your conversations.
              </p>
              <div className="text-sm text-gray-400">
                {messages.length} messages available for AI analysis
              </div>
            </div>
          )}
        </div>
      )}

      {/* Semantic Search Tab */}
      {activeAITab === 'search' && (
        <SemanticSearch vectorStorage={vectorStorage} />
      )}

      {/* Knowledge Base Tab */}
      {activeAITab === 'knowledge' && (
        <div className="space-y-6">
          {knowledgeBase.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AI Knowledge Base</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid gap-6">
                  {knowledgeBase.slice(0, 5).map((entry, index) => {
                    const cleanRoomName = entry.roomName.replace(/\s*\(WA\)\s*$/, '').trim();
                    
                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-sm transition-shadow bg-gradient-to-br from-purple-50 to-white">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Brain className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{cleanRoomName}</h4>
                              <span className="text-sm text-gray-500">{entry.messageCount} messages analyzed</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 mb-4 border border-purple-100">
                          <h5 className="font-medium text-gray-800 mb-2">AI Summary</h5>
                          <p className="text-gray-700 text-sm leading-relaxed">{entry.summary}</p>
                        </div>

                        {entry.insights && entry.insights.length > 0 && (
                          <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                            <h5 className="font-medium text-gray-800 mb-2 flex items-center space-x-2">
                              <Lightbulb className="h-4 w-4 text-yellow-600" />
                              <span>AI Insights</span>
                            </h5>
                            <div className="space-y-2">
                              {entry.insights.map((insight: string, i: number) => (
                                <p key={i} className="text-gray-700 text-sm">• {insight}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          Generated by AI • {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!loading && knowledgeBase.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">AI Knowledge Base Empty</h3>
              <p className="text-gray-500">
                Run AI analysis to build your intelligent conversation knowledge base.
              </p>
            </div>
          )}
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