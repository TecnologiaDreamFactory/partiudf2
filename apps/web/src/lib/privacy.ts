/**
 * Retorna "Primeiro S" (primeiro nome + inicial do sobrenome) para privacidade.
 * Se não houver sobrenome ou nome inválido, retorna só o que tiver ou "Anônimo".
 */
export function maskDisplayName(fullName: string): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return 'Anônimo';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Anônimo';
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();

  return `${first} ${initial}.`;
}
