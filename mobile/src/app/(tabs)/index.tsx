import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { useStudyCards } from "@/lib/firebase/useFlashcards";
import { buildQueue } from "@/lib/flashcards/queue";
import { classOccurrences, holidayOn } from "@/lib/timetable";
import { blockDone, blockMinutes } from "@/lib/calendar";
import { upcomingExams, daysUntil, countdownLabel, urgency, type Urgency } from "@/lib/exams";
import { getColor } from "@/lib/colorPalette";
import { localDateStr, formatSmartDuration } from "@/lib/dateUtils";
import { useTimerStore } from "@/store/timerStore";
import type { ClassItem, Exam, Session, StudyBlock, Subject, Task } from "@/types";
import { Button, Card, Chip, Dot, Empty, Icon, Screen, Section, StatRow } from "~/components/ui";
import { TaskRow } from "~/components/task-row";
import { colors, space } from "~/theme";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const URGENCY_COLOR: Record<Urgency, string> = { past: colors.outline, today: colors.error, red: colors.error, amber: colors.amber, green: colors.green };

export default function Today() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const today = localDateStr();
  const tasks = useCollection<Task>("tasks").items;
  const subjects = useCollection<Subject>("subjects").items;
  const sessions = useCollection<Session>("sessions").items;
  const exams = useCollection<Exam>("exams").items;
  const classes = useCollection<ClassItem>("classes").items;
  const blocks = useCollection<StudyBlock>("studyBlocks").items;
  const { settings: timetable } = useTimetable();
  const fc = useStudyCards();

  const fcQueue = buildQueue(fc.cards, fc.decks, fc.logsToday, new Date(), today);
  const fcDue = fcQueue.counts.learning + fcQueue.counts.review + fcQueue.counts.new;
  const classesToday = classOccurrences(classes, timetable, today, today);
  const holiday = holidayOn(today, timetable.holidays);
  const blocksToday = blocks.filter((b) => b.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const examsSoon = upcomingExams(exams, today).filter((e) => daysUntil(e.date, today) <= 14);

  const overdue = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < today).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const dueToday = tasks.filter((t) => !t.completed && t.dueDate === today)
    .sort((a, b) => PRIORITY_ORDER[a.priority ?? "low"] - PRIORITY_ORDER[b.priority ?? "low"]);
  const todaySessions = sessions.filter((s) => s.date === today).sort((a, b) => b.startTime.localeCompare(a.startTime));
  const minutes = todaySessions.reduce((n, s) => n + s.durationMinutes, 0);
  const tasksDone = tasks.filter((t) => t.completed && t.dueDate === today).length;
  const subjectOf = (id?: string) => subjects.find((s) => s.id === id);

  const startBlock = (b: StudyBlock) => {
    if (b.deckId) return router.push({ pathname: "/review", params: { deck: b.deckId, block: b.id } });
    const subject = subjectOf(b.subjectId);
    if (subject) {
      const ts = useTimerStore.getState();
      ts.setSubject(subject.id, subject.name);
      ts.setActiveBlock(b.id);
    }
    router.navigate("/timer");
  };

  return (
    <Screen title={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} subtitle="Here's what's on your plate today.">
      <StatRow stats={[
        { label: "Focused today", value: formatSmartDuration(minutes) },
        { label: "Tasks done", value: `${tasksDone}/${tasksDone + dueToday.length}` },
        { label: "Open tasks", value: tasks.filter((t) => !t.completed).length },
      ]} />

      <Card style={s.cardsDue}>
        <Icon name={{ ios: "rectangle.stack.fill", android: "style" }} size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.strong} testID="today-cards-due">{fc.loading ? "Flashcards" : fcDue > 0 ? `${fcDue} card${fcDue === 1 ? "" : "s"} to review` : "No cards due"}</Text>
          {!fc.loading && fcDue > 0 && <Text style={s.muted}>{fcQueue.counts.new} new · {fcQueue.counts.learning} learning · {fcQueue.counts.review} review</Text>}
        </View>
        {fcDue > 0 && <Button label="Study" onPress={() => router.push("/review")} style={{ minHeight: 40 }} />}
      </Card>

      {(classesToday.length > 0 || holiday) && (
        <Section title="Classes today">
          {holiday && <Text style={{ color: colors.amber }}>{holiday.name}: no classes.</Text>}
          {classesToday.map((o) => {
            const sub = subjectOf(o.subjectId);
            return (
              <Card key={`${o.classId}-${o.start}`} style={s.row}>
                <Text style={s.time}>{o.start}–{o.end}</Text>
                <Dot color={getColor(sub?.color ?? "violet").dot} />
                <Text style={[s.strong, { flex: 1 }]} numberOfLines={1}>{sub?.name ?? "Class"}{o.title ? ` · ${o.title}` : ""}</Text>
                {o.room ? <Text style={s.muted}>Room {o.room}</Text> : null}
              </Card>
            );
          })}
        </Section>
      )}

      {blocksToday.length > 0 && (
        <Section title="Planned study">
          {blocksToday.map((b) => {
            const done = blockDone(b);
            const sub = subjectOf(b.subjectId);
            return (
              <Card key={b.id} style={s.row}>
                <Text style={s.time}>{b.start}–{b.end}</Text>
                <Dot color={getColor(sub?.color ?? "violet").dot} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.strong, done && s.done]} numberOfLines={1}>{b.title}</Text>
                  <Text style={s.muted}>{b.minutesDone ?? 0} of {blockMinutes(b)} min</Text>
                </View>
                {done ? <Icon name={{ ios: "checkmark.circle.fill", android: "check_circle" }} color={colors.green} />
                  : <Pressable onPress={() => startBlock(b)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Start ${b.title}`}>
                      <Icon name={{ ios: "play.circle.fill", android: "play_circle" }} size={28} color={colors.primary} />
                    </Pressable>}
              </Card>
            );
          })}
        </Section>
      )}

      {examsSoon.length > 0 && (
        <Section title="Exams soon">
          {examsSoon.map((e) => {
            const days = daysUntil(e.date, today);
            return (
              <Card key={e.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.strong} numberOfLines={1}>{e.title}</Text>
                  <Text style={s.muted}>{[subjectOf(e.subjectId)?.name, e.startTime, e.room && `Room ${e.room}`].filter(Boolean).join(" · ")}</Text>
                </View>
                <Chip label={countdownLabel(days)} color={URGENCY_COLOR[urgency(days)]} />
              </Card>
            );
          })}
        </Section>
      )}

      {overdue.length > 0 && (
        <Section title={`Overdue (${overdue.length})`}>
          {overdue.map((t) => <TaskRow key={t.id} task={t} uid={uid} subjects={subjects} today={today} />)}
        </Section>
      )}

      <Section title="Due today" right={<Button label="Add" kind="ghost" icon={{ ios: "plus", android: "add" }} onPress={() => router.push({ pathname: "/task", params: { due: today } })} style={{ minHeight: 32, paddingHorizontal: 0 }} />}>
        {dueToday.length === 0 ? <Empty text="Nothing due today." /> : dueToday.map((t) => <TaskRow key={t.id} task={t} uid={uid} subjects={subjects} today={today} />)}
      </Section>

      <Section title="Study sessions today">
        {todaySessions.length === 0 ? <Empty text="No sessions yet. Start the timer when you study." />
          : todaySessions.map((ses) => (
            <Card key={ses.id} style={s.row}>
              <Dot color={getColor(ses.subjectColor).dot} />
              <Text style={[s.strong, { flex: 1 }]} numberOfLines={1}>{ses.subjectName}</Text>
              <Text style={s.muted}>{ses.startTime} · {formatSmartDuration(ses.durationMinutes)}</Text>
            </Card>
          ))}
      </Section>
    </Screen>
  );
}

const s = StyleSheet.create({
  cardsDue: { flexDirection: "row", alignItems: "center", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  strong: { color: colors.text, fontSize: 16, fontWeight: "500" },
  muted: { color: colors.textMuted, fontSize: 13 },
  time: { color: colors.textMuted, fontSize: 13, fontVariant: ["tabular-nums"], width: 92 },
  done: { color: colors.outline, textDecorationLine: "line-through" },
});
