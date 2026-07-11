import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { api } from "../api/client";

// No effect syncing `subtasks` from `todo.subtasks`: unlike the web version (which reuses
// one modal instance across different todos), this screen remounts fresh per navigation,
// so the lazy initial state is never stale.
export default function SubtaskList({ todo, token }) {
  const [subtasks, setSubtasks] = useState(todo.subtasks || []);
  const [title, setTitle] = useState("");

  async function handleAdd() {
    if (!title.trim()) return;
    const subtask = await api.addSubtask(token, todo.id, title.trim());
    setSubtasks((prev) => [...prev, subtask]);
    setTitle("");
  }

  async function toggle(subtask) {
    const updated = await api.updateSubtask(token, subtask.id, { done: !subtask.done });
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)));
  }

  async function remove(subtask) {
    await api.deleteSubtask(token, subtask.id);
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
  }

  return (
    <View>
      {subtasks.length > 0 ? (
        <View className="mb-2 gap-1.5">
          {subtasks.map((subtask) => (
            <View key={subtask.id} className="flex-row items-center gap-2">
              <Pressable
                onPress={() => toggle(subtask)}
                hitSlop={6}
                className={`h-4 w-4 items-center justify-center rounded border ${
                  subtask.done ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-500"
                }`}
              >
                {subtask.done ? <Text className="text-[9px] font-bold text-white">✓</Text> : null}
              </Pressable>
              <Text
                className={`flex-1 text-sm ${
                  subtask.done ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {subtask.title}
              </Text>
              <Pressable onPress={() => remove(subtask)} hitSlop={6}>
                <Text className="text-slate-400">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View className="flex-row items-center gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Add subtask..."
          onSubmitEditing={handleAdd}
          className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
        />
        <Pressable onPress={handleAdd}>
          <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
