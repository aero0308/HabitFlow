import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler, apiError } from "@/lib/api";
import { toDateString } from "@/lib/streak";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET_export(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "csv";
    if (format !== "csv") return apiError("Only CSV export is supported", 400);

    const habits = await db.habit.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const habitIds = habits.map((h) => h.id);
    const habitMap = new Map(habits.map((h) => [h.id, h]));

    const checkins = habitIds.length
      ? await db.checkin.findMany({
          where: { habitId: { in: habitIds } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        })
      : [];

    const rows: string[] = [];
    // Header
    rows.push([
      "date",
      "habit_id",
      "habit_name",
      "frequency",
      "target_count",
      "count",
      "completed",
      "note",
    ].map(csvEscape).join(","));

    for (const c of checkins) {
      const h = habitMap.get(c.habitId);
      if (!h) continue;
      rows.push([
        c.date,
        c.habitId,
        h.name,
        h.frequency,
        h.targetCount,
        c.count,
        c.count >= h.targetCount ? "true" : "false",
        c.note || "",
      ].map(csvEscape).join(","));
    }

    const csv = rows.join("\n");
    const filename = `habitflow-export-${toDateString(new Date())}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  })();
}
