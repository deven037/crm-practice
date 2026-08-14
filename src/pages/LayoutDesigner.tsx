import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAll, removeMany } from '../data/store';
import { CustomFieldModule, CUSTOM_FIELD_MODULES, PageLayout } from '../types';
import { TemplateGallery } from '../components/TemplateGallery';
import { SkeletonRows } from '../components/Spinner';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

const MODULE_LABELS: Record<CustomFieldModule, string> = {
  leads: 'Leads',
  contacts: 'Contacts',
  accounts: 'Accounts',
  deals: 'Deals',
  products: 'Products',
  tickets: 'Tickets',
  campaigns: 'Campaigns',
  quotes: 'Quotes',
};

export function LayoutDesigner() {
  const { module } = useParams<{ module: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';

  const isValidModule = (CUSTOM_FIELD_MODULES as readonly string[]).includes(module ?? '');
  const mod = (module ?? '') as CustomFieldModule;

  const [loading, setLoading] = useState(true);
  const [layouts, setLayouts] = useState<PageLayout[]>([]);

  const load = async () => {
    const all = await getAll<PageLayout>('pageLayouts');
    setLayouts(all.filter((l) => l.module === mod));
    setLoading(false);
  };

  useEffect(() => {
    if (isValidModule) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  if (!isValidModule) {
    return (
      <div className="empty-cell">
        Unknown module. <Link to="/setup">Back to Setup</Link>
      </div>
    );
  }

  const remove = async (layout: PageLayout) => {
    if (layout.isDefault) return;
    if (!window.confirm(`Delete layout "${layout.name}"?`)) return;
    await removeMany('pageLayouts', [layout.id]);
    toast.push('success', `Layout "${layout.name}" deleted.`);
    load();
  };

  return (
    <div data-testid="layout-designer-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>{MODULE_LABELS[mod]} — Page Layouts</span>
      </nav>
      <div className="page-header">
        <h1>{MODULE_LABELS[mod]} — Page Layouts</h1>
      </div>
      <p className="muted">
        Every module starts with a Default layout. Create a new one to arrange system and custom fields into your own
        tabs.
      </p>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <TemplateGallery
          items={layouts.map((l) => ({
            id: l.id,
            name: l.name,
            meta: `${l.tabs.length} tab(s)${l.isDefault ? ' · Default' : ''}`,
            onClick: () => navigate(`/setup/layouts/${mod}/${l.id}`),
            rows: readOnly || l.isDefault ? [] : [{ label: 'Delete', onClick: () => remove(l) }],
          }))}
          createLabel="New Layout"
          createHint="Arrange fields into tabs for a fresh layout."
          onCreate={() => !readOnly && navigate(`/setup/layouts/${mod}/new`)}
        />
      )}
    </div>
  );
}
