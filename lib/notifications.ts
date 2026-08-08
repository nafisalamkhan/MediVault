import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Medication } from "@/lib/db/schema";
import {
  getAllMedications,
  updateMedicationReminder,
  setMedicationReminderNotificationIds,
} from "@/lib/db";

const CHANNEL_ID = "medication-reminders";

const BANGLA_DIGITS: Record<string, string> = {
  "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
  "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯",
};

export function toBanglaDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => BANGLA_DIGITS[d] ?? d);
}

function toBanglaDose(input: string): string {
  let s = (input || "")
    .trim()
    .replace(/\b(\d+(?:\.\d+)?)\s?mg\b/gi, "$1 মিগ্রা")
    .replace(/\b(\d+(?:\.\d+)?)\s?mcg\b/gi, "$1 মাইক্রোগ্রাম")
    .replace(/\b(\d+(?:\.\d+)?)\s?ml\b/gi, "$1 মিলি")
    .replace(/\b(\d+(?:\.\d+)?)\s?g\b/gi, "$1 গ্রাম")
    .replace(/\b(\d+(?:\.\d+)?)\s?iu\b/gi, "$1 ইউনিট")
    .replace(/\bmg\b/gi, "মিগ্রা")
    .replace(/\bmcg\b/gi, "মাইক্রোগ্রাম")
    .replace(/\bml\b/gi, "মিলি")
    .replace(/\bg\b/gi, "গ্রাম")
    .replace(/\biu\b/gi, "ইউনিট");
  return toBanglaDigits(s);
}

export interface MedicationScheduleResult {
  enabled: boolean;
  times: string[];
  reminderNotificationIds: string;
}

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "ওষুধের রিমাইন্ডার",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
}

export async function requestReminderPermissions(): Promise<boolean> {
  await ensureReminderChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export function parseReminderTimes(json: string): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter((t) => {
      if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return false;
      const [h, m] = t.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    });
  } catch {
    return [];
  }
}

const MORNING = "08:00";
const NOON = "13:00";
const EVENING = "20:00";
const NIGHT = "21:00";

const NIGHT_WORDS = /(night|bedtime|\bhs\b|রাতে|রাতের|শোবার|ঘুম)/i;
const EVENING_WORDS = /(evening|dinner|সন্ধ্যা|সন্ধ্যায়|সন্ধ্যায়)/i;
const MORNING_WORDS = /(morning|breakfast|সকাল|সকালে)/i;
const NOON_WORDS = /(noon|afternoon|lunch|দুপুর|দুপুরে)/i;

export function deriveReminderTimes(frequency: string): string[] {
  const f = (frequency || "").trim();
  if (!f) return [];

  if (
    /\b(?:sos|prn|as needed)\b/i.test(f) ||
    /(?:^|[^\p{L}])(?:যখন প্রয়োজন|প্রয়োজন)(?:$|[^\p{L}])/u.test(f)
  ) {
    return [];
  }

  const digit = f.match(/(\d+)\s*[+\-]\s*(\d+)(?:\s*[+\-]\s*(\d+))?/);
  if (digit) {
    const lastSlot = NIGHT_WORDS.test(f) ? NIGHT : EVENING;
    const slots = digit[3] ? [MORNING, NOON, lastSlot] : [MORNING, lastSlot];
    const times: string[] = [];
    for (let i = 0; i < slots.length; i++) {
      if (parseInt(digit[i + 1], 10) > 0) times.push(slots[i]);
    }
    return times;
  }

  if (/(twice|two times|2 times|\bbid\b|b\.d|দুইবার|২ বার)/i.test(f)) {
    return [MORNING, EVENING];
  }
  if (/(three times|thrice|3 times|\btds\b|তিনবার|৩ বার)/i.test(f)) {
    return [MORNING, NOON, EVENING];
  }
  if (/(four times|4 times|\bqid\b|চারবার|৪ বার)/i.test(f)) {
    return ["08:00", "12:00", "16:00", "20:00"];
  }
  if (/(once|daily|every day|\bod\b|o\.d|দিনে একবার|একবার|১ বার|প্রতিদিন)/i.test(f)) {
    return ["09:00"];
  }

  if (NIGHT_WORDS.test(f)) return [NIGHT];
  if (EVENING_WORDS.test(f)) return [EVENING];
  if (MORNING_WORDS.test(f)) return [MORNING];
  if (NOON_WORDS.test(f)) return [NOON];

  return [];
}

export function formatReminderTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatReminderTimes(times: string[]): string {
  return times.map(formatReminderTime).join(", ");
}

function banglaFrequency(frequency: string): string {
  const f = (frequency || "").trim().toLowerCase();
  if (!f) return "";

  const digit = f.match(/(\d+)\s*[+\-]\s*(\d+)(?:\s*[+\-]\s*(\d+))?/);
  if (digit) {
    const three = Boolean(digit[3]);
    const last = NIGHT_WORDS.test(f) ? "রাতে" : "সন্ধ্যায়";
    const slots = three
      ? ["সকালে", "দুপুরে", "রাতে"]
      : ["সকালে", last];
    const labels: string[] = [];
    for (let i = 0; i < slots.length; i++) {
      const n = parseInt(digit[i + 1] || "0", 10);
      if (n > 0) labels.push(`${slots[i]} ${toBanglaDigits(String(n))} বার`);
    }
    if (labels.length > 0) return labels.join(", ");
    return toBanglaDigits(f);
  }

  if (/(twice|two times|2 times|\bbid\b|b\.d|দুইবার|২ বার)/i.test(f)) {
    return "দিনে ২ বার";
  }
  if (/(three times|thrice|3 times|\btds\b|তিনবার|৩ বার)/i.test(f)) {
    return "দিনে ৩ বার";
  }
  if (/(four times|4 times|\bqid\b|চারবার|৪ বার)/i.test(f)) {
    return "দিনে ৪ বার";
  }
  if (/(once|daily|every day|\bod\b|o\.d|দিনে একবার|একবার|১ বার|প্রতিদিন)/i.test(f)) {
    return "দিনে ১ বার";
  }
  if (NIGHT_WORDS.test(f)) return "রাতে ১ বার";
  if (EVENING_WORDS.test(f)) return "সন্ধ্যায় ১ বার";
  if (NOON_WORDS.test(f)) return "দুপুরে ১ বার";
  if (MORNING_WORDS.test(f)) return "সকালে ১ বার";
  return toBanglaDigits(f);
}

function banglaInstructions(instructions: string): string {
  const s = (instructions || "").trim().toLowerCase();
  if (!s) return "";
  if (/(after\s+(meals?|food|eating)|খাবারের? পরে|খাওয়ার? পরে)/i.test(s)) {
    return "খাবারের পরে খাবেন";
  }
  if (/(before\s+(meals?|food|eating)|খাবারের? আগে|খাওয়ার? আগে)/i.test(s)) {
    return "খাবারের আগে খাবেন";
  }
  if (/(with\s+(meals?|food)|খাবারের? সাথে)/i.test(s)) {
    return "খাবারের সাথে খাবেন";
  }
  if (/(empty\s+stomach|খালি\s*পেটে)/i.test(s)) {
    return "খালি পেটে খাবেন";
  }
  if (/(bedtime|at\s+night|রাতে|রাতের|শোবার)/i.test(s)) {
    return "রাতে ঘুমানোর আগে খাবেন";
  }
  return toBanglaDigits(s);
}

export function buildMedicationNotificationContent(med: Medication): {
  title: string;
  body: string;
} {
  const title = `⏰ ${med.name} খাওয়ার সময় হয়েছে`;
  const lines: string[] = [];
  if (med.dosage) lines.push(`💊 ডোজ: ${toBanglaDose(med.dosage)}`);
  const freq = banglaFrequency(med.frequency);
  if (freq) lines.push(`📅 ${freq}`);
  const instr = banglaInstructions(med.instructions);
  if (instr) lines.push(`🍽️ ${instr}`);
  lines.push("ভালো থাকুন 🙏");
  return { title, body: lines.join("\n") };
}

function parseNotificationIds(json: string): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function cancelMedicationNotificationIds(
  idsJson: string
): Promise<string[]> {
  const ids = parseNotificationIds(idsJson);
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      failed.push(id);
    }
  }
  return failed;
}

export async function scheduleMedicationReminder(
  med: Medication,
  ownerId: string
): Promise<MedicationScheduleResult> {
  await ensureReminderChannel();
  const times = parseReminderTimes(med.reminderTimes);
  const failedCancellations = await cancelMedicationNotificationIds(
    med.reminderNotificationIds
  );

  if (times.length === 0) {
    if (failedCancellations.length > 0) {
      // Some notifications remain scheduled. Persist only the failed IDs and
      // keep the reminder enabled so they can still be cancelled later.
      await setMedicationReminderNotificationIds(
        med.id,
        ownerId,
        JSON.stringify(failedCancellations)
      );
      return {
        enabled: med.reminderEnabled === 1,
        times: [],
        reminderNotificationIds: JSON.stringify(failedCancellations),
      };
    }
    await setMedicationReminderNotificationIds(med.id, ownerId, "[]");
    await updateMedicationReminder(med.id, ownerId, false, "[]");
    return { enabled: false, times: [], reminderNotificationIds: "[]" };
  }

  const granted = await requestReminderPermissions();
  if (!granted) {
    await setMedicationReminderNotificationIds(
      med.id,
      ownerId,
      JSON.stringify(failedCancellations)
    );
    // Keep the reminder enabled when cancellations are still pending so a retry
    // (or resync) can cancel them; disable only when none remain.
    await updateMedicationReminder(
      med.id,
      ownerId,
      failedCancellations.length > 0,
      med.reminderTimes
    );
    throw new Error("Notification permission is required for reminders.");
  }

  const ids: string[] = [];
  const scheduledTimes: string[] = [];
  const scheduleErrors: string[] = [];
  for (const t of times) {
    const [hour, minute] = t.split(":").map(Number);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          ...buildMedicationNotificationContent(med),
          sound: true,
          data: { medicationId: med.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
      scheduledTimes.push(t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      scheduleErrors.push(`${t}: ${msg}`);
      console.warn("[Notifications] Failed to schedule", t, err);
    }
  }

  // Android's 500-alarm-per-app limit is usually caused by orphaned repeating
  // reminders whose IDs the DB no longer tracks. When it's hit, prune those
  // orphans and retry only the times that failed.
  const hitAlarmLimit =
    scheduledTimes.length < times.length &&
    scheduleErrors.some((e) => ALARM_LIMIT_ERROR.test(e));
  if (hitAlarmLimit) {
    console.warn("[Notifications] Alarm limit reached; pruning orphaned reminders and retrying…");
    await runOrphanPrune(ownerId);
    const failedTimes = times.filter((t) => !scheduledTimes.includes(t));
    for (const t of failedTimes) {
      const [hour, minute] = t.split(":").map(Number);
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            ...buildMedicationNotificationContent(med),
            sound: true,
            data: { medicationId: med.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: CHANNEL_ID,
          },
        });
        ids.push(id);
        scheduledTimes.push(t);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        scheduleErrors.push(`${t}: ${msg}`);
        console.warn("[Notifications] Failed to schedule (retry)", t, err);
      }
    }
  }

  if (scheduledTimes.length === 0 && scheduleErrors.length > 0) {
    // Nothing could be scheduled; persist the real (empty) state, then throw so
    // the UI surfaces the underlying native error instead of a generic message.
    await setMedicationReminderNotificationIds(
      med.id,
      ownerId,
      JSON.stringify(failedCancellations)
    );
    await updateMedicationReminder(
      med.id,
      ownerId,
      false,
      med.reminderTimes
    );
    throw new Error(
      `Reminder scheduling failed for ${times.length} time(s). ${scheduleErrors.join("; ")}`
    );
  }

  // Merge only the IDs that failed to cancel (still-scheduled) with the newly
  // scheduled ones, so the persisted set targets precisely the active ones.
  const mergedIds = Array.from(new Set([...failedCancellations, ...ids]));
  await setMedicationReminderNotificationIds(
    med.id,
    ownerId,
    JSON.stringify(mergedIds)
  );
  await updateMedicationReminder(
    med.id,
    ownerId,
    mergedIds.length > 0,
    JSON.stringify(scheduledTimes)
  );
  return {
    enabled: mergedIds.length > 0,
    times: scheduledTimes,
    reminderNotificationIds: JSON.stringify(mergedIds),
  };
}

export async function cancelMedicationReminder(
  med: Medication,
  ownerId: string
): Promise<boolean> {
  const failed = await cancelMedicationNotificationIds(
    med.reminderNotificationIds
  );
  if (failed.length > 0) {
    // Persist only the IDs that failed to cancel so a retry (or resync) targets
    // precisely the still-active notifications; reminderEnabled stays as-is.
    await setMedicationReminderNotificationIds(
      med.id,
      ownerId,
      JSON.stringify(failed)
    );
    return false;
  }
  await setMedicationReminderNotificationIds(med.id, ownerId, "[]");
  await updateMedicationReminder(med.id, ownerId, false, med.reminderTimes);
  return true;
}

const ALARM_LIMIT_ERROR = /maximum limit of concurrent alarms/i;

// Android caps each app at 500 concurrent AlarmManager alarms, and a daily
// repeating reminder is one alarm that never expires. If the app ever loses
// track of a scheduled notification's ID (e.g. the local DB was reset while
// Expo Go's notification store kept the alarms), orphans accumulate until the
// limit is hit and every new schedule throws. This prunes those orphans.
export async function pruneOrphanedReminderNotifications(
  ownerId: string
): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(
    () => []
  );
  if (!Array.isArray(scheduled) || scheduled.length === 0) return 0;

  // A failed medication lookup is NOT the same as having no medications. If the
  // DB read fails we can't tell orphans from valid notifications, so abort the
  // prune instead of treating everything as an orphan and cancelling it.
  let meds: Medication[];
  try {
    meds = await getAllMedications(ownerId);
  } catch (err) {
    console.warn(
      "[Notifications] Medication lookup failed; skipping prune:",
      err
    );
    return 0;
  }

  const valid = new Set<string>();
  for (const m of meds) {
    if (m.reminderEnabled !== 1) continue;
    for (const id of parseNotificationIds(m.reminderNotificationIds)) valid.add(id);
  }

  const orphans = scheduled.filter(
    (n) =>
      n &&
      typeof n.identifier === "string" &&
      n.content?.data?.medicationId != null &&
      !valid.has(n.identifier)
  );
  if (orphans.length === 0) return 0;

  // Cancel in chunks so hundreds of orphaned alarms don't flood the
  // notifications service with one synchronous burst of bound-service calls.
  for (let i = 0; i < orphans.length; i += 25) {
    await Promise.all(
      orphans
        .slice(i, i + 25)
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
        )
    );
  }
  console.warn(
    `[Notifications] Pruned ${orphans.length} orphaned reminder notification(s).`
  );
  return orphans.length;
}

// Serializes orphan-pruning so concurrent recoveries (e.g. a resync that
// parallelizes per-medication scheduling) don't race each other.
let pruneChain: Promise<unknown> = Promise.resolve();

function runOrphanPrune(ownerId: string): Promise<number> {
  const attempt = pruneChain.then(() =>
    pruneOrphanedReminderNotifications(ownerId)
  );
  pruneChain = attempt.catch(() => {});
  return attempt;
}

export async function syncMedicationReminders(ownerId: string): Promise<void> {
  await ensureReminderChannel();
  await pruneOrphanedReminderNotifications(ownerId);
  const meds = await getAllMedications(ownerId);
  await Promise.all(
    meds
      .filter((m) => m.reminderEnabled === 1)
      .map((m) =>
        scheduleMedicationReminder(m, ownerId).catch((err) =>
          console.warn("[Notifications] Resync failed for", m.name, err)
        )
      )
  );
}
