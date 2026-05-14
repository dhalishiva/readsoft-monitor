import { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Mail, Users, LogOut, Activity, RefreshCw, Send,
  Moon, Sun, History, User, Menu, X
} from 'lucide-react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminsPage from './pages/AdminsPage';
import MailboxesPage from './pages/MailboxesPage';
import SmtpSettingsPage from './pages/SmtpSettingsPage';
import AlertHistoryPage from './pages/AlertHistoryPage';
import ProfilePage from './pages/ProfilePage';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── 1. Loading — show spinner, nothing else ────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  // ── 2. No session ──────────────────────────────────────────────────────────
  if (!session) return <Navigate to="/login" replace />;

  // ── 3. No admin row (safety net — should not flash) ────────────────────────
  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Your account is not registered. Please contact an administrator.
          </p>
          <button onClick={signOut} className="text-indigo-600 dark:text-indigo-400 underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── 4. Pending approval ────────────────────────────────────────────────────
  if (admin.approval_status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
          <div className="mx-auto h-12 w-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Pending Approval</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
            Your access request has been received. An administrator will review it shortly.
          </p>
          <button onClick={signOut} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── 5. Account disabled ────────────────────────────────────────────────────
  if (!admin.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-center max-w-md">
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Your account has been disabled. Contact an administrator.
          </p>
          <button onClick={signOut} className="text-indigo-600 dark:text-indigo-400 underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // ── 6. All good — render the app ───────────────────────────────────────────
  const navItems = [
    { path: '/',        label: 'Mailboxes',     icon: Activity },
    { path: '/alerts',  label: 'Alert History', icon: History  },
    { path: '/smtp',    label: 'SMTP',          icon: Send     },
    { path: '/admins',  label: 'Admin Users',   icon: Users    },
    { path: '/profile', label: 'My Profile',    icon: User     },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <div className="h-8 w-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <Mail size={18} />
          </div>
          <span className="font-bold text-lg leading-tight">FlowSentinel</span>
        </div>
        <button onClick={closeSidebar} className="md:hidden text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition text-sm ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white text-sm transition"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <Link
            to="/profile"
            onClick={closeSidebar}
            className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm hover:bg-indigo-400 shrink-0 text-white"
            title="My Profile"
          >
            {admin.email[0].toUpperCase()}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {admin.full_name || admin.email}
            </p>
            <p className="text-xs text-slate-500 truncate">{admin.role}</p>
          </div>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-white shrink-0" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={closeSidebar} />
      )}

      {/* Mobile sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 dark:bg-black
        transform transition-transform duration-200 ease-in-out md:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 dark:bg-black shrink-0">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 -ml-1"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 bg-indigo-600 rounded-md flex items-center justify-center shrink-0">
              <Mail size={13} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              FlowSentinel
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {navItems.find(n => n.path === location.pathname)?.label ?? ''}
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"        element={<MailboxesPage />}    />
            <Route path="/alerts"  element={<AlertHistoryPage />} />
            <Route path="/smtp"    element={<SmtpSettingsPage />} />
            <Route path="/admins"  element={<AdminsPage />}       />
            <Route path="/profile" element={<ProfilePage />}      />
          </Routes>
        </main>
      </div>
    </div>
  );
}