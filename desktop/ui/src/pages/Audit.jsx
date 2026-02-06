import React, { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

function statusAccent(status) {
  if (status === 'success') return theme.accent.green;
  if (status === 'failure') return theme.accent.red;
  if (status === 'rejected') return theme.accent.amber;
  return theme.accent.blue;
}

function statusPillClass(status) {
  if (status === 'success') return 'status-pill status-pill--ok';
  if (status === 'rejected') return 'status-pill status-pill--warning';
  return 'status-pill status-pill--error';
}

function renderTags(run) {
  const tags = [];
  if (run && run.dryRun) {
    tags.push({ id: 'dry-run', label: 'Dry-Run', className: 'status-pill status-pill--info' });
  }
  if (run && run.headlessIntent) {
    tags.push({ id: 'headless', label: 'Headless', className: 'status-pill status-pill--warning' });
  }
  if (run && run.advisorRequested === 'claude') {
    tags.push({ id: 'claude', label: 'Claude-Required', className: 'status-pill status-pill--info' });
  }
  if (run && run.providerSelected) {
    tags.push({ id: 'provider', label: 'Provider', className: 'status-pill status-pill--info' });
  }
  return tags;
}

export default function Audit({ api }) {
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.getAuditSummary().then((data) => mounted && setSummary(data));
    api.getAuditRuns().then((data) => mounted && setRuns(Array.isArray(data) ? data.slice().reverse() : []));
    return () => {
      mounted = false;
    };
  }, [api]);

  const metrics = summary || {
    total: 0,
    success: 0,
    failure: 0,
    rejected: 0,
    escalations: 0,
    healings: 0,
  };

  return (
    <section className="page">
      <Card title="Audit Index" accent={theme.accent.blue} className="hero-card">
        <h1>Audit</h1>
        <p className="muted">Structured run history with decisions, limits, and compliance.</p>
      </Card>

      <div className="grid">
        <Card title="Summary" accent={theme.accent.purple}>
          <div className="stat-row">
            <span>Total Runs</span>
            <strong>{metrics.total}</strong>
          </div>
          <div className="stat-row">
            <span>Successes</span>
            <strong>{metrics.success}</strong>
          </div>
          <div className="stat-row">
            <span>Failures</span>
            <strong>{metrics.failure}</strong>
          </div>
          <div className="stat-row">
            <span>Rejections</span>
            <strong>{metrics.rejected}</strong>
          </div>
          <div className="stat-row">
            <span>Escalations</span>
            <strong>{metrics.escalations}</strong>
          </div>
          <div className="stat-row">
            <span>Healings</span>
            <strong>{metrics.healings}</strong>
          </div>
        </Card>

        <Card title="Compliance" accent={activeRun && activeRun.compliance ? theme.accent.green : theme.accent.blue}>
          {activeRun && activeRun.compliance ? (
            <>
              <div className="stat-row">
                <span>Template Matched</span>
                <strong>{activeRun.compliance.templateMatched ? '✔' : '✖'}</strong>
              </div>
              <div className="stat-row">
                <span>Limits Enforced</span>
                <strong>{activeRun.compliance.limitsEnforced ? '✔' : '✖'}</strong>
              </div>
              <div className="stat-row">
                <span>Policy Respected</span>
                <strong>{activeRun.compliance.policyRespected ? '✔' : '✖'}</strong>
              </div>
            </>
          ) : (
            <p className="muted">Select a run to view compliance details.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-wide">
        <Card title="Timeline" accent={theme.accent.blue}>
          <div className="timeline">
            {runs.length === 0 ? <p className="muted">No audit entries yet.</p> : null}
            {runs.map((run) => (
              <button
                key={run.runId}
                type="button"
                className="audit-row"
                onClick={async () => {
                  const detail = await api.getAuditRun(run.runId);
                  setActiveRun(detail || run);
                }}
              >
                <span className="audit-dot" style={{ background: statusAccent(run.status) }} />
                <div className="audit-row-body">
                  <strong>{run.templateId}</strong>
                  <span className="muted">{run.timestamp}</span>
                  <div className="tag-row">
                    {renderTags(run).map((tag) => (
                      <span key={tag.id} className={tag.className}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={statusPillClass(run.status)}>{run.status}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Run Detail" accent={activeRun ? statusAccent(activeRun.status) : theme.accent.blue}>
          {activeRun ? (
            <div className="audit-detail">
              <div className="stat-row">
                <span>Run ID</span>
                <strong>{activeRun.runId}</strong>
              </div>
              <div className="stat-row">
                <span>Timestamp</span>
                <strong>{activeRun.timestamp}</strong>
              </div>
              <div className="stat-row">
                <span>Template</span>
                <strong>{activeRun.templateId}</strong>
              </div>
              <div className="stat-row">
                <span>Agent</span>
                <strong>{activeRun.agentRole}</strong>
              </div>
              <div className="stat-row">
                <span>Mode</span>
                <strong>{activeRun.mode}</strong>
              </div>
              <div className="stat-row">
                <span>Provider</span>
                <strong>{activeRun.providerSelected || 'auto'}</strong>
              </div>
              <div className="stat-row">
                <span>Provider Role</span>
                <strong>{activeRun.providerRole || 'auto'}</strong>
              </div>
              <div className="stat-row">
                <span>Advisor</span>
                <strong>{activeRun.advisorRequested || 'auto'}</strong>
              </div>
              <div className="stat-row">
                <span>Headless</span>
                <strong>{activeRun.headlessIntent ? 'true' : 'false'}</strong>
              </div>
              <div className="stat-row">
                <span>Dry Run</span>
                <strong>{activeRun.dryRun ? 'true' : 'false'}</strong>
              </div>

              <div className="divider" />
              <h3 className="section-title">Phases</h3>
              {Array.isArray(activeRun.phases) && activeRun.phases.length > 0 ? (
                <ul className="phase-list">
                  {activeRun.phases.map((phase) => (
                    <li key={`${phase.phase}-${phase.at}`}>
                      <strong>{phase.phase}</strong>
                      <span className="muted">{phase.at}</span>
                      <p className="muted">{phase.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No phase data available.</p>
              )}

              <div className="divider" />
              <h3 className="section-title">Decisions</h3>
              {Array.isArray(activeRun.decisions) && activeRun.decisions.length > 0 ? (
                <ul className="phase-list">
                  {activeRun.decisions.map((decision, index) => (
                    <li key={`${decision.type}-${index}`}>
                      <strong>{decision.type}</strong>
                      <span className="muted">{decision.policy}</span>
                      <p className="muted">{decision.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No special decisions recorded.</p>
              )}

              <div className="divider" />
              <h3 className="section-title">Compliance</h3>
              {activeRun.compliance ? (
                <ul className="checklist">
                  <li>Template matched: {activeRun.compliance.templateMatched ? '✔' : '✖'}</li>
                  <li>Limits enforced: {activeRun.compliance.limitsEnforced ? '✔' : '✖'}</li>
                  <li>Policy respected: {activeRun.compliance.policyRespected ? '✔' : '✖'}</li>
                </ul>
              ) : (
                <p className="muted">No compliance data available.</p>
              )}
            </div>
          ) : (
            <p className="muted">Select a run to view details.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
