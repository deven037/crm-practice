import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud } from 'lucide-react';
import { newId, upsert } from '../data/store';
import { Account, Contact, Lead, Product } from '../types';
import { Select } from '../components/Select';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

type ImportModule = 'leads' | 'contacts' | 'accounts' | 'products';

interface TargetField {
  key: string;
  label: string;
  required?: boolean;
}

const MODULE_OPTIONS: { value: ImportModule; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'products', label: 'Products' },
];

const TARGET_FIELDS: Record<ImportModule, TargetField[]> = {
  leads: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone' },
    { key: 'company', label: 'Company' },
    { key: 'source', label: 'Source' },
    { key: 'value', label: 'Value ($)' },
  ],
  contacts: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone' },
    { key: 'title', label: 'Job title' },
  ],
  accounts: [
    { key: 'name', label: 'Name', required: true },
    { key: 'industry', label: 'Industry' },
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website' },
  ],
  products: [
    { key: 'name', label: 'Name', required: true },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'description', label: 'Description' },
  ],
};

// No library — a lightweight CSV split (no quoted-comma support) is enough for a
// training/demo import; production CSV parsing would need a real parser.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim()));
}

function buildRecord(module: ImportModule, row: Record<string, string>, ownerId: string): Lead | Contact | Account | Product {
  const now = new Date().toISOString();
  switch (module) {
    case 'leads':
      return {
        id: newId('lead'),
        name: row.name ?? '',
        company: row.company ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        status: 'New',
        source: row.source || 'Web',
        ownerId,
        value: Number(row.value) || 0,
        createdAt: now,
      } as Lead;
    case 'contacts':
      return {
        id: newId('contact'),
        name: row.name ?? '',
        email: row.email ?? '',
        phone: row.phone ?? '',
        accountId: null,
        title: row.title ?? '',
        tags: ['imported'],
        avatar: null,
        notes: [],
        files: [],
        createdAt: now,
      } as Contact;
    case 'accounts':
      return {
        id: newId('account'),
        name: row.name ?? '',
        industry: row.industry ?? '',
        employees: 0,
        revenue: 0,
        website: row.website ?? '',
        phone: row.phone ?? '',
        ownerId,
        createdAt: now,
      } as Account;
    case 'products':
      return {
        id: newId('product'),
        name: row.name ?? '',
        sku: '',
        category: row.category || 'Subscription',
        price: Number(row.price) || 0,
        description: row.description ?? '',
        active: true,
        createdAt: now,
      } as Product;
  }
}

export function ImportData() {
  const toast = useToast();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [module, setModule] = useState<ImportModule>('leads');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const onFile = (file: File) => {
    setFileName(file.name);
    setImported(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''));
      const [head, ...body] = parsed;
      setHeaders(head ?? []);
      setRows(body);
      // Best-effort auto-map: a CSV column named exactly like a target field maps itself.
      const auto: Record<string, string> = {};
      (head ?? []).forEach((h) => {
        const match = TARGET_FIELDS[module].find((f) => f.key === h.toLowerCase());
        if (match) auto[h] = match.key;
      });
      setMapping(auto);
    };
    reader.readAsText(file);
  };

  const requiredMapped = TARGET_FIELDS[module]
    .filter((f) => f.required)
    .every((f) => Object.values(mapping).includes(f.key));

  const runImport = async () => {
    setImporting(true);
    let count = 0;
    for (const row of rows) {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        const target = mapping[h];
        if (target) record[target] = row[i] ?? '';
      });
      if (!record.name?.trim()) continue; // skip blank rows
      await upsert(module, buildRecord(module, record, user?.id ?? 'user-2'));
      count++;
    }
    setImporting(false);
    setImported(count);
    toast.push('success', `Imported ${count} ${module}.`);
  };

  const reset = () => {
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImported(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div data-testid="import-data-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Import Data</span>
      </nav>
      <div className="page-header">
        <h1>Import Data</h1>
      </div>
      <p className="muted">Upload a CSV, map its columns to fields, then bulk-create records.</p>

      <div className="card form-card">
        <div className="field">
          <span className="field-label">Module</span>
          <Select
            value={module}
            options={MODULE_OPTIONS}
            onChange={(v) => {
              setModule(v as ImportModule);
              reset();
            }}
            testId="import-module"
          />
        </div>

        <div className="field">
          <span className="field-label">CSV file</span>
          <button className="btn" data-testid="import-file-btn" onClick={() => fileInput.current?.click()}>
            <UploadCloud size={14} /> {fileName || 'Choose CSV file…'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            hidden
            data-testid="import-file-input"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        {headers.length > 0 && (
          <>
            <h3>Column mapping</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>CSV column</th>
                    <th>Maps to</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h) => (
                    <tr key={h}>
                      <td>
                        <code>{h}</code>
                      </td>
                      <td>
                        <Select
                          value={mapping[h] ?? ''}
                          options={[
                            { value: '', label: '(skip)' },
                            ...TARGET_FIELDS[module].map((f) => ({ value: f.key, label: f.label + (f.required ? ' *' : '') })),
                          ]}
                          onChange={(v) => setMapping({ ...mapping, [h]: v })}
                          testId={`import-map-${h}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="muted">{rows.length} row(s) ready to import.</p>
            {!requiredMapped && <div className="banner banner-error">Map every required (*) field before importing.</div>}

            <div className="form-actions">
              <button className="btn" onClick={reset}>
                Start over
              </button>
              <button
                className="btn btn-primary"
                data-testid="import-run-btn"
                disabled={!requiredMapped || importing || rows.length === 0}
                onClick={runImport}
              >
                {importing ? 'Importing…' : `Import ${rows.length} record(s)`}
              </button>
            </div>

            {imported !== null && (
              <div className="banner banner-info" data-testid="import-result">
                Imported {imported} of {rows.length} row(s).
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
