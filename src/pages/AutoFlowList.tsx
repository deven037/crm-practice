import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAll, getAllSync, removeMany } from '../data/store';
import { AutoFlowProcess, Product } from '../types';
import { TemplateGallery } from '../components/TemplateGallery';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

export function AutoFlowList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<AutoFlowProcess[]>([]);

  const load = async () => {
    setLoading(true);
    setProcesses(await getAll<AutoFlowProcess>('autoFlowProcesses'));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const products = getAllSync<Product>('products');
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? '—';

  const remove = async (process: AutoFlowProcess) => {
    if (process.status === 'published') {
      toast.push('error', 'A published process cannot be deleted — unpublish it first.');
      return;
    }
    if (!window.confirm(`Delete AutoFlow process "${process.name}"?`)) return;
    await removeMany('autoFlowProcesses', [process.id]);
    toast.push('success', `AutoFlow process "${process.name}" deleted.`);
    load();
  };

  return (
    <div data-testid="autoflow-list-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>AutoFlow</span>
      </nav>
      <div className="page-header">
        <h1>AutoFlow</h1>
      </div>
      <p className="muted">
        Visual, canvas-based processes tied to a product. Once published, a process can be used to drive record
        creation in its target module.
      </p>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <TemplateGallery
          items={processes.map((p) => ({
            id: p.id,
            name: p.name,
            meta: `${productName(p.productId)} · ${p.targetModule} · ${p.status}`,
            onClick: () => navigate(`/setup/autoflow/${p.id}`),
            rows: readOnly || p.status === 'published' ? [] : [{ label: 'Delete', onClick: () => remove(p) }],
          }))}
          createLabel="New Process"
          createHint="Design a visual process flow for a product."
          onCreate={() => !readOnly && navigate('/setup/autoflow/new')}
        />
      )}
    </div>
  );
}
