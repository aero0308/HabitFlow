import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Recreate the client if the cached instance doesn't have the newest models.
// This guards against schema changes during dev HMR not being picked up.
function createClient() {
  return new PrismaClient({ log: ['query'] })
}

let db = globalForPrisma.prisma ?? createClient()
// Verify the client has the HabitFreeze model (added in a later migration).
// If not, the cached instance is stale — recreate it.
if (typeof (db as unknown as { habitFreeze?: unknown }).habitFreeze !== 'object') {
  db = createClient()
}
globalForPrisma.prisma = db

export { db }