import React from 'react';
import StatusCard from '../components/StatusCard.jsx';
import UsageSummary from '../components/UsageSummary.jsx';

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

  return (
    <section className="page">
      <header className="page-header">
        <h1>System Dashboard</h1>
        <p>Read-only status overview for the orchestration engine.</p>
      </header>

      <div className="grid">
        <div className="card">
          <h2>Status</h2>
          <StatusCard label="Pending" value={data.pending} />
          <StatusCard label="Completed" value={data.completed} />
          <StatusCard label="Failed" value={data.failed} />
          <StatusCard label="Last Run" value={lastRunTime} />
          <StatusCard label="Last Run Status" value={lastRunStatus} />
          <StatusCard label="Routing Mode" value={data.mode} />
        </div>

        <div className="card">
          <h2>Usage Summary</h2>
          <UsageSummary usage={data.usage} />
          <p className="muted">Usage is approximate; execution remains controlled.</p>
          <button
            className="ghost-button"
            type="button"
            onClick={() => onNavigate && onNavigate('activity')}
          >
            View Recent Activity
          </button>
        </div>
      </div>
    </section>
  );
}
