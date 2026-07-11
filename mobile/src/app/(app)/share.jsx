import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import MemberRow from "../../components/MemberRow";

export default function ShareScreen() {
  const { auth } = useAuth();
  const params = useLocalSearchParams();
  const listId = params.listId;
  const listName = params.listName;

  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => {
    return api
      .getListShares(auth.token, listId)
      .then((data) => setShares(data.shares))
      .catch(() => {});
  }, [auth.token, listId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError("");
    try {
      await api.inviteToList(auth.token, listId, trimmed);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(shareId) {
    await api.removeListShare(auth.token, shareId);
    await refresh();
  }

  return (
    <View className="flex-1 bg-white p-4 dark:bg-slate-900">
      <Text className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Share &quot;{listName}&quot;</Text>

      <View className="mb-4 flex-row gap-2">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Invite by email"
          autoCapitalize="none"
          keyboardType="email-address"
          onSubmitEditing={handleInvite}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:text-white"
        />
        <Pressable
          onPress={handleInvite}
          disabled={submitting}
          className="items-center justify-center rounded-md bg-indigo-600 px-4 disabled:opacity-50"
        >
          <Text className="text-sm font-medium text-white">Invite</Text>
        </Pressable>
      </View>

      {error ? <Text className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</Text> : null}

      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">People on this list</Text>
      {shares.length === 0 ? (
        <Text className="text-sm text-slate-500 dark:text-slate-400">No one else yet — invite someone above.</Text>
      ) : (
        <View>
          {shares.map((share) => (
            <MemberRow key={share.id} member={share} canRemove onRemove={handleRemove} />
          ))}
        </View>
      )}
    </View>
  );
}
