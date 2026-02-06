import React from 'react';

export default function UsageSummary({ usage }) {
  const data = usage || { codexCalls: 0, claudeCalls: 0 };

  return (
    <>
      <div className="stat-row">
        <span>Codex Calls</span>
        <strong>{data.codexCalls}</strong>
      </div>
      <div className="stat-row">
        <span>Claude Calls</span>
        <strong>{data.claudeCalls}</strong>
      </div>
      <div className="stat-row">
        <span>Safety</span>
        <strong>Bounded</strong>
      </div>
    </>
  );
}
