// Must run before any store reads localStorage (the shared timer store persists there).
import "expo-sqlite/localStorage/install";
import { useEffect } from "react";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppSync } from "~/lib/app-sync";
import { Loading } from "~/components/ui";
import { Notifications } from "~/lib/notifications";
import { colors } from "~/theme";

SplashScreen.preventAutoHideAsync();

Notifications?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, border: colors.border, text: colors.text, primary: colors.primary },
};

function RootStack() {
  const { user, loading } = useAuth();
  // Hide the start screen as soon as the app runs; a dark spinner covers the short sign-in check.
  useEffect(() => { SplashScreen.hideAsync().catch(() => undefined); }, []);
  if (loading) return <Loading />;
  return (
    <>
      {user && <AppSync />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="review" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
          <Stack.Screen name="task" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
