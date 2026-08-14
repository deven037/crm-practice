import { Link } from 'react-router-dom';
import { Building2, DollarSign, Megaphone, Package, Receipt, Target, Ticket, User as UserIcon, type LucideIcon } from 'lucide-react';
import { getAllSync } from '../data/store';
import { CustomFieldDef, CUSTOM_FIELD_MODULES, CustomFieldModule } from '../types';

const OBJECT_MODULE_LABELS: Record<CustomFieldModule, { label: string; icon: LucideIcon }> = {
  leads: { label: 'Leads', icon: Target },
  contacts: { label: 'Contacts', icon: UserIcon },
  accounts: { label: 'Accounts', icon: Building2 },
  deals: { label: 'Deals', icon: DollarSign },
  products: { label: 'Products', icon: Package },
  tickets: { label: 'Tickets', icon: Ticket },
  campaigns: { label: 'Campaigns', icon: Megaphone },
  quotes: { label: 'Quotes', icon: Receipt },
};

export function CustomFieldsHub() {
  return (
    <div data-testid="custom-fields-hub-page">
      <nav className="breadcrumbs">
        <Link to="/setup">Setup</Link> <span>/</span> <span>Custom Fields</span>
      </nav>
      <div className="page-header">
        <h1>Custom Fields</h1>
      </div>
      <p className="muted">
        Define custom fields per module and design where they appear on each module's Form (New + Edit) and Detail
        pages.
      </p>
      <div className="object-config-grid">
        {CUSTOM_FIELD_MODULES.map((m) => {
          const count = getAllSync<CustomFieldDef>('customFieldDefs').filter((d) => d.module === m).length;
          const meta = OBJECT_MODULE_LABELS[m];
          return (
            <Link key={m} to={`/admin/objects/${m}`} className="object-config-card" data-testid={`object-config-${m}`}>
              <span className="object-config-icon">
                <meta.icon size={22} />
              </span>
              <span className="object-config-name">{meta.label}</span>
              <span className="muted">
                {count} custom field{count === 1 ? '' : 's'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
