import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useLists } from "../../context/ListsContext";
import { SMART_VIEWS } from "../../constants/views";
import GroupHeader from "../../components/GroupHeader";

function RenameAction({ onPress }) {
  return (
    <Pressable onPress={onPress} className="items-center justify-center bg-indigo-600 px-5">
      <Text className="text-sm font-medium text-white">Rename</Text>
    </Pressable>
  );
}

function DeleteAction({ onPress }) {
  return (
    <Pressable onPress={onPress} className="items-center justify-center bg-red-500 px-5">
      <Text className="text-sm font-medium text-white">Delete</Text>
    </Pressable>
  );
}

function LeaveAction({ onPress }) {
  return (
    <Pressable onPress={onPress} className="items-center justify-center bg-red-500 px-5">
      <Text className="text-sm font-medium text-white">Leave</Text>
    </Pressable>
  );
}

export default function ListsScreen() {
  const router = useRouter();
  const {
    lists,
    groups,
    sharedWithMe,
    activeView,
    setActiveView,
    createList,
    updateList,
    deleteList,
    createGroup,
    leaveSharedList,
  } = useLists();

  const [addingList, setAddingList] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListGroupId, setNewListGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [error, setError] = useState("");

  function toggleCollapsed(groupId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function selectView(view) {
    setActiveView(view);
    router.back();
  }

  async function submitNewList() {
    if (!newListName.trim()) return;
    try {
      await createList(newListName.trim(), newListGroupId);
      setNewListName("");
      setNewListGroupId(null);
      setAddingList(false);
      router.back();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitNewGroup() {
    if (!newGroupName.trim()) return;
    try {
      await createGroup(newGroupName.trim());
      setNewGroupName("");
      setAddingGroup(false);
    } catch (err) {
      setError(err.message);
    }
  }

  function startRename(list) {
    setRenameId(list.id);
    setRenameValue(list.name);
  }

  async function submitRename() {
    if (!renameValue.trim()) return;
    try {
      await updateList(renameId, { name: renameValue.trim() });
      setRenameId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function confirmDelete(list) {
    Alert.alert("Delete list", `Delete "${list.name}"? This deletes all its tasks.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteList(list.id).catch((err) => setError(err.message)) },
    ]);
  }

  function confirmLeave(list) {
    Alert.alert("Leave list", `Leave "${list.name}"? You'll lose access unless invited again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => leaveSharedList(list.share_id, list.id).catch((err) => setError(err.message)),
      },
    ]);
  }

  function isActiveList(listId) {
    return activeView.type === "list" && activeView.listId === listId;
  }

  function listRow(list) {
    if (renameId === list.id) {
      return (
        <View key={list.id} className="flex-row items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
          <TextInput
            value={renameValue}
            onChangeText={setRenameValue}
            autoFocus
            onSubmitEditing={submitRename}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
          />
          <Pressable onPress={submitRename}>
            <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Save</Text>
          </Pressable>
          <Pressable onPress={() => setRenameId(null)}>
            <Text className="text-sm text-slate-400">Cancel</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Swipeable
        key={list.id}
        renderLeftActions={() => <RenameAction onPress={() => startRename(list)} />}
        renderRightActions={list.is_default ? undefined : () => <DeleteAction onPress={() => confirmDelete(list)} />}
        overshootLeft={false}
        overshootRight={false}
      >
        <Pressable
          onPress={() => selectView({ type: "list", listId: list.id })}
          className={`border-b border-slate-100 px-4 py-3 dark:border-slate-700 ${
            isActiveList(list.id) ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-white dark:bg-slate-800"
          }`}
        >
          <Text
            className={
              isActiveList(list.id)
                ? "font-medium text-indigo-700 dark:text-indigo-300"
                : "text-slate-700 dark:text-slate-200"
            }
          >
            ☰ {list.name}
          </Text>
        </Pressable>
      </Swipeable>
    );
  }

  const grouped = groups.map((group) => ({ group, lists: lists.filter((l) => l.group_id === group.id) }));
  const ungrouped = lists.filter((l) => !l.group_id);

  return (
    <ScrollView className="flex-1 bg-white dark:bg-slate-900">
      <View className="py-2">
        {SMART_VIEWS.map((view) => (
          <Pressable
            key={view.type}
            onPress={() => selectView({ type: view.type })}
            className={`flex-row items-center gap-2 px-4 py-2.5 ${
              activeView.type === view.type ? "bg-indigo-50 dark:bg-indigo-950/40" : ""
            }`}
          >
            <Text>{view.icon}</Text>
            <Text
              className={
                activeView.type === view.type
                  ? "font-medium text-indigo-700 dark:text-indigo-300"
                  : "text-slate-700 dark:text-slate-200"
              }
            >
              {view.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {grouped.map(({ group, lists: groupLists }) => {
        const isCollapsed = collapsed.has(group.id);
        return (
          <View key={group.id}>
            <GroupHeader group={group} collapsed={isCollapsed} onToggle={() => toggleCollapsed(group.id)} />
            {!isCollapsed
              ? groupLists.length > 0
                ? groupLists.map(listRow)
                : (
                  <Text className="px-4 py-1 text-xs italic text-slate-400 dark:text-slate-500">No lists yet</Text>
                )
              : null}
          </View>
        );
      })}

      {ungrouped.map(listRow)}

      {sharedWithMe.length > 0 ? (
        <View className="mt-2">
          <Text className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Shared with Me</Text>
          {sharedWithMe.map((list) => (
            <Swipeable
              key={list.id}
              renderRightActions={() => <LeaveAction onPress={() => confirmLeave(list)} />}
              overshootRight={false}
            >
              <Pressable
                onPress={() => selectView({ type: "list", listId: list.id })}
                className={`flex-row items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700 ${
                  isActiveList(list.id) ? "bg-indigo-50 dark:bg-indigo-950/40" : "bg-white dark:bg-slate-800"
                }`}
              >
                <Text className={isActiveList(list.id) ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200"}>
                  👥 {list.name}
                </Text>
                <Text className="text-xs text-slate-400">{list.owner_nickname || list.owner_username}</Text>
              </Pressable>
            </Swipeable>
          ))}
        </View>
      ) : null}

      {error ? <Text className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{error}</Text> : null}

      <View className="mt-3 gap-1 px-4 pb-8">
        {addingList ? (
          <View className="gap-2 py-2">
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              autoFocus
              onSubmitEditing={submitNewList}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
            />
            {groups.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => setNewListGroupId(null)}
                  className={`rounded-full border px-3 py-1 ${
                    newListGroupId == null ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <Text className={newListGroupId == null ? "text-xs text-white" : "text-xs text-slate-700 dark:text-slate-200"}>
                    No group
                  </Text>
                </Pressable>
                {groups.map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => setNewListGroupId(group.id)}
                    className={`rounded-full border px-3 py-1 ${
                      newListGroupId === group.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <Text className={newListGroupId === group.id ? "text-xs text-white" : "text-xs text-slate-700 dark:text-slate-200"}>
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable onPress={submitNewList}>
              <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Add list</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setAddingList(true)} className="py-2">
            <Text className="text-sm text-slate-500 dark:text-slate-400">+ New list</Text>
          </Pressable>
        )}

        {addingGroup ? (
          <View className="flex-row items-center gap-2 py-2">
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group name"
              autoFocus
              onSubmitEditing={submitNewGroup}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
            />
            <Pressable onPress={submitNewGroup}>
              <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Add</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setAddingGroup(true)} className="py-2">
            <Text className="text-sm text-slate-500 dark:text-slate-400">+ New group</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}
