import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

function CheckEmailNotice({ email, onBack }) {
  const [status, setStatus] = useState("idle");

  async function handleResend() {
    setStatus("sending");
    try {
      await api.resendVerification(email);
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6 dark:bg-slate-900">
      <View className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-slate-800">
        <Text className="mb-2 text-center text-2xl font-semibold text-slate-900 dark:text-white">
          Check your email
        </Text>
        <Text className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          We sent a verification link to {email}. Tap it to activate your account, then come back and log in.
        </Text>
        <Pressable
          onPress={handleResend}
          disabled={status === "sending"}
          className="w-full items-center rounded-md bg-indigo-600 px-4 py-3 disabled:opacity-50"
        >
          <Text className="text-sm font-medium text-white">
            {status === "sending" ? "Sending..." : status === "sent" ? "Email sent" : "Resend email"}
          </Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-4 items-center">
          <Text className="text-sm text-slate-500 dark:text-slate-400">Back to login</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [checkEmail, setCheckEmail] = useState(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetFields() {
    setUsername("");
    setEmail("");
    setPassword("");
    setError("");
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { token, username: u, nickname, id } = await api.login(email.trim(), password);
        login(token, u, nickname, id);
      } else {
        await api.signup(username.trim(), email.trim(), password);
        setCheckEmail(email.trim());
      }
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        setCheckEmail(email.trim());
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleSignIn() {
    Alert.alert(
      "Google sign-in not set up yet",
      "This needs a Google Cloud OAuth client ID for iOS/Android before it can be enabled."
    );
  }

  if (checkEmail) {
    return (
      <CheckEmailNotice
        email={checkEmail}
        onBack={() => {
          setCheckEmail(null);
          resetFields();
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50 dark:bg-slate-900"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6" keyboardShouldPersistTaps="handled">
        <View className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm dark:bg-slate-800">
          <Text className="text-center text-2xl font-semibold text-slate-900 dark:text-white">Planora</Text>
          <Text className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
            From To-Do to Done
          </Text>
          <Text className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" ? "Log in to your account" : "Create an account"}
          </Text>

          {mode === "signup" && (
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoCapitalize="none"
              className="mb-3 rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            className="mb-3 rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "signup" ? "Password (min. 8 characters)" : "Password"}
            secureTextEntry
            className="mb-3 rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
          />

          {error ? <Text className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="w-full items-center rounded-md bg-indigo-600 px-4 py-3 disabled:opacity-50"
          >
            <Text className="text-sm font-medium text-white">
              {submitting ? (mode === "login" ? "Logging in..." : "Creating account...") : mode === "login" ? "Log in" : "Sign up"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="mt-4 items-center"
          >
            <Text className="text-sm text-indigo-600 dark:text-indigo-400">
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </Text>
          </Pressable>

          <View className="my-6 h-px bg-slate-200 dark:bg-slate-700" />

          <Pressable
            onPress={handleGoogleSignIn}
            className="w-full items-center rounded-md border border-slate-300 px-4 py-3 dark:border-slate-600"
          >
            <Text className="text-sm font-medium text-slate-700 dark:text-slate-200">Sign in with Google</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
