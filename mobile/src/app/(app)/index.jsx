import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLists } from "../../context/ListsContext";
import TodoRow from "../../components/TodoRow";
import InviteBanner from "../../components/InviteBanner";
import { visibleTodos } from "../../constants/todoMeta";
import { viewTitle, canQuickAdd, createPayloadFor, fetchTodosForView } from "../../constants/views";

export default function TodoListScreen() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const {
    lists,
    sharedWithMe,
    invitesReceived,
    activeView,
    refreshListShares,
    acceptListShareInvite,
    declineListShareInvite,
  } = useLists();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadTodos = useCallback(
    (opts = {}) => {
      if (!opts.silent) setLoading(true);
      return fetchTodosForView(api, auth.token, activeView)
        .then(setTodos)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [auth.token, activeView]
  );

  useFocusEffect(
    useCallback(() => {
      loadTodos({ silent: todos.length > 0 });
      refreshListShares();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadTodos])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadTodos({ silent: true });
    setRefreshing(false);
  }

  async function handleAdd() {
    if (!title.trim()) return;
    const payload = { title: title.trim(), ...createPayloadFor(activeView, lists) };
    try {
      const todo = await api.addTodo(auth.token, payload);
      setTodos((prev) => [todo, ...prev]);
      setTitle("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDone(todo) {
    const updated = await api.updateTodo(auth.token, todo.id, { done: !todo.done });
    if (!todo.done && todo.recurrence !== "none" && todo.due_date) {
      await loadTodos({ silent: true });
    } else {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    }
  }

  async function toggleImportant(todo) {
    await api.updateTodo(auth.token, todo.id, { important: !todo.important });
    await loadTodos({ silent: true });
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
  const headerTitle = viewTitle(activeView, lists, sharedWithMe);
  const canAdd = canQuickAdd(activeView);
  const ownsActiveList = activeView.type === "list" && lists.some((l) => l.id === activeView.listId);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-900">
      <View className="flex-row items-center justify-between border-b border-slate-200 px-4 pb-3 pt-14 dark:border-slate-700">
        <Pressable
          onPress={() => router.push("/(app)/lists")}
          className="flex-1 flex-row items-center gap-1"
          hitSlop={8}
        >
          <Text className="text-xl font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text className="text-slate-400">▾</Text>
        </Pressable>
        <View className="flex-row items-center gap-4">
          {ownsActiveList ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(app)/share",
                  params: { listId: activeView.listId, listName: headerTitle },
                })
              }
            >
              <Text className="text-sm text-indigo-600 dark:text-indigo-400">Share</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={logout}>
            <Text className="text-sm text-slate-500 dark:text-slate-400">Log out</Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 pt-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
        />
      </View>

      {invitesReceived.length > 0 ? (
        <View className="px-4 pt-3">
          {invitesReceived.map((invite) => (
            <InviteBanner
              key={invite.share_id}
              invite={invite}
              onAccept={acceptListShareInvite}
              onDecline={declineListShareInvite}
            />
          ))}
        </View>
      ) : null}

      {canAdd ? (
        <View className="px-4 pt-3">
          <TextInput
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleAdd}
            placeholder="Add a task"
            returnKeyType="done"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
          />
        </View>
      ) : null}

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
            <TodoRow
              todo={item}
              onToggle={toggleDone}
              onDelete={removeTodo}
              onPress={openTodo}
              onToggleImportant={toggleImportant}
              currentUserId={auth.id}
            />
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

      {canAdd ? (
        <Pressable
          onPress={() => router.push({ pathname: "/(app)/add-edit-todo" })}
          className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg"
        >
          <Text className="text-2xl font-light text-white">+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
