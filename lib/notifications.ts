import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Medication } from "@/lib/db/schema";
import {
  getAllMedications,
  updateMedicationReminder,
  setMedicationReminderNotificationIds,
} from "@/lib/db";

const CHANNEL_ID = "medication-reminders";

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
    name: "Medication reminders",
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
    return arr.filter(
      (t) => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t)
    );
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

  if (/\b(sos|prn|as needed|যখন প্রয়োজন|প্রয়োজন)\b/i.test(f)) return [];

  const digit = f.match(/(\d+)\s*[+\-]\s*(\d+)(?:\s*[+\-]\s*(\d+))?/);
  if (digit) {
    const slots = [MORNING, NOON, NIGHT_WORDS.test(f) ? NIGHT : EVENING];
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

async function cancelMedicationNotificationIds(idsJson: string): Promise<void> {
  let ids: string[] = [];
  try {
    ids = JSON.parse(idsJson || "[]");
  } catch {
    ids = [];
  }
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}

export async function scheduleMedicationReminder(
  med: Medication,
  ownerId: string
): Promise<void> {
  await ensureReminderChannel();
  const times = parseReminderTimes(med.reminderTimes);
  await cancelMedicationNotificationIds(med.reminderNotificationIds);

  if (times.length === 0) {
    await updateMedicationReminder(med.id, ownerId, false, "[]");
    return;
  }

  const granted = await requestReminderPermissions();
  if (!granted) {
    throw new Error("Notification permission is required for reminders.");
  }

  const ids: string[] = [];
  for (const t of times) {
    const [hour, minute] = t.split(":").map(Number);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: med.name,
          body:
            [med.dosage, med.frequency].filter(Boolean).join(" · ") ||
            "Time to take your medication",
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
    } catch (err) {
      console.warn("[Notifications] Failed to schedule", t, err);
    }
  }

  await setMedicationReminderNotificationIds(
    med.id,
    ownerId,
    JSON.stringify(ids)
  );
  await updateMedicationReminder(
    med.id,
    ownerId,
    ids.length > 0,
    JSON.stringify(times)
  );
}

export async function cancelMedicationReminder(
  med: Medication,
  ownerId: string
): Promise<void> {
  await cancelMedicationNotificationIds(med.reminderNotificationIds);
  await setMedicationReminderNotificationIds(med.id, ownerId, "[]");
  await updateMedicationReminder(med.id, ownerId, false, med.reminderTimes);
}

export async function syncMedicationReminders(ownerId: string): Promise<void> {
  await ensureReminderChannel();
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
