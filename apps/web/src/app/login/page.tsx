'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { isValidNumericPassword } from '@/lib/auth/password';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const pw = password.trim();
    if (!isValidNumericPassword(pw)) {
      setError('Senha deve ter de 4 a 8 dígitos numéricos');
      return;
    }

    setLoading(true);
    try {
      const data = await login({ email: email.trim(), password: pw });

      setAuth({ token: data.token, user: data.user });

      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else if (data.user.role === 'DRIVER') {
        router.push('/d');
      } else {
        router.push('/p');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-xl font-semibold text-df-ink">PARTIU DF</h1>
            <p className="text-sm text-df-muted">Entre para continuar</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-df-danger dark:border-red-900/40 dark:bg-red-950/40"
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
            placeholder="admin@local"
            autoComplete="email"
            inputMode="email"
          />
          <Input
            label="Senha"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••"
            autoComplete="current-password"
            inputMode="numeric"
            hint="4 a 8 dígitos numéricos"
          />
          <Button type="submit" isLoading={loading} fullWidth>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
