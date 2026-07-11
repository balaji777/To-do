import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLists } from "../../context/ListsContext";
import { todayStr } from "../../constants/todoMeta";
import { createPayloadFor } from "../../constants/views";
import SubtaskList from "../../components/SubtaskList";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const RECURRENCES = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function OptionRow({ options, value, onChange, disabled }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={`rounded-full border px-3 py-1.5 ${disabled ? "opacity-40" : ""} ${
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

function toLocalDateTimeStr(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export default function AddEditTodoScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const { activeView, lists } = useLists();
  const params = useLocalSearchParams();
  const existing = useMemo(() => (params.todo ? JSON.parse(params.todo) : null), [params.todo]);
  const isEditing = !!existing;

  const [title, setTitle] = useState(existing?.title || "");
  const [dueDate, setDueDate] = useState(existing?.due_date || "");
  const [priority, setPriority] = useState(existing?.priority || "medium");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [recurrence, setRecurrence] = useState(existing?.recurrence || "none");
  const [important, setImportant] = useState(existing?.important || false);
  const [myDay, setMyDay] = useState(!!existing?.my_day_date);
  const [remindAt, setRemindAt] = useState(existing?.remind_at || "");
  const [assignedTo, setAssignedTo] = useState(existing?.assigned_to || null);
  const [members, setMembers] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    api
      .getListShares(auth.token, existing.list_id)
      .then((data) =>
        setMembers([
          data.owner,
          ...data.shares.filter((s) => s.status === "accepted").map((s) => ({ id: s.user_id, username: s.username, nickname: s.nickname })),
        ])
      )
      .catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, existing?.list_id]);

  function handleDateChange(event, selected) {
    setShowPicker(Platform.OS === "ios");
    if (selected) {
      setDueDate(selected.toISOString().slice(0, 10));
    }
  }

  function handleRemindChange(event, selected) {
    setShowRemindPicker(Platform.OS === "ios");
    if (selected) {
      setRemindAt(toLocalDateTimeStr(selected));
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
      notes: notes.trim() || null,
      recurrence: dueDate ? recurrence : "none",
      important,
    };
    if (isEditing) {
      payload.my_day = myDay;
      payload.remind_at = remindAt || null;
      payload.assigned_to = assignedTo;
    } else {
      Object.assign(payload, createPayloadFor(activeView, lists));
    }
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

      <Pressable onPress={() => setImportant((v) => !v)} className="flex-row items-center gap-1.5">
        <Text className={important ? "text-lg text-amber-500" : "text-lg text-slate-400"}>
          {important ? "★" : "☆"}
        </Text>
        <Text className={important ? "text-sm font-medium text-amber-600 dark:text-amber-400" : "text-sm text-slate-500 dark:text-slate-400"}>
          {important ? "Important" : "Mark important"}
        </Text>
      </Pressable>

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
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Repeat</Text>
        <OptionRow options={RECURRENCES} value={recurrence} onChange={setRecurrence} disabled={!dueDate} />
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Priority</Text>
        <OptionRow options={PRIORITIES} value={priority} onChange={setPriority} />
      </View>

      <View>
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes..."
          multiline
          numberOfLines={3}
          className="rounded-md border border-slate-300 px-3 py-3 text-slate-900 dark:border-slate-600 dark:text-white"
        />
      </View>

      {isEditing ? (
        <>
          <Pressable
            onPress={() => setMyDay((v) => !v)}
            className={`items-center rounded-md px-3 py-2 ${
              myDay ? "bg-amber-50 dark:bg-amber-950/40" : "bg-slate-100 dark:bg-slate-700"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                myDay ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {myDay ? "☀ Added to My Day" : "☀ Add to My Day"}
            </Text>
          </Pressable>

          <View>
            <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Remind me</Text>
            <Pressable
              onPress={() => setShowRemindPicker(true)}
              className="rounded-md border border-slate-300 px-3 py-3 dark:border-slate-600"
            >
              <Text className="text-slate-900 dark:text-white">{remindAt ? remindAt.replace("T", " ") : "No reminder"}</Text>
            </Pressable>
            {showRemindPicker ? (
              <DateTimePicker
                value={remindAt ? new Date(remindAt) : new Date()}
                mode="datetime"
                onChange={handleRemindChange}
              />
            ) : null}
            {remindAt ? (
              <Pressable onPress={() => setRemindAt("")} className="mt-1">
                <Text className="text-xs text-slate-400">Clear reminder</Text>
              </Pressable>
            ) : null}
          </View>

          {members.length > 1 ? (
            <View>
              <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Assigned to</Text>
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => setAssignedTo(null)}
                  className={`rounded-full border px-3 py-1.5 ${
                    assignedTo == null ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  <Text className={assignedTo == null ? "text-sm text-white" : "text-sm text-slate-700 dark:text-slate-200"}>
                    Nobody
                  </Text>
                </Pressable>
                {members.map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() => setAssignedTo(member.id)}
                    className={`rounded-full border px-3 py-1.5 ${
                      assignedTo === member.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    <Text className={assignedTo === member.id ? "text-sm text-white" : "text-sm text-slate-700 dark:text-slate-200"}>
                      {member.nickname || member.username}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Steps</Text>
            <SubtaskList todo={existing} token={auth.token} />
          </View>
        </>
      ) : null}

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
