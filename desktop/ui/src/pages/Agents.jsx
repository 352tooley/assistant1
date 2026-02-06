import React from 'react';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

const fallbackAgents = [
  { id: 'devops', name: 'DevOps', role: 'Infra Monitor', status: 'offline' },
  { id: 'research', name: 'Research', role: 'Evidence Scout', status: 'offline' },
];

export default function Agents({ agents }) {
  const list = agents && agents.length > 0 ? agents : fallbackAgents;

  return (
    <section className="page">
      <Card title="Agent Roster" accent={theme.accent.purple} className="hero-card">
        <h1>Agents</h1>
        <p className="muted">Static roster for UI visualization. Execution remains controlled by the orchestrator.</p>
      </Card>

      <div className="grid">
        {list.map((agent) => (
          <Card key={agent.id} title={agent.role} accent={agent.status === 'active' ? theme.accent.green : theme.accent.blue}>
            <div className="agent-card">
              <div>
                <h2>{agent.name}</h2>
                <p className="muted">Role: {agent.role}</p>
              </div>
              <span className={`status-pill ${agent.status === 'active' ? 'status-pill--ok' : 'status-pill--info'}`}>
                {agent.status}
              </span>
            </div>
            <div className="stat-row">
              <span>Authority</span>
              <strong>Advisory / Read-only</strong>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
