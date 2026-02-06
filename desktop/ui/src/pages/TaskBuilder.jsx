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

function explainClaudeAvailability(claudeStatus) {
  if (!claudeStatus) {
    return { ok: false, reason: 'Status not yet fetched.' };
  }
  if (claudeStatus.ok) {
    return { ok: true, reason: 'Claude is available.' };
  }
  if (claudeStatus.reason === 'missing_api_key') {
    return { ok: false, reason: 'Missing API key.' };
  }
  if (claudeStatus.reason === 'engagement_disabled') {
    return { ok: false, reason: 'Provider disabled.' };
  }
  if (claudeStatus.reason === 'trigger_not_allowed') {
    return { ok: false, reason: 'Trigger not allowed.' };
  }
  return { ok: false, reason: 'Claude adapter unavailable.' };
}

export default function TaskBuilder({ api, onRunComplete, liveStatus, claudeStatus, providerData }) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [formInputs, setFormInputs] = useState({});
  const [message, setMessage] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('standard');
  const [executionMode, setExecutionMode] = useState('standard');
  const [maxCycles, setMaxCycles] = useState(1);
  const [allowsClaude, setAllowsClaude] = useState(false);
  const [requestedAdvisor, setRequestedAdvisor] = useState('auto');
  const [dryRunSelected, setDryRunSelected] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [frozenStatus, setFrozenStatus] = useState(null);
  const [preferredProvider, setPreferredProvider] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [preferredModel, setPreferredModel] = useState('');

  const onPreview = async () => {
    setMessage('');
    setRunResult(null);
    setDryRunResult(null);
    setFrozenStatus(null);
    try {
      const result = await api.buildTaskPreview(input);
      setPreview(result);
      if (result && result.extractedInputs) {
        setFormInputs(result.extractedInputs);
      }
      if (result?.template?.maxCycles) {
        setMaxCycles(result.template.maxCycles);
      }
      if (result?.template?.allowsClaude) {
        setAllowsClaude(result.template.allowsClaude);
      } else {
        setAllowsClaude(false);
      }
    } catch (err) {
      setMessage('Preview failed: ' + (err.message || String(err)));
    }
  };

  const onDryRun = async () => {
    if (!preview?.template) {
      setMessage('No template selected. Generate a preview first.');
      return;
    }
    setMessage('');
    setDryRunSelected(true);
    setDryRunRunning(true);
    setDryRunResult(null);
    try {
      const result = await api.runDryRun({
        templateId: preview?.template?.id || '',
        requestedAdvisor,
        mode,
        headless: executionMode === 'headless',
        preferredProvider,
        preferredRole,
        preferredModel,
      });
      setDryRunResult(result);
    } catch (err) {
      setMessage('Dry-run failed: ' + (err.message || String(err)));
    } finally {
      setDryRunRunning(false);
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
    setFrozenStatus(null);
    try {
      const request = {
        templateId: preview.template.id,
        inputs: formInputs,
      requestedAgentRole: preview.template.agentRole,
      requestedAdvisor,
      mode,
      preferredProvider,
      preferredRole,
      preferredModel,
      limits: {
          maxCycles: Math.min(Number(maxCycles) || 1, preview.template.maxCycles),
          maxRuntimeMs: 120000,
        },
        allowsClaude: preview.template.allowsClaude ? Boolean(allowsClaude) : false,
      };
      const result = await api.executeApprovedTask(request);
      setRunResult(result);
      if (onRunComplete) {
        onRunComplete({
          status: result.status,
          message: result.message,
          outputSummary: result.outputSummary,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setMessage('Execution failed: ' + (err.message || String(err)));
    } finally {
      setRunning(false);
    }
  };

  const statusFallback = runResult
    ? {
        runId: 'completed',
        status: runResult.status === 'success' ? 'completed' : runResult.status,
        phase: runResult.status === 'success' ? 'Completed' : 'Failed',
        message: runResult.message,
        startedAt: runResult.logHint?.lastTimestamp || null,
        updatedAt: runResult.logHint?.lastTimestamp || null,
      }
    : null;

  React.useEffect(() => {
    if (liveStatus) {
      setFrozenStatus(liveStatus);
      return;
    }
    if (!liveStatus && runResult && !running) {
      setFrozenStatus((prev) => prev || statusFallback);
    }
  }, [liveStatus, runResult, running]);

  const onInputChange = (key, value) => {
    setFormInputs((prev) => ({ ...prev, [key]: value }));
  };

  const missingInputs = computeMissingInputs(preview?.template, formInputs);
  const claudeAvailability = explainClaudeAvailability(claudeStatus);
  const claudeBlocked = requestedAdvisor === 'claude' && !claudeAvailability.ok;
  const headlessSelected = executionMode === 'headless';
  const providers = Array.isArray(providerData?.providers) ? providerData.providers : [];
  const selectedProvider = providers.find((provider) => provider.name === preferredProvider);
  const providerModels = selectedProvider?.models || [];
  const providerReady = !preferredProvider || (selectedProvider && selectedProvider.enabled && (selectedProvider.authStatus.apiKey || selectedProvider.authStatus.oauth));
  const requiresProvider =
    preview?.template?.id === 'open_ended_idea' ||
    preview?.template?.id === 'open_ended_plan' ||
    preview?.template?.id === 'youtube_analysis';
  const providerBlocked = (Boolean(preferredProvider) && !providerReady) || (requiresProvider && !preferredProvider);
  const approveDisabled =
    missingInputs.length > 0 ||
    !preview?.template ||
    running ||
    dryRunSelected ||
    headlessSelected ||
    claudeBlocked ||
    providerBlocked;

  const hasTemplate = Boolean(preview?.template);
  const readiness = missingInputs.length > 0 ? 'missing' : hasTemplate ? 'ready' : 'blocked';
  const contractAccent =
    readiness === 'ready' ? theme.accent.green : readiness === 'missing' ? theme.accent.amber : theme.accent.red;
  const approvalLabel = running ? 'Running...' : 'Approve & Run';

  const liveDisplay = liveStatus || frozenStatus;
  const elapsedMs =
    liveDisplay && liveDisplay.startedAt
      ? Date.now() - new Date(liveDisplay.startedAt).getTime()
      : 0;
  const elapsedLabel = liveDisplay ? `${Math.max(0, Math.round(elapsedMs / 1000))}s` : null;
  const statusAccentMap = {
    starting: theme.accent.blue,
    running: theme.accent.blue,
    waiting: theme.accent.blue,
    escalated: theme.accent.purple,
    healing: theme.accent.amber,
    completed: theme.accent.green,
    failed: theme.accent.red,
    rejected: theme.accent.red,
  };
  const liveAccent = liveDisplay ? statusAccentMap[liveDisplay.status] || theme.accent.blue : theme.accent.blue;
  const dryRunStatus =
    dryRunResult && dryRunResult.status === 'dry_run_ok'
      ? 'ready'
      : dryRunResult && dryRunResult.status === 'rejected'
      ? 'blocked'
      : null;
  const dryRunAccent =
    dryRunStatus === 'ready' ? theme.accent.green : dryRunStatus === 'blocked' ? theme.accent.red : theme.accent.blue;
  const dryRunLabel = dryRunRunning ? 'Running...' : 'Dry-Run Check';

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
          <button className="ghost-button" type="button" onClick={onDryRun} disabled={dryRunRunning}>
            {dryRunLabel}
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
        {claudeBlocked ? (
          <p className="muted">
            Claude was requested but is unavailable. {claudeAvailability.reason} Run a dry-run or configure provider.
          </p>
        ) : null}
        {providerBlocked ? (
          <p className="muted">
            {requiresProvider && !preferredProvider
              ? 'This template requires a preferred provider.'
              : 'Preferred provider is unavailable. Enable it and add credentials before running.'}
          </p>
        ) : null}
        {headlessSelected ? (
          <p className="muted">Headless runs must be started via CLI. UI execution is disabled.</p>
        ) : null}
        {dryRunSelected ? (
          <p className="muted">Dry-run selected. Use Dry-Run Check to validate without execution.</p>
        ) : null}
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
                const def = preview.template.inputs[key];
                const fieldType = def.type || 'string';
                const isMissing = missingInputs.includes(key);

                if (fieldType === 'enum') {
                  return (
                    <label key={key} className={`input-row ${isMissing ? 'missing' : ''}`}>
                      <span>{key}</span>
                      <select
                        value={formInputs[key] || ''}
                        onChange={(event) => onInputChange(key, event.target.value)}
                      >
                        <option value="">-- select --</option>
                        {(def.options || []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (fieldType === 'multi-select') {
                  const selected = Array.isArray(formInputs[key]) ? formInputs[key] : [];
                  return (
                    <div key={key} className={`input-row ${isMissing ? 'missing' : ''}`}>
                      <span>{key}</span>
                      <div>
                        {(def.options || []).map((opt) => (
                          <label key={opt} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={selected.includes(opt)}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...selected, opt]
                                  : selected.filter((v) => v !== opt);
                                onInputChange(key, next);
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (fieldType === 'url') {
                  return (
                    <label key={key} className={`input-row ${isMissing ? 'missing' : ''}`}>
                      <span>{key}</span>
                      <input
                        type="url"
                        value={formInputs[key] || ''}
                        onChange={(event) => onInputChange(key, event.target.value)}
                        placeholder="https://..."
                      />
                    </label>
                  );
                }

                return (
                  <label key={key} className={`input-row ${isMissing ? 'missing' : ''}`}>
                    <span>{key}</span>
                    <input
                      type="text"
                      value={formInputs[key] || ''}
                      onChange={(event) => onInputChange(key, event.target.value)}
                      placeholder={fieldType}
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
              <span>Max Cycles</span>
              <input
                type="number"
                min={1}
                max={preview?.template?.maxCycles || 1}
                value={maxCycles}
                disabled={headlessSelected}
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

        <Card title="Run Configuration" accent={theme.accent.purple}>
          <div className="preview-inputs">
            <label className="input-row">
              <span>Advisor</span>
              <select value={requestedAdvisor} onChange={(event) => setRequestedAdvisor(event.target.value)}>
                <option value="auto">auto</option>
                <option value="none">none</option>
                <option value="claude">claude</option>
              </select>
            </label>
            <label className="input-row">
              <span>Preferred Provider</span>
              <select
                value={preferredProvider}
                onChange={(event) => {
                  setPreferredProvider(event.target.value);
                  setPreferredRole('');
                  setPreferredModel('');
                }}
              >
                <option value="">auto</option>
                {providers.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-row">
              <span>Preferred Role</span>
              <select value={preferredRole} onChange={(event) => setPreferredRole(event.target.value)}>
                <option value="">auto</option>
                {(selectedProvider?.allowedRoles || []).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-row">
              <span>Preferred Model</span>
              <select value={preferredModel} onChange={(event) => setPreferredModel(event.target.value)}>
                <option value="">auto</option>
                {providerModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-row">
              <span>Execution Mode</span>
              <select value={executionMode} onChange={(event) => setExecutionMode(event.target.value)}>
                <option value="standard">standard</option>
                <option value="headless">headless</option>
              </select>
            </label>
            <label className="input-row">
              <span>Routing Mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="standard">standard</option>
                <option value="budget">budget</option>
                <option value="diagnostic">diagnostic</option>
              </select>
            </label>
            <label className="input-row">
              <span>Dry-run only</span>
              <input
                type="checkbox"
                checked={dryRunSelected}
                onChange={(event) => setDryRunSelected(event.target.checked)}
              />
            </label>
          </div>
          {requestedAdvisor === 'claude' ? (
            <p className="muted">
              Claude advisor selected. This will invoke the Anthropic API and requires a valid key.
            </p>
          ) : null}
          <p className="muted">Provider and role are validated at runtime. Dry-run recommended.</p>
          {headlessSelected ? (
            <div className="warning-pill">Headless runs continue without UI supervision.</div>
          ) : null}
          {headlessSelected ? (
            <div className="stat-row">
              <span>Max Cycles</span>
              <strong>{preview?.template?.maxCycles ?? 'n/a'}</strong>
            </div>
          ) : null}
          {headlessSelected ? (
            <div className="stat-row">
              <span>Poll Interval</span>
              <strong>5s</strong>
            </div>
          ) : null}
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

        <Card title="Dry-Run Result" accent={dryRunAccent}>
          {dryRunResult ? (
            <div className="preview">
              <div className="stat-row">
                <span>Status</span>
                <strong>{dryRunStatus === 'ready' ? 'Ready to run' : 'Blocked'}</strong>
              </div>
              <div className="stat-row">
                <span>Advisor</span>
                <strong>{requestedAdvisor}</strong>
              </div>
              <div className="stat-row">
                <span>Claude Available</span>
                <strong>{dryRunResult.claudeAvailable ? 'yes' : 'no'}</strong>
              </div>
              <div className="stat-row">
                <span>Message</span>
                <strong>{dryRunResult.message || 'Dry run complete.'}</strong>
              </div>
              <p className="muted">Nothing executed. This is a preflight check only.</p>
            </div>
          ) : (
            <p className="muted">Run a dry-run check to validate readiness.</p>
          )}
        </Card>

        {liveDisplay ? (
          <Card title="Live Run" accent={liveAccent}>
            <div className="stat-row">
              <span>Status</span>
              <strong>{liveDisplay.status}</strong>
            </div>
            <div className="stat-row">
              <span>Phase</span>
              <strong>{liveDisplay.phase}</strong>
            </div>
            <div className="stat-row">
              <span>Message</span>
              <strong>{liveDisplay.message}</strong>
            </div>
            <div className="stat-row">
              <span>Elapsed</span>
              <strong>{elapsedLabel}</strong>
            </div>
            {(liveDisplay.status === 'running' || liveDisplay.status === 'starting' || liveDisplay.status === 'waiting') && api.requestStop ? (
              <button
                className="ghost-button"
                type="button"
                onClick={async () => {
                  try {
                    const result = await api.requestStop();
                    setMessage(result.ok ? 'Stop requested.' : 'Stop failed: ' + (result.reason || 'unknown'));
                  } catch (err) {
                    setMessage('Stop failed: ' + (err.message || String(err)));
                  }
                }}
              >
                Request Stop
              </button>
            ) : null}
          </Card>
        ) : null}
      </div>
    </section>
  );
}
