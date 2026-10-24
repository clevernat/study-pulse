import { NativeTabs } from "expo-router/native-tabs";
import { useTimerStore } from "@/store/timerStore";
import { colors } from "~/theme";

// Same sections as the website's phone bar: Today · Plan · Timer · Study, plus Settings.
export default function TabsLayout() {
  const timerRunning = useTimerStore((s) => s.state === "running");
  return (
    <NativeTabs tintColor={colors.primary} backgroundColor={colors.card}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} md="today" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="calendar_month" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="timer">
        <NativeTabs.Trigger.Icon sf={{ default: "timer", selected: "timer" }} md="timer" />
        <NativeTabs.Trigger.Label>Timer</NativeTabs.Trigger.Label>
        {timerRunning ? <NativeTabs.Trigger.Badge> </NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="study">
        <NativeTabs.Trigger.Icon sf={{ default: "rectangle.stack", selected: "rectangle.stack.fill" }} md="style" />
        <NativeTabs.Trigger.Label>Study</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
