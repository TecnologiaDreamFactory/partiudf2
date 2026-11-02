'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, updatePassword } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { isValidPassword, PASSWORD_RULE } from '@/lib/auth/password';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/Logo';
import { Tag } from '@/components/ui/Tag';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // troca obrigatória (provisória ou fora da regra): guarda a atual para não pedir de novo
  const [pending, setPending] = useState<{
    password: string;
    role: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const goHome = (role: string) => {
    if (role === 'ADMIN') router.push('/admin');
    else if (role === 'DRIVER') router.push('/d');
    else router.push('/');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const pw = password.trim();

    setLoading(true);
    try {
      const data = await login({ email: email.trim(), password: pw });

      setAuth({ token: data.token, user: data.user });

      if (data.user.mustChangePassword) {
        setPending({ password: pw, role: data.user.role });
        return;
      }
      goHome(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const next = newPassword.trim();
    if (!isValidPassword(next)) {
      setError(`Senha fraca. ${PASSWORD_RULE}.`);
      return;
    }
    if (next !== confirmPassword.trim()) {
      setError('As senhas não conferem');
      return;
    }
    setLoading(true);
    try {
      await updatePassword({
        currentPassword: pending!.password,
        newPassword: next,
      });
      goHome(pending!.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao trocar a senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
      <div className="flex h-11 items-center">
        <span className="flex items-center gap-2.5 text-[20px] leading-none tracking-[-.04em] text-df-ink">
          <Logo className="size-8" />
          <span>
            <span className="font-light">partiu</span>
            <b className="font-bold">df</b>
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        {pending === null ? (
          <>
            <Tag>Acesso</Tag>
            <h1 className="mt-5 text-[44px] text-df-ink sm:text-[56px]">
              entre para <span className="text-grad">continuar</span>
            </h1>
            <p className="mt-3 text-[15px] text-df-muted">
              Motorista e administração.
            </p>

            <Card className="mt-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div
                    className="rounded-2xl bg-df-danger/10 px-4 py-3 text-[15px] text-df-danger"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
                <Input
                  label="Email"
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@email.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                />
                <Input
                  label="Senha"
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••"
                  autoComplete="current-password"
                />
                <Button type="submit" size="lg" isLoading={loading} fullWidth>
                  {loading ? 'entrando…' : 'entrar'}
                </Button>
              </form>
            </Card>
          </>
        ) : (
          <>
            <Tag>Nova senha</Tag>
            <h1 className="mt-5 text-[44px] text-df-ink sm:text-[56px]">
              crie sua <span className="text-grad">senha</span>
            </h1>
            <p className="mt-3 text-[15px] text-df-muted">
              Sua senha é provisória ou não segue o padrão de segurança. Crie
              uma só sua para continuar.
            </p>

            <Card className="mt-8">
              <form onSubmit={handleChangePassword} className="space-y-5">
                {error && (
                  <div
                    className="rounded-2xl bg-df-danger/10 px-4 py-3 text-[15px] text-df-danger"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
                <Input
                  label="Nova senha"
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••"
                  autoComplete="new-password"
                  hint={PASSWORD_RULE}
                />
                <Input
                  label="Repita a nova senha"
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••"
                  autoComplete="new-password"
                />
                <Button type="submit" size="lg" isLoading={loading} fullWidth>
                  {loading ? 'salvando…' : 'salvar e continuar'}
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
