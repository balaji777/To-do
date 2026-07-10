import { AuthProvider, useAuth } from "./AuthContext";
import GoogleSignIn from "./GoogleSignIn";
import NicknameModal from "./NicknameModal";
import TodoApp from "./TodoApp";

function AppShell() {
  const { auth } = useAuth();
  if (!auth) return <GoogleSignIn />;
  if (!auth.nickname) return <NicknameModal />;
  return <TodoApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
