-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "machineId" INTEGER;

-- CreateIndex
CREATE INDEX "ActivityLog_machineId_idx" ON "ActivityLog"("machineId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
