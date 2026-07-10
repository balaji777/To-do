import { AuthProvider, useAuth } from "./AuthContext";
import AnimatedBackground from "./AnimatedBackground";
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
    return (
      <>
        <AnimatedBackground />
        <VerifyEmailConfirm />
      </>
    );
  }

  return (
    <AuthProvider>
      <AnimatedBackground />
      <AppShell />
    </AuthProvider>
  );
}
