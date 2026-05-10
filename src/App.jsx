import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Users, LogOut, Activity, RefreshCw, Send, Moon, Sun, History } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminsPage from './pages/AdminsPage';
import MailboxesPage from './pages/MailboxesPage';
import SmtpSettingsPage from './pages/SmtpSettingsPage';
import AlertHistoryPage from './pages/AlertHistoryPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedShell />} />
      </Routes>
    </AuthProvider>
  );
}

function ProtectedShell() {
  const { session, admin, loading, signOut, darkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-slate-700 dark:text-slate-300 mb-4">Your account is not registered as an admin.</p>
          <button onClick={signOut} className="text-indigo-600 dark:text-indigo-400 underline">Sign out</button>
        </div>
      </div>
    );
  }

  if (!admin.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-slate-700 dark:text-slate-300 mb-4">Your account has been disabled. Contact a super admin.</p>
          <button onClick={signOut} className="text-indigo-600 dark:text-indigo-400 underline">Sign out</button>
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/', label: 'Mailboxes', icon: Activity },
    { path: '/alerts', label: 'Alert History', icon: History },
    { path: '/smtp', label: 'SMTP', icon: Send },
    { path: '/admins', label: 'Admin Users', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="w-64 bg-slate-900 dark:bg-black text-slate-300 flex flex-col">
        <div className="p-6 flex items-center gap-3 text-white">
          <div className="h-8 w-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Mail size={18} />
          </div>
          <span className="font-bold text-lg">ReadSoft Monitor</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>
                <item.icon size={18} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-2">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white text-sm"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">
              {admin.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{admin.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{admin.role}</p>
            </div>
            <button onClick={async () => { await signOut(); navigate('/login'); }} className="text-slate-400 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<MailboxesPage />} />
          <Route path="/alerts" element={<AlertHistoryPage />} />
          <Route path="/smtp" element={<SmtpSettingsPage />} />
          <Route path="/admins" element={<AdminsPage />} />
        </Routes>
      </main>
    </div>
  );
}