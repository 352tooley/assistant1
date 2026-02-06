import React, { useState } from 'react';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

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

  const hasTemplate = Boolean(preview?.template);
  const readiness = missingInputs.length > 0 ? 'missing' : hasTemplate ? 'ready' : 'blocked';
  const contractAccent =
    readiness === 'ready' ? theme.accent.green : readiness === 'missing' ? theme.accent.amber : theme.accent.red;
  const approvalLabel = running ? 'Running...' : 'Approve & Run';

  return (
    <section className="page">
      <Card title="Intent Input" accent={theme.accent.blue} className="hero-card">
        <h1>Task Builder</h1>
        <p className="muted">Describe a task in natural language to generate a controlled preview.</p>
        <label className="label">Task description</label>
        <textarea
          className="textarea"
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Example: build a basic website site named &quot;Acme&quot; with theme minimal"
        />
        <div className="button-row">
          <button className="primary" type="button" onClick={onPreview}>
            Generate Preview
          </button>
          <button className="primary primary-approve" type="button" onClick={onApprove} disabled={approveDisabled}>
            {approvalLabel}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </Card>

      <div className="grid">
        <Card title="Execution Contract" accent={contractAccent}>
          <div className="stat-row">
            <span>Template</span>
            <strong>{preview?.template?.label || 'Unmatched'}</strong>
          </div>
          <div className="stat-row">
            <span>Confidence</span>
            <strong>{preview?.confidence ?? 0}%</strong>
          </div>
          <div className="stat-row">
            <span>Agent Role</span>
            <strong>{preview?.template?.agentRole || 'n/a'}</strong>
          </div>
          <div className="stat-row">
            <span>Claude Escalation</span>
            <strong>{preview?.template?.allowsClaude ? 'allowed' : 'blocked'}</strong>
          </div>
          <div className="stat-row">
            <span>Max Cycles</span>
            <strong>{preview?.template?.maxCycles ?? 'n/a'}</strong>
          </div>

          <div className="preview-inputs">
            {preview?.template?.inputs &&
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

          <div className="divider" />
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
        </Card>

        <Card title="Execution Status" accent={runResult?.status === 'success' ? theme.accent.green : theme.accent.blue}>
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
        </Card>
      </div>
    </section>
  );
}
