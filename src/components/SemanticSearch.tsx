'use client';

import { useState } from 'react';
import { MessageMindVectorStorage } from '@/lib/vectorStorage';
import { Search, Clock, User, MessageCircle, Zap } from 'lucide-react';

interface SearchResult {
  content: string;
  similarity: number;
  metadata: {
    sender: string;
    roomName: string;
    timestamp: Date;
    messageType: 'whatsapp' | 'matrix';
  };
}

interface SemanticSearchProps {
  vectorStorage: MessageMindVectorStorage;
}

export default function SemanticSearch({ vectorStorage }: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(vectorStorage.getStats());

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const searchResults = await vectorStorage.semanticSearch(query, 15);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatSimilarity = (similarity: number): string => {
    return `${(similarity * 100).toFixed(1)}%`;
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return timestamp.toLocaleDateString();
  };

  const exampleQueries = [
    "help with tap",
    "work discussion",
    "morning greetings",
    "asking questions",
    "making plans"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center space-x-3 mb-4">
          <Search className="h-8 w-8" />
          <div>
            <h2 className="text-2xl font-bold">Semantic Search</h2>
            <p className="text-blue-100">Find messages by meaning, not just keywords</p>
          </div>
        </div>
        
        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <div className="text-sm text-blue-100">Messages Indexed</div>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">{Object.keys(stats.messagesByRoom).length}</div>
            <div className="text-sm text-blue-100">Conversations</div>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">
              {stats.oldestMessage ? formatTimestamp(stats.oldestMessage) : 'N/A'}
            </div>
            <div className="text-sm text-blue-100">Oldest Message</div>
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search messages by meaning... (e.g., 'asking for help', 'making plans')"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            <span>{loading ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {/* Example Queries */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">Try these example searches:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map(example => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({results.length})
            </h3>
            
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{result.metadata.sender}</p>
                      <p className="text-sm text-gray-500">{result.metadata.roomName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {formatSimilarity(result.similarity)} match
                    </span>
                    {result.metadata.messageType === 'whatsapp' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        WhatsApp
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-700 mb-3 leading-relaxed">
                  {result.content}
                </p>
                
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimestamp(result.metadata.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {results.length === 0 && query && !loading && (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No messages found</p>
            <p className="text-sm">Try different keywords or check your spelling</p>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !query && (
          <div className="text-center py-8 text-gray-500">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Semantic Search Ready</p>
            <p className="text-sm">
              Search finds messages by meaning, not just exact words.<br />
              Try "asking for help" to find all support requests.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}