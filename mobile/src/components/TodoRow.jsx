import { View, Text, Pressable } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { PRIORITY_STYLES, PRIORITY_TEXT_STYLES, RECURRENCE_LABELS, isOverdue } from "../constants/todoMeta";

function DeleteAction({ onPress }) {
  return (
    <Pressable onPress={onPress} className="items-center justify-center bg-red-500 px-5">
      <Text className="text-sm font-medium text-white">Delete</Text>
    </Pressable>
  );
}

export default function TodoRow({ todo, onToggle, onDelete, onPress, onToggleImportant, currentUserId }) {
  return (
    <Swipeable renderRightActions={() => <DeleteAction onPress={() => onDelete(todo)} />} overshootRight={false}>
      <Pressable
        onPress={() => onPress(todo)}
        className="flex-row items-start gap-3 border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
      >
        <Pressable
          onPress={() => onToggle(todo)}
          hitSlop={8}
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            todo.done ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-500"
          }`}
        >
          {todo.done ? <Text className="text-xs font-bold text-white">✓</Text> : null}
        </Pressable>

        <View className="flex-1">
          <Text
            className={todo.done ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}
            numberOfLines={2}
          >
            {todo.title}
          </Text>

          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
            <View className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[todo.priority]}`}>
              <Text className={`text-xs font-medium ${PRIORITY_TEXT_STYLES[todo.priority]}`}>{todo.priority}</Text>
            </View>

            {todo.list_name ? (
              <View className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700">
                <Text className="text-xs text-slate-600 dark:text-slate-300">{todo.list_name}</Text>
              </View>
            ) : null}

            {todo.created_by ? (
              <View className="rounded-full bg-indigo-50 px-2 py-0.5 dark:bg-indigo-950/40">
                <Text className="text-xs text-indigo-600 dark:text-indigo-300">
                  {todo.created_by === currentUserId
                    ? "You"
                    : todo.created_by_nickname || todo.created_by_username || "Collaborator"}
                </Text>
              </View>
            ) : null}
          </View>

          {todo.due_date || RECURRENCE_LABELS[todo.recurrence] ? (
            <View className="mt-1 flex-row flex-wrap gap-2">
              {todo.due_date ? (
                <Text className={isOverdue(todo) ? "text-xs font-medium text-rose-600 dark:text-rose-400" : "text-xs text-slate-400"}>
                  Due {new Date(todo.due_date).toLocaleDateString()}
                  {isOverdue(todo) ? " (overdue)" : ""}
                </Text>
              ) : null}
              {RECURRENCE_LABELS[todo.recurrence] ? (
                <Text className="text-xs text-slate-400">{RECURRENCE_LABELS[todo.recurrence]}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {onToggleImportant ? (
          <Pressable onPress={() => onToggleImportant(todo)} hitSlop={8} className="mt-0.5">
            <Text className={todo.important ? "text-lg text-amber-500" : "text-lg text-slate-300 dark:text-slate-600"}>
              {todo.important ? "★" : "☆"}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Swipeable>
  );
}
