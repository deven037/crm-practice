import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { LeadForm } from './pages/LeadForm';
import { LeadDetail } from './pages/LeadDetail';
import { Contacts } from './pages/Contacts';
import { ContactForm } from './pages/ContactForm';
import { ContactDetail } from './pages/ContactDetail';
import { Accounts } from './pages/Accounts';
import { AccountForm } from './pages/AccountForm';
import { AccountDetail } from './pages/AccountDetail';
import { Products } from './pages/Products';
import { ProductForm } from './pages/ProductForm';
import { ProductDetail } from './pages/ProductDetail';
import { Campaigns } from './pages/Campaigns';
import { CampaignForm } from './pages/CampaignForm';
import { CampaignDetail } from './pages/CampaignDetail';
import { Quotes } from './pages/Quotes';
import { QuoteForm } from './pages/QuoteForm';
import { QuoteDetail } from './pages/QuoteDetail';
import { Deals } from './pages/Deals';
import { DealForm } from './pages/DealForm';
import { DealDetail } from './pages/DealDetail';
import { Tasks } from './pages/Tasks';
import { Tickets } from './pages/Tickets';
import { TicketForm } from './pages/TicketForm';
import { TicketDetail } from './pages/TicketDetail';
import { ObjectConfig } from './pages/ObjectConfig';
import { Setup } from './pages/Setup';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { RoleForm } from './pages/RoleForm';
import { CustomFieldsHub } from './pages/CustomFieldsHub';
import { AuditLog } from './pages/AuditLog';
import { AssignmentRules } from './pages/AssignmentRules';
import { AssignmentRuleForm } from './pages/AssignmentRuleForm';
import { AssignmentRuleDetail } from './pages/AssignmentRuleDetail';
import { DedupeRules } from './pages/DedupeRules';
import { DedupeRuleForm } from './pages/DedupeRuleForm';
import { DedupeRuleDetail } from './pages/DedupeRuleDetail';
import { StatusCodes } from './pages/StatusCodes';
import { SlaManagement } from './pages/SlaManagement';
import { ImportData } from './pages/ImportData';
import { LayoutDesigner } from './pages/LayoutDesigner';
import { LayoutDesignerEditor } from './pages/LayoutDesignerEditor';
import { AutoFlowDesigner } from './pages/AutoFlowDesigner';
import { AutoFlowList } from './pages/AutoFlowList';
import { AutoFlowIntakeForm } from './pages/AutoFlowIntakeForm';
import { Settings } from './pages/Settings';
import { TestCases } from './pages/TestCases';
import { Forbidden } from './pages/Forbidden';

/**
 * Assigns a session-salted `id` to every input/button/textarea that lacks one
 * (e.g. id="el-x8k2f-3a"). The ids change on every reload and depend on render
 * order — a deliberate trap: they look usable in devtools but are worthless as
 * locators. Teaches automation engineers to prefer roles, text, and testids.
 */
function DynamicIdDecorator() {
  useEffect(() => {
    const salt = Math.random().toString(36).slice(2, 7);
    let counter = 0;
    const decorate = () => {
      document
        .querySelectorAll('input:not([id]), textarea:not([id]), button:not([id]), select:not([id])')
        .forEach((el) => {
          el.id = `el-${salt}-${(counter++).toString(36)}`;
        });
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

function Protected({ children, roles }: { children: JSX.Element; roles?: ('admin' | 'rep' | 'viewer')[] }) {
  return (
    <RequireAuth roles={roles}>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <DynamicIdDecorator />
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/leads" element={<Protected><Leads /></Protected>} />
            <Route path="/leads/new" element={<Protected><LeadForm /></Protected>} />
            <Route path="/leads/:id" element={<Protected><LeadDetail /></Protected>} />
            <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
            <Route path="/contacts/new" element={<Protected><ContactForm /></Protected>} />
            <Route path="/contacts/:id" element={<Protected><ContactDetail /></Protected>} />
            <Route path="/accounts" element={<Protected><Accounts /></Protected>} />
            <Route path="/accounts/new" element={<Protected><AccountForm /></Protected>} />
            <Route path="/accounts/:id" element={<Protected><AccountDetail /></Protected>} />
            <Route path="/products" element={<Protected><Products /></Protected>} />
            <Route path="/products/new" element={<Protected><ProductForm /></Protected>} />
            <Route path="/products/:id" element={<Protected><ProductDetail /></Protected>} />
            <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
            <Route path="/campaigns/new" element={<Protected><CampaignForm /></Protected>} />
            <Route path="/campaigns/:id" element={<Protected><CampaignDetail /></Protected>} />
            <Route path="/quotes" element={<Protected><Quotes /></Protected>} />
            <Route path="/quotes/new" element={<Protected><QuoteForm /></Protected>} />
            <Route path="/quotes/:id" element={<Protected><QuoteDetail /></Protected>} />
            <Route path="/deals" element={<Protected><Deals /></Protected>} />
            <Route path="/deals/new" element={<Protected><DealForm /></Protected>} />
            <Route path="/deals/:id" element={<Protected><DealDetail /></Protected>} />
            <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
            <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
            <Route path="/tickets/new" element={<Protected><TicketForm /></Protected>} />
            <Route path="/tickets/:id" element={<Protected><TicketDetail /></Protected>} />
            <Route path="/admin" element={<Protected roles={['admin', 'rep']}><Navigate to="/setup" replace /></Protected>} />
            <Route path="/admin/objects/:module" element={<Protected roles={['admin', 'rep']}><ObjectConfig /></Protected>} />
            <Route path="/setup" element={<Protected roles={['admin', 'rep']}><Setup /></Protected>} />
            <Route path="/setup/users" element={<Protected roles={['admin', 'rep']}><Users /></Protected>} />
            <Route path="/setup/roles" element={<Protected roles={['admin', 'rep']}><Roles /></Protected>} />
            <Route path="/setup/roles/:id" element={<Protected roles={['admin', 'rep']}><RoleForm /></Protected>} />
            <Route path="/setup/custom-fields" element={<Protected roles={['admin', 'rep']}><CustomFieldsHub /></Protected>} />
            <Route path="/setup/audit" element={<Protected roles={['admin', 'rep']}><AuditLog /></Protected>} />
            <Route path="/setup/assignment-rules" element={<Protected roles={['admin', 'rep']}><AssignmentRules /></Protected>} />
            <Route path="/setup/assignment-rules/new" element={<Protected roles={['admin', 'rep']}><AssignmentRuleForm /></Protected>} />
            <Route path="/setup/assignment-rules/:id/edit" element={<Protected roles={['admin', 'rep']}><AssignmentRuleForm /></Protected>} />
            <Route path="/setup/assignment-rules/:id" element={<Protected roles={['admin', 'rep']}><AssignmentRuleDetail /></Protected>} />
            <Route path="/setup/dedupe-rules" element={<Protected roles={['admin', 'rep']}><DedupeRules /></Protected>} />
            <Route path="/setup/dedupe-rules/new" element={<Protected roles={['admin', 'rep']}><DedupeRuleForm /></Protected>} />
            <Route path="/setup/dedupe-rules/:id/edit" element={<Protected roles={['admin', 'rep']}><DedupeRuleForm /></Protected>} />
            <Route path="/setup/dedupe-rules/:id" element={<Protected roles={['admin', 'rep']}><DedupeRuleDetail /></Protected>} />
            <Route path="/setup/status-codes" element={<Protected roles={['admin', 'rep']}><StatusCodes /></Protected>} />
            <Route path="/setup/sla" element={<Protected roles={['admin', 'rep']}><SlaManagement /></Protected>} />
            <Route path="/setup/import" element={<Protected roles={['admin', 'rep']}><ImportData /></Protected>} />
            <Route path="/setup/layouts/:module" element={<Protected roles={['admin', 'rep']}><LayoutDesigner /></Protected>} />
            <Route path="/setup/layouts/:module/:id" element={<Protected roles={['admin', 'rep']}><LayoutDesignerEditor /></Protected>} />
            <Route path="/setup/autoflow" element={<Protected roles={['admin', 'rep']}><AutoFlowList /></Protected>} />
            <Route path="/setup/autoflow/new" element={<Protected roles={['admin', 'rep']}><AutoFlowIntakeForm /></Protected>} />
            <Route path="/setup/autoflow/:id" element={<Protected roles={['admin', 'rep']}><AutoFlowDesigner /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/testcases" element={<Protected><TestCases /></Protected>} />
            <Route path="/forbidden" element={<Protected><Forbidden /></Protected>} />
            <Route path="*" element={<Protected><Forbidden /></Protected>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
