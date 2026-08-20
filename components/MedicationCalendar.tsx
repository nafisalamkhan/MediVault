import { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, fonts, radius } from "@/lib/theme";
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
  selectedDate = new Date(),
  onDateChange,
  onMedicationPress,
}: MedicationCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(mode);
  const [currentDate, setCurrentDate] = useState(selectedDate);

  useEffect(() => {
    setViewMode(mode);
  }, [mode]);

  useEffect(() => {
    setCurrentDate(selectedDate);
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
          <Text style={styles.weekTitle}>
            {currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Text>
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
              <Text style={[styles.dayName, isSelected(item) && styles.dayNameSelected]}>
                {item.toLocaleDateString(undefined, { weekday: "short" })}
              </Text>
              <Text style={[styles.dayNumber, isSelected(item) && styles.dayNumberSelected]}>
                {item.getDate()}
              </Text>
              <Text style={styles.dayMedsCount}>
                {medications.filter((m) => m.reminderEnabled === 1).length} meds
              </Text>
            </TouchableOpacity>
          )}
        />

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>
          {isToday(currentDate) ? "Today&apos;s Schedule" : currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        {timeSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="schedule" size={48} color={colors.inkTertiary} />
            <Text style={styles.emptyText}>No medications scheduled for today</Text>
          </View>
        ) : (
          <FlatList
            data={timeSlots}
            keyExtractor={(s) => s.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => item.meds[0] && onMedicationPress?.(item.meds[0])}
                style={styles.timeSlot}
                activeOpacity={0.8}
              >
                <View style={styles.timeLabel}>
                  <Text style={styles.timeText}>{item.label}</Text>
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
                      <Text style={styles.medPillText} numberOfLines={1}>
                        {m.name} {m.dosage ? `(${m.dosage})` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
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
          <Text style={styles.todayBtnText}>Today</Text>
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
        <Text style={styles.dateWeekday}>
          {currentDate.toLocaleDateString(undefined, { weekday: "long" })}
        </Text>
        <Text style={styles.dateFull}>
          {currentDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>

      {timeSlots.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="schedule" size={64} color={colors.inkTertiary} />
          <Text style={styles.emptyText}>No medications scheduled</Text>
          <Text style={styles.emptySubtext}>
            Add reminders to medications to see them here
          </Text>
        </View>
      ) : (
        <FlatList
          data={timeSlots}
          keyExtractor={(s) => s.label}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => item.meds[0] && onMedicationPress?.(item.meds[0])}
              style={styles.timeSlot}
              activeOpacity={0.8}
            >
              <View style={styles.timeLabel}>
                <Text style={styles.timeText}>{item.label}</Text>
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
                    <Text style={styles.medPillText} numberOfLines={1}>
                      {m.name} {m.dosage ? `(${m.dosage})` : ""}
                    </Text>
                    {m.frequency && (
                      <Text style={styles.medFrequency}>{m.frequency}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  weekContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
    padding: 8,
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  dayCard: {
    width: 48,
    alignItems: "center",
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfacePearl,
  },
  dayCardSelected: {
    backgroundColor: colors.primary,
  },
  dayCardToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayName: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontFamily: fonts.regular,
  },
  dayNameSelected: {
    color: colors.white,
  },
  dayNumber: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayMedsCount: {
    marginTop: 4,
    fontSize: 10,
    color: colors.inkTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 8,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily: fonts.semibold,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
    color: colors.inkSecondary,
    textAlign: "center",
    fontFamily: fonts.medium,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: colors.inkTertiary,
    textAlign: "center",
    fontFamily: fonts.regular,
  },
  dayContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  todayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  dateDisplay: {
    alignItems: "center",
    paddingBottom: 12,
  },
  dateWeekday: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
  dateFull: {
    marginTop: 2,
    fontSize: 14,
    color: colors.inkSecondary,
  },
  timeSlot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairlineRgba,
  },
  timeLabel: {
    width: 70,
    alignItems: "flex-end",
    marginRight: 16,
  },
  timeText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.ink,
    fontFamily: fonts.medium,
    fontVariant: ["tabular-nums"],
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
    backgroundColor: colors.surfacePearl,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medPillColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  medPillText: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  medFrequency: {
    fontSize: 11,
    color: colors.inkTertiary,
    fontFamily: fonts.regular,
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