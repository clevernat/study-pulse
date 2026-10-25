import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/firebase/useCollection";
import { addTask, deleteTask, updateItem } from "@/lib/firebase/firestore";
import { TASK_KINDS } from "@/lib/tasks";
import { getColor } from "@/lib/colorPalette";
import { localDateStr } from "@/lib/dateUtils";
import { REMINDER_OPTIONS } from "@/components/ui/Field";
import type { Subject, Task, TaskKind } from "@/types";
import { Button } from "~/components/ui";
import { ChipPicker, DateTimeField, Field, SwitchRow, f } from "~/components/form";
import { colors, space } from "~/theme";

type Priority = "" | "low" | "medium" | "high";
const PRIORITIES: { value: Priority; label: string; color?: string }[] = [
  { value: "", label: "None" }, { value: "low", label: "Low", color: colors.green },
  { value: "medium", label: "Medium", color: colors.amber }, { value: "high", label: "High", color: colors.error },
];

/** Add or edit a task (opened as a sheet). Same fields and rules as the website's task form. */
export default function TaskSheet() {
  const { id, due } = useLocalSearchParams<{ id?: string; due?: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const insets = useSafeAreaInsets();
  const tasks = useCollection<Task>("tasks");
  const subjects = useCollection<Subject>("subjects").items;
  const existing = id ? tasks.items.find((t) => t.id === id) : undefined;

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [subjectId, setSubjectId] = useState("");
  const [hasDate, setHasDate] = useState(!!due);
  const [dueDate, setDueDate] = useState(due ?? localDateStr());
  const [hasTime, setHasTime] = useState(false);
  const [dueTime, setDueTime] = useState("17:00");
  const [priority, setPriority] = useState<Priority>("");
  const [reminder, setReminder] = useState("");
  const [repeatDays, setRepeatDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  // Fill the form once the task has loaded.
  if (existing && !loaded) {
    setTitle(existing.title);
    setKind(existing.kind ?? "task");
    setSubjectId(existing.subjectId ?? "");
    setHasDate(!!existing.dueDate);
    if (existing.dueDate) setDueDate(existing.dueDate);
    setHasTime(!!existing.dueTime);
    if (existing.dueTime) setDueTime(existing.dueTime);
    setPriority(existing.priority ?? "");
    setReminder(existing.reminderMinutesBefore?.toString() ?? "");
    setRepeatDays(existing.repeatAfterDays?.toString() ?? "");
    setLoaded(true);
  }

  const save = async () => {
    if (!title.trim() || !uid) return;
    setBusy(true);
    const sub = subjects.find((s) => s.id === subjectId);
    const repeat = parseInt(repeatDays);
    const fields: Partial<Task> = {
      title: title.trim(),
      kind,
      subjectId: sub?.id,
      subjectName: sub?.name,
      dueDate: hasDate ? dueDate : undefined,
      dueTime: hasDate && hasTime ? dueTime : undefined,
      priority: priority || undefined,
      reminderMinutesBefore: hasDate && reminder !== "" ? parseInt(reminder) : undefined,
      repeatAfterDays: kind === "revision" && repeat > 0 ? Math.min(365, repeat) : undefined,
    };
    try {
      if (existing) {
        await updateItem<Task>(uid, "tasks", existing.id, fields);
      } else {
        // New documents leave out empty fields (Firestore ignores undefined here).
        await addTask(uid, { uid, completed: false, createdAt: new Date().toISOString(), ...fields } as Omit<Task, "id">);
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert("Delete task?", existing.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteTask(uid, existing.id); router.back(); } },
    ]);
  };

  if (id && !loaded) return <View style={{ flex: 1, backgroundColor: colors.card }} />;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.card }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={s.heading} accessibilityRole="header">{existing ? "Edit task" : "New task"}</Text>
        <Field label="Title">
          <TextInput testID="task-title" style={f.input} value={title} onChangeText={setTitle} placeholder="What do you need to do?"
            placeholderTextColor={colors.outline} autoFocus={!existing} returnKeyType="done" accessibilityLabel="Title" />
        </Field>
        <Field label="Type">
          <ChipPicker label="Type" value={kind} onChange={setKind} options={TASK_KINDS.map((k) => ({ value: k.value, label: k.label }))} />
        </Field>
        {subjects.length > 0 && (
          <Field label="Subject">
            <ChipPicker label="Subject" value={subjectId} onChange={setSubjectId}
              options={[{ value: "", label: "None" }, ...subjects.map((sub) => ({ value: sub.id, label: sub.name, color: getColor(sub.color).dot }))]} />
          </Field>
        )}
        <View>
          <SwitchRow label="Due date" value={hasDate} onChange={setHasDate} testID="task-has-date" />
          {hasDate && <DateTimeField mode="date" label="Due date" value={dueDate} onChange={setDueDate} />}
        </View>
        {hasDate && (
          <View>
            <SwitchRow label="Time" hint="Leave off for any time that day" value={hasTime} onChange={setHasTime} />
            {hasTime && <DateTimeField mode="time" label="Time" value={dueTime} onChange={setDueTime} />}
          </View>
        )}
        {hasDate && (
          <Field label="Reminder">
            <ChipPicker label="Reminder" value={reminder} onChange={setReminder} options={REMINDER_OPTIONS} />
          </Field>
        )}
        <Field label="Priority">
          <ChipPicker label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
        </Field>
        {kind === "revision" && (
          <Field label="Repeat after (days)">
            <TextInput style={[f.input, { width: 120 }]} value={repeatDays} onChangeText={(t) => setRepeatDays(t.replace(/\D/g, ""))}
              keyboardType="number-pad" placeholder="e.g. 7" placeholderTextColor={colors.outline} accessibilityLabel="Repeat after days" />
          </Field>
        )}
        <Button testID="task-save" label={existing ? "Save" : "Add task"} onPress={save} busy={busy} disabled={!title.trim()} />
        {existing && <Button label="Delete task" kind="danger" onPress={remove} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg },
  heading: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: space.sm },
});
