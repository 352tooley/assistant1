import React from 'react';
import StatusCard from '../components/StatusCard.jsx';
import UsageSummary from '../components/UsageSummary.jsx';

export default function Dashboard({ status }) {
  const data = status || {
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunTimestamp: 'unknown',
    mode: 'standard',
    usage: { codexCalls: 0, claudeCalls: 0 },
  };

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
          <StatusCard label="Last Run" value={data.lastRunTimestamp || 'unknown'} />
          <StatusCard label="Routing Mode" value={data.mode} />
        </div>

        <div className="card">
          <h2>Usage Summary</h2>
          <UsageSummary usage={data.usage} />
          <p className="muted">Usage is approximate; execution remains controlled.</p>
        </div>
      </div>
    </section>
  );
}
