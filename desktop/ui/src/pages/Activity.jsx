import React from 'react';

const activityItems = [
  { id: 1, time: 'Today 09:12', action: 'Headless cycle completed', detail: 'Idle detected, sleeping.' },
  { id: 2, time: 'Today 08:47', action: 'CLI status', detail: 'Operator requested status snapshot.' },
  { id: 3, time: 'Today 08:30', action: 'Preview generated', detail: 'Task preview created (no execution).' },
];

export default function Activity() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Activity</h1>
        <p>Recent actions (static mock for V1).</p>
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
