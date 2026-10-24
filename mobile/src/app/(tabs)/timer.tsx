// Pomodoro timer. Uses the website's timer store, so it runs the same way and
// stays in sync with the laptop (see TimerSync, mounted in AppSync).
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTimerStore, formatTime } from "@/store/timerStore";
import { useCollection } from "@/lib/firebase/useCollection";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import { computeStreak } from "@/lib/streakLogic";
import type { Session, Subject } from "@/types";
import { Card, Empty, Icon, Screen, Section, StatRow, type IconName } from "~/components/ui";
import { ChipPicker } from "~/components/form";
import { ensurePermission } from "~/lib/notifications";
import { colors, space } from "~/theme";

const SESSION_TYPES = ["Deep Work", "Reading", "Writing", "Coding", "Research", "Review", "Planning", "Admin", "Practice", "Job Search"];
const MODE = {
  focus: { label: "Focus", color: colors.primary },
  "short-break": { label: "Short break", color: colors.green },
  "long-break": { label: "Long break", color: colors.amber },
} as const;
const RING = 260, STROKE = 10, R = (RING - STROKE) / 2, CIRC = 2 * Math.PI * R;

export default function Timer() {
  const t = useTimerStore();
  const subjects = useCollection<Subject>("subjects");
  const sessions = useCollection<Session>("sessions").items;
  const today = localDateStr();

  // The chosen subject was deleted (on any device): clear it.
  useEffect(() => {
    if (subjects.loading) return;
    if (t.selectedSubjectId && !subjects.items.some((s) => s.id === t.selectedSubjectId)) t.setSubject("", "Select a Subject");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.items, subjects.loading]);

  const mode = MODE[t.mode];
  const progress = t.totalSeconds > 0 ? 1 - t.secondsRemaining / t.totalSeconds : 0;
  const running = t.state === "running";
  const noSubject = !t.selectedSubjectId;
  const todayMin = sessions.filter((s) => s.date === today).reduce((n, s) => n + s.durationMinutes, 0);
  const streak = computeStreak(sessions.map((s) => s.date), today);

  const toggle = async () => {
    if (running) return t.pause();
    if (noSubject) return;
    ensurePermission().catch(() => undefined);
    t.start();
  };

  return (
    <Screen title="Timer" subtitle={noSubject ? "Choose a subject to start." : t.selectedSubjectName}>
      <View style={s.ringWrap} accessible accessibilityLabel={`${mode.label}, ${formatTime(t.secondsRemaining)} left, ${t.state}`}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={mode.color} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} />
        </Svg>
        <View style={s.ringCenter}>
          <Text style={[s.mode, { color: mode.color }]}>{mode.label}</Text>
          <Text style={s.time} testID="timer-time">{formatTime(t.secondsRemaining)}</Text>
          <Text style={s.round}>Round {(t.pomodoroIndex % t.totalPomodoros) + 1} of {t.totalPomodoros}</Text>
        </View>
      </View>

      <View style={s.controls}>
        <RoundButton icon={{ ios: "arrow.counterclockwise", android: "replay" }} label="Reset" onPress={t.reset} />
        <Pressable testID="timer-toggle" onPress={toggle} disabled={!running && noSubject}
          accessibilityRole="button" accessibilityLabel={running ? "Pause" : "Start"} accessibilityState={{ disabled: !running && noSubject }}
          style={({ pressed }) => [s.play, { backgroundColor: noSubject && !running ? colors.raised : colors.primaryStrong }, pressed && { opacity: 0.8 }]}>
          <Icon name={running ? { ios: "pause.fill", android: "pause" } : { ios: "play.fill", android: "play_arrow" }} size={30} color={colors.onPrimaryStrong} />
        </Pressable>
        <RoundButton icon={{ ios: "forward.end.fill", android: "skip_next" }} label="Skip" onPress={t.skip} />
      </View>

      <Section title="Subject">
        {subjects.items.length === 0 ? <Empty text="Add a subject on the website first." /> : (
          <ChipPicker label="Subject" value={t.selectedSubjectId} onChange={(id) => {
            const sub = subjects.items.find((x) => x.id === id);
            if (sub) t.setSubject(sub.id, sub.name);
          }} options={subjects.items.map((sub) => ({ value: sub.id, label: sub.name, color: getColor(sub.color).dot }))} />
        )}
      </Section>

      <Section title="Session type">
        <ChipPicker label="Session type" value={t.sessionType} onChange={t.setSessionType} options={SESSION_TYPES.map((x) => ({ value: x, label: x }))} />
      </Section>

      <Card style={{ gap: space.md }}>
        <Text style={s.cardTitle}>Focus length</Text>
        <ChipPicker label="Focus length" value={String(t.pomodoroLength)} onChange={(v) => t.setDurations(Number(v), t.shortBreak, t.longBreak)}
          options={[...new Set([25, 45, 60, t.pomodoroLength])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: `${n} min` }))} />
        <Text style={s.cardTitle}>Rounds before long break</Text>
        <ChipPicker label="Rounds before long break" value={String(t.totalPomodoros)} onChange={(v) => t.setTotalPomodoros(Number(v))}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))} />
        <Text style={s.note}>Breaks: {t.shortBreak} min, long break {t.longBreak} min. Change lengths in Settings.</Text>
      </Card>

      <StatRow stats={[
        { label: "Focused today", value: formatSmartDuration(todayMin) },
        { label: "Streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
        { label: "Sessions today", value: sessions.filter((x) => x.date === today).length },
      ]} />
    </Screen>
  );
}

function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [s.round_btn, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  ringWrap: { alignSelf: "center", width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", gap: 4 },
  mode: { fontSize: 15, fontWeight: "600" },
  time: { color: colors.text, fontSize: 60, fontWeight: "300", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  round: { color: colors.textMuted, fontSize: 13 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xl },
  play: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  round_btn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  note: { color: colors.outline, fontSize: 13 },
});
