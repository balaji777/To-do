import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const ListsContext = createContext(null);

export function ListsProvider({ children }) {
  const { auth } = useAuth();
  const token = auth?.token;

  const [lists, setLists] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [invitesReceived, setInvitesReceived] = useState([]);
  const [activeView, setActiveView] = useState({ type: "my-day" });
  const [taskMembers, setTaskMembers] = useState([]);

  const refreshLists = useCallback(() => {
    if (!token) return Promise.resolve();
    return api.getLists(token).then(setLists).catch(() => {});
  }, [token]);

  const refreshGroups = useCallback(() => {
    if (!token) return Promise.resolve();
    return api.getListGroups(token).then(setGroups).catch(() => {});
  }, [token]);

  const refreshListShares = useCallback(() => {
    if (!token) return Promise.resolve();
    return api
      .getMyListShares(token)
      .then((data) => {
        setSharedWithMe(data.sharedWithMe);
        setInvitesReceived(data.invitesReceived);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshLists();
    refreshGroups();
    refreshListShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || activeView.type !== "list") return;
    api
      .getListShares(token, activeView.listId)
      .then((data) => setTaskMembers([data.owner, ...data.shares.filter((s) => s.status === "accepted")]))
      .catch(() => setTaskMembers([]));
  }, [token, activeView]);

  // Not persisted in state directly (that would need a synchronous setState-in-effect
  // reset on logout, which the React Compiler's lint rule flags) - masked here instead
  // so a logged-out render never exposes a previous session's leftover data.
  const exposedLists = token ? lists : [];
  const exposedGroups = token ? groups : [];
  const exposedSharedWithMe = token ? sharedWithMe : [];
  const exposedInvitesReceived = token ? invitesReceived : [];
  const exposedActiveView = token ? activeView : { type: "my-day" };
  const exposedTaskMembers = token && activeView.type === "list" ? taskMembers : [];

  const createList = useCallback(
    async (name, groupId) => {
      const list = await api.addList(token, name, groupId);
      setLists((prev) => [...prev, list]);
      setActiveView({ type: "list", listId: list.id });
      return list;
    },
    [token]
  );

  const updateList = useCallback(
    async (id, changes) => {
      const updated = await api.updateList(token, id, changes);
      setLists((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated;
    },
    [token]
  );

  const deleteList = useCallback(
    async (id) => {
      await api.deleteList(token, id);
      setLists((prev) => prev.filter((l) => l.id !== id));
      setActiveView((prev) => (prev.type === "list" && prev.listId === id ? { type: "my-day" } : prev));
    },
    [token]
  );

  const createGroup = useCallback(
    async (name) => {
      const group = await api.addListGroup(token, name);
      setGroups((prev) => [...prev, group]);
      return group;
    },
    [token]
  );

  const updateGroup = useCallback(
    async (id, changes) => {
      const updated = await api.updateListGroup(token, id, changes);
      setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
      return updated;
    },
    [token]
  );

  const deleteGroup = useCallback(
    async (id) => {
      await api.deleteListGroup(token, id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setLists((prev) => prev.map((l) => (l.group_id === id ? { ...l, group_id: null } : l)));
    },
    [token]
  );

  const acceptListShareInvite = useCallback(
    async (id) => {
      await api.acceptListShare(token, id);
      await refreshListShares();
    },
    [token, refreshListShares]
  );

  const declineListShareInvite = useCallback(
    async (id) => {
      await api.declineListShare(token, id);
      await refreshListShares();
    },
    [token, refreshListShares]
  );

  const leaveSharedList = useCallback(
    async (shareId, listId) => {
      await api.removeListShare(token, shareId);
      setActiveView((prev) => (prev.type === "list" && prev.listId === listId ? { type: "my-day" } : prev));
      await refreshListShares();
    },
    [token, refreshListShares]
  );

  const value = {
    lists: exposedLists,
    groups: exposedGroups,
    sharedWithMe: exposedSharedWithMe,
    invitesReceived: exposedInvitesReceived,
    activeView: exposedActiveView,
    setActiveView,
    taskMembers: exposedTaskMembers,
    refreshLists,
    refreshGroups,
    refreshListShares,
    createList,
    updateList,
    deleteList,
    createGroup,
    updateGroup,
    deleteGroup,
    acceptListShareInvite,
    declineListShareInvite,
    leaveSharedList,
  };

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists() {
  return useContext(ListsContext);
}
