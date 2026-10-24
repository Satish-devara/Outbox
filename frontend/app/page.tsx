'use client';

import { useState } from 'react';
import ScheduleForm from '@/components/ScheduleForm';
import EmailTable from '@/components/EmailTable';
import QueueStats from '@/components/QueueStats';
import Header from '@/components/Header';

type Tab = 'schedule' | 'scheduled' | 'sent';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEmailScheduled = () => {
    setRefreshKey((k) => k + 1);
    setActiveTab('scheduled');
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'schedule', label: 'Schedule Email', icon: '✉️' },
    { id: 'scheduled', label: 'Scheduled', icon: '⏰' },
    { id: 'sent', label: 'Sent', icon: '✅' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Queue Stats */}
        <QueueStats key={refreshKey} />

        {/* Tab Navigation */}
        <div className="mt-8 mb-6">
          <div className="flex gap-1 p-1 glass rounded-xl w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Panels */}
        <div className="fade-in">
          {activeTab === 'schedule' && (
            <ScheduleForm onSuccess={handleEmailScheduled} />
          )}
          {activeTab === 'scheduled' && (
            <EmailTable
              key={`scheduled-${refreshKey}`}
              status="scheduled"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === 'sent' && (
            <EmailTable
              key={`sent-${refreshKey}`}
              status="sent"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
