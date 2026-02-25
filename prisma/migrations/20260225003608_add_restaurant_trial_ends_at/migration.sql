-- DropIndex
DROP INDEX "Restaurant_userId_idx";

-- DropIndex
DROP INDEX "User_restaurantId_idx";

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
