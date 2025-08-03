'use client';

import { useState } from 'react';
import { MessageMindMatrix, MessageMindConfig } from '@/lib/matrix';

interface MatrixAuthProps {
  onAuthenticated: (client: MessageMindMatrix) => void;
}

export default function MatrixAuth({ onAuthenticated }: MatrixAuthProps) {
  const [homeserver, setHomeserver] = useState('https://messagemind.duckdns.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Store credentials securely (in production, use proper token storage)
      localStorage.setItem('messagemind_config', JSON.stringify(config));

      onAuthenticated(client);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Check for existing session
  const checkExistingSession = async () => {
    try {
      const stored = localStorage.getItem('messagemind_config');
      if (stored) {
        const config: MessageMindConfig = JSON.parse(stored);
        const client = new MessageMindMatrix(config);
        await client.start();
        onAuthenticated(client);
      }
    } catch (err) {
      localStorage.removeItem('messagemind_config');
    }
  };

  // Auto-check for existing session on component mount
  useState(() => {
    checkExistingSession();
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">MessageMind</h2>
          <p className="text-gray-600">Connect to your Matrix homeserver</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="homeserver" className="block text-sm font-medium text-gray-700">
              Homeserver URL
            </label>
            <input
              id="homeserver"
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://messagemind.duckdns.org"
              required
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="your-username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Connect to MessageMind'}
          </button>
        </form>

        <div className="text-xs text-gray-500 text-center">
          Secure connection to your Matrix homeserver
        </div>
      </div>
    </div>
  );
}

// Import statement fix
import { createClient } from 'matrix-js-sdk';