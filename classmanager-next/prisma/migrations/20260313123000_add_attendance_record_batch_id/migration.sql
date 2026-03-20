-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN "batch_id" UUID;

-- CreateIndex
CREATE INDEX "attendance_records_class_id_batch_id_idx" ON "attendance_records"("class_id", "batch_id");
