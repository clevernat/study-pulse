import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { addTask, updateTask } from "@/lib/firebase/firestore";
import { nextRepeat, TASK_KINDS, kindOf } from "@/lib/tasks";
import { getColor } from "@/lib/colorPalette";
import type { Subject, Task } from "@/types";
import { Dot, Icon } from "~/components/ui";
import { colors, radius, space } from "~/theme";

const PRIORITY_COLOR = { high: colors.error, medium: colors.amber, low: colors.green } as const;

/** Done / not done. A finished repeating revision task makes its next copy (same as the website). */
export async function toggleTask(uid: string, task: Task) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  await updateTask(uid, task.id, { completed: !task.completed });
  const next = !task.completed ? nextRepeat(task, new Date()) : null;
  if (next) await addTask(uid, { ...next, repeatAfterDays: task.repeatAfterDays });
}

export function dueLabel(task: Pick<Task, "dueDate" | "dueTime">, today: string): string | null {
  if (!task.dueDate) return null;
  const time = task.dueTime ? ` ${task.dueTime}` : "";
  if (task.dueDate === today) return `Today${time}`;
  const d = new Date(task.dueDate + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + time;
}

export function TaskRow({ task, uid, subjects, today }: { task: Task; uid: string; subjects: Subject[]; today: string }) {
  const subject = subjects.find((s) => s.id === task.subjectId);
  const overdue = !task.completed && !!task.dueDate && task.dueDate < today;
  const due = dueLabel(task, today);
  const kind = kindOf(task);
  return (
    <View style={s.row}>
      <Pressable testID={`task-check-${task.id}`} onPress={() => toggleTask(uid, task)} hitSlop={10}
        accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`Done: ${task.title}`}
        style={[s.check, task.completed && s.checkOn]}>
        {task.completed ? <Icon name={{ ios: "checkmark", android: "check" }} size={14} color={colors.bg} /> : null}
      </Pressable>
      <Pressable style={s.body} onPress={() => router.push({ pathname: "/task", params: { id: task.id } })}
        accessibilityRole="button" accessibilityLabel={`Edit ${task.title}`}>
        <Text style={[s.title, task.completed && s.titleDone]} numberOfLines={2}>{task.title}</Text>
        <View style={s.meta}>
          {kind !== "task" && <Text style={s.metaText}>{TASK_KINDS.find((k) => k.value === kind)?.label}</Text>}
          {subject && (<View style={s.subject}><Dot color={getColor(subject.color).dot} size={6} /><Text style={s.metaText} numberOfLines={1}>{subject.name}</Text></View>)}
          {due && <Text style={[s.metaText, overdue && { color: colors.error }]}>{due}</Text>}
          {task.repeatAfterDays ? <Icon name={{ ios: "repeat", android: "repeat" }} size={12} /> : null}
        </View>
      </Pressable>
      {task.priority && !task.completed ? <Dot color={PRIORITY_COLOR[task.priority]} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 56 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.outline, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.green, borderColor: colors.green },
  body: { flex: 1, gap: 3, paddingVertical: 4 },
  title: { color: colors.text, fontSize: 16 },
  titleDone: { color: colors.outline, textDecorationLine: "line-through" },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  metaText: { color: colors.textMuted, fontSize: 12 },
  subject: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 160 },
});
