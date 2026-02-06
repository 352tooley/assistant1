import React, { useEffect, useMemo, useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Agents from './pages/Agents.jsx';
import TaskBuilder from './pages/TaskBuilder.jsx';
import Activity from './pages/Activity.jsx';
import Audit from './pages/Audit.jsx';
import theme from './theme.js';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'agents', label: 'Agents' },
  { id: 'builder', label: 'Task Builder' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Audit' },
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
  runDryRun: async () => ({
    status: 'rejected',
    message: 'Desktop IPC unavailable.',
  }),
  checkClaudeAvailability: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  listAvailableProviders: async () => ({ registry: {}, providers: [] }),
  addProvider: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  enableProvider: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  disableProvider: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  assignRoles: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  assignProjects: async () => ({ ok: false, reason: 'ipc_unavailable' }),
  getLiveRunStatus: async () => null,
  getAuditSummary: async () => ({
    total: 0,
    success: 0,
    failure: 0,
    rejected: 0,
    escalations: 0,
    healings: 0,
  }),
  getAuditRuns: async () => [],
  getAuditRun: async () => null,
  requestStop: async () => ({ ok: false, reason: 'ipc_unavailable' }),
};

export default function App() {
  try {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [status, setStatus] = useState(null);
    const [agents, setAgents] = useState([]);
    const [lastRun, setLastRun] = useState(null);
    const [liveStatus, setLiveStatus] = useState(null);
    const [claudeStatus, setClaudeStatus] = useState(null);
    const [providerData, setProviderData] = useState({ registry: {}, providers: [] });

    const api = useMemo(() => window.assistant1 || fallbackApi, []);

    const refreshStatus = () => {
      api.getStatus().then((data) => setStatus(data));
    };

    const refreshProviders = () => {
      if (api.listAvailableProviders) {
        api.listAvailableProviders().then((data) =>
          setProviderData(data || { registry: {}, providers: [] })
        );
      }
    };

    useEffect(() => {
      let mounted = true;
      api.getStatus().then((data) => mounted && setStatus(data));
      api.getAgents().then((data) => mounted && setAgents(data));
      if (api.checkClaudeAvailability) {
        api.checkClaudeAvailability().then((data) => mounted && setClaudeStatus(data));
      }
      refreshProviders();
      return () => {
        mounted = false;
      };
    }, [api]);

    useEffect(() => {
      if (!api.getLiveRunStatus) {
        return () => {};
      }
      let active = true;
      const interval = setInterval(() => {
        api.getLiveRunStatus().then((data) => {
          if (!active) {
            return;
          }
          setLiveStatus(data || null);
        });
      }, 1000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [api]);

    useEffect(() => {
      const root = document.documentElement;
      root.style.setProperty('--bg', theme.background.base);
      root.style.setProperty('--panel', theme.background.panel);
      root.style.setProperty('--panel-alt', theme.background.panelAlt);
      root.style.setProperty('--text', theme.text.primary);
      root.style.setProperty('--text-secondary', theme.text.secondary);
      root.style.setProperty('--muted', theme.text.muted);
      root.style.setProperty('--accent', theme.accent.purple);
      root.style.setProperty('--accent-blue', theme.accent.blue);
      root.style.setProperty('--accent-green', theme.accent.green);
      root.style.setProperty('--accent-amber', theme.accent.amber);
      root.style.setProperty('--accent-red', theme.accent.red);
      root.style.setProperty('--radius-card', theme.radius.card);
      root.style.setProperty('--radius-pill', theme.radius.pill);
      root.style.setProperty('--shadow-soft', theme.shadow.soft);
    }, []);

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
            <Dashboard
              status={status}
              lastRun={lastRun}
              liveStatus={liveStatus}
              claudeStatus={claudeStatus}
              providerData={providerData}
              onProvidersChange={refreshProviders}
              api={api}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'agents' && <Agents agents={agents} />}
          {activeTab === 'builder' && (
            <TaskBuilder
              api={api}
              liveStatus={liveStatus}
              claudeStatus={claudeStatus}
              providerData={providerData}
              onRunComplete={(result) => {
                setLastRun(result);
                refreshStatus();
              }}
            />
          )}
          {activeTab === 'activity' && <Activity lastRun={lastRun} api={api} />}
          {activeTab === 'audit' && <Audit api={api} />}
        </main>
      </div>
    );
  } catch (err) {
    console.error('Renderer crash:', err);
    throw err;
  }
}
