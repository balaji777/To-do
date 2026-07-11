import { View, Text, Pressable } from "react-native";

export default function MemberRow({ member, canRemove, onRemove }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-slate-700 dark:text-slate-300">
        {member.nickname || member.username}
        {member.status === "pending" ? (
          <Text className="text-xs text-amber-600 dark:text-amber-400"> (pending)</Text>
        ) : null}
      </Text>
      {canRemove ? (
        <Pressable onPress={() => onRemove(member.id)} hitSlop={6}>
          <Text className="text-xs text-slate-400">Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
