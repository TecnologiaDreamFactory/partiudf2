'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
  fetchAdminPassengerLogins,
  deleteAdminPassengerLogins,
  fetchAdminPickupPoints,
  createAdminPickupPoint,
  updateAdminPickupPoint,
  deleteAdminPickupPoint,
  type AdminPickupPoint,
} from '@/lib/api';
import { requireAuth, logout } from '@/lib/auth';
import {
  generateNumericPassword,
  isValidNumericPassword,
} from '@/lib/auth/password';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const ROLES = ['ADMIN', 'DRIVER', 'PASSENGER'] as const;

export default function AdminPage() {
  const router = useRouter();
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('PASSENGER');
  const [createName, setCreateName] = useState('');
  const [createAvatarUrl, setCreateAvatarUrl] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createSaving, setCreateSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [loginsReportLoading, setLoginsReportLoading] = useState(false);
  const [loginsDeleting, setLoginsDeleting] = useState(false);

  const [pickupPoints, setPickupPoints] = useState<AdminPickupPoint[]>([]);
  const [ppLoading, setPpLoading] = useState(true);
  const [showCreatePp, setShowCreatePp] = useState(false);
  const [ppCode, setPpCode] = useState('');
  const [ppName, setPpName] = useState('');
  const [ppLat, setPpLat] = useState('');
  const [ppLng, setPpLng] = useState('');
  const [ppAddress, setPpAddress] = useState('');
  const [ppSaving, setPpSaving] = useState(false);
  const [ppEditingId, setPpEditingId] = useState<string | null>(null);
  const [ppEditCode, setPpEditCode] = useState('');
  const [ppEditName, setPpEditName] = useState('');
  const [ppEditLat, setPpEditLat] = useState('');
  const [ppEditLng, setPpEditLng] = useState('');
  const [ppEditAddress, setPpEditAddress] = useState('');
  const [ppEditSaving, setPpEditSaving] = useState(false);
  const [ppDeletingId, setPpDeletingId] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: select and copy
    }
  }, []);

  useEffect(() => {
    const { ok } = requireAuth(['ADMIN']);
    if (!ok) {
      router.replace('/login');
      setAuthOk(false);
      return;
    }
    setAuthOk(true);
  }, [router]);

  useEffect(() => {
    if (authOk !== true) return;

    setLoading(true);
    fetchAdminUsers(roleFilter || undefined)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [authOk, roleFilter]);

  useEffect(() => {
    if (authOk !== true) return;
    setPpLoading(true);
    fetchAdminPickupPoints()
      .then(setPickupPoints)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar pontos'))
      .finally(() => setPpLoading(false));
  }, [authOk]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidNumericPassword(createPassword)) {
      setError('Senha deve ter de 4 a 8 dígitos numéricos');
      return;
    }
    setCreateSaving(true);
    try {
      const user = await createAdminUser({
        email: createEmail.trim(),
        role: createRole,
        name: createName.trim() || undefined,
        avatarUrl: createAvatarUrl.trim() || undefined,
        password: createPassword.trim(),
      });
      setUsers((prev) => [user, ...prev]);
      setShowCreate(false);
      setCreateEmail('');
      setCreateRole('PASSENGER');
      setCreateName('');
      setCreateAvatarUrl('');
      setCreatePassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar');
    } finally {
      setCreateSaving(false);
    }
  };

  const startEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setEditName(u.name ?? '');
    setEditRole(u.role);
    setEditAvatarUrl(u.avatarUrl ?? '');
    setEditPassword('');
  };

  const handleUpdate = async (id: string) => {
    setError('');
    if (editPassword && !isValidNumericPassword(editPassword)) {
      setError('Senha deve ter de 4 a 8 dígitos numéricos');
      return;
    }
    setEditSaving(true);
    try {
      const updated = await updateAdminUser(id, {
        name: editName.trim() || undefined,
        role: editRole,
        avatarUrl: editAvatarUrl.trim() || undefined,
        password: editPassword?.trim() || undefined,
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir "${u.name || u.email}"? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setError('');
    setDeletingUserId(u.id);
    try {
      await deleteAdminUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir usuário');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleGenerateLoginsReport = async () => {
    setError('');
    setLoginsReportLoading(true);
    try {
      const logins = await fetchAdminPassengerLogins();
      if (logins.length === 0) {
        window.alert('Nenhum login de passageiro encontrado.');
        return;
      }
      const header = ['ID', 'Email', 'Nome', 'Check-ins', 'Data de criacao'];
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const rows = logins.map((l) =>
        [
          l.id,
          l.email,
          l.name ?? '',
          String(l.checkinsCount),
          new Date(l.createdAt).toLocaleString('pt-BR'),
        ]
          .map(escape)
          .join(','),
      );
      const csv = [header.map(escape).join(','), ...rows].join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logins-passageiros-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório');
    } finally {
      setLoginsReportLoading(false);
    }
  };

  const handleDeleteLogins = async () => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir TODOS os logins de passageiros? Os check-ins associados também serão removidos. Esta ação não pode ser desfeita.',
      )
    )
      return;
    setError('');
    setLoginsDeleting(true);
    try {
      const { deleted } = await deleteAdminPassengerLogins();
      window.alert(`${deleted} login(s) de passageiro excluído(s).`);
      // Atualiza a lista de usuários caso esteja exibindo passageiros.
      const refreshed = await fetchAdminUsers(roleFilter || undefined);
      setUsers(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir logins');
    } finally {
      setLoginsDeleting(false);
    }
  };

  const handleCreatePp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const lat = parseFloat(ppLat);
    const lng = parseFloat(ppLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Latitude e longitude devem ser números válidos');
      return;
    }
    setPpSaving(true);
    try {
      const item = await createAdminPickupPoint({
        code: ppCode.trim(),
        name: ppName.trim(),
        lat,
        lng,
        address: ppAddress.trim() || undefined,
      });
      setPickupPoints((prev) => [item, ...prev].sort((a, b) => a.code.localeCompare(b.code)));
      setShowCreatePp(false);
      setPpCode('');
      setPpName('');
      setPpLat('');
      setPpLng('');
      setPpAddress('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar ponto');
    } finally {
      setPpSaving(false);
    }
  };

  const startEditPp = (p: AdminPickupPoint) => {
    setPpEditingId(p.id);
    setPpEditCode(p.code);
    setPpEditName(p.name);
    setPpEditLat(String(p.lat));
    setPpEditLng(String(p.lng));
    setPpEditAddress(p.address ?? '');
  };

  const handleUpdatePp = async (id: string) => {
    setError('');
    const lat = parseFloat(ppEditLat);
    const lng = parseFloat(ppEditLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Latitude e longitude devem ser números válidos');
      return;
    }
    setPpEditSaving(true);
    try {
      const updated = await updateAdminPickupPoint(id, {
        code: ppEditCode.trim(),
        name: ppEditName.trim(),
        lat,
        lng,
        address: ppEditAddress.trim() || null,
      });
      setPickupPoints((prev) =>
        prev.map((p) => (p.id === id ? updated : p)).sort((a, b) => a.code.localeCompare(b.code)),
      );
      setPpEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar ponto');
    } finally {
      setPpEditSaving(false);
    }
  };

  const handleDeletePp = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este ponto de embarque?')) return;
    setError('');
    setPpDeletingId(id);
    try {
      await deleteAdminPickupPoint(id);
      setPickupPoints((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir ponto');
    } finally {
      setPpDeletingId(null);
    }
  };

  if (authOk !== true) {
    return (
      <main className="mx-auto max-w-4xl bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-df-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl bg-df-surface px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-df-ink sm:text-3xl">
          Admin
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="rounded-lg border border-df-border px-3 py-1.5 text-sm text-df-muted transition hover:bg-df-surface-2 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
          >
            Perfil
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-df-border px-3 py-1.5 text-sm text-df-muted transition hover:bg-df-surface-2 focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
          >
            Sair
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor="roleFilter" className="mb-1 block text-sm font-medium text-df-ink">
              Filtrar por role
            </label>
            <select
              id="roleFilter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-df-border px-3 py-2 text-df-ink focus:border-dream-blue focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
            >
              <option value="">Todos</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => setShowCreate(true)}>
              Novo usuário
            </Button>
          </div>
        </div>

        <hr className="my-4 border-df-border" />
        <div>
          <p className="mb-2 text-sm font-medium text-df-ink">
            Logins de passageiros (sessões anônimas)
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleGenerateLoginsReport}
              disabled={loginsReportLoading}
            >
              {loginsReportLoading ? 'Gerando…' : 'Gerar relatório (CSV)'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDeleteLogins}
              disabled={loginsDeleting}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {loginsDeleting ? 'Excluindo…' : 'Excluir logins de passageiros'}
            </Button>
          </div>
        </div>
      </Card>

      {showCreate && (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold text-df-ink">Criar usuário</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-df-ink">Role</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value)}
                className="w-full rounded-xl border border-df-border px-3 py-2.5 text-df-ink focus:border-dream-blue focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Nome (opcional)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Nome"
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-df-ink">
                Senha inicial (4-8 dígitos)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="1234"
                  required
                  className="min-w-0 flex-1 rounded-xl border border-df-border px-3 py-2.5 text-df-ink focus:border-dream-blue focus:outline-none focus:ring-2 focus:ring-dream-blue/30"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreatePassword(generateNumericPassword(8))}
                >
                  Gerar senha
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => copyToClipboard(createPassword)}
                  disabled={!createPassword}
                >
                  Copiar
                </Button>
              </div>
            </div>
            <div>
              <Input
                label="avatarUrl (opcional)"
                value={createAvatarUrl}
                onChange={(e) => setCreateAvatarUrl(e.target.value)}
                placeholder="/avatars/p1.png"
              />
              {createAvatarUrl.trim() && (
                <img
                  src={createAvatarUrl.trim()}
                  alt="Preview"
                  className="mt-2 h-12 w-12 rounded-full border-2 border-df-border object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createSaving}>
                {createSaving ? 'Criando…' : 'Criar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold text-df-ink">Lista de usuários</h2>
        {loading ? (
          <p className="text-df-muted">Carregando…</p>
        ) : users.length === 0 ? (
          <p className="text-df-muted">Nenhum usuário encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-df-border">
                  <th className="py-3 pr-4 font-medium text-df-ink">Avatar</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Email</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Nome</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Role</th>
                  <th className="py-3 font-medium text-df-ink">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-df-border">
                    <td className="py-3 pr-4">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-10 w-10 rounded-full border border-df-border object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-xs text-df-muted">
                          ?
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-medium">{u.email}</td>
                    <td className="py-3 pr-4">
                      {editingId === u.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full max-w-[140px] rounded-lg border border-df-border px-2 py-1 text-df-ink"
                        />
                      ) : (
                        u.name || '—'
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {editingId === u.id ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded-lg border border-df-border px-2 py-1 text-df-ink"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded bg-df-surface-2 px-2 py-0.5 text-df-ink">
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {editingId === u.id ? (
                        <div className="flex flex-col gap-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-df-muted">
                              Nova senha (opcional, 4-8 dígitos)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={editPassword}
                                onChange={(e) =>
                                  setEditPassword(e.target.value.replace(/\D/g, '').slice(0, 8))
                                }
                                placeholder="Deixe vazio para manter"
                                className="min-w-0 flex-1 rounded-lg border border-df-border px-2 py-1 text-df-ink"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setEditPassword(generateNumericPassword(8))}
                              >
                                Gerar senha
                              </Button>
                              {editPassword && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(editPassword)}
                                >
                                  Copiar
                                </Button>
                              )}
                            </div>
                          </div>
                          <Input
                            label="avatarUrl"
                            value={editAvatarUrl}
                            onChange={(e) => setEditAvatarUrl(e.target.value)}
                            placeholder="/avatars/p1.png"
                          />
                          {editAvatarUrl.trim() && (
                            <img
                              src={editAvatarUrl.trim()}
                              alt="Preview"
                              className="h-10 w-10 rounded-full border border-df-border object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleUpdate(u.id)}
                              disabled={editSaving}
                            >
                              {editSaving ? 'Salvando…' : 'Salvar'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditPassword('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => startEdit(u)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteUser(u)}
                            disabled={deletingUserId === u.id}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            {deletingUserId === u.id ? 'Excluindo…' : 'Excluir'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <hr className="my-8 border-df-border" />
      <h2 className="mb-4 text-xl font-semibold text-df-ink">Pontos de embarque</h2>
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-df-muted">
            Gerencie os pontos onde os passageiros podem fazer check-in.
          </p>
          <Button type="button" onClick={() => setShowCreatePp(true)}>
            Novo ponto
          </Button>
        </div>

        {showCreatePp && (
          <form onSubmit={handleCreatePp} className="mb-6 space-y-4 rounded-lg border border-df-border bg-df-surface-2/50 p-4">
            <h3 className="font-medium text-df-ink">Criar ponto de embarque</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Código (único, ex: METRO_A)"
                value={ppCode}
                onChange={(e) => setPpCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="METRO_CINELANDIA_A"
                required
              />
              <Input
                label="Nome"
                value={ppName}
                onChange={(e) => setPpName(e.target.value)}
                placeholder="Metrô Cinelândia A"
                required
              />
              <Input
                label="Latitude"
                type="number"
                step="any"
                value={ppLat}
                onChange={(e) => setPpLat(e.target.value)}
                placeholder="-22.912001"
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                value={ppLng}
                onChange={(e) => setPpLng(e.target.value)}
                placeholder="-43.175761"
                required
              />
              <div className="sm:col-span-2">
                <Input
                  label="Endereço (opcional)"
                  value={ppAddress}
                  onChange={(e) => setPpAddress(e.target.value)}
                  placeholder="Centro"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={ppSaving}>
                {ppSaving ? 'Criando…' : 'Criar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreatePp(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {ppLoading ? (
          <p className="text-df-muted">Carregando…</p>
        ) : pickupPoints.length === 0 ? (
          <p className="text-df-muted">Nenhum ponto de embarque cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-df-border">
                  <th className="py-3 pr-4 font-medium text-df-ink">Código</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Nome</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Lat / Lng</th>
                  <th className="py-3 pr-4 font-medium text-df-ink">Endereço</th>
                  <th className="py-3 font-medium text-df-ink">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pickupPoints.map((p) => (
                  <tr key={p.id} className="border-b border-df-border">
                    <td className="py-3 pr-4 font-mono text-df-ink">
                      {ppEditingId === p.id ? (
                        <input
                          type="text"
                          value={ppEditCode}
                          onChange={(e) => setPpEditCode(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                          className="w-full max-w-[160px] rounded-lg border border-df-border px-2 py-1 text-df-ink"
                        />
                      ) : (
                        p.code
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {ppEditingId === p.id ? (
                        <input
                          type="text"
                          value={ppEditName}
                          onChange={(e) => setPpEditName(e.target.value)}
                          className="w-full max-w-[180px] rounded-lg border border-df-border px-2 py-1 text-df-ink"
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="py-3 pr-4 text-df-ink">
                      {ppEditingId === p.id ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="any"
                            value={ppEditLat}
                            onChange={(e) => setPpEditLat(e.target.value)}
                            className="w-24 rounded-lg border border-df-border px-2 py-1 text-df-ink"
                          />
                          <input
                            type="number"
                            step="any"
                            value={ppEditLng}
                            onChange={(e) => setPpEditLng(e.target.value)}
                            className="w-24 rounded-lg border border-df-border px-2 py-1 text-df-ink"
                          />
                        </div>
                      ) : (
                        `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`
                      )}
                    </td>
                    <td className="py-3 pr-4 text-df-muted">
                      {ppEditingId === p.id ? (
                        <input
                          type="text"
                          value={ppEditAddress}
                          onChange={(e) => setPpEditAddress(e.target.value)}
                          placeholder="Opcional"
                          className="w-full max-w-[120px] rounded-lg border border-df-border px-2 py-1 text-df-ink"
                        />
                      ) : (
                        p.address || '—'
                      )}
                    </td>
                    <td className="py-3">
                      {ppEditingId === p.id ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleUpdatePp(p.id)}
                            disabled={ppEditSaving}
                          >
                            {ppEditSaving ? 'Salvando…' : 'Salvar'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPpEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => startEditPp(p)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeletePp(p.id)}
                            disabled={ppDeletingId === p.id}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            {ppDeletingId === p.id ? 'Excluindo…' : 'Excluir'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
