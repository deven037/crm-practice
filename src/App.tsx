import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
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
import { Deals } from './pages/Deals';
import { DealForm } from './pages/DealForm';
import { DealDetail } from './pages/DealDetail';
import { Tasks } from './pages/Tasks';
import { Tickets } from './pages/Tickets';
import { TicketForm } from './pages/TicketForm';
import { TicketDetail } from './pages/TicketDetail';
import { Admin } from './pages/Admin';
import { Settings } from './pages/Settings';
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
            <Route path="/deals" element={<Protected><Deals /></Protected>} />
            <Route path="/deals/new" element={<Protected><DealForm /></Protected>} />
            <Route path="/deals/:id" element={<Protected><DealDetail /></Protected>} />
            <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
            <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
            <Route path="/tickets/new" element={<Protected><TicketForm /></Protected>} />
            <Route path="/tickets/:id" element={<Protected><TicketDetail /></Protected>} />
            <Route path="/admin" element={<Protected roles={['admin', 'rep']}><Admin /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/forbidden" element={<Protected><Forbidden /></Protected>} />
            <Route path="*" element={<Protected><Forbidden /></Protected>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
