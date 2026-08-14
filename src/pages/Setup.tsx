import { Link } from 'react-router-dom';
import { History, Package, ShieldCheck, UploadCloud, Users as UsersIcon, Workflow } from 'lucide-react';
import { getAllSync } from '../data/store';
import { AutoFlowProcess, RoleDef, User } from '../types';

interface SetupCard {
  to: string;
  label: string;
  icon: typeof UsersIcon;
  testId: string;
  describe: () => string;
}

// Custom Fields, Assignment Rules, Dedupe Rule, Status Codes, and SLA Management are
// deliberately not listed here — each is reachable from its relevant module's own
// ToolBox panel (see ToolBoxPanel usage in Leads/Contacts/Accounts/Deals/Products/
// Tickets/Campaigns/Quotes), so surfacing them again at the Setup-hub level would just
// be a second path to the same place.
export function Setup() {
  const users = getAllSync<User>('users');
  const roles = getAllSync<RoleDef>('roleDefs');
  const autoFlowProcesses = getAllSync<AutoFlowProcess>('autoFlowProcesses');

  const cards: SetupCard[] = [
    { to: '/setup/users', label: 'Users', icon: UsersIcon, testId: 'setup-card-users', describe: () => `${users.length} user(s)` },
    { to: '/setup/roles', label: 'Roles', icon: ShieldCheck, testId: 'setup-card-roles', describe: () => `${roles.length} role(s)` },
    { to: '/products', label: 'Product', icon: Package, testId: 'setup-card-product', describe: () => 'Manage the product catalog' },
    {
      to: '/setup/autoflow',
      label: 'AutoFlow',
      icon: Workflow,
      testId: 'setup-card-autoflow',
      describe: () => `${autoFlowProcesses.length} process(es)`,
    },
    { to: '/setup/audit', label: 'Audit Log', icon: History, testId: 'setup-card-audit', describe: () => 'Recent admin activity' },
    { to: '/setup/import', label: 'Import Data', icon: UploadCloud, testId: 'setup-card-import', describe: () => 'CSV → bulk create' },
  ];

  return (
    <div data-testid="setup-page">
      <div className="page-header">
        <h1>Setup</h1>
      </div>
      <p className="muted">Manage users, roles, product catalog, audit history, and data import.</p>

      <div className="object-config-grid">
        {cards.map((card) => (
          <Link key={card.to} to={card.to} className="object-config-card" data-testid={card.testId}>
            <span className="object-config-icon">
              <card.icon size={22} />
            </span>
            <span className="object-config-name">{card.label}</span>
            <span className="muted">{card.describe()}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
