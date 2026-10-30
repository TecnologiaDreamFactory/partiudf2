import 'server-only';

/**
 * Publica eventos no Supabase Realtime (substitui o Socket.IO do Nest).
 * Canais privados: os clientes so podem ouvir (politica em 0002_supabase_security);
 * quem publica e o servidor, com a service role key, pela API REST de broadcast.
 *
 * Topicos: `trips` (inicio/fim de viagem, para todos) e `trip:<id>` (posicao e check-ins).
 */
export async function broadcast(topic: string, event: string, payload: object): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[realtime] Supabase nao configurado; evento ignorado:', topic, event);
    return;
  }
  // Aguardado de proposito: na Vercel a funcao congela ao responder, e um fetch solto se perde.
  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic, event, payload, private: true }] }),
  });
  // Falha no tempo real nao desfaz a operacao ja gravada no banco: so registra.
  if (!res.ok) console.error('[realtime] broadcast falhou', res.status, await res.text());
}
