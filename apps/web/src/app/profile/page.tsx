'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthMe, updateUsersMe, updatePassword } from '@/lib/api';
import { requireAuth, logout } from '@/lib/auth';
import { isValidNumericPassword } from '@/lib/auth/password';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function ProfilePage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const { ok } = requireAuth(['PASSENGER', 'DRIVER', 'ADMIN']);
    if (!ok) {
      router.replace('/login');
      setAuthOk(false);
      return;
    }
    setAuthOk(true);
  }, [router]);

  useEffect(() => {
    if (authOk !== true) return;
    fetchAuthMe()
      .then((me) => {
        setName(me.name ?? '');
        setAvatarUrl(me.avatarUrl ?? '');
      })
      .catch(() => {});
  }, [authOk]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateUsersMe({
        name: name.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    const current = currentPassword.trim();
    const next = newPassword.trim();
    if (!isValidNumericPassword(current)) {
      setPasswordError('Senha atual deve ter de 4 a 8 dígitos');
      return;
    }
    if (!isValidNumericPassword(next)) {
      setPasswordError('Nova senha deve ter de 4 a 8 dígitos');
      return;
    }
    setPasswordSaving(true);
    try {
      await updatePassword({ currentPassword: current, newPassword: next });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Erro ao trocar senha');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (authOk !== true) {
    return (
      <main className="mx-auto max-w-md bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-df-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-df-ink sm:text-3xl">
          Meu perfil
        </h1>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-df-border px-3 py-1.5 text-sm text-df-muted transition hover:bg-df-surface-2 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
        >
          Sair
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <Card className="mb-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
          <div>
            <Input
              label="Avatar (caminho relativo)"
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="/avatars/p1.png"
            />
            {avatarUrl.trim() && (
              <div className="mt-2">
                <p className="mb-1 text-sm text-df-muted">Preview:</p>
                <img
                  src={avatarUrl.trim()}
                  alt="Preview"
                  className="h-16 w-16 rounded-full border-2 border-df-border object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-df-ink">Trocar senha</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
              role="status"
            >
              Senha alterada com sucesso.
            </div>
          )}
          <Input
            label="Senha atual"
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="4-8 dígitos"
            autoComplete="current-password"
          />
          <Input
            label="Nova senha"
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="4-8 dígitos"
            autoComplete="new-password"
          />
          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Alterando…' : 'Alterar senha'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
