-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Machine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "username" TEXT,
    "password" TEXT,
    "port" INTEGER NOT NULL DEFAULT 22,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "roomId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Machine_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Machine" ("createdAt", "id", "ipAddress", "name", "roomId", "status", "updatedAt") SELECT "createdAt", "id", "ipAddress", "name", "roomId", "status", "updatedAt" FROM "Machine";
DROP TABLE "Machine";
ALTER TABLE "new_Machine" RENAME TO "Machine";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
