import { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Typography } from "@/components/ui";
import { colors, radius, typography, spacing } from "@/lib/theme";
import type { Medication } from "@/lib/db/schema";
import { parseReminderTimes } from "@/lib/notifications";

export type CalendarViewMode = "week" | "day";

interface MedicationCalendarProps {
  medications: Medication[];
  mode?: CalendarViewMode;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  onMedicationPress?: (med: Medication) => void;
}

export default function MedicationCalendar({
  medications,
  mode = "week",
  selectedDate,
  onDateChange,
  onMedicationPress,
}: MedicationCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(mode);
  const [currentDate, setCurrentDate] = useState<Date>(() => selectedDate ?? new Date());

  useEffect(() => {
    setViewMode(mode);
  }, [mode]);

  useEffect(() => {
    if (selectedDate !== undefined) {
      setCurrentDate(selectedDate);
    }
  }, [selectedDate]);

  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  const dayMeds = useMemo(() => {
    return medications
      .filter((m) => m.reminderEnabled === 1)
      .flatMap((med) => {
        const times = parseReminderTimes(med.reminderTimes);
        return times.map((t) => {
          const [hour, minute] = t.split(":").map(Number);
          return {
            med,
            timeStr: t,
            hour,
            minute,
            label: formatTime12h(hour, minute),
          };
        });
      });
  }, [medications]);

  const timeSlots = useMemo(() => {
    const slotsMap = new Map<string, { med: Medication; timeStr: string; hour: number; minute: number; label: string }[]>();
    for (const entry of dayMeds) {
      const key = `${entry.hour}:${entry.minute}`;
      if (!slotsMap.has(key)) {
        slotsMap.set(key, []);
      }
      slotsMap.get(key)!.push(entry);
    }

    return Array.from(slotsMap.entries())
      .map(([key, entries]) => {
        const [hour, minute] = key.split(":").map(Number);
        return {
          hour,
          minute,
          label: formatTime12h(hour, minute),
          meds: entries.map((e) => ({ ...e.med, timeStr: e.timeStr })),
        };
      })
      .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
  }, [dayMeds]);

  function formatTime12h(hour: number, minute: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${minute.toString().padStart(2, "0")} ${period}`;
  }

  function isToday(date: Date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isSelected(date: Date) {
    return date.toDateString() === currentDate.toDateString();
  }

  function navigateWeek(delta: number) {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + delta * 7);
    setCurrentDate(next);
    onDateChange?.(next);
  }

  function navigateDay(delta: number) {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + delta);
    setCurrentDate(next);
    onDateChange?.(next);
  }

  if (viewMode === "week") {
    return (
      <View style={styles.weekContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            onPress={() => navigateWeek(-1)}
            style={styles.navBtn}
            accessibilityLabel="Previous week"
          >
            <MaterialIcons name="chevron-left" size={24} color={colors.ink} />
          </TouchableOpacity>
          <Typography variant="title" style={styles.weekTitle}>
            {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Typography>
          <TouchableOpacity
            onPress={() => navigateWeek(1)}
            style={styles.navBtn}
            accessibilityLabel="Next week"
          >
            <MaterialIcons name="chevron-right" size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={weekDates}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(d) => d.toISOString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                setCurrentDate(item);
                onDateChange?.(item);
              }}
              style={[
                styles.dayCard,
                isSelected(item) && styles.dayCardSelected,
                isToday(item) && styles.dayCardToday,
              ]}
            >
              <Typography variant="caption" style={[styles.dayName, isSelected(item) && styles.dayNameSelected]}>
                {item.toLocaleDateString(undefined, { weekday: "short" })}
              </Typography>
              <Typography variant="heading3" style={[styles.dayNumber, isSelected(item) && styles.dayNumberSelected]}>
                {item.getDate()}
              </Typography>
              <Typography variant="caption" style={styles.dayMedsCount}>
                {medications.filter((m) => m.reminderEnabled === 1).length} meds
              </Typography>
            </TouchableOpacity>
          )}
        />

        <View style={styles.divider} />

        <Typography variant="eyebrow" style={styles.sectionTitle}>
          {isToday(currentDate) ? "Today's Schedule" : currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Typography>
        {timeSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="schedule" size={48} color={colors.inkMuted} />
            <Typography variant="bodyMd" style={styles.emptyText}>
              {isToday(currentDate)
                ? "No medications scheduled for today"
                : `No medications scheduled for ${currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
            </Typography>
          </View>
        ) : (
          <FlatList
            data={timeSlots}
            keyExtractor={(s) => s.label}
            renderItem={({ item }) => (
              <View style={styles.timeSlot}>
                <View style={styles.timeLabel}>
                  <Typography variant="bodyMd" style={styles.timeText}>{item.label}</Typography>
                </View>
                <View style={styles.medList}>
                  {item.meds.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.medPill}
                      onPress={() => onMedicationPress?.(m)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.medPillColor} />
                      <Typography variant="bodySm" style={styles.medPillText} numberOfLines={1}>
                        {m.name} {m.dosage ? `(${m.dosage})` : ""}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.dayContainer}>
      <View style={styles.dayHeader}>
        <TouchableOpacity
          onPress={() => navigateDay(-1)}
          style={styles.navBtn}
          accessibilityLabel="Previous day"
        >
          <MaterialIcons name="chevron-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const today = new Date();
            setCurrentDate(today);
            onDateChange?.(today);
          }}
          style={styles.todayBtn}
        >
          <Typography variant="caption" style={styles.todayBtnText}>Today</Typography>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigateDay(1)}
          style={styles.navBtn}
          accessibilityLabel="Next day"
        >
          <MaterialIcons name="chevron-right" size={24} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateDisplay}>
        <Typography variant="heading2" style={styles.dateWeekday}>
          {currentDate.toLocaleDateString(undefined, { weekday: "long" })}
        </Typography>
        <Typography variant="bodyMd" style={styles.dateFull}>
          {currentDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </Typography>
      </View>

      {timeSlots.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="schedule" size={64} color={colors.inkMuted} />
          <Typography variant="heading3" style={styles.emptyText}>No medications scheduled</Typography>
          <Typography variant="bodySm" style={styles.emptySubtext}>
            Add reminders to medications to see them here
          </Typography>
        </View>
      ) : (
        <FlatList
          data={timeSlots}
          keyExtractor={(s) => s.label}
          renderItem={({ item }) => (
            <View style={styles.timeSlot}>
              <View style={styles.timeLabel}>
                <Typography variant="bodyMd" style={styles.timeText}>{item.label}</Typography>
              </View>
              <View style={styles.medList}>
                {item.meds.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.medPill}
                    onPress={() => onMedicationPress?.(m)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.medPillColor} />
                    <Typography variant="bodySm" style={styles.medPillText} numberOfLines={1}>
                      {m.name} {m.dosage ? `(${m.dosage})` : ""}
                    </Typography>
                    {m.frequency && (
                      <Typography variant="caption" style={styles.medFrequency}>{m.frequency}</Typography>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  weekContainer: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 8,
  },
  weekTitle: {
    color: colors.ink,
  },
  dayCard: {
    width: 48,
    alignItems: "center",
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dayCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayName: {
    color: colors.inkSecondary,
  },
  dayNameSelected: {
    color: colors.white,
  },
  dayNumber: {
    marginTop: 4,
    color: colors.ink,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayMedsCount: {
    marginTop: 4,
    color: colors.inkMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 8,
  },
  sectionTitle: {
    paddingHorizontal: spacing.xl,
    marginBottom: 8,
    color: colors.inkMuted,
    textTransform: "uppercase",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  emptySubtext: {
    marginTop: 4,
    color: colors.inkMuted,
    textAlign: "center",
  },
  dayContainer: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
  },
  todayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  todayBtnText: {
    color: colors.primary,
  },
  dateDisplay: {
    alignItems: "center",
    paddingBottom: 12,
  },
  dateWeekday: {
    color: colors.ink,
  },
  dateFull: {
    marginTop: 2,
    color: colors.inkSecondary,
  },
  timeSlot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  timeLabel: {
    width: 70,
    alignItems: "flex-end",
    marginRight: 16,
  },
  timeText: {
    color: colors.ink,
  },
  medList: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  medPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  medPillColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  medPillText: {
    color: colors.ink,
  },
  medFrequency: {
    color: colors.inkMuted,
  },
});

export function useMedicationCalendar(medications: Medication[]) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");

  return {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
  };
}