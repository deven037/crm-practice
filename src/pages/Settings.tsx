import { useEffect, useState } from 'react';
import { Activity, FolderOpen, Play, Save } from 'lucide-react';
import { getValue, setValue } from '../data/store';
import { apiFetch, clearToken } from '../data/apiFetch';
import { Modal } from '../components/Modal';
import { Accordion } from '../components/Accordion';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

interface Prefs {
  emailNotifs: boolean;
  pushNotifs: boolean;
  weeklyDigest: boolean;
  density: 'comfortable' | 'compact';
}

const DEFAULT_PREFS: Prefs = { emailNotifs: true, pushNotifs: false, weeklyDigest: true, density: 'comfortable' };
const BRIDGE_URL = 'http://127.0.0.1:8765';

interface BridgeConfig {
  project_dir: string;
  analysis_script: string;
  python_executable: string;
  output_dir: string;
}

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  project_dir: '',
  analysis_script: 'analysis.py',
  python_executable: '',
  output_dir: 'outputs',
};

export function Settings() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [prefs, setPrefs] = useState<Prefs>(() => getValue('prefs', DEFAULT_PREFS));
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>(() => getValue('dataStudioBridge', DEFAULT_BRIDGE_CONFIG));
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [analysisRepositoryUrl, setAnalysisRepositoryUrl] = useState('https://github.com/deven037/crm-data-science-lab');
  const [analysisPipelineReady, setAnalysisPipelineReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${BRIDGE_URL}/api/health`)
      .then((response) => response.json())
      .then((body: { ok?: boolean; config?: BridgeConfig }) => {
        if (!active) return;
        setBridgeStatus(body.ok ? 'connected' : 'offline');
        if (body.config) {
          setBridgeConfig(body.config);
          setValue('dataStudioBridge', body.config);
        }
      })
      .catch(() => { if (active) setBridgeStatus('offline'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    apiFetch<{ repository_url: string; ready: boolean }>('/analysis/config')
      .then((config) => {
        setAnalysisRepositoryUrl(config.repository_url);
        setAnalysisPipelineReady(config.ready);
      })
      .catch(() => setAnalysisPipelineReady(false));
  }, []);

  const saveProfile = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone.trim())) errs.phone = 'Enter a valid phone number.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (user) {
      await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      await refreshUser();
    }
    toast.push('success', 'Profile saved.');
  };

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    setValue('prefs', next);
  };

  const bridgeRequest = async (path: string, body?: Record<string, unknown>) => {
    const response = await fetch(`${BRIDGE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? `Local bridge request failed (${response.status}).`);
    return result as Record<string, unknown>;
  };

  const saveBridgeConfig = async () => {
    setBridgeBusy(true);
    setBridgeMessage('');
    try {
      const result = await bridgeRequest('/api/config', bridgeConfig as unknown as Record<string, unknown>);
      const saved = result.config as BridgeConfig;
      setBridgeConfig(saved);
      setValue('dataStudioBridge', saved);
      setBridgeStatus('connected');
      setBridgeMessage(Boolean(result.script_exists) ? 'Connection saved. Your configured script is ready.' : 'Connection saved. Create the starter script or set your existing script path.');
      toast.push('success', 'Python project connection saved.');
    } catch (error) {
      setBridgeStatus('offline');
      setBridgeMessage(error instanceof Error ? error.message : 'Unable to connect to the local bridge.');
    } finally {
      setBridgeBusy(false);
    }
  };

  const createAnalysisStarter = async () => {
    setBridgeBusy(true);
    setBridgeMessage('');
    try {
      const configured = await bridgeRequest('/api/config', bridgeConfig as unknown as Record<string, unknown>);
      const saved = configured.config as BridgeConfig;
      setBridgeConfig(saved);
      setValue('dataStudioBridge', saved);
      const result = await bridgeRequest('/api/template', {});
      setBridgeMessage(`Starter script created at ${String(result.script)}. Open it in PyCharm to write your analysis.`);
      toast.push('success', 'Analysis starter created in your project.');
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : 'Unable to create the starter script.');
    } finally {
      setBridgeBusy(false);
    }
  };

  const doReset = async () => {
    await apiFetch('/reset', { method: 'POST' });
    clearToken();
    toast.push('success', 'All data reset to seed state. Reloading…');
    setTimeout(() => {
      window.location.href = '/login';
    }, 800);
  };

  return (
    <div data-testid="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <section className="card">
        <h3>Profile</h3>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Full name *</span>
            <input className="input" data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <span className="field-label">Email *</span>
            <input className="input" data-testid="profile-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          <div className="field">
            <span className="field-label">Phone</span>
            <input className="input" data-testid="profile-phone" placeholder="+91 98xxx xxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>
        </div>
        <button className="btn btn-primary" data-testid="profile-save-btn" onClick={saveProfile}>
          Save profile
        </button>
      </section>

      <section className="card">
        <h3>Notification preferences</h3>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.emailNotifs}
              onChange={(e) => savePrefs({ ...prefs, emailNotifs: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Email notifications
        </label>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.pushNotifs}
              onChange={(e) => savePrefs({ ...prefs, pushNotifs: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Push notifications
        </label>
        <label className="switch-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={prefs.weeklyDigest}
              onChange={(e) => savePrefs({ ...prefs, weeklyDigest: e.target.checked })}
            />
            <span className="switch-slider" />
          </label>
          Weekly digest email
        </label>

        <h4>Display density</h4>
        <div className="radio-row">
          <label className="checkbox-label">
            <input
              type="radio"
              name="density"
              checked={prefs.density === 'comfortable'}
              onChange={() => savePrefs({ ...prefs, density: 'comfortable' })}
            />
            Comfortable
          </label>
          <label className="checkbox-label">
            <input
              type="radio"
              name="density"
              checked={prefs.density === 'compact'}
              onChange={() => savePrefs({ ...prefs, density: 'compact' })}
            />
            Compact
          </label>
        </div>
      </section>

      <section className="card" data-testid="python-project-bridge-settings">
        <div className="settings-bridge-heading">
          <div>
            <h3>Python project bridge</h3>
            <p className="muted">Connect Data Studio to a local PyCharm project. The browser itself cannot write to your filesystem; this local bridge does that on your computer.</p>
          </div>
          <span className={`bridge-status bridge-status-${bridgeStatus}`}><Activity size={14} />{bridgeStatus === 'connected' ? 'Bridge online' : bridgeStatus === 'checking' ? 'Checking bridge' : 'Bridge offline'}</span>
        </div>
        {bridgeStatus === 'offline' && <div className="banner banner-info">Start <code>python_bridge/server.py</code> with your project interpreter, then test the connection again.</div>}
        <div className="form-grid settings-bridge-grid">
          <div className="field settings-bridge-wide">
            <span className="field-label">PyCharm project folder *</span>
            <div className="input-icon-wrap"><FolderOpen className="input-icon" size={16} /><input className="input" data-testid="python-project-folder" aria-readonly="true" readOnly placeholder="Waiting for the local Python bridge" value={bridgeConfig.project_dir} /></div>
            <span className="field-hint">This is the local checkout used by Get Analysis. The folder path is managed by the local Python bridge and cannot be changed here.</span>
          </div>
          <div className="field">
            <span className="field-label">Analysis script path</span>
            <input className="input" data-testid="python-analysis-script" placeholder="analysis.py" value={bridgeConfig.analysis_script} onChange={(event) => setBridgeConfig({ ...bridgeConfig, analysis_script: event.target.value })} />
            <span className="field-hint">Relative to your project folder.</span>
          </div>
          <div className="field">
            <span className="field-label">Python interpreter path</span>
            <input className="input" data-testid="python-interpreter-path" placeholder="PyCharm interpreter path" value={bridgeConfig.python_executable} onChange={(event) => setBridgeConfig({ ...bridgeConfig, python_executable: event.target.value })} />
            <span className="field-hint">Use the interpreter configured for this project.</span>
          </div>
          <div className="field">
            <span className="field-label">Analysis output folder</span>
            <input className="input" data-testid="python-output-dir" value={bridgeConfig.output_dir} onChange={(event) => setBridgeConfig({ ...bridgeConfig, output_dir: event.target.value })} />
            <span className="field-hint">Relative to the project folder; images saved here appear in Data Studio.</span>
          </div>
        </div>
        <div className="settings-bridge-actions">
          <button type="button" className="btn btn-primary" data-testid="save-python-bridge-btn" disabled={bridgeBusy || bridgeStatus === 'offline'} onClick={saveBridgeConfig}><Save size={15} />{bridgeBusy ? 'Saving…' : 'Save project connection'}</button>
          <button type="button" className="btn" data-testid="create-analysis-starter-btn" disabled={bridgeBusy || bridgeStatus === 'offline' || !bridgeConfig.project_dir} onClick={createAnalysisStarter}><Play size={14} />Create starter script</button>
          <button type="button" className="link-btn" onClick={() => { setBridgeStatus('checking'); fetch(`${BRIDGE_URL}/api/health`).then((response) => { if (!response.ok) throw new Error(); setBridgeStatus('connected'); }).catch(() => setBridgeStatus('offline')); }}>Test connection</button>
        </div>
        {bridgeMessage && <p className="settings-bridge-message" role="status">{bridgeMessage}</p>}
        <p className="field-hint">Scripts run locally using the selected interpreter, with a 120-second limit. Only configure a project and script you trust.</p>
      </section>

      <section className="card" data-testid="hosted-analysis-settings">
        <div className="settings-bridge-heading">
          <div>
            <h3>Hosted analysis pipeline</h3>
            <p className="muted">Data Studio can send a selected dataset to the trusted GitHub Actions workflow for analysis after the hosted service is configured.</p>
          </div>
          <span className={`bridge-status bridge-status-${analysisPipelineReady ? 'connected' : 'offline'}`}><Activity size={14} />{analysisPipelineReady ? 'Pipeline ready' : 'Setup required'}</span>
        </div>
        <div className="field settings-bridge-wide">
          <span className="field-label">Shared analysis repository</span>
          <input className="input" data-testid="hosted-analysis-repository" aria-readonly="true" readOnly value={analysisRepositoryUrl} />
          <span className="field-hint">Managed by the CRM server. The repository URL is visible to everyone; GitHub credentials stay on the server.</span>
        </div>
        {!analysisPipelineReady && <p className="field-hint">Configure the GitHub Actions token, callback secret, public API URL, and workflow secret before enabling hosted runs.</p>}
      </section>

      <section className="card">
        <h3>Help center</h3>
        <Accordion title="Open embedded help center (iframe)">
          {/* iframe — practices frame switching */}
          <iframe src="/help.html" title="Help Center" className="help-iframe" data-testid="help-iframe" />
        </Accordion>
      </section>

      <section className="card danger-zone">
        <h3>Danger zone</h3>
        <p className="muted">
          Reset all CRM data back to the original seed state. Use this to get a clean, repeatable dataset before test runs.
          You can also open the app with <code>?reset=true</code> to do this automatically.
        </p>
        <button className="btn btn-danger" data-testid="reset-data-btn" onClick={() => setConfirmReset(true)}>
          Reset all data
        </button>
      </section>

      {confirmReset && (
        <Modal
          title="Reset all data?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" data-testid="reset-confirm-btn" onClick={doReset}>
                Yes, reset everything
              </button>
            </>
          }
        >
          <p>
            This wipes every change you've made (leads, deals, tickets, users…) and restores the deterministic seed data.
            You will be signed out.
          </p>
        </Modal>
      )}
    </div>
  );
}
