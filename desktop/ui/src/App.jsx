import React, { useEffect, useMemo, useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Agents from './pages/Agents.jsx';
import TaskBuilder from './pages/TaskBuilder.jsx';
import Activity from './pages/Activity.jsx';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'agents', label: 'Agents' },
  { id: 'builder', label: 'Task Builder' },
  { id: 'activity', label: 'Activity' },
];

const fallbackApi = {
  getStatus: async () => ({
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunTimestamp: 'unknown',
    mode: 'standard',
    usage: { codexCalls: 0, claudeCalls: 0 },
  }),
  getAgents: async () => [
    { id: 'codex', name: 'Codex', role: 'Implementer', status: 'active' },
    { id: 'claude', name: 'Claude', role: 'Diagnostician', status: 'standby' },
  ],
  buildTaskPreview: async (text) => ({
    template: {
      id: 'web_build_basic',
      label: 'Web Build Basic',
      agentRole: 'DevOps',
      allowsClaude: false,
      maxCycles: 3,
      inputs: { siteName: { type: 'string', required: true } },
    },
    confidence: text ? 72 : 0,
    extractedInputs: { siteName: text },
    missingInputs: text ? [] : ['siteName'],
  }),
  executeApprovedTask: async () => ({
    status: 'rejected',
    message: 'Desktop IPC unavailable.',
  }),
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [agents, setAgents] = useState([]);
  const [lastRun, setLastRun] = useState(null);

  const api = useMemo(() => window.assistant1 || fallbackApi, []);

  const refreshStatus = () => {
    api.getStatus().then((data) => setStatus(data));
  };

  useEffect(() => {
    let mounted = true;
    api.getStatus().then((data) => mounted && setStatus(data));
    api.getAgents().then((data) => mounted && setAgents(data));
    return () => {
      mounted = false;
    };
  }, [api]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-title">assistant1</span>
          <span className="brand-subtitle">Desktop Control Center V2</span>
        </div>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="muted">Execution requires explicit approval</p>
        </div>
      </aside>
      <main className="content">
        {activeTab === 'dashboard' && (
          <Dashboard status={status} lastRun={lastRun} onNavigate={setActiveTab} />
        )}
        {activeTab === 'agents' && <Agents agents={agents} />}
        {activeTab === 'builder' && (
          <TaskBuilder
            api={api}
            onRunComplete={(result) => {
              setLastRun(result);
              refreshStatus();
            }}
          />
        )}
        {activeTab === 'activity' && <Activity lastRun={lastRun} />}
      </main>
    </div>
  );
}
