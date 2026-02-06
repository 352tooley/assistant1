import React from 'react';
import StatusCard from '../components/StatusCard.jsx';
import UsageSummary from '../components/UsageSummary.jsx';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

export default function Dashboard({ status, lastRun, onNavigate }) {
  const data = status || {
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunTimestamp: 'unknown',
    mode: 'standard',
    usage: { codexCalls: 0, claudeCalls: 0 },
  };
  const lastRunStatus = lastRun ? `${lastRun.status}` : 'none';
  const lastRunTime = lastRun?.timestamp || data.lastRunTimestamp || 'unknown';

  const engineAccent = data.failed > 0 ? theme.accent.red : theme.accent.blue;
  const statusTone = data.failed > 0 ? 'status-pill status-pill--error' : 'status-pill status-pill--ok';

  return (
    <section className="page">
      <Card title="Mission Status" accent={engineAccent} className="hero-card">
        <div className="hero-grid">
          <div>
            <h1>System Dashboard</h1>
            <p className="muted">Read-only status overview for the orchestration engine.</p>
          </div>
          <div className="hero-status">
            <span className={statusTone}>{data.failed > 0 ? 'Attention' : 'Nominal'}</span>
            <span className="muted">Last Run: {lastRunTime}</span>
          </div>
        </div>
      </Card>

      <div className="grid">
        <Card title="Engine Status" accent={engineAccent}>
          <StatusCard label="Pending" value={data.pending} />
          <StatusCard label="Completed" value={data.completed} />
          <StatusCard label="Failed" value={data.failed} />
          <StatusCard label="Last Run Status" value={lastRunStatus} />
          <StatusCard label="Routing Mode" value={data.mode} />
        </Card>

        <Card title="Usage Telemetry" accent={theme.accent.purple}>
          <UsageSummary usage={data.usage} />
          <p className="muted">Usage is approximate; execution remains controlled.</p>
          <button
            className="ghost-button"
            type="button"
            onClick={() => onNavigate && onNavigate('activity')}
          >
            View Recent Activity
          </button>
        </Card>

        <Card title="Recent Signal" accent={theme.accent.blue}>
          <div className="stat-row">
            <span>Last Run</span>
            <strong>{lastRunTime}</strong>
          </div>
          <div className="stat-row">
            <span>Status</span>
            <strong>{lastRunStatus}</strong>
          </div>
          <p className="muted">Track recent approvals and operator actions in Activity.</p>
        </Card>
      </div>
    </section>
  );
}
