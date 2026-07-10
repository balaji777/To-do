import { AuthProvider, useAuth } from "./AuthContext";
import AuthScreen from "./AuthScreen";
import NicknameModal from "./NicknameModal";
import TodoApp from "./TodoApp";
import VerifyEmailConfirm from "./VerifyEmailConfirm";

function AppShell() {
  const { auth } = useAuth();
  if (!auth) return <AuthScreen />;
  if (!auth.nickname) return <NicknameModal />;
  return <TodoApp />;
}

export default function App() {
  if (window.location.pathname === "/verify-email") {
    return <VerifyEmailConfirm />;
  }

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
