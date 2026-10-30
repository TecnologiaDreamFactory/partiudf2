-- CreateIndex: 1 check-in ativo por usuário/trip
CREATE UNIQUE INDEX `Checkin_tripId_userId_key` ON `Checkin`(`tripId`, `userId`);
