import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Database,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  Shield,
  Sun,
} from 'lucide-react';
import { BootstrapPayload, ThemeMode } from './types.ts';
import { AdminConsole } from './components/AdminConsole.tsx';
import { PublicPages } from './components/PublicPages.tsx';
import {
  getClientBootstrap,
  handleClientApiAction,
} from './lib/standaloneWebEngine.ts';

const DEFAULT_GOOGLE_CLIENT_ID =
  '881444436109-t1v1a42d9l8v7ibnqplnebdkdlqp15v7.apps.googleusercontent.com';

export default function AdminPortal() {
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('lootify_admin_authed') === 'true';
    } catch {
      return false;
    }
  });
  const [adminTab, setAdminTab] = useState<'console' | 'deploy-guide'>('console');
  const [emailInput, setEmailInput] = useState('admin@lootify.in');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [data, setData] = useState<BootstrapPayload>(() =>
    getClientBootstrap('usr_admin_1')
  );
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('lootify_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [workerApiUrl, setWorkerApiUrl] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('lootify_worker_api_url') ||
        'https://lootify-api.sarthaksinghyadav1.workers.dev'
      );
    } catch {
      return 'https://lootify-api.sarthaksinghyadav1.workers.dev';
    }
  });
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3600);
    },
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lootify_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const resolveApiUrl = useCallback(
    (endpoint: string) => {
      const cleanBase = workerApiUrl.trim().replace(/\/+$/, '');
      if (cleanBase && endpoint.startsWith('/api/')) {
        return `${cleanBase}${endpoint}`;
      }
      return endpoint;
    },
    [workerApiUrl]
  );

  const fetchAdminBootstrap = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/bootstrap?userId=usr_admin_1'), {
        headers: { 'x-user-id': 'usr_admin_1' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Fallback to local admin bootstrap');
      }
      const payload: BootstrapPayload = await res.json();
      if (payload?.settings && payload?.currentUser) {
        setData(payload);
        return;
      }
      throw new Error('Incomplete bootstrap');
    } catch {
      setData(getClientBootstrap('usr_admin_1'));
    }
  }, [resolveApiUrl]);

  useEffect(() => {
    fetchAdminBootstrap();
  }, [fetchAdminBootstrap]);

  const apiPost = async (endpoint: string, body?: any) => {
    try {
      const res = await fetch(resolveApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'usr_admin_1',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('USE_CLIENT_ENGINE');
      }
      const json = await res.json();
      if (!res.ok) {
        if (String(json.error || '').includes("reading 'prepare'")) {
          throw new Error('USE_CLIENT_ENGINE');
        }
        throw new Error(json.error || 'Operation failed');
      }
      if (json.bootstrap?.currentUser && json.bootstrap?.settings) {
        setData(json.bootstrap);
      } else if (json.settings && json.currentUser) {
        setData(json);
      } else {
        const fallbackPayload = handleClientApiAction('POST', endpoint, 'usr_admin_1', body);
        if (fallbackPayload?.currentUser && fallbackPayload?.settings) {
          setData(fallbackPayload);
        }
      }
      return json;
    } catch (err: any) {
      if (
        err.message === 'USE_CLIENT_ENGINE' ||
        err instanceof TypeError ||
        err instanceof SyntaxError
      ) {
        const result = handleClientApiAction('POST', endpoint, 'usr_admin_1', body);
        if (result?.bootstrap?.currentUser) {
          setData(result.bootstrap);
        } else if (result?.settings && result?.currentUser) {
          setData(result);
        }
        return result;
      }
      throw err;
    }
  };

  const apiDelete = async (endpoint: string) => {
    try {
      const res = await fetch(resolveApiUrl(endpoint), {
        method: 'DELETE',
        headers: { 'x-user-id': 'usr_admin_1' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('USE_CLIENT_ENGINE');
      }
      const json = await res.json();
      if (json.settings && json.currentUser) {
        setData(json);
      } else {
        throw new Error('USE_CLIENT_ENGINE');
      }
      return json;
    } catch {
      const result = handleClientApiAction('DELETE', endpoint, 'usr_admin_1');
      if (result?.settings && result?.currentUser) {
        setData(result);
      }
      return result;
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      if (
        (cleanEmail === 'admin@lootify.in' ||
          cleanEmail === 'sarthaksinghyadav1@gmail.com') &&
        (passwordInput === 'admin123' || passwordInput === 'sarthak123')
      ) {
        sessionStorage.setItem('lootify_admin_authed', 'true');
        setAdminAuthenticated(true);
        notify('Welcome to Lootify Admin Control Center!', 'success');
        return;
      }
      // Also verify against Cloudflare Worker /api/auth/login
      const res = await apiPost('/api/auth/login', {
        email: cleanEmail,
        password: passwordInput,
      });
      const usr = res?.currentUser || res?.user;
      if (usr && usr.role === 'admin') {
        sessionStorage.setItem('lootify_admin_authed', 'true');
        setAdminAuthenticated(true);
        notify('Admin authenticated via Cloudflare D1!', 'success');
      } else {
        notify('Access Denied: This account does not have Admin permissions.', 'error');
      }
    } catch (err: any) {
      notify(err.message || 'Invalid Admin credentials', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const triggerAdminGoogleLogin = () => {
    const win = window as any;
    const clientId =
      localStorage.getItem('lootify_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
    if (win.google?.accounts?.oauth2) {
      const tokenClient = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: 'openid email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.access_token) {
            try {
              const profileRes = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                }
              );
              const profile = await profileRes.json();
              const email = String(profile?.email || '').toLowerCase();
              if (
                email === 'sarthaksinghyadav1@gmail.com' ||
                email === 'admin@lootify.in'
              ) {
                sessionStorage.setItem('lootify_admin_authed', 'true');
                setAdminAuthenticated(true);
                notify(`Admin verified via Google (${email})`, 'success');
              } else {
                notify(
                  `Google account (${email}) is not registered as Founder Admin.`,
                  'error'
                );
              }
            } catch {
              notify('Failed to verify Google Admin profile.', 'error');
            }
          }
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    notify('Google Identity Services script loading, or use Admin Password login below.', 'info');
  };

  const handleLogoutAdmin = () => {
    sessionStorage.removeItem('lootify_admin_authed');
    setAdminAuthenticated(false);
    notify('Logged out of Admin Portal.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Dedicated Standalone Admin Portal Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight font-display text-slate-900 dark:text-white">
                  {data.settings.siteName}.in
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                  Admin Portal (/admin.html)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Dedicated Founder & Operations Control Center · Separated from User Website
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {adminAuthenticated && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setAdminTab('console')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    adminTab === 'console'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Admin Console
                </button>
                <button
                  onClick={() => setAdminTab('deploy-guide')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    adminTab === 'deploy-guide'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Domain & DB Guide
                </button>
              </div>
            )}

            <button
              onClick={() => setDbModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Worker & D1 Config</span>
            </button>

            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark</span>
                </>
              )}
            </button>

            <a
              href="./index.html"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = './';
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>User Website</span>
            </a>

            {adminAuthenticated && (
              <button
                onClick={handleLogoutAdmin}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:py-10">
        {!adminAuthenticated ? (
          <div className="max-w-md mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-extrabold font-display text-slate-900 dark:text-white">
                Admin Portal Authentication
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This URL (<code className="font-mono">/admin.html</code>) is isolated from the public user website. Sign in with your Founder Admin credentials to manage users, payouts, and offerwalls.
              </p>
            </div>

            <button
              type="button"
              onClick={triggerAdminGoogleLogin}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-3 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                />
              </svg>
              <span>Sign in with Founder Google Account</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                or Admin Email & Password
              </span>
              <div className="grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@lootify.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password (default: admin123)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
              >
                {loginLoading ? 'Verifying Admin...' : 'Unlock Admin Control Center →'}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Default Admin Credentials:</span>
              <button
                type="button"
                onClick={() => {
                  setEmailInput('admin@lootify.in');
                  setPasswordInput('admin123');
                }}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Auto-Fill (admin@lootify.in / admin123)
              </button>
            </div>
          </div>
        ) : adminTab === 'deploy-guide' ? (
          <PublicPages
            data={data}
            activePage="deploy-guide"
            onNavigate={() => setAdminTab('console')}
            onRegisterUser={async () => {}}
            theme={theme}
            onToggleTheme={toggleTheme}
            notify={notify}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Connected Backend:{' '}
                <code className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {workerApiUrl}
                </code>
              </div>
              <button
                onClick={fetchAdminBootstrap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Live D1 Data</span>
              </button>
            </div>

            <AdminConsole
              data={data}
              apiPost={apiPost}
              apiDelete={apiDelete}
              notify={notify}
            />
          </div>
        )}
      </main>

      {/* Worker & D1 Config Modal */}
      {dbModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cloudflare Worker + D1 API Connection
              </h3>
              <button
                onClick={() => setDbModalOpen(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Your Cloudflare Worker URL connects both the User Website and this Admin Portal to your D1 SQL Database.
            </p>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Cloudflare Worker Endpoint URL
              </label>
              <input
                type="url"
                value={workerApiUrl}
                onChange={(e) => setWorkerApiUrl(e.target.value)}
                placeholder="https://lootify-api.sarthaksinghyadav1.workers.dev"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('lootify_worker_api_url', workerApiUrl.trim());
                  fetchAdminBootstrap();
                  setDbModalOpen(false);
                  notify('Cloudflare Worker API URL saved!', 'success');
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Save & Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-white text-xs font-medium shadow-lg">
          {toast.message}
        </div>
      )}
    </div>
  );
}
