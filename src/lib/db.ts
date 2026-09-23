import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  return new PrismaClient({ log: ['query'] })
}

let db = globalForPrisma.prisma ?? createClient()
// Verify the cached client has the latest models. If any are missing,
// the cached instance is stale — recreate it.
if (
  typeof (db as unknown as { habitFreeze?: unknown }).habitFreeze !== 'object' ||
  typeof (db as unknown as { weeklyInsight?: unknown }).weeklyInsight !== 'object' ||
  typeof (db as unknown as { weeklyCoachLetter?: unknown }).weeklyCoachLetter !== 'object' ||
  typeof (db as unknown as { chatConversation?: unknown }).chatConversation !== 'object' ||
  typeof (db as unknown as { habitSuggestionLog?: unknown }).habitSuggestionLog !== 'object'
) {
  db = createClient()
}
globalForPrisma.prisma = db

export { db }