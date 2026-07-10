import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function NicknameScreen() {
  const { auth, setNickname } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a nickname.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { nickname } = await api.setNickname(auth.token, trimmed);
      setNickname(nickname);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 items-center justify-center bg-slate-50 px-6 dark:bg-slate-900"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="w-full max-w-sm rounded-xl bg-white p-8 dark:bg-slate-800">
        <Text className="mb-2 text-center text-2xl font-semibold text-slate-900 dark:text-white">Welcome!</Text>
        <Text className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">What should we call you?</Text>

        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Nickname"
          maxLength={30}
          autoFocus
          className="mb-3 rounded-md border border-slate-300 px-3 py-3 text-center text-slate-900 dark:border-slate-600 dark:text-white"
        />
        {error ? <Text className="mb-3 text-center text-sm text-red-600 dark:text-red-400">{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="w-full items-center rounded-md bg-indigo-600 px-4 py-3 disabled:opacity-50"
        >
          <Text className="text-sm font-medium text-white">{submitting ? "Saving..." : "Continue"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
