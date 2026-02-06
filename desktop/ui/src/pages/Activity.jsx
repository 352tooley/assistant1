import React from 'react';

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
  return (
    <section className="page">
      <header className="page-header">
        <h1>Activity</h1>
        <p>Recent actions (includes latest desktop run).</p>
      </header>

      <div className="card">
        <ul className="activity-list">
          {activityItems.map((item) => (
            <li key={item.id} className="activity-item">
              <div>
                <strong>{item.action}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <span className="timestamp">{item.time}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
