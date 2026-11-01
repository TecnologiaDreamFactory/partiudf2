'use client';

import { useEffect, useState } from 'react';
import { fetchTripReport, type TripReport as Report } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

/** YYYY-MM-DD no fuso do aparelho ('sv-SE' formata assim). */
const ymd = (d: Date) => d.toLocaleDateString('sv-SE');
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min`;
}

function downloadCsv(report: Report, from: string, to: string) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Inicio', 'Fim', 'Duracao (min)', 'Motorista', 'Email do motorista', 'Pessoas', 'Status'];
  const rows = report.trips.map((t) =>
    [
      new Date(t.startedAt).toLocaleString('pt-BR'),
      t.endedAt ? new Date(t.endedAt).toLocaleString('pt-BR') : '',
      t.durationMinutes == null ? '' : String(t.durationMinutes),
      t.driverName ?? '',
      t.driverEmail,
      String(t.viewers),
      t.status === 'ACTIVE' ? 'Em andamento' : 'Encerrada',
    ]
      .map(escape)
      .join(','),
  );
  const totalMinutes = report.trips.reduce((sum, t) => sum + (t.durationMinutes ?? 0), 0);
  // totais do período no fim da planilha ("pessoas" conta cada aparelho uma vez só)
  const totals = [
    ['Total de viagens', String(report.trips.length)],
    ['Tempo total', formatDuration(totalMinutes)],
    ['Pessoas diferentes', String(report.uniqueViewers)],
  ].map((r) => r.map(escape).join(','));
  // BOM: o Excel abre acentos certos
  const csv = '﻿' + [header.map(escape).join(','), ...rows, '', ...totals].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `viagens-${from}-a-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Relatório de viagens: na tela só o período; o detalhe de cada viagem
 * (duração, motorista, pessoas) e os totais vão no CSV.
 */
export function TripReport() {
  const [from, setFrom] = useState(() => ymd(daysAgo(30)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setLoading(true);
    setError('');
    // datas locais; "até" inclui o dia inteiro
    const end = new Date(`${to}T00:00`);
    end.setDate(end.getDate() + 1);
    fetchTripReport(new Date(`${from}T00:00`), end)
      .then((r) => alive && setReport(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Erro ao carregar relatório'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const trips = report?.trips ?? [];

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-df-ink">relatório de viagens</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth={false}
          disabled={!report || trips.length === 0}
          onClick={() => report && downloadCsv(report, from, to)}
        >
          Baixar CSV
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Input label="De" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Até" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error && <p className="mb-4 text-sm text-df-danger">{error}</p>}

      {loading && <p className="text-sm text-df-muted">Carregando…</p>}
      {!loading && trips.length === 0 && (
        <p className="text-sm text-df-muted">Nenhuma viagem nesse período.</p>
      )}
    </Card>
  );
}
