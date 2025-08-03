'use client';

import { useState } from 'react';
import { Bot, MessageSquare, Zap } from 'lucide-react';

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);

  const testConnection = async () => {
    try {
      // Test connection to your Matrix server
      const response = await fetch('https://messagemind.duckdns.org/_matrix/client/versions');
      const data = await response.json();
      
      if (data.versions) {
        setIsConnected(true);
        console.log('Matrix server versions:', data.versions);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setIsConnected(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <Bot className="h-16 w-16 text-indigo-600 mr-4" />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              MessageMind
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered WhatsApp message analysis and management platform. 
            Connect, analyze, and gain insights from your conversations.
          </p>
        </div>

        {/* Test Connection Card */}
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Connection Test
          </h2>
          
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-700">Matrix Server Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isConnected 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isConnected ? 'Connected' : 'Not Tested'}
            </span>
          </div>

          <button
            onClick={testConnection}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            <Zap className="h-5 w-5 mr-2" />
            Test Connection to messagemind.duckdns.org
          </button>

          {isConnected && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✅ Successfully connected to your Matrix homeserver!
                Check the browser console for server details.
              </p>
            </div>
          )}
        </div>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <MessageSquare className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Message Sync
            </h3>
            <p className="text-gray-600">
              Real-time synchronization of WhatsApp messages through Matrix bridge
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Bot className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              AI Analysis
            </h3>
            <p className="text-gray-600">
              Intelligent conversation summarization and intent parsing
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Zap className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              Daily Reports
            </h3>
            <p className="text-gray-600">
              Automated daily insights and conversation prioritization
            </p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            React app is running successfully! Next steps:
          </p>
          <div className="space-y-2 text-sm text-gray-500 max-w-md mx-auto">
            <p>1. ✅ Test Matrix server connectivity</p>
            <p>2. 🔄 Add Matrix authentication</p>
            <p>3. 🔄 Build message dashboard</p>
            <p>4. 🔄 Implement AI features</p>
          </div>
        </div>
      </div>
    </div>
  );
}