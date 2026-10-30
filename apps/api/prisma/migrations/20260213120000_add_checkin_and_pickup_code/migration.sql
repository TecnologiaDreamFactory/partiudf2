-- AlterTable: Add code to PickupPoint (required, unique)
ALTER TABLE `PickupPoint` ADD COLUMN `code` VARCHAR(191) NULL;

UPDATE `PickupPoint` SET `code` = CONCAT('MIG_', `id`) WHERE `code` IS NULL;

ALTER TABLE `PickupPoint` MODIFY COLUMN `code` VARCHAR(191) NOT NULL,
ADD UNIQUE INDEX `PickupPoint_code_key`(`code`);

-- AlterTable: Add name and avatarUrl to User (optional)
ALTER TABLE `User` ADD COLUMN `name` VARCHAR(191) NULL,
ADD COLUMN `avatarUrl` VARCHAR(191) NULL;

-- CreateTable: Checkin (MySQL uses ENUM in column, no separate type)
CREATE TABLE `Checkin` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `pickupPointId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Checkin` ADD CONSTRAINT `Checkin_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Checkin` ADD CONSTRAINT `Checkin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Checkin` ADD CONSTRAINT `Checkin_pickupPointId_fkey` FOREIGN KEY (`pickupPointId`) REFERENCES `PickupPoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
