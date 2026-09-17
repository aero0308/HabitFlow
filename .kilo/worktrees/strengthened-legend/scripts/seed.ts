// Seed script: creates a demo user with a FULL YEAR of realistic historical data.
// Run with: bun run seed
// Idempotent — wipes and recreates the demo user cleanly on each run.
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { recalculateStreak, toDateString } from "../src/lib/streak";

async function main() {
  console.log("🌱 Seeding database (full year of data)...\n");

  const email = "demo@habitflow.app";
  const password = "demo1234";

  // ---- Delete existing demo user (cascade deletes everything) ----
  await db.user.deleteMany({ where: { email } }).catch(() => {});

  // ---- Create user ----
  const user = await db.user.create({
    data: {
      email,
      hashedPassword: await hashPassword(password),
      name: "Alex Demo",
      firstName: "Alex",
      lastName: "Demo",
      timezone: "UTC",
      emailRemindersEnabled: true,
    },
  });
  console.log(`  ✓ Created user: ${user.email}`);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364); // 365 days including today
  startDate.setHours(0, 0, 0, 0);

  // ---- Define habits ----
  const habitDefs = [
    { name: "Morning Run", description: "30 min cardio", color: "#f59e0b", icon: "🏃", frequency: "daily", customDays: "", targetCount: 1, timeOfDay: "MORNING", completionRate: 0.60 },
    { name: "Drink Water", description: "Stay hydrated", color: "#0ea5e9", icon: "💧", frequency: "daily", customDays: "", targetCount: 8, timeOfDay: "ANY_TIME", completionRate: 0.85 },
    { name: "Read a Book", description: "At least 20 pages", color: "#8b5cf6", icon: "📚", frequency: "daily", customDays: "", targetCount: 1, timeOfDay: "EVENING", completionRate: 0.70 },
    { name: "Meditate", description: "10 min mindfulness", color: "#10b981", icon: "🧘", frequency: "custom", customDays: "0,2,4", targetCount: 1, timeOfDay: "MORNING", completionRate: 0.75 },
    { name: "Journal", description: "Daily reflection", color: "#ec4899", icon: "✍️", frequency: "daily", customDays: "", targetCount: 1, timeOfDay: "EVENING", completionRate: 0.65 },
    { name: "Gym", description: "Strength training", color: "#6366f1", icon: "💪", frequency: "custom", customDays: "1,3,5", targetCount: 1, timeOfDay: "AFTERNOON", completionRate: 0.55 },
  ];

  // ---- Create off-mode periods (2-3 per year) ----
  const offModeRanges: { start: Date; end: Date; reason: string }[] = [
    { start: new Date(today.getFullYear(), 5, 15), end: new Date(today.getFullYear(), 5, 28), reason: "Vacation" },
    { start: new Date(today.getFullYear(), 10, 20), end: new Date(today.getFullYear(), 10, 27), reason: "Holiday" },
    { start: new Date(today.getFullYear(), 2, 10), end: new Date(today.getFullYear(), 2, 17), reason: "Sick leave" },
  ];

  for (const om of offModeRanges) {
    await db.offMode.create({
      data: {
        userId: user.id,
        startDate: toDateString(om.start),
        endDate: toDateString(om.end),
        reason: om.reason,
      },
    });
  }
  console.log(`  ✓ Created ${offModeRanges.length} off-mode periods`);

  // ---- Helper: check if a date is in an off-mode range ----
  function isInOffMode(dateStr: string): boolean {
    return offModeRanges.some((om) => {
      const s = toDateString(om.start);
      const e = toDateString(om.end);
      return dateStr >= s && dateStr <= e;
    });
  }

  // ---- Helper: is habit scheduled on this day? ----
  function isScheduled(h: typeof habitDefs[0], date: Date): boolean {
    const jsDay = date.getDay();
    const monFirst = jsDay === 0 ? 6 : jsDay - 1;
    if (h.frequency === "daily") return true;
    if (h.frequency === "custom") {
      return h.customDays.split(",").filter(Boolean).map(Number).includes(monFirst);
    }
    return false;
  }

  // ---- Seeded RNG ----
  const rng = mulberry32(42);

  // ---- Create habits ----
  const createdHabits: { id: string; name: string; icon: string; targetCount: number }[] = [];

  for (let i = 0; i < habitDefs.length; i++) {
    const h = habitDefs[i];
    const habit = await db.habit.create({
      data: {
        userId: user.id,
        name: h.name,
        description: h.description,
        color: h.color,
        icon: h.icon,
        frequency: h.frequency,
        customDays: h.customDays,
        targetCount: h.targetCount,
        timeOfDay: h.timeOfDay,
        startDate,
        position: i,
        isArchived: false,
        category: "",
      },
    });
    createdHabits.push({ id: habit.id, name: habit.name, icon: habit.icon, targetCount: habit.targetCount });
    console.log(`  ✓ Created habit: ${h.icon} ${h.name}`);
  }

  // ---- Generate check-ins (365 days) ----
  let totalCheckins = 0;
  const dayByDayCompletion: Map<string, number> = new Map(); // date -> count completed

  // Pre-compute week types for natural randomness
  const weekTypes: { type: "normal" | "perfect" | "slump" }[] = [];
  const totalWeeks = Math.ceil(365 / 7);
  for (let w = 0; w < totalWeeks; w++) {
    const r = rng();
    if (r < 0.05) weekTypes.push({ type: "perfect" });
    else if (r < 0.15) weekTypes.push({ type: "slump" });
    else weekTypes.push({ type: "normal" });
  }

  for (const habit of createdHabits) {
    const hDef = habitDefs.find((d) => d.name === habit.name)!;
    const cursor = new Date(startDate);
    let dayIndex = 0;

    while (cursor <= today) {
      const ds = toDateString(cursor);

      // Skip off-mode days
      if (isInOffMode(ds)) {
        cursor.setDate(cursor.getDate() + 1);
        dayIndex++;
        continue;
      }

      // Check if scheduled
      if (!isScheduled(hDef, cursor)) {
        cursor.setDate(cursor.getDate() + 1);
        dayIndex++;
        continue;
      }

      // Determine week type
      const weekIdx = Math.floor(dayIndex / 7);
      const weekType = weekTypes[weekIdx] ?? { type: "normal" };

      // Determine if completed
      let completed = false;
      let count = 0;

      if (weekType.type === "perfect") {
        completed = rng() < 0.95;
      } else if (weekType.type === "slump") {
        completed = rng() < 0.30;
      } else {
        completed = rng() < hDef.completionRate;
      }

      if (completed) {
        if (habit.targetCount > 1) {
          // Drink Water: random count between 4 and 8, weighted toward 8
          const r = rng();
          if (r < 0.5) count = 8;
          else if (r < 0.75) count = 7;
          else if (r < 0.9) count = 6;
          else count = Math.max(4, Math.floor(rng() * 6) + 4);
        } else {
          count = 1;
        }

        await db.checkin.create({
          data: {
            habitId: habit.id,
            date: ds,
            count,
            note: "",
          },
        });
        totalCheckins++;

        // Track completion for mood correlation
        dayByDayCompletion.set(ds, (dayByDayCompletion.get(ds) ?? 0) + 1);
      }

      cursor.setDate(cursor.getDate() + 1);
      dayIndex++;
    }

    // Calculate streaks
    await recalculateStreak(habit.id, today);
  }
  console.log(`  ✓ Created ${totalCheckins} check-ins across 365 days`);

  // ---- Generate mood entries (365 days) ----
  let totalMoods = 0;
  const moodTagsList = ["tired", "motivated", "stressed", "calm", "energized", "focused", "happy", "anxious"];
  const moodNotesList = [
    "Felt great after the morning run!",
    "A bit tired but productive.",
    "Stressed about deadlines at work.",
    "Calm and focused today.",
    "Low energy, skipped workout.",
    "Amazing day, got everything done.",
    "Feeling anxious about tomorrow.",
    "Relaxed evening, good progress.",
    "Productive morning, lazy afternoon.",
    "Grateful for today.",
    "Rough start but turned it around.",
    "Perfect balance of work and rest.",
  ];

  // Pick 3-5 random extreme days
  const extremeDays = new Set<number>();
  while (extremeDays.size < 4) {
    extremeDays.add(Math.floor(rng() * 365));
  }

  const moodCursor = new Date(startDate);
  let moodDayIndex = 0;

  while (moodCursor <= today) {
    const ds = toDateString(moodCursor);

    // Skip off-mode days
    if (isInOffMode(ds)) {
      moodCursor.setDate(moodCursor.getDate() + 1);
      moodDayIndex++;
      continue;
    }

    const completedCount = dayByDayCompletion.get(ds) ?? 0;

    // Base mood calculation
    let score = 6.5;
    if (completedCount === 0) {
      score -= 1.5;
    } else {
      score += completedCount * 0.5;
    }
    score = Math.min(10, score);

    // Random noise ±1.0
    score += (rng() - 0.5) * 2;

    // Extreme days
    const isExtreme = extremeDays.has(moodDayIndex);
    if (isExtreme) {
      if (rng() < 0.5) {
        score = 9 + rng(); // 9-10
      } else {
        score = 1 + rng() * 2; // 1-3
      }
    }

    score = Math.max(1, Math.min(10, Math.round(score)));

    // Tags on ~40% of entries
    const tags: string[] = [];
    if (rng() < 0.40) {
      const tagCount = 1 + Math.floor(rng() * 2);
      for (let t = 0; t < tagCount; t++) {
        const tag = moodTagsList[Math.floor(rng() * moodTagsList.length)];
        if (!tags.includes(tag)) tags.push(tag);
      }
    }

    // Notes on ~30% of entries (always on extreme days)
    let note = "";
    if (isExtreme || rng() < 0.25) {
      note = moodNotesList[Math.floor(rng() * moodNotesList.length)];
      if (isExtreme && score <= 3) {
        note = "Really tough day. Taking it one step at a time.";
      } else if (isExtreme && score >= 9) {
        note = "One of the best days in a while! Everything clicked.";
      }
    }

    await db.moodEntry.create({
      data: {
        userId: user.id,
        date: ds,
        score,
        note,
        tags: tags.join(","),
      },
    });
    totalMoods++;

    moodCursor.setDate(moodCursor.getDate() + 1);
    moodDayIndex++;
  }
  console.log(`  ✓ Created ${totalMoods} mood entries`);

  // ---- Get current streak for Drink Water ----
  const drinkWaterHabit = createdHabits.find((h) => h.name === "Drink Water");
  let drinkWaterStreak = 0;
  if (drinkWaterHabit) {
    const streak = await db.streak.findUnique({ where: { habitId: drinkWaterHabit.id } });
    drinkWaterStreak = streak?.currentStreak ?? 0;
  }

  // ---- Summary ----
  console.log("\n✅ Demo user created");
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Habits: ${createdHabits.length}`);
  console.log(`   Check-ins: ${totalCheckins}`);
  console.log(`   Mood entries: ${totalMoods}`);
  console.log(`   Off-mode periods: ${offModeRanges.length}`);
  console.log(`   Current streak (Drink Water): ${drinkWaterStreak} days`);
}

// Seeded RNG for deterministic data
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
