import "../global.css";

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { ListsProvider } from "../context/ListsContext";

function RootLayoutNav() {
  const { auth, isLoading } = useAuth();

  if (isLoading) {
    return <View className="flex-1 bg-slate-50" />;
  }

  const isAuthenticated = !!auth;
  const needsNickname = isAuthenticated && !auth.nickname;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)/login" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && needsNickname}>
        <Stack.Screen name="(auth)/nickname" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && !needsNickname}>
        <Stack.Screen name="(app)/index" />
        <Stack.Screen
          name="(app)/add-edit-todo"
          options={{ presentation: "modal", headerShown: true, title: "Task" }}
        />
        <Stack.Screen name="(app)/lists" options={{ presentation: "modal", headerShown: true, title: "Lists" }} />
        <Stack.Screen name="(app)/share" options={{ presentation: "modal", headerShown: true, title: "Share" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <ListsProvider>
            <RootLayoutNav />
          </ListsProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
