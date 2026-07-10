import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { todayStr } from "../../constants/todoMeta";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const TYPES = [
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "chore", label: "Chore" },
];

function OptionRow({ options, value, onChange }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`rounded-full border px-3 py-1.5 ${
            value === opt.value
              ? "border-indigo-600 bg-indigo-600"
              : "border-slate-300 dark:border-slate-600"
          }`}
        >
          <Text className={value === opt.value ? "text-sm text-white" : "text-sm text-slate-700 dark:text-slate-200"}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function AddEditTodoScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const existing = useMemo(() => (params.todo ? JSON.parse(params.todo) : null), [params.todo]);
  const isEditing = !!existing;

  const [title, setTitle] = useState(existing?.title || "");
  const [dueDate, setDueDate] = useState(existing?.due_date || "");
  const [priority, setPriority] = useState(existing?.priority || "medium");
  const [type, setType] = useState(existing?.type || "task");
  const [link, setLink] = useState(existing?.link || "");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleDateChange(event, selected) {
    setShowPicker(Platform.OS === "ios");
    if (selected) {
      setDueDate(selected.toISOString().slice(0, 10));
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: title.trim(),
      due_date: dueDate || null,
      priority,
      type,
      link: link.trim() || null,
    };
    try {
      if (isEditing) {
        await api.updateTodo(auth.token, existing.id, payload);
      } else {
        await api.addTodo(auth.token, payload);
      }
      router.back();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await api.deleteTodo(auth.token, existing.id);
      router.back();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900" contentContainerClassName="p-4 gap-4">
      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What needs to ship?"
          autoFocus={!isEditing}
          className="rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
        />
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Due date</Text>
        <Pressable
          onPress={() => setShowPicker(true)}
          className="rounded-md border border-slate-300 px-3 py-3 dark:border-slate-600"
        >
          <Text className="text-slate-900 dark:text-white">{dueDate || "No due date"}</Text>
        </Pressable>
        {showPicker ? (
          <DateTimePicker
            value={dueDate ? new Date(dueDate) : new Date()}
            mode="date"
            minimumDate={new Date(todayStr())}
            onChange={handleDateChange}
          />
        ) : null}
        {dueDate ? (
          <Pressable onPress={() => setDueDate("")} className="mt-1">
            <Text className="text-xs text-slate-400">Clear date</Text>
          </Pressable>
        ) : null}
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Type</Text>
        <OptionRow options={TYPES} value={type} onChange={setType} />
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Priority</Text>
        <OptionRow options={PRIORITIES} value={priority} onChange={setPriority} />
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Issue / PR link</Text>
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder="https://github.com/..."
          autoCapitalize="none"
          keyboardType="url"
          className="rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
        />
      </View>

      {error ? <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="items-center rounded-md bg-indigo-600 px-4 py-3 disabled:opacity-50"
      >
        <Text className="text-sm font-medium text-white">{saving ? "Saving..." : "Save"}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable onPress={handleDelete} disabled={saving} className="items-center py-2">
          <Text className="text-sm text-red-600 dark:text-red-400">Delete task</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
