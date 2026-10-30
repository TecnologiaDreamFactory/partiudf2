-- Supabase publica as tabelas do schema "public" na Data API (REST/GraphQL).
-- O app so acessa o banco pelo Prisma (usuario postgres, que ignora RLS), entao
-- RLS ligado e SEM politicas = ninguem le nada pela Data API com a chave anon.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PickupPoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checkin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Realtime em canais privados: quem tem a chave anon pode OUVIR os broadcasts
-- (posicao da van, check-ins), mas nao ENVIAR — nao existe politica de INSERT.
-- So o servidor publica, com a service role key (que ignora RLS).
CREATE POLICY "partiudf_anon_le_broadcast"
  ON "realtime"."messages"
  FOR SELECT
  TO anon, authenticated
  USING ("realtime"."messages"."extension" = 'broadcast');
