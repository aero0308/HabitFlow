import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler } from "@/lib/api";

/** GET /api/habits/search?q=... — fuzzy search habits by name/category */
export async function GET_search(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    if (!q.trim()) return Response.json({ habits: [] });

    const habits = await db.habit.findMany({
      where: {
        userId: user.id,
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { position: "asc" },
      take: 20,
      include: { streak: true },
    });

    return Response.json({
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        category: h.category,
        timeOfDay: h.timeOfDay,
        currentStreak: h.streak?.currentStreak ?? 0,
      })),
    });
  })();
}
