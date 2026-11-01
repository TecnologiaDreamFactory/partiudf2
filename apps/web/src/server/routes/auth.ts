import 'server-only';
import bcrypt from 'bcryptjs';
// import { randomBytes } from 'node:crypto'; // RESERVA (desativada no MVP)
import { prisma } from '@/server/db';
import {
  assertNumericPassword,
  badRequest,
  forbidden,
  readBody,
  requireUser,
  signToken,
  str,
  unauthorized,
  type Role,
} from '@/server/http';
import type { Route } from '@/server/router';

const SALT_ROUNDS = 10;
// RESERVA (desativada no MVP)
// const GUEST_UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DbUser = {
  id: string;
  email: string;
  role: Role;
  name: string | null;
  avatarUrl: string | null;
  mustChangePassword: boolean;
};

const publicUser = (u: DbUser) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  name: u.name ?? null,
  avatarUrl: u.avatarUrl ?? null,
  mustChangePassword: u.mustChangePassword,
});

export const hashPassword = (pw: string) => bcrypt.hash(pw, SALT_ROUNDS);

async function updateProfile(req: Request) {
  const { userId } = requireUser(req);
  const body = await readBody(req);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.avatarUrl !== undefined && { avatarUrl: str(body.avatarUrl) || null }),
      ...(body.name !== undefined && { name: str(body.name) || null }),
    },
  });
  return publicUser(user);
}

export const authRoutes: Route[] = [
  [
    'POST',
    '/auth/login',
    async (req) => {
      const body = await readBody(req);
      const pw = assertNumericPassword(body.password);
      const user = await prisma.user.findUnique({ where: { email: str(body.email) } });
      if (!user || !(await bcrypt.compare(pw, user.password))) throw unauthorized();
      if (!user.active) throw forbidden('Usuário inativo. Fale com o administrador.');
      // admin fica 30 dias; motorista 12h (um turno: o celular é compartilhado); passageiro com login, 1h
      const expiresIn = user.role === 'ADMIN' ? '30d' : user.role === 'DRIVER' ? '12h' : '1h';
      return { token: signToken({ userId: user.id, role: user.role }, expiresIn), user: publicUser(user) };
    },
  ],
  // RESERVA (desativada no MVP): o passageiro so acompanha a van, sem sessao.
  // Para religar a reserva, descomente esta rota (e o import randomBytes
  // e GUEST_UUID_RE) junto com os blocos "RESERVA" de app/page.tsx.
  // [
  //   // Sessao anonima de passageiro (sem tela de login): um User PASSENGER por navegador.
  //   'POST',
  //   '/auth/passenger-session',
  //   async (req) => {
  //     const gid = str((await readBody(req)).guestId);
  //     if (!GUEST_UUID_RE.test(gid)) throw badRequest('guestId inválido (use um UUID v4)');
  //     const email = `guest_${gid}@passenger.local`;
  //     const user =
  //       (await prisma.user.findUnique({ where: { email } })) ??
  //       (await prisma.user.create({
  //         data: {
  //           email,
  //           password: await hashPassword(randomBytes(32).toString('hex')),
  //           role: 'PASSENGER',
  //           name: 'Passageiro',
  //         },
  //       }));
  //     return { token: signToken({ userId: user.id, role: user.role }, '365d'), user: publicUser(user) };
  //   },
  // ],
  [
    'GET',
    '/auth/me',
    async (req) => {
      const { userId, role } = requireUser(req);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user ? publicUser(user) : { id: userId, email: '', role };
    },
  ],
  [
    'PATCH',
    '/auth/password',
    async (req) => {
      const { userId } = requireUser(req);
      const body = await readBody(req);
      const current = assertNumericPassword(body.currentPassword);
      const next = assertNumericPassword(body.newPassword);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !(await bcrypt.compare(current, user.password))) throw unauthorized();
      if (next === current) throw badRequest('A nova senha precisa ser diferente da atual');
      await prisma.user.update({
        where: { id: userId },
        data: { password: await hashPassword(next), mustChangePassword: false },
      });
      return { ok: true };
    },
  ],
  ['PATCH', '/auth/me', updateProfile],
  ['PATCH', '/users/me', updateProfile],
];
