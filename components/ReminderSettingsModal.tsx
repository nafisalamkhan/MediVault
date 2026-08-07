import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, GlassPanel } from "@/components/ui";
import { colors, radius, fonts } from "@/lib/theme";
import type { Medication } from "@/lib/db/schema";
import {
  parseReminderTimes,
  deriveReminderTimes,
  scheduleMedicationReminder,
  cancelMedicationReminder,
  formatReminderTime,
} from "@/lib/notifications";

const REMINDER_PRESETS: { time: string; label: string }[] = [
  { time: "08:00", label: "8:00 AM · সকাল" },
  { time: "13:00", label: "1:00 PM · দুপুর" },
  { time: "17:00", label: "5:00 PM · বিকাল" },
  { time: "21:00", label: "9:00 PM · রাত" },
];

interface Props {
  medication: Medication | null;
  onClose: () => void;
  onSaved: (updated: Medication) => void;
}

export default function ReminderSettingsModal({
  medication,
  onClose,
  onSaved,
}: Props) {
  const { userId } = useAuth();
  const [editTimes, setEditTimes] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTime, setPickerTime] = useState(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!medication) return;
    const existing = parseReminderTimes(medication.reminderTimes);
    setEditTimes(
      existing.length > 0
        ? existing
        : medication.reminderEnabled === 1
        ? deriveReminderTimes(medication.frequency)
        : []
    );
    setShowTimePicker(false);
  }, [medication]);

  function openClockPicker() {
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    setPickerTime(next);
    setShowTimePicker(true);
  }

  function onTimePickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowTimePicker(false);
    if (event.type === "set" && date) {
      const h = date.getHours();
      const m = date.getMinutes();
      addEditTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  function addEditTime(raw: string) {
    const t = (raw || "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return;
    const [h, m] = t.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return;
    const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setEditTimes((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized].sort()
    );
  }

  function removeEditTime(t: string) {
    setEditTimes((prev) => prev.filter((x) => x !== t));
  }

  async function handleSave() {
    if (!medication || !userId || saving) return;
    setSaving(true);
    try {
      if (editTimes.length === 0) {
        const cancelled = await cancelMedicationReminder(medication, userId);
        if (!cancelled) {
          Alert.alert(
            "Reminder Error",
            "Some scheduled notifications could not be cancelled yet. Please try again."
          );
          return;
        }
        onSaved({
          ...medication,
          reminderEnabled: 0,
          reminderNotificationIds: "[]",
        });
      } else {
        const result = await scheduleMedicationReminder(
          { ...medication, reminderTimes: JSON.stringify(editTimes) },
          userId
        );
        if (result.times.length !== editTimes.length) {
          Alert.alert(
            "Reminder Error",
            "Some reminder times could not be scheduled. Please try again."
          );
          return;
        }
        onSaved({
          ...medication,
          reminderEnabled: result.enabled ? 1 : 0,
          reminderTimes: JSON.stringify(result.times),
          reminderNotificationIds: result.reminderNotificationIds,
        });
      }
      onClose();
    } catch (err: any) {
      Alert.alert("Reminder Error", err.message || "Failed to save reminders.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={medication !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <GlassPanel style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reminder Settings</Text>
          <Text style={styles.modalDesc}>
            {medication?.name} · every day at the times you pick
          </Text>

          {editTimes.length === 0 ? (
            <Text style={styles.editorEmpty}>
              No reminder times yet. Pick a time below.
            </Text>
          ) : (
            <View style={styles.timeChipWrap}>
              {editTimes.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => removeEditTime(t)}
                  style={styles.timeChip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timeChipText}>{formatReminderTime(t)} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.editorSectionLabel}>Quick add</Text>
          <View style={styles.timeChipWrap}>
            {REMINDER_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.time}
                onPress={() => addEditTime(p.time)}
                disabled={editTimes.includes(p.time)}
                style={[
                  styles.timeChip,
                  editTimes.includes(p.time) && styles.timeChipSelected,
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.timeChipText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.editorSectionLabel}>Add from clock</Text>
          <TouchableOpacity onPress={openClockPicker} style={styles.clockBtn} activeOpacity={0.8}>
            <MaterialIcons name="access-time" size={20} color={colors.white} />
            <Text style={styles.clockBtnText}>Pick a time</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={pickerTime}
              mode="time"
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onTimePickerChange}
            />
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCancelBtn}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.modalConfirmBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalConfirmText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.editorHint}>
            {editTimes.length === 0
              ? "Saving with no times turns this reminder off."
              : "Saving removes old notifications and schedules the ones above."}
          </Text>
        </GlassPanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
    marginBottom: 4,
    letterSpacing: -0.374,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.inkTertiary,
    marginBottom: 16,
  },
  editorEmpty: {
    fontSize: 14,
    color: colors.inkSecondary,
    marginBottom: 14,
  },
  timeChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  timeChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeChipSelected: {
    opacity: 0.45,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  editorSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.inkTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    fontFamily: fonts.semibold,
  },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    marginBottom: 16,
  },
  clockBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineRgba,
    backgroundColor: colors.canvas,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: fonts.semibold,
  },
  editorHint: {
    fontSize: 12,
    color: colors.inkTertiary,
    marginTop: 12,
    textAlign: "center",
  },
});
