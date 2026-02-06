import React from 'react';

const fallbackAgents = [
  { id: 'devops', name: 'DevOps', role: 'Infra Monitor', status: 'offline' },
  { id: 'research', name: 'Research', role: 'Evidence Scout', status: 'offline' },
];

export default function Agents({ agents }) {
  const list = agents && agents.length > 0 ? agents : fallbackAgents;

  return (
    <section className="page">
      <header className="page-header">
        <h1>Agents</h1>
        <p>Static roster for UI visualization. Execution is disabled in V1.</p>
      </header>

      <div className="grid">
        {list.map((agent) => (
          <div className="card" key={agent.id}>
            <h2>{agent.name}</h2>
            <p className="muted">{agent.role}</p>
            <div className="stat-row">
              <span>Status</span>
              <strong>{agent.status}</strong>
            </div>
            <button className="ghost-button" type="button">
              Toggle (UI only)
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
