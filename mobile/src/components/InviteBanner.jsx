import { View, Text, Pressable } from "react-native";

export default function InviteBanner({ invite, onAccept, onDecline }) {
  return (
    <View className="mb-2 flex-row items-center justify-between gap-2 rounded-md bg-indigo-50 px-3 py-2 dark:bg-indigo-950/40">
      <Text className="flex-1 text-sm text-indigo-800 dark:text-indigo-200">
        <Text className="font-semibold">{invite.owner_nickname || invite.owner_username}</Text> shared &quot;
        {invite.list_name}&quot; with you.
      </Text>
      <View className="flex-row gap-2">
        <Pressable onPress={() => onAccept(invite.share_id)} className="rounded bg-indigo-600 px-2 py-1">
          <Text className="text-xs font-medium text-white">Accept</Text>
        </Pressable>
        <Pressable
          onPress={() => onDecline(invite.share_id)}
          className="rounded bg-white px-2 py-1 ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600"
        >
          <Text className="text-xs font-medium text-slate-600 dark:text-slate-300">Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}
