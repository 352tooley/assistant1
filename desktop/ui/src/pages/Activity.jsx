import React from 'react';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

export default function Activity({ lastRun }) {
  const activityItems = [
    ...(lastRun
      ? [
          {
            id: 'last-run',
            time: lastRun.timestamp || 'recent',
            action: `Desktop run ${lastRun.status}`,
            detail: lastRun.outputSummary || lastRun.message || 'Run completed.',
          },
        ]
      : []),
    { id: 1, time: 'Today 09:12', action: 'Headless cycle completed', detail: 'Idle detected, sleeping.' },
    { id: 2, time: 'Today 08:47', action: 'CLI status', detail: 'Operator requested status snapshot.' },
    { id: 3, time: 'Today 08:30', action: 'Preview generated', detail: 'Task preview created (no execution).' },
  ];
  const resolveAccent = (action) => {
    const lower = String(action || '').toLowerCase();
    if (lower.includes('fail') || lower.includes('reject')) {
      return theme.accent.red;
    }
    if (lower.includes('escalat')) {
      return theme.accent.amber;
    }
    return theme.accent.green;
  };

  return (
    <section className="page">
      <Card title="Activity Feed" accent={theme.accent.blue} className="hero-card">
        <h1>Activity</h1>
        <p className="muted">Recent operator actions and execution outcomes.</p>
      </Card>

      <div className="timeline">
        {activityItems.map((item) => (
          <Card
            key={item.id}
            title={item.time}
            accent={resolveAccent(item.action)}
            className="timeline-card"
          >
            <div className="timeline-row">
              <span className="timeline-dot" />
              <div>
                <strong>{item.action}</strong>
                <p className="muted">{item.detail}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
