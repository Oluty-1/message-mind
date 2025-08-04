// src/components/MatrixAuth.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from 'matrix-js-sdk';
import { MessageMindMatrix, MessageMindConfig } from '@/lib/matrix';
import { Bot, Lock, Globe, User, Eye, EyeOff } from 'lucide-react';

interface MatrixAuthProps {
  onAuthenticated: (client: MessageMindMatrix) => void;
}

export default function MatrixAuth({ onAuthenticated }: MatrixAuthProps) {
  const [homeserver, setHomeserver] = useState('https://messagemind.duckdns.org');
  const [username, setUsername] = useState('tayo');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for existing session on component mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const stored = localStorage.getItem('messagemind_config');
      if (stored) {
        const config: MessageMindConfig = JSON.parse(stored);
        const client = new MessageMindMatrix(config);
        await client.start();
        
        // Wait for initial sync to complete
        const checkReady = setInterval(() => {
          if (client.isReady()) {
            clearInterval(checkReady);
            onAuthenticated(client);
          }
        }, 500);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkReady);
        }, 10000);
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      localStorage.removeItem('messagemind_config');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create temporary client for login
      const tempClient = createClient({
        baseUrl: homeserver,
      });

      // Login to get access token
      const response = await tempClient.login('m.login.password', {
        user: username,
        password: password,
      });

      // Create authenticated client
      const config: MessageMindConfig = {
        homeserverUrl: homeserver,
        userId: response.user_id,
        accessToken: response.access_token,
      };

      const client = new MessageMindMatrix(config);
      await client.start();

      // Store credentials securely
      localStorage.setItem('messagemind_config', JSON.stringify(config));

      // Wait for initial sync
      const waitForReady = () => {
        if (client.isReady()) {
          onAuthenticated(client);
        } else {
          setTimeout(waitForReady, 500);
        }
      };
      
      setTimeout(waitForReady, 1000);

    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Bot className="h-12 w-12 text-indigo-600 mr-3" />
            <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              MessageMind
            </h2>
          </div>
          <p className="text-gray-600 text-sm">
            Connect to your Matrix homeserver to access AI-powered message insights
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="homeserver" className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="h-4 w-4 inline mr-2" />
              Homeserver URL
            </label>
            <input
              id="homeserver"
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
              placeholder="https://messagemind.duckdns.org"
              required
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 inline mr-2" />
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
              placeholder="your-username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="h-4 w-4 inline mr-2" />
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-500"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              'Connect to MessageMind'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Secure encrypted connection to your Matrix homeserver
          </p>
        </div>
      </div>
    </div>
  );
}