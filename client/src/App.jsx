import { AuthProvider, useAuth } from "./AuthContext";
import LoginForm from "./LoginForm";
import TodoApp from "./TodoApp";

function AppShell() {
  const { auth } = useAuth();
  return auth ? <TodoApp /> : <LoginForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
