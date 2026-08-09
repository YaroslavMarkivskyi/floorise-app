-- AlterTable
ALTER TABLE "shopping_lists" ADD COLUMN     "silpo_checkout_url" TEXT;

-- CreateTable
CREATE TABLE "silpo_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "silpo_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "silpo_connections_user_id_key" ON "silpo_connections"("user_id");

-- AddForeignKey
ALTER TABLE "silpo_connections" ADD CONSTRAINT "silpo_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
