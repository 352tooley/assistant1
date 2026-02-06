import React, { useState } from 'react';

export default function TaskBuilder({ api }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');

  const onPreview = async () => {
    setMessage('');
    const result = await api.buildTaskPreview(input);
    setPreview(result);
  };

  const onApprove = () => {
    setMessage('Execution disabled in V1 (preview only).');
  };

  return (
    <section className="page">
      <header className="page-header">
        <h1>Task Builder</h1>
        <p>Describe a task in natural language to generate a preview.</p>
      </header>

      <div className="card">
        <label className="label">Task description</label>
        <textarea
          className="textarea"
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Example: summarize acceptance criteria for the new module"
        />
        <div className="button-row">
          <button className="primary" type="button" onClick={onPreview}>
            Generate Preview
          </button>
          <button className="ghost-button" type="button" onClick={onApprove}>
            Approve
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="card">
        <h2>Preview</h2>
        {preview ? (
          <div className="preview">
            <div className="stat-row">
              <span>Task Type</span>
              <strong>{preview.taskType}</strong>
            </div>
            <div className="stat-row">
              <span>Assigned Agent</span>
              <strong>{preview.assignedAgent}</strong>
            </div>
            <div className="stat-row">
              <span>Claude Escalation Allowed</span>
              <strong>{preview.claudeEscalationAllowed ? 'true' : 'false'}</strong>
            </div>
            <pre className="code-block">{JSON.stringify(preview.inputs, null, 2)}</pre>
          </div>
        ) : (
          <p className="muted">Preview will appear here after generation.</p>
        )}
      </div>
    </section>
  );
}
