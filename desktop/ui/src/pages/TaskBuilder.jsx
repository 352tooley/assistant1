import React, { useState } from 'react';

function computeMissingInputs(template, values) {
  if (!template || !template.inputs) {
    return [];
  }
  return Object.keys(template.inputs).filter((key) => {
    const def = template.inputs[key];
    if (!def.required) {
      return false;
    }
    const value = values[key];
    const type = def.type || 'string';
    if (type === 'multi-select') {
      return !Array.isArray(value) || value.length === 0;
    }
    if (type === 'enum') {
      return value === undefined || value === null || value === '';
    }
    if (type === 'url') {
      return typeof value !== 'string' || !/^https?:\/\//i.test(value.trim());
    }
    return typeof value !== 'string' || value.trim().length === 0;
  });
}

export default function TaskBuilder({ api, onRunComplete }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [formInputs, setFormInputs] = useState({});
  const [message, setMessage] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('standard');
  const [maxCycles, setMaxCycles] = useState(1);
  const [allowsClaude, setAllowsClaude] = useState(false);

  const onPreview = async () => {
    setMessage('');
    setRunResult(null);
    const result = await api.buildTaskPreview(input);
    setPreview(result);
    if (result && result.extractedInputs) {
      setFormInputs(result.extractedInputs);
    }
    if (result?.template?.maxCycles) {
      setMaxCycles(Math.min(1, result.template.maxCycles));
    }
    if (result?.template?.allowsClaude) {
      setAllowsClaude(result.template.allowsClaude);
    } else {
      setAllowsClaude(false);
    }
  };

  const onApprove = async () => {
    if (!preview?.template) {
      setMessage('No template selected.');
      return;
    }
    if (missingInputs.length > 0) {
      setMessage('Missing required inputs.');
      return;
    }
    setMessage('');
    setRunning(true);
    const request = {
      templateId: preview.template.id,
      inputs: formInputs,
      requestedAgentRole: preview.template.agentRole,
      mode,
      limits: {
        maxCycles: Math.min(Number(maxCycles) || 1, preview.template.maxCycles),
        maxRuntimeMs: 120000,
      },
      allowsClaude: preview.template.allowsClaude ? Boolean(allowsClaude) : false,
    };
    const result = await api.executeApprovedTask(request);
    setRunResult(result);
    setRunning(false);
    if (onRunComplete) {
      onRunComplete({
        status: result.status,
        message: result.message,
        outputSummary: result.outputSummary,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const onInputChange = (key, value) => {
    setFormInputs((prev) => ({ ...prev, [key]: value }));
  };

  const missingInputs = computeMissingInputs(preview?.template, formInputs);
  const approveDisabled = missingInputs.length > 0 || !preview?.template || running;

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
            {running ? 'Running...' : 'Approve'}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>

      <div className="card">
        <h2>Run Settings</h2>
        <div className="preview-inputs">
          <label className="input-row">
            <span>Mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="standard">standard</option>
              <option value="budget">budget</option>
              <option value="diagnostic">diagnostic</option>
            </select>
          </label>
          <label className="input-row">
            <span>Max Cycles</span>
            <input
              type="number"
              min={1}
              max={preview?.template?.maxCycles || 1}
              value={maxCycles}
              onChange={(event) => {
                const nextValue = Number(event.target.value) || 1;
                const maxAllowed = preview?.template?.maxCycles || 1;
                setMaxCycles(Math.min(nextValue, maxAllowed));
              }}
            />
          </label>
          <label className="input-row">
            <span>Allows Claude</span>
            <input
              type="checkbox"
              checked={allowsClaude}
              disabled={!preview?.template?.allowsClaude}
              onChange={(event) => setAllowsClaude(event.target.checked)}
            />
          </label>
        </div>
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

      <div className="card">
        <h2>Execution Status</h2>
        {runResult ? (
          <div className="preview">
            <div className="stat-row">
              <span>Status</span>
              <strong>{runResult.status}</strong>
            </div>
            <div className="stat-row">
              <span>Message</span>
              <strong>{runResult.message}</strong>
            </div>
            <div className="stat-row">
              <span>Output Summary</span>
              <strong>{runResult.outputSummary || 'n/a'}</strong>
            </div>
            <div className="stat-row">
              <span>Log Hint</span>
              <strong>{runResult.logHint?.lastTimestamp || 'n/a'}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">No execution yet.</p>
        )}
      </div>
    </section>
  );
}
