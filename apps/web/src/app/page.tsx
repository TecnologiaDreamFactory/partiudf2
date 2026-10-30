'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Rota raiz: sempre abre a versão passageiro.
 * Administrador e motorista usam /login → /admin ou /d diretamente.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/p');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-df-surface-2 text-df-muted">
      <p className="text-sm">Carregando…</p>
    </main>
  );
}
