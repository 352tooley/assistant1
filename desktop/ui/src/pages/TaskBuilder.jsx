import React, { useState } from 'react';

export default function TaskBuilder({ api }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [formInputs, setFormInputs] = useState({});
  const [message, setMessage] = useState('');

  const onPreview = async () => {
    setMessage('');
    const result = await api.buildTaskPreview(input);
    setPreview(result);
    if (result && result.extractedInputs) {
      setFormInputs(result.extractedInputs);
    }
  };

  const onApprove = () => {
    setMessage('Execution disabled in V1 (preview only).');
  };

  const onInputChange = (key, value) => {
    setFormInputs((prev) => ({ ...prev, [key]: value }));
  };

  const missingInputs = preview?.missingInputs || [];
  const approveDisabled = missingInputs.length > 0 || !preview?.template;

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
          <button className="ghost-button" type="button" onClick={onApprove} disabled={approveDisabled}>
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
              <span>Template</span>
              <strong>{preview.template?.label || 'Unmatched'}</strong>
            </div>
            <div className="stat-row">
              <span>Confidence</span>
              <strong>{preview.confidence ?? 0}%</strong>
            </div>
            <div className="stat-row">
              <span>Agent Role</span>
              <strong>{preview.template?.agentRole || 'n/a'}</strong>
            </div>
            <div className="stat-row">
              <span>Claude Escalation Allowed</span>
              <strong>{preview.template?.allowsClaude ? 'true' : 'false'}</strong>
            </div>
            <div className="stat-row">
              <span>Max Cycles</span>
              <strong>{preview.template?.maxCycles ?? 'n/a'}</strong>
            </div>
            <div className="preview-inputs">
              {preview.template?.inputs &&
                Object.keys(preview.template.inputs).map((key) => {
                  const isMissing = missingInputs.includes(key);
                  return (
                    <label key={key} className={`input-row ${isMissing ? 'missing' : ''}`}>
                      <span>{key}</span>
                      <input
                        type="text"
                        value={formInputs[key] || ''}
                        onChange={(event) => onInputChange(key, event.target.value)}
                        placeholder={preview.template.inputs[key].type}
                      />
                    </label>
                  );
                })}
            </div>
            {missingInputs.length > 0 ? (
              <p className="muted">Missing required inputs: {missingInputs.join(', ')}</p>
            ) : (
              <p className="muted">All required inputs provided.</p>
            )}
          </div>
        ) : (
          <p className="muted">Preview will appear here after generation.</p>
        )}
      </div>
    </section>
  );
}
