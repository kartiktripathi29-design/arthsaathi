-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('PERSON', 'CHANNEL', 'BUSINESS', 'RAIL', 'RAW');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('ENGINE', 'USER', 'RULE');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('NAME_PENDING', 'STATEMENT_PENDING', 'REVIEW_PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('OLD', 'NEW');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LOGIN', 'LOGOUT', 'SIGNUP', 'PASSWORD_RESET', 'ONBOARDING_NAME_SET', 'ONBOARDING_ACCOUNT_ADDED', 'STATEMENT_UPLOAD', 'STATEMENT_PARSE_START', 'STATEMENT_PARSE_SUCCESS', 'STATEMENT_PARSE_FAIL', 'STATEMENT_DELETE', 'TXN_CLASSIFY', 'TXN_BULK_CLASSIFY', 'PERSON_TAG_SET', 'ENTITY_RESOLVED', 'SALARY_UPLOAD', 'SALARY_PARSE_SUCCESS', 'SALARY_PARSE_FAIL', 'TAX_CALC_RUN', 'TAX_REGIME_SELECTED', 'INVEST_PLAN_GENERATED', 'CHAT_SESSION_START', 'CHAT_MESSAGE_SENT', 'CHAT_MESSAGE_RECEIVED', 'ACCOUNT_DELETE', 'DATA_EXPORT_REQUESTED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('UNCLASSIFIED', 'TRANSFER_TO_PERSONS', 'TRANSFER_TO_BANK_ACCOUNT', 'SELF_TRANSFER', 'REFUND', 'SALARY', 'FREELANCE', 'BUSINESS_INCOME', 'INVESTMENT_RETURN', 'INTEREST_INCOME', 'OTHER_INCOME', 'GROCERIES', 'FOOD_RESTAURANT', 'TRANSPORT_FUEL', 'TRANSPORT_METRO', 'TRANSPORT_RIDESHARE', 'UTILITIES_TELECOM', 'UTILITIES_ELECTRICITY', 'UTILITIES_OTHER', 'RENT', 'HEALTH_PHARMACY', 'HEALTH_MEDICAL', 'SHOPPING_FASHION', 'SHOPPING_ECOMMERCE', 'SHOPPING_OTHER', 'ENTERTAINMENT', 'HOME_SERVICES', 'PROFESSIONAL_LEGAL', 'EDUCATION', 'TRAVEL', 'CREDIT_CARD_PAYMENT', 'EMI_LOAN', 'INSURANCE', 'INVESTMENT_SIP', 'INVESTMENT_RD', 'INVESTMENT_OTHER', 'OTHER_EXPENSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "legalName" TEXT,
    "nameAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "maskedNumber" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "originalName" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "txnCount" INTEGER NOT NULL DEFAULT 0,
    "parsedAt" TIMESTAMP(3),
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "accountId" TEXT,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "rawNarration" TEXT NOT NULL,
    "referenceNo" TEXT,
    "balanceAfter" DECIMAL(14,2),
    "what" TEXT,
    "why" TEXT,
    "whoName" TEXT,
    "entityId" TEXT,
    "category" "Category" NOT NULL DEFAULT 'UNCLASSIFIED',
    "source" "ClassificationSource" NOT NULL DEFAULT 'ENGINE',
    "confidence" DOUBLE PRECISION,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionTag" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" "TagKind" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "TransactionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "relationship" TEXT,
    "defaultCategory" "Category",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" "Category",
    "resolutionSource" TEXT,
    "notes" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "employer" TEXT,
    "components" JSONB NOT NULL,
    "netPay" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'NAME_PENDING',
    "monthlyIncome" DECIMAL(14,2),
    "taxRegime" "TaxRegime",
    "city" TEXT,
    "age" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_maskedNumber_key" ON "Account"("userId", "maskedNumber");

-- CreateIndex
CREATE INDEX "Statement_userId_idx" ON "Statement"("userId");

-- CreateIndex
CREATE INDEX "Statement_userId_periodEnd_idx" ON "Statement"("userId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_userId_contentHash_key" ON "Statement"("userId", "contentHash");

-- CreateIndex
CREATE INDEX "Transaction_userId_txnDate_idx" ON "Transaction"("userId", "txnDate");

-- CreateIndex
CREATE INDEX "Transaction_userId_category_idx" ON "Transaction"("userId", "category");

-- CreateIndex
CREATE INDEX "Transaction_userId_reviewed_idx" ON "Transaction"("userId", "reviewed");

-- CreateIndex
CREATE INDEX "Transaction_statementId_idx" ON "Transaction"("statementId");

-- CreateIndex
CREATE INDEX "Transaction_entityId_idx" ON "Transaction"("entityId");

-- CreateIndex
CREATE INDEX "TransactionTag_kind_value_idx" ON "TransactionTag"("kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTag_transactionId_kind_value_key" ON "TransactionTag"("transactionId", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_transactionId_key" ON "Classification"("transactionId");

-- CreateIndex
CREATE INDEX "Classification_userId_idx" ON "Classification"("userId");

-- CreateIndex
CREATE INDEX "PersonTag_userId_idx" ON "PersonTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonTag_userId_personName_key" ON "PersonTag"("userId", "personName");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_canonicalName_key" ON "Entity"("canonicalName");

-- CreateIndex
CREATE INDEX "Entity_canonicalName_idx" ON "Entity"("canonicalName");

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_userId_eventType_idx" ON "ActivityEvent"("userId", "eventType");

-- CreateIndex
CREATE INDEX "ActivityEvent_eventType_createdAt_idx" ON "ActivityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SalarySlip_userId_periodMonth_idx" ON "SalarySlip"("userId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_userId_periodMonth_key" ON "SalarySlip"("userId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionTag" ADD CONSTRAINT "TransactionTag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classification" ADD CONSTRAINT "Classification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTag" ADD CONSTRAINT "PersonTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
