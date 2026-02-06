import React, { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

export default function Activity({ lastRun, api }) {
  const [auditRuns, setAuditRuns] = useState([]);

  useEffect(() => {
    let mounted = true;
    if (api && api.getAuditRuns) {
      api.getAuditRuns().then((data) => {
        if (!mounted) return;
        setAuditRuns(Array.isArray(data) ? data.slice().reverse() : []);
      });
    }
    return () => {
      mounted = false;
    };
  }, [api]);

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
    ...(auditRuns || []).map((run) => ({
      id: run.runId,
      time: run.timestamp,
      action: `Run ${run.status}`,
      detail: `${run.templateId} (${run.mode})`,
    })),
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
