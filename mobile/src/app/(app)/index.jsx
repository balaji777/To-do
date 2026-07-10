import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import TodoRow from "../../components/TodoRow";
import { visibleTodos } from "../../constants/todoMeta";

export default function TodoListScreen() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadTodos = useCallback(
    (opts = {}) => {
      if (!opts.silent) setLoading(true);
      return api
        .getTodos(auth.token)
        .then(setTodos)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [auth.token]
  );

  useFocusEffect(
    useCallback(() => {
      loadTodos({ silent: todos.length > 0 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadTodos])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadTodos({ silent: true });
    setRefreshing(false);
  }

  async function toggleDone(todo) {
    const updated = await api.updateTodo(auth.token, todo.id, { done: !todo.done });
    if (!todo.done && todo.recurrence !== "none" && todo.due_date) {
      const refreshed = await api.getTodos(auth.token);
      setTodos(refreshed);
    } else {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    }
  }

  async function removeTodo(todo) {
    await api.deleteTodo(auth.token, todo.id);
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
  }

  function openTodo(todo) {
    router.push({ pathname: "/(app)/add-edit-todo", params: { todo: JSON.stringify(todo) } });
  }

  const remaining = todos.filter((t) => !t.done).length;
  const filtered = useMemo(() => visibleTodos(todos, { search }), [todos, search]);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-row items-center justify-between border-b border-slate-200 px-4 pb-3 pt-14 dark:border-slate-700">
        <Text className="text-xl font-semibold text-slate-900 dark:text-white">
          {auth.nickname || auth.username}&apos;s tasks
        </Text>
        <Pressable onPress={logout}>
          <Text className="text-sm text-slate-500 dark:text-slate-400">Log out</Text>
        </Pressable>
      </View>

      <View className="px-4 pt-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
        />
      </View>

      {error ? (
        <Text className="px-4 pt-3 text-sm text-red-600 dark:text-red-400">{error}</Text>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TodoRow todo={item} onToggle={toggleDone} onDelete={removeTodo} onPress={openTodo} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-slate-500 dark:text-slate-400">
                {todos.length === 0 ? "No tasks yet — tap + to add one." : "No tasks match."}
              </Text>
            </View>
          }
          ListFooterComponent={
            todos.length > 0 ? (
              <Text className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {remaining} of {todos.length} remaining
              </Text>
            ) : null
          }
        />
      )}

      <Pressable
        onPress={() => router.push({ pathname: "/(app)/add-edit-todo" })}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg"
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>
    </View>
  );
}
