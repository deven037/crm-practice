import { useEffect, useMemo, useState } from 'react';
import { Check, Download, FolderDown, LoaderCircle, Play, RefreshCw, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../data/apiFetch';
import { getAll, getAllSync, getValue, setValue } from '../data/store';
import { CustomFieldDef, CustomFieldModule } from '../types';
import { downloadCsv } from '../utils';
import { Modal } from '../components/Modal';
import { AnalysisReport } from '../components/AnalysisReportView';

type DatasetKey = CustomFieldModule | 'tasks' | 'activities' | 'notifications';
type DataRow = Record<string, unknown>;

interface DatasetDefinition {
  key: DatasetKey;
  label: string;
  description: string;
  useCase: string;
  recommendedFields: string[];
}

interface DatasetField {
  key: string;
  label: string;
  type: string;
}

interface BridgeConfig {
  project_dir: string;
  analysis_script: string;
  python_executable: string;
  output_dir: string;
}

interface SavedDataset {
  name: string;
  kind: 'raw' | 'processed';
  file_name: string;
  dataset_path: string;
  rows: number;
  fields: string[];
  created_at: string;
  size_bytes: number;
}

interface HostedSavedDataset {
  id: string;
  artifact_id: number;
  run_id: number;
  name: string;
  category: DatasetKey;
  file_name: string;
  kind: 'processed';
  created_at: string;
  size_bytes: number;
}

type SavedDatasetFilter = 'all' | 'raw' | 'processed';

interface HostedAnalysisConfig {
  repository_url: string;
  ready: boolean;
}

interface HostedAnalysisJob {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  report?: AnalysisReport;
  error?: string;
  artifact_id?: number;
}

const BRIDGE_URL = 'http://127.0.0.1:8765';

const DATASETS: DatasetDefinition[] = [
  { key: 'leads', label: 'Leads', description: 'Prospects, acquisition sources, pipeline status, and estimated value.', useCase: 'Compare lead sources and explore conversion outcomes.', recommendedFields: ['name', 'company', 'status', 'source', 'value', 'createdAt'] },
  { key: 'contacts', label: 'Contacts', description: 'People, account links, job titles, and segmentation tags.', useCase: 'Explore account coverage and contact segments.', recommendedFields: ['name', 'title', 'accountId', 'tags', 'createdAt'] },
  { key: 'accounts', label: 'Accounts', description: 'Organizations, industries, employee counts, and revenue.', useCase: 'Compare account size and industry distributions.', recommendedFields: ['name', 'industry', 'employees', 'revenue', 'createdAt'] },
  { key: 'deals', label: 'Deals', description: 'Sales opportunities, pipeline stages, amounts, and close dates.', useCase: 'Study deal sizes, stages, and expected close timing.', recommendedFields: ['name', 'accountId', 'amount', 'stage', 'probability', 'closeDate'] },
  { key: 'products', label: 'Products', description: 'Catalog items, categories, prices, and active status.', useCase: 'Compare product categories and price distributions.', recommendedFields: ['name', 'category', 'price', 'active', 'createdAt'] },
  { key: 'campaigns', label: 'Campaigns', description: 'Marketing activities, channels, budgets, and date ranges.', useCase: 'Explore channel mix and campaign investment.', recommendedFields: ['name', 'channel', 'budget', 'status', 'startDate', 'endDate'] },
  { key: 'tickets', label: 'Tickets', description: 'Support requests, priorities, workflow states, and SLA dates.', useCase: 'Analyze support volume, priority, and resolution workflow.', recommendedFields: ['subject', 'requester', 'priority', 'status', 'slaDue', 'createdAt'] },
  { key: 'quotes', label: 'Quotes', description: 'Account-linked proposals, status, validity, and line items.', useCase: 'Inspect quote lifecycle and line-item structures.', recommendedFields: ['quoteNumber', 'accountId', 'dealId', 'status', 'validUntil', 'createdAt'] },
  { key: 'tasks', label: 'Tasks', description: 'Work items, due dates, completion, and priority.', useCase: 'Explore workload and completion patterns.', recommendedFields: ['title', 'dueDate', 'priority', 'completed', 'order'] },
  { key: 'activities', label: 'Activities', description: 'A seeded activity timeline with event text and timestamps.', useCase: 'Practice text exploration and time-based grouping.', recommendedFields: ['text', 'icon', 'when'] },
  { key: 'notifications', label: 'Notifications', description: 'In-app notification content, read state, and timestamps.', useCase: 'Explore event types and read-state distributions.', recommendedFields: ['text', 'read', 'when'] },
];

const FRIENDLY_LABELS: Record<string, string> = {
  id: 'Record ID', createdAt: 'Created at', updatedAt: 'Updated at', ownerId: 'Owner ID', accountId: 'Account ID',
  productId: 'Product ID', campaignId: 'Campaign ID', dealId: 'Deal ID', closeDate: 'Expected close', slaDue: 'SLA due',
  validUntil: 'Valid until', when: 'Occurred at', customFields: 'Custom fields',
};

function fieldType(values: unknown[], key: string): string {
  const value = values.find((item) => item !== null && item !== undefined && item !== '');
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'boolean') return 'Boolean';
  if (/(date|createdAt|updatedAt|when|slaDue)$/i.test(key) && typeof value === 'string' && !Number.isNaN(Date.parse(value))) return 'Date/time';
  return 'Text';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fieldValue(row: DataRow, fieldKey: string, customFields: CustomFieldDef[]): unknown {
  if (fieldKey.startsWith('custom:')) {
    const definition = customFields.find((item) => item.id === fieldKey.slice('custom:'.length));
    return definition ? (row.customFields as Record<string, unknown> | undefined)?.[definition.key] : undefined;
  }
  return row[fieldKey];
}

function datasetFileName(value: string): string {
  return value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').replace(/-+/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 64);
}

const ANALYSIS_STAGES = [
  'Create the named dataset file from the selected rows and fields',
  'Send the created dataset to GitHub Actions',
  'Run the Python analysis',
  'Save the cleaned dataset and report as an artifact',
  'Collect analysis results',
];

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function DataStudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('leads');
  const [datasetName, setDatasetName] = useState('leads');
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[] | null>(null);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [hostedAnalysisReady, setHostedAnalysisReady] = useState(false);
  const [hostedRepositoryUrl, setHostedRepositoryUrl] = useState('https://github.com/deven037/crm-data-science-lab');
  const [hostedConsent, setHostedConsent] = useState(false);
  const [bridgeWorking, setBridgeWorking] = useState(false);
  const [bridgeMessage, setBridgeMessage] = useState('');
  const [lastDatasetPath, setLastDatasetPath] = useState('');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runStage, setRunStage] = useState(-1);
  const [runStages, setRunStages] = useState<string[]>(ANALYSIS_STAGES);
  const [runError, setRunError] = useState('');
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [selectedDatasetPath, setSelectedDatasetPath] = useState(() => (location.state as { selectDatasetPath?: string } | null)?.selectDatasetPath ?? '');
  const [savedDatasetFilter, setSavedDatasetFilter] = useState<SavedDatasetFilter>('all');
  const [hostedSavedDatasets, setHostedSavedDatasets] = useState<HostedSavedDataset[]>([]);
  const [selectedHostedArtifactId, setSelectedHostedArtifactId] = useState('');
  const [savedCategoryFilter, setSavedCategoryFilter] = useState<DatasetKey | 'all'>('all');
  const [hostedDatasetError, setHostedDatasetError] = useState('');

  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>(() => getValue<BridgeConfig>('dataStudioBridge', {
    project_dir: '', analysis_script: 'analysis.py', python_executable: '', output_dir: 'outputs',
  }));

  const dataset = DATASETS.find((item) => item.key === datasetKey)!;
  const customFields = getAllSync<CustomFieldDef>('customFieldDefs').filter((item) => item.module === datasetKey);

  const refreshSavedDatasets = async () => {
    const response = await fetch(`${BRIDGE_URL}/api/datasets`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `Could not read saved datasets (${response.status}).`);
    const items = (body.datasets ?? []) as SavedDataset[];
    setSavedDatasets(items);
    return items;
  };

  const refreshHostedSavedDatasets = async () => {
    const result = await apiFetch<{ datasets: HostedSavedDataset[] }>('/analysis/datasets');
    const items = result.datasets ?? [];
    setHostedSavedDatasets(items);
    setHostedDatasetError('');
    return items;
  };

  const loadDataset = async (key: DatasetKey) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await getAll<DataRow>(key);
      setRows(result);
      setSelectedFields(null);
    } catch (error) {
      setRows([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to load this dataset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    setDatasetName(datasetKey);
    getAll<DataRow>(datasetKey)
      .then((result) => {
        if (!current) return;
        setRows(result);
        setSelectedFields(null);
      })
      .catch((error: unknown) => {
        if (!current) return;
        setRows([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load this dataset.');
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [datasetKey]);

  useEffect(() => {
    let current = true;
    fetch(`${BRIDGE_URL}/api/health`)
      .then((response) => response.json())
      .then(async (body: { ok?: boolean; ready?: boolean; config?: BridgeConfig }) => {
        if (!current) return;
        setBridgeOnline(Boolean(body.ok && body.ready));
        if (body.config) {
          setBridgeConfig(body.config);
          setValue('dataStudioBridge', body.config);
        }
        if (body.ok && body.ready) {
          const response = await fetch(`${BRIDGE_URL}/api/datasets`);
          const result = await response.json().catch(() => ({}));
          if (response.ok && current) {
            const items = (result.datasets ?? []) as SavedDataset[];
            setSavedDatasets(items);
            const requested = (location.state as { selectDatasetPath?: string } | null)?.selectDatasetPath;
            setSelectedDatasetPath((selected) => {
              if (requested && items.some((item) => item.dataset_path === requested)) return requested;
              return items.some((item) => item.dataset_path === selected) ? selected : (items[0]?.dataset_path ?? '');
            });
          }
        }
      })
      .catch(() => { if (current) setBridgeOnline(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    refreshHostedSavedDatasets().catch((error: unknown) => {
      if (current) setHostedDatasetError(error instanceof Error ? error.message : 'Could not load processed datasets from GitHub Actions.');
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    apiFetch<HostedAnalysisConfig>('/analysis/config')
      .then((config) => {
        setHostedAnalysisReady(config.ready);
        setHostedRepositoryUrl(config.repository_url);
      })
      .catch(() => setHostedAnalysisReady(false));
  }, []);

  const fields = useMemo<DatasetField[]>(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.entries(row).forEach(([key, value]) => {
      if (key === 'password' || key === 'avatar' || key === 'customFields' || (value !== null && typeof value === 'object' && !Array.isArray(value))) return;
      keys.add(key);
    }));
    const customDefinitions = getAllSync<CustomFieldDef>('customFieldDefs').filter((item) => item.module === datasetKey);
    const definitions = customDefinitions.map((item) => ({ key: `custom:${item.id}`, label: item.label, type: item.type === 'number' ? 'Number' : item.type === 'checkbox' ? 'Boolean' : item.type === 'date' ? 'Date/time' : 'Text' }));
    const standard = [...keys].map((key) => ({
      key,
      label: FRIENDLY_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()),
      type: fieldType(rows.map((row) => row[key]), key),
    }));
    return [...standard, ...definitions];
  }, [datasetKey, rows]);

  const effectiveFields = selectedFields ?? fields.filter((field) => dataset.recommendedFields.includes(field.key)).map((field) => field.key);
  const visibleSavedDatasets = savedDatasetFilter === 'all'
    ? savedDatasets
    : savedDatasets.filter((item) => item.kind === savedDatasetFilter);
  const visibleHostedSavedDatasets = savedCategoryFilter === 'all'
    ? hostedSavedDatasets
    : hostedSavedDatasets.filter((item) => item.category === savedCategoryFilter);

  useEffect(() => {
    if (visibleSavedDatasets.length > 0 && !visibleSavedDatasets.some((item) => item.dataset_path === selectedDatasetPath)) {
      setSelectedDatasetPath(visibleSavedDatasets[0].dataset_path);
    }
  }, [selectedDatasetPath, visibleSavedDatasets]);

  useEffect(() => {
    if (selectedHostedArtifactId && !visibleHostedSavedDatasets.some((item) => String(item.artifact_id) === selectedHostedArtifactId)) {
      setSelectedHostedArtifactId('');
    }
  }, [selectedHostedArtifactId, visibleHostedSavedDatasets]);

  useEffect(() => setHostedConsent(false), [datasetKey, datasetName, query, selectedFields]);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => fields.some((field) => displayValue(fieldValue(row, field.key, customFields)).toLowerCase().includes(term)));
  }, [customFields, fields, query, rows]);

  const missingCells = filteredRows.reduce((count, row) => count + effectiveFields.filter((key) => {
    const value = fieldValue(row, key, customFields);
    return value === null || value === undefined || value === '';
  }).length, 0);
  const repeatedCombinations = effectiveFields.length === 0 ? 0 : filteredRows.length - new Set(filteredRows.map((row) => JSON.stringify(effectiveFields.map((key) => fieldValue(row, key, customFields) ?? null)))).size;
  const previewRows = filteredRows.slice(0, 12);

  const toggleField = (key: string) => {
    const current = effectiveFields;
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    setSelectedFields(next);
  };

  const exportDataset = () => {
    const exportFields = fields.filter((field) => effectiveFields.includes(field.key));
    downloadCsv(`${datasetFileName(datasetName) || datasetKey}.csv`, [
      exportFields.map((field) => field.label),
      ...filteredRows.map((row) => exportFields.map((field) => {
        const value = fieldValue(row, field.key, customFields);
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
      })),
    ]);
  };

  const saveProjectDataset = async () => {
    if (effectiveFields.length === 0) throw new Error('Select at least one field before saving a dataset.');
    const name = datasetFileName(datasetName);
    if (!name) throw new Error('Enter a dataset name using letters, numbers, spaces, hyphens, or underscores.');
    const selected = fields.filter((field) => effectiveFields.includes(field.key));
    const response = await fetch(`${BRIDGE_URL}/api/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset: name,
        fields: selected.map((field) => field.label),
        rows: filteredRows.map((row) => selected.map((field) => {
          const value = fieldValue(row, field.key, customFields);
          return value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        })),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `Dataset save failed (${response.status}).`);
    const savedPath = String(body.dataset_path);
    setLastDatasetPath(savedPath);
    setSelectedDatasetPath(savedPath);
    await refreshSavedDatasets();
    return savedPath;
  };

  const saveToProject = async () => {
    setBridgeWorking(true);
    setBridgeMessage('');
    try {
      const path = await saveProjectDataset();
      setBridgeMessage(`Saved ${filteredRows.length.toLocaleString()} rows to ${path}`);
    } catch (error) {
      setBridgeMessage(error instanceof Error ? error.message : 'Could not save the dataset to your project.');
    } finally {
      setBridgeWorking(false);
    }
  };

  const getAnalysis = async () => {
    const selectedHostedDataset = hostedSavedDatasets.find((item) => String(item.artifact_id) === selectedHostedArtifactId);
    const useHostedPipeline = Boolean(selectedHostedDataset) || !bridgeOnline;
    const runName = selectedHostedDataset?.name || datasetFileName(datasetName) || datasetKey;
    setRunStages(selectedHostedDataset ? [
      `Load ${selectedHostedDataset.file_name} from the saved artifacts`,
      'Send the selected processed dataset to GitHub Actions',
      'Run the Python analysis',
      'Return the analysis report without saving another dataset',
      'Collect analysis results',
    ] : useHostedPipeline ? [
      `Create ${runName || datasetKey}.csv from the selected rows and fields`,
      'Send the created dataset to GitHub Actions',
      'Run the Python analysis',
      `Save ${runName || datasetKey}-cleaned.csv and its report as an artifact`,
      'Collect analysis results',
    ] : [
      'Check the local Python bridge',
      'Load the selected saved dataset',
      'Run the Python analysis',
      'Collect the cleaned dataset and charts',
      'Show analysis results',
    ]);
    if (useHostedPipeline && !hostedAnalysisReady) {
      setRunError('The hosted analysis pipeline is not configured yet. Contact the CRM administrator.');
      setRunStage(-1);
      setRunDialogOpen(true);
      return;
    }
    if (useHostedPipeline && !selectedHostedDataset && !hostedConsent) {
      setRunError('Confirm that you want to send this selected dataset to the hosted GitHub Actions runner.');
      setRunStage(-1);
      setRunDialogOpen(true);
      return;
    }
    if (!useHostedPipeline && !selectedDatasetPath) {
      setRunError('Save a dataset first, then select it from your project dataset library.');
      setRunStage(-1);
      setRunDialogOpen(true);
      return;
    }
    const startedAt = Date.now();
    setBridgeWorking(true);
    setBridgeMessage('');
    setRunError('');
    setRunStage(0);
    setRunDialogOpen(true);
    try {
      await nextPaint();
      await wait(250);
      if (useHostedPipeline) {
        const name = selectedHostedDataset?.name ?? datasetFileName(datasetName);
        if (!name) throw new Error('Enter a dataset name using letters, numbers, spaces, hyphens, or underscores.');
        const selected = selectedHostedDataset ? [] : fields.filter((field) => effectiveFields.includes(field.key));
        if (!selectedHostedDataset && (selected.length === 0 || filteredRows.length === 0)) throw new Error('Select at least one field and one matching record.');
        setRunStage(1);
        const created = await apiFetch<{ id: string }>('/analysis/jobs', {
          method: 'POST',
          body: JSON.stringify(selectedHostedDataset ? {
            name,
            category: selectedHostedDataset.category,
            source_artifact_id: selectedHostedDataset.artifact_id,
          } : {
            name,
            category: datasetKey,
            fields: selected.map((field) => field.label),
            rows: filteredRows.map((row) => selected.map((field) => {
              const value = fieldValue(row, field.key, customFields);
              if (value === undefined) return null;
              return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
            })),
          }),
        });
        setRunStage(2);
        const deadline = Date.now() + 5 * 60 * 1000;
        let completed: HostedAnalysisJob | undefined;
        while (Date.now() < deadline) {
          await wait(2000);
          const job = await apiFetch<HostedAnalysisJob>(`/analysis/jobs/${encodeURIComponent(created.id)}`);
          if (job.status === 'failed') throw new Error(job.error ?? 'The GitHub Actions workflow failed.');
          if (job.status === 'complete') {
            completed = job;
            break;
          }
        }
        if (!completed?.report) throw new Error('The hosted analysis did not return results within five minutes.');
        const report = completed.report;
        setRunStage(3);
        let updatedHostedDatasets = hostedSavedDatasets;
        try {
          updatedHostedDatasets = await refreshHostedSavedDatasets();
        } catch (error) {
          setHostedDatasetError(error instanceof Error ? error.message : 'Analysis finished, but the saved dataset list could not be refreshed.');
        }
        const savedArtifact = updatedHostedDatasets.find((item) => item.artifact_id === completed.artifact_id);
        if (selectedHostedDataset) {
          setSelectedHostedArtifactId(String(selectedHostedDataset.artifact_id));
          setLastDatasetPath(`${selectedHostedDataset.category} · ${selectedHostedDataset.file_name}`);
        } else {
          if (savedArtifact) setSelectedHostedArtifactId(String(savedArtifact.artifact_id));
          setLastDatasetPath(savedArtifact ? `${savedArtifact.category} · ${savedArtifact.file_name}` : `GitHub Actions · ${name}-cleaned.csv`);
        }
        await wait(Math.max(0, 1400 - (Date.now() - startedAt)));
        setRunStage(4);
        await wait(250);
        navigate('/data-studio/analysis', {
          state: {
            report,
          datasetPath: savedArtifact ? `GitHub Actions · ${savedArtifact.file_name}` : `GitHub Actions · ${hostedRepositoryUrl}`,
            datasetName: name,
            completedAt: new Date().toISOString(),
          },
        });
        setRunDialogOpen(false);
        return;
      }
      const healthResponse = await fetch(`${BRIDGE_URL}/api/health`);
      const health = await healthResponse.json().catch(() => ({}));
      if (!healthResponse.ok || !health.ok || !health.ready) throw new Error('Python project bridge is not ready. Check the connection and project folder in Settings.');
      setRunStage(1);
      const availableDatasets = await refreshSavedDatasets();
      const selectedDataset = availableDatasets.find((item) => item.dataset_path === selectedDatasetPath);
      if (!selectedDataset) throw new Error('That saved dataset is no longer available. Refresh the project dataset library and select another file.');
      setRunStage(2);
      await wait(250);
      const response = await fetch(`${BRIDGE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_path: selectedDataset.dataset_path }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Analysis failed (${response.status}).${body.stderr ? ` ${body.stderr}` : ''}`);
      }
      const report = body.report as AnalysisReport;
      setRunStage(3);
      setLastDatasetPath(String(body.dataset_path ?? selectedDataset.dataset_path));
      const updatedLibrary = await refreshSavedDatasets();
      if (report.processed_dataset && updatedLibrary.some((item) => item.dataset_path === report.processed_dataset)) {
        setSelectedDatasetPath(report.processed_dataset);
      }
      await wait(Math.max(0, 1400 - (Date.now() - startedAt)));
      setRunStage(4);
      await wait(250);
      navigate('/data-studio/analysis', {
        state: {
          report,
          datasetPath: String(body.dataset_path ?? selectedDataset.dataset_path),
          datasetName: selectedDataset.name,
          completedAt: new Date().toISOString(),
        },
      });
      setRunDialogOpen(false);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Could not run your Python analysis.');
    } finally {
      setBridgeWorking(false);
    }
  };

  return (
    <div className="data-studio" data-testid="data-studio-page">
      <div className="page-header data-studio-header">
        <div>
          <span className="data-studio-eyebrow">CRM DATA WORKSPACE</span>
          <h1>Data Studio</h1>
          <p className="page-subtitle">{bridgeOnline ? 'Explore CRM datasets and take a clean extract into your local Python project.' : 'Explore CRM data and send a selected extract to the hosted analysis pipeline.'}</p>
        </div>
        <span className="data-studio-live"><span /> Live CRM data</span>
      </div>

      <div className="data-studio-layout">
        <aside className="data-studio-catalog" aria-label="Dataset catalog">
          <div className="data-studio-section-head">
            <div><span className="data-studio-kicker">CATALOG</span><h2>Datasets</h2></div>
            <span className="data-studio-count">{DATASETS.length}</span>
          </div>
          <div className="data-studio-dataset-list">
            {DATASETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`data-studio-dataset${datasetKey === item.key ? ' active' : ''}`}
                aria-pressed={datasetKey === item.key}
                onClick={() => setDatasetKey(item.key)}
              >
                <span className="data-studio-dataset-name">{item.label}</span>
                <span className="data-studio-dataset-meta">{item.key}</span>
              </button>
            ))}
          </div>
          <div className="data-studio-note">
            <strong>Practice data</strong>
            <span>Seed data is repeatable. Use Settings → Reset all data to restore its baseline.</span>
          </div>
        </aside>

        <section className="data-studio-main">
          <div className="data-studio-title-row">
            <div>
              <span className="data-studio-kicker">DATASET / {dataset.key.toUpperCase()}</span>
              <h2>{dataset.label}</h2>
              <p>{dataset.description}</p>
            </div>
            <div className="data-studio-actions">
              <button type="button" className="btn" onClick={() => loadDataset(datasetKey)} disabled={loading} aria-label="Refresh dataset">
                <RefreshCw size={15} /> Refresh
              </button>
              <button type="button" className="btn btn-primary" onClick={exportDataset} disabled={loading || filteredRows.length === 0 || effectiveFields.length === 0}>
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          <div className="data-studio-metrics">
            <div><span>Records</span><strong>{loading ? '—' : filteredRows.length.toLocaleString()}</strong><small>{query ? `of ${rows.length.toLocaleString()} total` : 'in current view'}</small></div>
            <div><span>Available fields</span><strong>{loading ? '—' : fields.length}</strong><small>including configured custom fields</small></div>
            <div><span>Missing selected values</span><strong>{loading ? '—' : missingCells.toLocaleString()}</strong><small>across {effectiveFields.length} selected fields</small></div>
            <div><span>Repeated combinations</span><strong>{loading ? '—' : repeatedCombinations.toLocaleString()}</strong><small>based on selected fields</small></div>
          </div>

          <div className="data-studio-workspace">
            <section className="data-studio-fields" aria-labelledby="field-picker-title">
              <div className="data-studio-section-head">
                <div><span className="data-studio-kicker">EXTRACT</span><h3 id="field-picker-title">Choose fields</h3></div>
                <button type="button" className="link-btn" onClick={() => setSelectedFields(fields.map((field) => field.key))}>Select all</button>
              </div>
              <p className="muted">Pick the columns for your analysis. Custom fields follow your current CRM setup.</p>
              <div className="data-studio-selection-count">{effectiveFields.length} of {fields.length} fields selected</div>
              <div className="data-studio-field-list">
                {fields.map((field) => (
                  <label className="data-studio-field" key={field.key}>
                    <input type="checkbox" checked={effectiveFields.includes(field.key)} onChange={() => toggleField(field.key)} />
                    <span className="data-studio-field-label">{field.label}</span>
                    <code>{field.type}</code>
                  </label>
                ))}
                {!loading && fields.length === 0 && <p className="muted">No fields found.</p>}
              </div>
              <button type="button" className="link-btn data-studio-reset-fields" onClick={() => setSelectedFields(null)}>Use recommended fields</button>
            </section>

            <section className="data-studio-preview" aria-labelledby="preview-title">
              <div className="data-studio-preview-head">
                <div><span className="data-studio-kicker">INSPECT</span><h3 id="preview-title">Data preview</h3></div>
                <label className="data-studio-search">
                  <Search size={15} />
                  <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dataset values" aria-label="Search dataset values" />
                </label>
              </div>
              <div className="data-studio-usecase"><strong>Practice prompt</strong><span>{dataset.useCase}</span></div>
              {loadError && <div className="banner banner-error">{loadError}</div>}
              {loading ? (
                <div className="empty-cell">Loading {dataset.label.toLowerCase()}…</div>
              ) : previewRows.length === 0 ? (
                <div className="empty-cell">No records match this search.</div>
              ) : effectiveFields.length === 0 ? (
                <div className="data-studio-no-fields"><strong>Choose at least one field</strong><span>Select columns on the left to build your preview and export.</span></div>
              ) : (
                <>
                  <div className="table-wrap data-studio-table-wrap">
                    <table className="table data-studio-table">
                      <thead><tr>{fields.filter((field) => effectiveFields.includes(field.key)).map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead>
                      <tbody>
                        {previewRows.map((row, index) => (
                          <tr key={String(row.id ?? index)}>{fields.filter((field) => effectiveFields.includes(field.key)).map((field) => (
                            <td key={field.key} title={displayValue(fieldValue(row, field.key, customFields))}>{displayValue(fieldValue(row, field.key, customFields))}</td>
                          ))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="data-studio-preview-footer">Showing {previewRows.length} of {filteredRows.length.toLocaleString()} matching records · export includes every match</div>
                </>
              )}
            </section>
          </div>

          <div className="data-studio-save-options">
            <label className="field" htmlFor="dataset-project-name">
              <span className="field-label">Dataset name for your project</span>
              <input id="dataset-project-name" className="input" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} placeholder="e.g. qualified-leads-october" maxLength={64} />
            </label>
            <span className="field-hint">The bridge adds a timestamp automatically, so each saved version remains unique.</span>
          </div>
          <section className="data-studio-library" aria-labelledby="saved-datasets-title">
            <div className="data-studio-library-heading">
              <div><span className="data-studio-kicker">PROJECT FILES</span><h3 id="saved-datasets-title">Saved datasets</h3></div>
              <button type="button" className="btn btn-small" disabled={!bridgeOnline || bridgeWorking} onClick={() => refreshSavedDatasets().catch((error: unknown) => setBridgeMessage(error instanceof Error ? error.message : 'Could not refresh datasets.'))}><RefreshCw size={13} /> Refresh list</button>
            </div>
            {savedDatasets.length > 0 ? (
              <>
                <label className="field data-studio-kind-filter" htmlFor="saved-dataset-kind">
                  <span className="field-label">Dataset type</span>
                  <select id="saved-dataset-kind" className="input" value={savedDatasetFilter} onChange={(event) => setSavedDatasetFilter(event.target.value as SavedDatasetFilter)}>
                    <option value="all">All datasets</option>
                    <option value="raw">Raw datasets</option>
                    <option value="processed">Cleaned datasets</option>
                  </select>
                </label>
                <label className="field" htmlFor="saved-project-dataset">
                  <span className="field-label">Choose a saved dataset to analyze</span>
                  <select id="saved-project-dataset" className="input" value={selectedDatasetPath} onChange={(event) => setSelectedDatasetPath(event.target.value)}>
                    {visibleSavedDatasets.map((item) => <option key={item.dataset_path} value={item.dataset_path}>{item.kind === 'processed' ? 'Cleaned' : 'Raw'} · {item.name} · {item.rows.toLocaleString()} rows · {new Date(item.created_at).toLocaleString()}</option>)}
                  </select>
                </label>
                {visibleSavedDatasets.find((item) => item.dataset_path === selectedDatasetPath) && (
                  <div className="data-studio-library-meta">
                    <span><strong>Type</strong> {visibleSavedDatasets.find((item) => item.dataset_path === selectedDatasetPath)!.kind === 'processed' ? 'Cleaned' : 'Raw'}</span>
                    <span><strong>File</strong> <code>{visibleSavedDatasets.find((item) => item.dataset_path === selectedDatasetPath)!.dataset_path}</code></span>
                    <span><strong>Fields</strong> {visibleSavedDatasets.find((item) => item.dataset_path === selectedDatasetPath)!.fields.join(', ')}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="muted data-studio-library-empty">{bridgeOnline ? <>No local datasets in this project yet. Build a selection above, name it, then choose <strong>Save dataset</strong>.</> : 'Local project files require the Python bridge. Hosted processed datasets are listed below.'}</p>
            )}
          </section>
          <section className="data-studio-library" aria-labelledby="hosted-saved-datasets-title">
            <div className="data-studio-library-heading">
              <div><span className="data-studio-kicker">GITHUB ACTIONS · MAX 10</span><h3 id="hosted-saved-datasets-title">Processed datasets</h3></div>
              <button type="button" className="btn btn-small" disabled={bridgeWorking} onClick={() => refreshHostedSavedDatasets().catch((error: unknown) => setHostedDatasetError(error instanceof Error ? error.message : 'Could not refresh processed datasets.'))}><RefreshCw size={13} /> Refresh list</button>
            </div>
            <label className="field data-studio-kind-filter" htmlFor="hosted-saved-dataset-category">
              <span className="field-label">Filter by CRM category</span>
              <select id="hosted-saved-dataset-category" className="input" value={savedCategoryFilter} onChange={(event) => setSavedCategoryFilter(event.target.value as DatasetKey | 'all')}>
                <option value="all">All categories</option>
                {DATASETS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            {visibleHostedSavedDatasets.length > 0 ? (
              <>
                <label className="field" htmlFor="hosted-saved-dataset">
                  <span className="field-label">Choose a processed dataset to analyze</span>
                  <select id="hosted-saved-dataset" className="input" value={selectedHostedArtifactId} onChange={(event) => setSelectedHostedArtifactId(event.target.value)}>
                    <option value="">Choose a saved processed dataset</option>
                    {visibleHostedSavedDatasets.map((item) => <option key={item.artifact_id} value={item.artifact_id}>{DATASETS.find((definition) => definition.key === item.category)?.label ?? item.category} · {item.file_name} · {new Date(item.created_at).toLocaleString()}</option>)}
                  </select>
                </label>
                {visibleHostedSavedDatasets.find((item) => String(item.artifact_id) === selectedHostedArtifactId) && (() => {
                  const selected = visibleHostedSavedDatasets.find((item) => String(item.artifact_id) === selectedHostedArtifactId)!;
                  return <div className="data-studio-library-meta">
                    <span><strong>Category</strong> {DATASETS.find((definition) => definition.key === selected.category)?.label ?? selected.category}</span>
                    <span><strong>File</strong> <code>{selected.file_name}</code></span>
                    <span><strong>Stored</strong> {new Date(selected.created_at).toLocaleString()}</span>
                  </div>;
                })()}
              </>
            ) : (
              <p className="muted data-studio-library-empty">{hostedDatasetError || (hostedSavedDatasets.length === 0 ? 'No processed datasets saved yet. Run an analysis to create one.' : 'No processed datasets in this category.')}</p>
            )}
          </section>
          <div className="data-studio-handoff">
            <div className="data-studio-handoff-mark">PY</div>
            <div><strong>{selectedHostedArtifactId ? 'Analyze a processed dataset' : bridgeOnline ? 'Analyze a saved dataset' : 'Analyze the current selection'}</strong><p>{selectedHostedArtifactId ? `The selected processed file will be analyzed again. Its existing saved copy will be reused, so this run will not create another saved dataset. ${hostedSavedDatasets.length} of 10 saved slots are in use.` : bridgeOnline ? `Connected to ${bridgeConfig.project_dir}. Saved CSVs remain in data/raw for later runs.` : hostedAnalysisReady ? `The named dataset and its cleaned result will be saved in GitHub Actions from ${hostedRepositoryUrl}.` : 'Start the local bridge or configure the hosted analysis pipeline in Settings.'}</p></div>
            <div className="data-studio-python-actions">
              <button type="button" className="btn" onClick={saveToProject} disabled={!bridgeOnline || bridgeWorking || loading || filteredRows.length === 0 || effectiveFields.length === 0 || !datasetFileName(datasetName)}><FolderDown size={15} /> Save dataset</button>
              <button type="button" className="btn btn-primary" onClick={getAnalysis} disabled={bridgeWorking || (selectedHostedArtifactId ? !hostedAnalysisReady : bridgeOnline ? !selectedDatasetPath : (!hostedAnalysisReady || !hostedConsent || loading || filteredRows.length === 0 || effectiveFields.length === 0))}><Play size={14} /> Get Analysis</button>
              <Link to="/settings" className="data-studio-settings-link">Settings</Link>
            </div>
          </div>
          {!bridgeOnline && hostedAnalysisReady && (
            <div className="banner banner-info data-studio-hosted-consent" data-testid="hosted-analysis-consent">
              <label className="checkbox-label">
                <input type="checkbox" checked={hostedConsent} onChange={(event) => setHostedConsent(event.target.checked)} />
                Create the file <strong>{datasetFileName(datasetName) || datasetKey}.csv</strong> and run the analysis.
              </label>
            </div>
          )}
          {!bridgeOnline && !hostedAnalysisReady && (
            <div className="banner banner-info">The hosted analysis pipeline is not configured yet. The repository URL and setup status are available in Settings.</div>
          )}
          {bridgeMessage && <div className="banner banner-info" role="status">{bridgeMessage}</div>}
          {lastDatasetPath && <div className="data-studio-saved-path">Last dataset: <code>{lastDatasetPath}</code></div>}
        </section>
      </div>
      {runDialogOpen && (
        <Modal title={runError ? 'Analysis needs attention' : 'Running Python analysis'} onClose={() => { if (!bridgeWorking) setRunDialogOpen(false); }}>
          <div className="analysis-progress-dialog" aria-live="polite">
            <div className={`analysis-progress-orb${runError ? ' has-error' : ''}`}>
              {runError ? <span>!</span> : bridgeWorking ? <LoaderCircle size={24} className="analysis-progress-spinner" /> : <Check size={24} />}
            </div>
            <p className="analysis-progress-lead">{runError ? 'The analysis did not finish.' : 'Preparing your dataset and running the configured project script.'}</p>
            <ol className="analysis-progress-steps">
              {runStages.map((stage, index) => (
                <li key={stage} className={index < runStage ? 'complete' : index === runStage && !runError ? 'current' : ''}>
                  <span className="analysis-step-icon">{index < runStage ? <Check size={13} /> : index === runStage && !runError ? <LoaderCircle size={13} className="analysis-progress-spinner" /> : index + 1}</span>
                  <span>{stage}</span>
                  {index < runStage && <small>Complete</small>}
                </li>
              ))}
            </ol>
            {runError && <div className="banner banner-error analysis-progress-error">{runError}</div>}
            {runError && <div className="analysis-progress-footer"><button type="button" className="btn" onClick={() => setRunDialogOpen(false)}>Close</button><button type="button" className="btn btn-primary" onClick={getAnalysis}>Try again</button></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
