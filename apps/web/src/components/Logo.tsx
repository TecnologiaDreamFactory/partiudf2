import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Tamanho em pixels (lado do quadrado). Default: 32. */
  size?: number;
  /** Texto alternativo, opcional. */
  alt?: string;
}

/**
 * Logo PARTIU DF.
 *
 * Usa o PNG estático em /logo2.png (versão oficial da marca, já versionada
 * em apps/web/public). Renderizamos com next/image desativado (uso de <img>)
 * para manter o componente puro e funcionar em qualquer contexto — inclusive
 * dentro de um header server-rendered.
 */
export function Logo({ className, size = 32, alt = 'PARTIU DF' }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo2.png"
      alt={alt}
      width={size}
      height={size}
      className={cn('object-contain select-none', className)}
      draggable={false}
    />
  );
}
