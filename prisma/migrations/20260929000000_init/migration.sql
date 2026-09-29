CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED');
CREATE TYPE "CampaignStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "googleId" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "avatarUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserTenant" (
  "userId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
  CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("userId", "tenantId")
);
CREATE TABLE "Sender" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "smtpHost" TEXT NOT NULL, "smtpPort" INTEGER NOT NULL DEFAULT 587, "smtpUser" TEXT NOT NULL,
  "smtpPassword" TEXT NOT NULL, "hourlyLimit" INTEGER, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmailCampaign" (
  "id" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL, "delayMs" INTEGER NOT NULL, "hourlyLimit" INTEGER,
  "senderId" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScheduledEmail" (
  "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED', "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "failureReason" TEXT, "bullJobId" TEXT,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ScheduledEmail_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SlackConnection" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "accessToken" TEXT NOT NULL, "teamId" TEXT, "teamName" TEXT,
  "channelId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "UserTenant_tenantId_idx" ON "UserTenant"("tenantId");
CREATE UNIQUE INDEX "Sender_tenantId_email_key" ON "Sender"("tenantId", "email");
CREATE INDEX "Sender_tenantId_isActive_idx" ON "Sender"("tenantId", "isActive");
CREATE INDEX "EmailCampaign_tenantId_createdAt_idx" ON "EmailCampaign"("tenantId", "createdAt");
CREATE UNIQUE INDEX "EmailCampaign_idempotencyKey_key" ON "EmailCampaign"("idempotencyKey");
CREATE UNIQUE INDEX "ScheduledEmail_bullJobId_key" ON "ScheduledEmail"("bullJobId");
CREATE UNIQUE INDEX "ScheduledEmail_idempotencyKey_key" ON "ScheduledEmail"("idempotencyKey");
CREATE INDEX "ScheduledEmail_tenantId_status_scheduledAt_idx" ON "ScheduledEmail"("tenantId", "status", "scheduledAt");
CREATE INDEX "ScheduledEmail_senderId_scheduledAt_idx" ON "ScheduledEmail"("senderId", "scheduledAt");
CREATE INDEX "ScheduledEmail_campaignId_idx" ON "ScheduledEmail"("campaignId");
CREATE UNIQUE INDEX "ScheduledEmail_campaignId_recipient_key" ON "ScheduledEmail"("campaignId", "recipient");
CREATE UNIQUE INDEX "SlackConnection_tenantId_key" ON "SlackConnection"("tenantId");

ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sender" ADD CONSTRAINT "Sender_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledEmail" ADD CONSTRAINT "ScheduledEmail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
