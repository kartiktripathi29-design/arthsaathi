-- BUG-8 cloud persistence (privacy model B+). One row per user holding an encrypted JSON blob
-- of all `av_*`/`as_*` localStorage keys. NOT yet applied to any environment — run
-- `prisma migrate deploy` (prod) or `prisma migrate dev` (local) when real auth is in place.

-- CreateTable
CREATE TABLE "UserData" (
    "userId" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserData_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserData" ADD CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
