ALTER TABLE "EmailCampaign" ADD COLUMN "htmlBody" TEXT NOT NULL DEFAULT '';

CREATE TABLE "EmailAttachment" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "contentBase64" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailAttachment_campaignId_idx" ON "EmailAttachment"("campaignId");
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;