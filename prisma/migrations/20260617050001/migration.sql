-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('MONTHLY', 'PAY_AS_YOU_GO');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "name" TEXT,
    "type" "PlanType" NOT NULL DEFAULT 'MONTHLY',
    "price" DECIMAL(65,30) NOT NULL,
    "billing_period" TEXT DEFAULT 'monthly',
    "credits" INTEGER DEFAULT 0,
    "benefits" TEXT[],
    "stripe_product_id" TEXT,
    "stripe_price_id" TEXT,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "stripe_subscription_id" TEXT,
    "remaining_credits" INTEGER,
    "plan_type" "PlanType" NOT NULL DEFAULT 'MONTHLY',
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_end" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
