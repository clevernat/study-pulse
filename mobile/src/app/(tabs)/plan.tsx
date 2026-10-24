import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { useTimetable } from "@/lib/firebase/useTimetable";
import { buildEvents, type CalEvent, type EventKind } from "@/lib/calendar";
import { addDays } from "@/lib/timetable";
import { dueKey } from "@/lib/tasks";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import type { ClassItem, Exam, StudyBlock, Subject, Task } from "@/types";
import { Button, Card, Dot, Empty, Icon, Screen, Section, type IconName } from "~/components/ui";
import { TaskRow } from "~/components/task-row";
import { colors, space } from "~/theme";

const AGENDA_DAYS = 14;
const DONE_SHOWN = 20;
const KIND: Record<Exclude<EventKind, "session">, { label: string; icon: IconName }> = {
  class: { label: "Class", icon: { ios: "building.columns", android: "school" } },
  exam: { label: "Exam", icon: { ios: "graduationcap", android: "workspace_premium" } },
  task: { label: "Task", icon: { ios: "checklist", android: "task_alt" } },
  block: { label: "Study", icon: { ios: "book", android: "menu_book" } },
};

export default function Plan() {
  const [view, setView] = useState(0);
  return (
    <Screen title="Plan" right={<Button label="Task" icon={{ ios: "plus", android: "add" }} onPress={() => router.push("/task")} style={{ minHeight: 40 }} testID="plan-add-task" />}>
      <SegmentedControl values={["Tasks", "Agenda"]} selectedIndex={view} onChange={(e) => setView(e.nativeEvent.selectedSegmentIndex)}
        appearance="dark" accessibilityLabel="Show tasks or agenda" style={{ height: 36 }} />
      {view === 0 ? <TasksView /> : <AgendaView />}
    </Screen>
  );
}

function TasksView() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const today = localDateStr();
  const tasks = useCollection<Task>("tasks");
  const subjects = useCollection<Subject>("subjects").items;
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const open = tasks.items.filter((t) => !t.completed).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
    return {
      overdue: open.filter((t) => t.dueDate && t.dueDate < today),
      today: open.filter((t) => t.dueDate === today),
      upcoming: open.filter((t) => t.dueDate && t.dueDate > today),
      someday: open.filter((t) => !t.dueDate),
      done: tasks.items.filter((t) => t.completed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }, [tasks.items, today]);

  if (tasks.loading) return null;
  const row = (t: Task) => <TaskRow key={t.id} task={t} uid={uid} subjects={subjects} today={today} />;
  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.someday.length;
  return (
    <>
      {openCount === 0 && <Empty text="No open tasks. Tap Task to add one." />}
      {groups.overdue.length > 0 && <Section title={`Overdue (${groups.overdue.length})`}>{groups.overdue.map(row)}</Section>}
      {groups.today.length > 0 && <Section title="Today">{groups.today.map(row)}</Section>}
      {groups.upcoming.length > 0 && <Section title="Upcoming">{groups.upcoming.map(row)}</Section>}
      {groups.someday.length > 0 && <Section title="No date">{groups.someday.map(row)}</Section>}
      {groups.done.length > 0 && (
        <Section title={`Done (${groups.done.length})`} right={
          <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: colors.primary, fontSize: 14 }}>{showDone ? "Hide" : "Show"}</Text>
          </Pressable>}>
          {showDone && groups.done.slice(0, DONE_SHOWN).map(row)}
        </Section>
      )}
    </>
  );
}

function AgendaView() {
  const today = localDateStr();
  const last = addDays(today, AGENDA_DAYS - 1);
  const classes = useCollection<ClassItem>("classes").items;
  const exams = useCollection<Exam>("exams").items;
  const tasks = useCollection<Task>("tasks").items;
  const blocks = useCollection<StudyBlock>("studyBlocks").items;
  const subjects = useCollection<Subject>("subjects").items;
  const { settings: timetable } = useTimetable();

  const byDay = useMemo(() => {
    const events = buildEvents({ classes, timetable, exams, tasks, blocks, sessions: [] }, today, last);
    const map = new Map<string, CalEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return [...map.entries()];
  }, [classes, timetable, exams, tasks, blocks, today, last]);

  if (byDay.length === 0) return <Empty text="Nothing planned for the next two weeks." />;
  return (
    <>
      {byDay.map(([date, events]) => (
        <Section key={date} title={dayTitle(date, today)}>
          {events.map((e) => {
            const kind = KIND[e.kind as keyof typeof KIND];
            const sub = subjects.find((x) => x.id === e.subjectId);
            const open = () => {
              if (e.kind === "task" && e.refId) router.push({ pathname: "/task", params: { id: e.refId } });
            };
            return (
              <Pressable key={e.key} onPress={open} disabled={e.kind !== "task"} accessibilityRole={e.kind === "task" ? "button" : undefined}>
                <Card style={s.event}>
                  <Text style={s.time}>{e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "All day"}</Text>
                  <Dot color={getColor(sub?.color ?? "violet").dot} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, e.done && s.done]} numberOfLines={2}>{e.kind === "class" ? sub?.name ?? e.title : e.title}</Text>
                    <Text style={s.muted}>{[kind?.label, e.kind !== "class" && sub?.name, e.detail].filter(Boolean).join(" · ")}</Text>
                  </View>
                  {kind && <Icon name={kind.icon} size={16} />}
                </Card>
              </Pressable>
            );
          })}
        </Section>
      ))}
    </>
  );
}

function dayTitle(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

const s = StyleSheet.create({
  event: { flexDirection: "row", alignItems: "center", gap: space.md },
  time: { color: colors.textMuted, fontSize: 13, fontVariant: ["tabular-nums"], width: 92 },
  title: { color: colors.text, fontSize: 16 },
  done: { color: colors.outline, textDecorationLine: "line-through" },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
