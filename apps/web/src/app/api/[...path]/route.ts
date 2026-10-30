import { dispatch, type Route } from '@/server/router';
import { authRoutes } from '@/server/routes/auth';
import { tripRoutes } from '@/server/routes/trips';
import { checkinRoutes } from '@/server/routes/checkins';
import { adminRoutes } from '@/server/routes/admin';

// API do PARTIU DF (antes: NestJS em apps/api). Mesmas URLs, agora sob /api.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const routes: Route[] = [
  ['GET', '/health', async () => ({ ok: true, ts: new Date().toISOString() })],
  ...authRoutes,
  ...tripRoutes,
  // ordem importa: /checkins/pickup-points antes de /checkins/:tripId
  ...checkinRoutes,
  ...adminRoutes,
];

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, { params }: Ctx) {
  const { path } = await params;
  return dispatch(routes, req, '/' + path.join('/'));
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
