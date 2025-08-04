// src/components/Dashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { MessageMindMatrix, extractMessageContent, getMessageSender, getMessageTimestamp, isWhatsAppMessage } from '@/lib/matrix';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { MessageSquare, Users, Bot, Zap, Calendar, Search, LogOut, Smartphone, Filter, Brain } from 'lucide-react';
import AIInsights from './AIInsights';

interface DashboardProps {
  client: MessageMindMatrix;
}

interface ProcessedMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  roomName: string;
  roomId: string;
  isWhatsApp: boolean;
}

export default function Dashboard({ client }: DashboardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<ProcessedMessage[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWhatsAppOnly, setShowWhatsAppOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'ai'>('messages');

  useEffect(() => {
    if (!client.isReady()) {
      const checkReady = setInterval(() => {
        if (client.isReady()) {
          clearInterval(checkReady);
          loadRooms();
        }
      }, 500);
      return () => clearInterval(checkReady);
    } else {
      loadRooms();
    }
  }, [client]);

  const loadRooms = () => {
    try {
      const allRooms = client.getRooms();
      const whatsappRooms = client.getWhatsAppRooms();
      
      console.log('All rooms:', allRooms.length);
      console.log('WhatsApp rooms:', whatsappRooms.length);
      
      setRooms(allRooms);
      
      // Load recent messages from all rooms
      const allMessages: ProcessedMessage[] = [];
      
      allRooms.forEach(room => {
        const recentEvents = client.getRecentMessages(room.roomId, 30);
        
        recentEvents.forEach(event => {
          const content = extractMessageContent(event);
          if (content.trim() && !content.startsWith('!') && content.length > 1) {
            allMessages.push({
              id: event.getId() || '',
              content,
              sender: getMessageSender(event),
              timestamp: getMessageTimestamp(event),
              roomName: room.name || room.roomId.substring(1, 20) + '...',
              roomId: room.roomId,
              isWhatsApp: isWhatsAppMessage(event)
            });
          }
        });
      });
      
      // Sort by timestamp (newest first)
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setMessages(allMessages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setLoading(false);
    }
  };

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = (event: MatrixEvent) => {
      const content = extractMessageContent(event);
      if (!content.trim() || content.startsWith('!') || content.length <= 1) return;

      const room = client.getRooms().find(r => r.roomId === event.getRoomId());
      if (!room) return;

      const newMessage: ProcessedMessage = {
        id: event.getId() || '',
        content,
        sender: getMessageSender(event),
        timestamp: getMessageTimestamp(event),
        roomName: room.name || room.roomId.substring(1, 20) + '...',
        roomId: room.roomId,
        isWhatsApp: isWhatsAppMessage(event)
      };

      setMessages(prev => [newMessage, ...prev]);
    };

    client.onNewMessage(handleNewMessage);
  }, [client]);

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = !searchTerm || 
      msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.roomName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !showWhatsAppOnly || msg.isWhatsApp;
    
    return matchesSearch && matchesFilter;
  });

  const whatsappMessages = messages.filter(msg => msg.isWhatsApp);
  const todayMessages = messages.filter(msg => {
    const today = new Date();
    return msg.timestamp.toDateString() === today.toDateString();
  });

  const logout = () => {
    localStorage.removeItem('messagemind_config');
    client.stop();
    window.location.reload();
  };

  const formatSender = (sender: string) => {
    // Clean up sender name for display
    return sender.split(':')[0].replace('@', '').replace('whatsapp_', '').replace('_', ' ');
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading MessageMind Dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Syncing your messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'messages'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Messages
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'ai'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                  <span>AI Insights</span>
                </button>
              </div>
              <Bot className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">MessageMind</h1>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                ● Connected
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={() => setShowWhatsAppOnly(!showWhatsAppOnly)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors ${
                  showWhatsAppOnly 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>WhatsApp Only</span>
              </button>
              
              <button
                onClick={logout}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <MessageSquare className="h-10 w-10 text-blue-600 bg-blue-100 rounded-lg p-2" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{messages.length.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <Smartphone className="h-10 w-10 text-green-600 bg-green-100 rounded-lg p-2" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">WhatsApp Messages</p>
                <p className="text-2xl font-bold text-gray-900">{whatsappMessages.length.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <Calendar className="h-10 w-10 text-purple-600 bg-purple-100 rounded-lg p-2" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Messages</p>
                <p className="text-2xl font-bold text-gray-900">{todayMessages.length.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <Users className="h-10 w-10 text-orange-600 bg-orange-100 rounded-lg p-2" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Rooms</p>
                <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'messages' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Rooms List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Rooms ({rooms.length})</h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {rooms.map(room => {
                  const isWhatsAppRoom = client.getWhatsAppRooms().includes(room);
                  return (
                    <div
                      key={room.roomId}
                      onClick={() => setSelectedRoom(room.roomId)}
                      className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedRoom === room.roomId ? 'bg-indigo-50 border-indigo-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">
                            {room.name || 'Unnamed Room'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {room.roomId.substring(0, 30)}...
                          </p>
                        </div>
                        {isWhatsAppRoom && (
                          <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex-shrink-0">
                            WA
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Messages List */}
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recent Messages 
                    {searchTerm && ` (${filteredMessages.length} results)`}
                    {showWhatsAppOnly && ' - WhatsApp Only'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {filteredMessages.length} of {messages.length} messages
                  </div>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredMessages.slice(0, 100).map(message => (
                  <div key={message.id} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <p className="font-medium text-gray-900 text-sm">
                            {formatSender(message.sender)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {message.roomName}
                          </p>
                          {message.isWhatsApp && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              WhatsApp
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {message.content.length > 200 
                            ? message.content.substring(0, 200) + '...'
                            : message.content
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredMessages.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {searchTerm ? 'No messages found' : 'No messages available'}
                    </p>
                    <p className="text-sm">
                      {searchTerm 
                        ? 'Try adjusting your search terms or filters' 
                        : 'Messages will appear here as they sync from your Matrix server'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <AIInsights client={client} messages={messages} />
        )}
      </div>
    </div>
  );
}