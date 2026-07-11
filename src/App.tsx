import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Contacts } from './pages/Contacts';
import { ContactDetail } from './pages/ContactDetail';
import { Accounts } from './pages/Accounts';
import { AccountDetail } from './pages/AccountDetail';
import { Deals } from './pages/Deals';
import { Tasks } from './pages/Tasks';
import { Tickets } from './pages/Tickets';
import { TicketDetail } from './pages/TicketDetail';
import { Admin } from './pages/Admin';
import { Settings } from './pages/Settings';
import { Forbidden } from './pages/Forbidden';

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
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/leads" element={<Protected><Leads /></Protected>} />
            <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
            <Route path="/contacts/:id" element={<Protected><ContactDetail /></Protected>} />
            <Route path="/accounts" element={<Protected><Accounts /></Protected>} />
            <Route path="/accounts/:id" element={<Protected><AccountDetail /></Protected>} />
            <Route path="/deals" element={<Protected><Deals /></Protected>} />
            <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
            <Route path="/tickets" element={<Protected><Tickets /></Protected>} />
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
