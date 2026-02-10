-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Restaurant_stripeCustomerId_key" ON "Restaurant"("stripeCustomerId");
