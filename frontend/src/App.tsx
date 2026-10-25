import { useState } from 'react';
import ScheduleForm from './components/ScheduleForm';
import EmailTable from './components/EmailTable';
import QueueStats from './components/QueueStats';
import Header from './components/Header';

type Tab = 'schedule' | 'all' | 'scheduled' | 'sent' | 'failed';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEmailScheduled = () => {
    setRefreshKey((k) => k + 1);
    setActiveTab('scheduled');
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'schedule',  label: 'Schedule Email', icon: '✉️' },
    { id: 'all',        label: 'All Emails',     icon: '📋' },
    { id: 'scheduled',  label: 'Scheduled',      icon: '⏰' },
    { id: 'sent',       label: 'Sent',           icon: '✅' },
    { id: 'failed',     label: 'Failed',         icon: '❌' },
  ];

  return (
    <div className="min-h-screen bg-[#09090e] text-gray-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Top Queue Statistics Banner */}
        <div className="mb-8">
          <QueueStats key={refreshKey} />
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="mb-6">
          <div className="flex gap-1.5 p-1.5 bg-[#12121b] border border-white/8 rounded-2xl w-fit flex-wrap shadow-inner">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer',
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5',
                  ].join(' ')}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="fade-in" key={activeTab}>
          {activeTab === 'schedule' && (
            <ScheduleForm onSuccess={handleEmailScheduled} />
          )}
          {activeTab === 'all' && (
            <EmailTable
              key={`all-${refreshKey}`}
              status={undefined}
              title="📋 All Emails (All Statuses)"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === 'scheduled' && (
            <EmailTable
              key={`scheduled-${refreshKey}`}
              status="scheduled"
              title="⏰ Scheduled Emails (BullMQ Delay Queue)"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === 'sent' && (
            <EmailTable
              key={`sent-${refreshKey}`}
              status="sent"
              title="✅ Sent Emails (Delivered via Ethereal SMTP)"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === 'failed' && (
            <EmailTable
              key={`failed-${refreshKey}`}
              status="failed"
              title="❌ Failed Emails"
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 py-4 text-center text-xs text-gray-500">
        ReachInbox Outbox Email Scheduler &bull; BullMQ + Redis + TypeScript + React.js
      </footer>
    </div>
  );
}
