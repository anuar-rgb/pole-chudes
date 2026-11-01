import { Link } from 'react-router-dom';

/** Заглушка — админ-панель реализуется на этапе 4 */
export function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-black">Админ-панель</h1>
      <p className="mt-3 text-[var(--c-muted)]">
        Конструктор барабанов, база вопросов, темы и ассеты появятся на следующих этапах.
      </p>
      <Link to="/" className="mt-6 inline-block underline">
        ← К барабану
      </Link>
    </main>
  );
}
