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
import { Text, GlassPanel, Button } from "@/components/ui";
import { colors, radius, typography, shadows } from "@/lib/theme";
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
        <GlassPanel variant="elevated" style={styles.modalCard}>
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
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              disabled={saving}
            />
            <Button
              title={saving ? "Saving..." : "Save"}
              variant="primary"
              onPress={handleSave}
              disabled={saving}
              loading={saving}
            />
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
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalTitle: {
    fontSize: typography.heading3.fontSize,
    fontWeight: typography.heading3.fontWeight,
    lineHeight: typography.heading3.lineHeight,
    letterSpacing: typography.heading3.letterSpacing,
    color: colors.ink,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkMuted,
    marginBottom: 20,
  },
  editorEmpty: {
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
    marginBottom: 16,
  },
  timeChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  timeChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timeChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  editorSectionLabel: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    lineHeight: typography.eyebrow.lineHeight,
    letterSpacing: typography.eyebrow.letterSpacing,
    color: colors.inkMuted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  clockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    marginBottom: 20,
  },
  clockBtnText: {
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    lineHeight: typography.button.lineHeight,
    color: colors.white,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  editorHint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    color: colors.inkMuted,
    marginTop: 16,
    textAlign: "center",
  },
});