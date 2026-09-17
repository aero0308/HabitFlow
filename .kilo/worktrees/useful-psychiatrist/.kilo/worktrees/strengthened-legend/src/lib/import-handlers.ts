import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { withErrorHandler, apiError } from "@/lib/api";
import { recalculateStreak } from "@/lib/streak";
import { z } from "zod";

// Parse a single CSV line into fields, handling quoted values with embedded commas/quotes/newlines.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let current = "";
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

// Split CSV text into lines, joining quoted multi-line fields.
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // toggle quote state (account for escaped "")
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      // skip \r\n pairs
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim() !== "") lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") lines.push(current);
  return lines;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST_import(req: Request) {
  return withErrorHandler(async () => {
    const user = await requireUser();
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("text/csv") && !contentType.includes("text/plain") && !contentType.includes("application/octet-stream")) {
      return apiError("Content-Type must be text/csv", 415, "UNSUPPORTED_MEDIA_TYPE");
    }

    const text = await req.text();
    if (!text.trim()) return apiError("CSV file is empty", 422, "EMPTY");

    const lines = splitCsvLines(text);
    if (lines.length < 2) return apiError("CSV has no data rows", 422, "NO_DATA");

    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const required = ["date", "habit_name", "count"];
    for (const r of required) {
      if (!header.includes(r)) {
        return apiError(`CSV missing required column: ${r}. Expected header: date,habit_name,...,count`, 422, "INVALID_HEADER");
      }
    }
    const idx = {
      date: header.indexOf("date"),
      habitName: header.indexOf("habit_name"),
      frequency: header.indexOf("frequency"),
      targetCount: header.indexOf("target_count"),
      count: header.indexOf("count"),
      note: header.indexOf("note"),
    };

    // Group rows by habit name so we create each habit once
    const byHabit = new Map<string, { date: string; count: number; note: string; frequency?: string; targetCount?: number }[]>();
    let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const date = (fields[idx.date] ?? "").trim();
      const habitName = (fields[idx.habitName] ?? "").trim();
      const countStr = (fields[idx.count] ?? "").trim();
      const note = idx.note >= 0 ? (fields[idx.note] ?? "").trim() : "";
      const frequency = idx.frequency >= 0 ? (fields[idx.frequency] ?? "").trim() : "";
      const targetCountStr = idx.targetCount >= 0 ? (fields[idx.targetCount] ?? "").trim() : "";

      if (!date || !habitName || !DATE_RE.test(date)) {
        skipped++;
        continue;
      }
      const count = Number(countStr) || 1;
      const targetCount = targetCountStr ? Number(targetCountStr) : undefined;
      const list = byHabit.get(habitName) ?? [];
      list.push({ date, count, note, frequency: frequency || undefined, targetCount: targetCount && !Number.isNaN(targetCount) ? targetCount : undefined });
      byHabit.set(habitName, list);
    }

    if (byHabit.size === 0) return apiError("No valid rows found in CSV", 422, "NO_VALID_ROWS");

    // Fetch existing habits for this user to match by name (case-insensitive)
    const existingHabits = await db.habit.findMany({ where: { userId: user.id } });
    const existingByName = new Map(existingHabits.map((h) => [h.name.toLowerCase(), h]));

    let habitsCreated = 0;
    let habitsMatched = 0;
    let checkinsCreated = 0;
    let checkinsSkipped = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Process in a transaction-ish loop (create habits, then checkins)
    const habitIdMap = new Map<string, string>(); // habitName -> habitId
    for (const [habitName, rows] of byHabit) {
      const existing = existingByName.get(habitName.toLowerCase());
      let habitId: string;
      let targetCount = 1;
      if (existing) {
        habitId = existing.id;
        targetCount = existing.targetCount;
        habitsMatched++;
      } else {
        // Create a new habit with sensible defaults derived from the CSV rows
        const firstRow = rows[0];
        const freq = firstRow.frequency && ["daily", "weekly", "custom"].includes(firstRow.frequency) ? firstRow.frequency : "daily";
        targetCount = firstRow.targetCount ?? 1;
        const created = await db.habit.create({
          data: {
            userId: user.id,
            name: habitName,
            description: "",
            color: "#10b981",
            icon: "✅",
            frequency: freq,
            customDays: "",
            targetCount,
            startDate: new Date(rows[0].date + "T00:00:00"),
            position: existingHabits.length + habitsCreated,
            isArchived: false,
            category: "",
          },
        });
        habitId = created.id;
        habitsCreated++;
      }
      habitIdMap.set(habitName, habitId);

      // Upsert check-ins for this habit
      for (const row of rows) {
        // Don't import future-dated check-ins
        if (row.date > todayStr) {
          checkinsSkipped++;
          continue;
        }
        try {
          await db.checkin.upsert({
            where: { habitId_date: { habitId, date: row.date } },
            create: { habitId, date: row.date, count: row.count, note: row.note || "" },
            update: { count: row.count, note: row.note || "" },
          });
          checkinsCreated++;
        } catch {
          checkinsSkipped++;
        }
      }
      // Recalculate streaks for the habit
      await recalculateStreak(habitId);
    }

    return Response.json({
      ok: true,
      summary: {
        habitsCreated,
        habitsMatched,
        checkinsCreated,
        checkinsSkipped,
        rowsSkipped: skipped,
      },
    });
  })();
}
