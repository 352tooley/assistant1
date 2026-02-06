import React from 'react';
import StatusCard from '../components/StatusCard.jsx';
import UsageSummary from '../components/UsageSummary.jsx';
import Card from '../components/Card.jsx';
import theme from '../theme.js';

function describeClaudeStatus(claudeStatus) {
  if (!claudeStatus) {
    return { label: 'Unknown', detail: 'Status not yet fetched.' };
  }
  if (claudeStatus.ok) {
    return { label: 'Available', detail: 'Claude will run when explicitly requested.' };
  }
  const reason = claudeStatus.reason || 'unavailable';
  if (reason === 'missing_api_key') {
    return { label: 'Unavailable', detail: 'Missing API key.' };
  }
  if (reason === 'engagement_disabled') {
    return { label: 'Unavailable', detail: 'Provider disabled.' };
  }
  if (reason === 'trigger_not_allowed') {
    return { label: 'Unavailable', detail: 'Trigger not allowed.' };
  }
  return { label: 'Unavailable', detail: 'Claude adapter not callable.' };
}

export default function Dashboard({ status, lastRun, liveStatus, claudeStatus, providerData, onProvidersChange, api, onNavigate }) {
  const data = status || {
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunTimestamp: 'unknown',
    mode: 'standard',
    usage: { codexCalls: 0, claudeCalls: 0 },
  };
  const lastRunStatus = lastRun ? `${lastRun.status}` : 'none';
  const lastRunTime = lastRun?.timestamp || data.lastRunTimestamp || 'unknown';

  const engineAccent = data.failed > 0 ? theme.accent.red : theme.accent.blue;
  const statusTone = data.failed > 0 ? 'status-pill status-pill--error' : 'status-pill status-pill--ok';
  const liveAccent = liveStatus ? theme.accent.blue : theme.accent.purple;
  const claudeInfo = describeClaudeStatus(claudeStatus);
  const claudeAccent = claudeStatus && claudeStatus.ok ? theme.accent.green : theme.accent.red;
  const claudePill = claudeStatus && claudeStatus.ok ? 'status-pill status-pill--ok' : 'status-pill status-pill--error';
  const registry = providerData?.registry || {};
  const providers = Array.isArray(providerData?.providers) ? providerData.providers : [];
  const [newProviderType, setNewProviderType] = React.useState('openai');
  const [newProviderName, setNewProviderName] = React.useState('');
  const [newAuthMethod, setNewAuthMethod] = React.useState('apiKey');
  const apiKeyRef = React.useRef(null);
  const projectRefs = React.useRef({});

  const handleAddProvider = async () => {
    const apiKey = apiKeyRef.current ? apiKeyRef.current.value : '';
    await api.addProvider({
      type: newProviderType,
      name: newProviderName.trim(),
      authMethod: newAuthMethod,
      apiKey: newAuthMethod === 'apiKey' ? apiKey : undefined,
    });
    if (apiKeyRef.current) {
      apiKeyRef.current.value = '';
    }
    setNewProviderName('');
    if (onProvidersChange) {
      onProvidersChange();
    }
  };

  const toggleProvider = async (provider) => {
    if (!provider) {
      return;
    }
    if (provider.enabled) {
      await api.disableProvider(provider.name);
    } else {
      await api.enableProvider(provider.name);
    }
    if (onProvidersChange) {
      onProvidersChange();
    }
  };

  const updateRoles = async (provider, role, checked) => {
    if (!provider) {
      return;
    }
    const nextRoles = checked
      ? Array.from(new Set([...(provider.roles || []), role]))
      : (provider.roles || []).filter((item) => item !== role);
    await api.assignRoles({ name: provider.name, roles: nextRoles });
    if (onProvidersChange) {
      onProvidersChange();
    }
  };

  const updateProjects = async (provider) => {
    if (!provider) {
      return;
    }
    const input = projectRefs.current[provider.name];
    const value = input ? input.value : '';
    await api.assignProjects({ name: provider.name, projects: value });
    if (onProvidersChange) {
      onProvidersChange();
    }
  };

  return (
    <section className="page">
      <Card title="Mission Status" accent={engineAccent} className="hero-card">
        <div className="hero-grid">
          <div>
            <h1>System Dashboard</h1>
            <p className="muted">Read-only status overview for the orchestration engine.</p>
          </div>
          <div className="hero-status">
            <span className={statusTone}>{data.failed > 0 ? 'Attention' : 'Nominal'}</span>
            <span className="muted">Last Run: {lastRunTime}</span>
          </div>
        </div>
      </Card>

      <div className="grid">
        <Card title="Engine Status" accent={engineAccent}>
          <StatusCard label="Pending" value={data.pending} />
          <StatusCard label="Completed" value={data.completed} />
          <StatusCard label="Failed" value={data.failed} />
          <StatusCard label="Last Run Status" value={lastRunStatus} />
          <StatusCard label="Routing Mode" value={data.mode} />
        </Card>

        <Card title="Usage Telemetry" accent={theme.accent.purple}>
          <UsageSummary usage={data.usage} />
          <p className="muted">Usage is approximate; execution remains controlled.</p>
          <button
            className="ghost-button"
            type="button"
            onClick={() => onNavigate && onNavigate('activity')}
          >
            View Recent Activity
          </button>
        </Card>

        {liveStatus ? (
          <Card title="Active Run" accent={liveAccent}>
            <div className="stat-row">
              <span>Status</span>
              <strong>{liveStatus.status}</strong>
            </div>
            <div className="stat-row">
              <span>Phase</span>
              <strong>{liveStatus.phase}</strong>
            </div>
            <div className="stat-row">
              <span>Message</span>
              <strong>{liveStatus.message}</strong>
            </div>
            <button className="ghost-button" type="button" onClick={() => onNavigate && onNavigate('builder')}>
              View Live Run
            </button>
          </Card>
        ) : null}

        <Card title="Claude Status" accent={claudeAccent}>
          <div className="stat-row">
            <span>Claude Available</span>
            <strong className={claudePill}>{claudeInfo.label}</strong>
          </div>
          <p className="muted">{claudeInfo.detail}</p>
          <p className="muted">Claude is only invoked when explicitly requested.</p>
        </Card>

        <Card title="AI Providers" accent={theme.accent.blue}>
          <div className="preview-inputs">
            <label className="input-row">
              <span>Provider Type</span>
              <select value={newProviderType} onChange={(event) => setNewProviderType(event.target.value)}>
                {Object.keys(registry).map((key) => (
                  <option key={key} value={key}>
                    {registry[key].label || key}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-row">
              <span>Name</span>
              <input
                type="text"
                value={newProviderName}
                onChange={(event) => setNewProviderName(event.target.value)}
                placeholder="myClaude"
              />
            </label>
            <label className="input-row">
              <span>Auth Method</span>
              <select value={newAuthMethod} onChange={(event) => setNewAuthMethod(event.target.value)}>
                {(registry[newProviderType]?.auth || ['apiKey']).map((auth) => (
                  <option key={auth} value={auth}>
                    {auth}
                  </option>
                ))}
              </select>
            </label>
            {newAuthMethod === 'apiKey' ? (
              <label className="input-row">
                <span>API Key</span>
                <input type="password" placeholder="sk-..." ref={apiKeyRef} />
              </label>
            ) : (
              <div className="oauth-row">
                <button className="ghost-button" type="button" disabled>
                  Sign in
                </button>
                <span className="muted">OAuth requires a provider-specific sign-in flow.</span>
              </div>
            )}
            <button className="primary" type="button" onClick={handleAddProvider} disabled={!newProviderName.trim()}>
              Add Provider
            </button>
          </div>
          <div className="divider" />
          {providers.length === 0 ? (
            <p className="muted">No providers configured.</p>
          ) : (
            providers.map((provider) => {
              const ready = provider.enabled && (provider.authStatus.apiKey || provider.authStatus.oauth);
              const statusClass = ready ? 'status-pill status-pill--ok' : 'status-pill status-pill--warning';
              return (
                <div key={provider.name} className="provider-row">
                  <div>
                    <strong>{provider.name}</strong>
                    <p className="muted">{provider.label}</p>
                  </div>
                  <span className={statusClass}>{ready ? 'Ready' : 'Missing Auth'}</span>
                  <button className="ghost-button" type="button" onClick={() => toggleProvider(provider)}>
                    {provider.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <div className="provider-roles">
                    {(provider.allowedRoles || []).map((role) => (
                      <label key={role} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={provider.roles.includes(role)}
                          onChange={(event) => updateRoles(provider, role, event.target.checked)}
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                  <div className="provider-projects">
                    <input
                      type="text"
                      placeholder="project-a, project-b"
                      ref={(el) => {
                        projectRefs.current[provider.name] = el;
                      }}
                    />
                    <button className="ghost-button" type="button" onClick={() => updateProjects(provider)}>
                      Save Projects
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <Card title="Recent Signal" accent={theme.accent.blue}>
          <div className="stat-row">
            <span>Last Run</span>
            <strong>{lastRunTime}</strong>
          </div>
          <div className="stat-row">
            <span>Status</span>
            <strong>{lastRunStatus}</strong>
          </div>
          <p className="muted">Track recent approvals and operator actions in Activity.</p>
        </Card>
      </div>
    </section>
  );
}
