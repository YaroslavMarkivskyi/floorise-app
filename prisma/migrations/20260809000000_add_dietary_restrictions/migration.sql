-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "dietary_restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dietary_notes" TEXT;
