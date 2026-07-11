import { Text, Pressable } from "react-native";

export default function GroupHeader({ group, collapsed, onToggle }) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center gap-1 px-4 py-2">
      <Text className="text-[10px] text-slate-400">{collapsed ? "▸" : "▾"}</Text>
      <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.name}</Text>
    </Pressable>
  );
}
