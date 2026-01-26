-- CreateTable for FiatOrder
CREATE TABLE IF NOT EXISTS "FiatOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bankAccount" TEXT NOT NULL,
    "bankName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FiatOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FiatOrder_userId_idx" ON "FiatOrder"("userId");
CREATE INDEX "FiatOrder_status_idx" ON "FiatOrder"("status");
