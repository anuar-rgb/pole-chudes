import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { CircleDot, FileQuestion, Images, LogOut, Palette, Play, Lock } from 'lucide-react';
import { api, authToken, type AuthMode } from '@/api/client';
import { useDataStore } from '@/store/dataStore';
import { applyThemeCss } from '@/utils/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/form';
import { Toaster } from '@/components/ui/Toast';
import { WheelList } from '@/components/admin/WheelList';
import { WheelEditor } from '@/components/admin/WheelEditor';
import { QuestionManager } from '@/components/admin/QuestionManager';
import { AssetGallery } from '@/components/admin/AssetGallery';

type Auth = { state: 'checking' } | { state: 'offline' } | { state: 'locked' } | { state: 'login' } | { state: 'ok'; mode: AuthMode };

const NAV = [
  { to: '/admin/wheels', label: 'Барабаны', icon: CircleDot },
  { to: '/admin/questions', label: 'Вопросы', icon: FileQuestion },
  { to: '/admin/themes', label: 'Темы', icon: Palette },
  { to: '/admin/assets', label: 'Ассеты', icon: Images },
];

export function AdminPage() {
  const [auth, setAuth] = useState<Auth>({ state: 'checking' });
  const { status, load, themes } = useDataStore();

  useEffect(() => {
    api
      .me()
      .then((me) => setAuth(me.authorized ? { state: 'ok', mode: me.mode } : me.mode === 'locked' ? { state: 'locked' } : { state: 'login' }))
      .catch(() => setAuth({ state: 'offline' }));
  }, []);

  // Админка всегда работает с актуальными данными сервера
  useEffect(() => {
    if (auth.state === 'ok' && status !== 'ready' && status !== 'loading') void load();
  }, [auth.state, status, load]);

  useEffect(() => {
    if (themes[0]) applyThemeCss(themes[0]);
  }, [themes]);

  if (auth.state !== 'ok') return <AuthScreen auth={auth} onLogin={(mode) => setAuth({ state: 'ok', mode })} />;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-3 md:py-5">
        <Link to="/admin" className="mr-2 shrink-0 px-2 text-lg font-black md:mb-4 md:mr-0">
          Админка
        </Link>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2.5 rounded-[calc(var(--radius)*0.6)] px-3 py-2 text-sm transition ${
                isActive ? 'bg-[var(--c-accent)] font-bold text-[var(--c-accent-text)]' : 'hover:bg-white/10'
              }`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
        <div className="flex shrink-0 gap-1 md:mt-auto md:flex-col">
          <Link to="/" className="flex items-center gap-2.5 rounded px-3 py-2 text-sm hover:bg-white/10">
            <Play size={18} /> К игре
          </Link>
          {auth.mode === 'password' && (
            <button
              onClick={() => {
                authToken.set('');
                setAuth({ state: 'login' });
              }}
              className="flex items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              <LogOut size={18} /> Выйти
            </button>
          )}
        </div>
      </nav>

      <main className="min-w-0 p-4 sm:p-6">
        {auth.mode === 'open' && (
          <p className="mb-4 rounded-[var(--radius)] border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/10 px-3 py-2 text-xs">
            Локальный режим: админка открыта без пароля. На сервере задайте переменную <code>ADMIN_PASSWORD</code>.
          </p>
        )}
        {status !== 'ready' ? (
          <p className="text-[var(--c-muted)]">Загрузка данных…</p>
        ) : (
          <Routes>
            <Route index element={<Navigate to="wheels" replace />} />
            <Route path="wheels" element={<WheelList />} />
            <Route path="wheels/:id" element={<WheelEditorRoute />} />
            <Route path="questions" element={<QuestionManager />} />
            <Route path="themes" element={<ThemesStub />} />
            <Route path="assets" element={<AssetGallery />} />
            <Route path="*" element={<Navigate to="wheels" replace />} />
          </Routes>
        )}
      </main>
      <Toaster />
    </div>
  );
}

function WheelEditorRoute() {
  const { id = '' } = useParams();
  return <WheelEditor wheelId={id} />;
}

function ThemesStub() {
  const themes = useDataStore((s) => s.themes);
  return (
    <div>
      <h1 className="mb-2 text-2xl font-black">Темы</h1>
      <p className="mb-5 text-sm text-[var(--c-muted)]">Редактор тем — следующий этап. Сейчас доступны встроенные темы:</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <li key={t.id} className="overflow-hidden rounded-[var(--radius)] border border-white/10" style={{ background: t.colors.background, color: t.colors.text, fontFamily: t.fontFamily }}>
            <div className="p-4">
              <div className="font-bold">{t.name}</div>
              <div className="mt-3 flex gap-1">
                {t.sectionPalette.map((c, i) => (
                  <span key={i} className="h-5 flex-1 rounded-sm" style={{ background: c }} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuthScreen({ auth, onLogin }: { auth: Auth; onLogin: (mode: AuthMode) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const body =
    auth.state === 'checking' ? (
      <p className="text-[var(--c-muted)]">Проверка доступа…</p>
    ) : auth.state === 'offline' ? (
      <p>
        Сервер недоступен. Запустите <code>npm run dev</code> — он поднимает и сайт, и API.
      </p>
    ) : auth.state === 'locked' ? (
      <p>
        Админка отключена: на сервере не задан пароль. В Railway добавьте переменную <code>ADMIN_PASSWORD</code> и перезапустите сервис.
      </p>
    ) : (
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const r = await api.login(password);
            authToken.set(r.token);
            onLogin(r.mode);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-[var(--c-muted)]">Пароль администратора</span>
          <Input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-[var(--c-danger)]">{error}</p>}
        <Button type="submit" disabled={!password || busy}>
          {busy ? 'Проверка…' : 'Войти'}
        </Button>
      </form>
    );

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="panel w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={20} className="text-[var(--c-accent)]" />
          <h1 className="text-xl font-black">Админка</h1>
        </div>
        {body}
        <Link to="/" className="mt-5 inline-block text-sm text-[var(--c-muted)] underline">
          ← К игре
        </Link>
      </div>
    </main>
  );
}
