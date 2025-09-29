import React, { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface Integration {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  accountInfo?: string;
}

const Settings = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      icon: '📅',
      description: 'Schedule interviews and sync events automatically',
      connected: false
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: '📧',
      description: 'Send emails and manage communications',
      connected: false
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      icon: '📁',
      description: 'Store and share candidate documents',
      connected: false
    },
    {
      id: 'outlook',
      name: 'Outlook',
      icon: '📮',
      description: 'Connect Microsoft Outlook for email and calendar',
      connected: false
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: '💬',
      description: 'Get notifications and collaborate with your team',
      connected: false
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: '💼',
      description: 'Source candidates and send InMail messages',
      connected: false
    }
  ]);

  const [userInfo, setUserInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: ''
  });

  const { success, error } = useNotifications();

  useEffect(() => {
    loadUserSettings();
    loadIntegrations();
  }, []);

  const loadUserSettings = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setUserInfo({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'recruiter'
    });
  };

  const loadIntegrations = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:3001/api/v3/integrations/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setIntegrations(prev => prev.map(integration => {
          const status = data.integrations.find((i: any) => i.id === integration.id);
          return status ? { ...integration, ...status } : integration;
        }));
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    }
  };

  const handleConnect = async (integrationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v3/integrations/${integrationId}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (data.success && data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.success) {
        success(`${integrations.find(i => i.id === integrationId)?.name} connected!`);
        loadIntegrations();
      }
    } catch (err: any) {
      error(err.message || 'Failed to connect integration');
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:3001/api/v3/integrations/${integrationId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        success(`${integrations.find(i => i.id === integrationId)?.name} disconnected`);
        loadIntegrations();
      }
    } catch (err: any) {
      error(err.message || 'Failed to disconnect integration');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">⚙️ Settings</h1>

      {/* User Profile Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={userInfo.firstName}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={userInfo.lastName}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={userInfo.email}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              value={userInfo.role}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50 capitalize"
            />
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Platform Integrations</h2>
        <p className="text-sm text-gray-600 mb-6">
          Connect your accounts to enable the AI Assistant to perform tasks like sending emails, scheduling interviews, and more.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`border rounded-lg p-4 transition-all ${
                integration.connected
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{integration.icon}</span>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    {integration.connected && integration.accountInfo && (
                      <p className="text-xs text-gray-500">{integration.accountInfo}</p>
                    )}
                  </div>
                </div>
                {integration.connected && (
                  <span className="text-green-600 text-xl">✓</span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

              {integration.connected ? (
                <button
                  onClick={() => handleDisconnect(integration.id)}
                  className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(integration.id)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant Permissions */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">AI Assistant Permissions</h2>
        <p className="text-sm text-gray-600 mb-4">
          Control what actions the AI Assistant can perform on your behalf
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium">Send emails</div>
              <div className="text-sm text-gray-500">Allow AI to send emails to candidates</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium">Schedule calendar events</div>
              <div className="text-sm text-gray-500">Allow AI to create calendar invites</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" defaultChecked className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium">Access candidate data</div>
              <div className="text-sm text-gray-500">Allow AI to read and analyze candidate information</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-medium">Make pipeline changes</div>
              <div className="text-sm text-gray-500">Allow AI to move candidates through pipeline stages</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default Settings;