import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

export default function TodoApp() {
  const { auth, logout } = useAuth();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getTodos(auth.token)
      .then(setTodos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const todo = await api.addTodo(auth.token, title);
      setTodos((prev) => [todo, ...prev]);
      setTitle("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDone(todo) {
    const updated = await api.updateTodo(auth.token, todo.id, { done: !todo.done });
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
  }

  async function removeTodo(id) {
    await api.deleteTodo(auth.token, id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">
            {auth.username}&apos;s tasks
          </h1>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700">
            Log out
          </button>
        </div>

        <form onSubmit={handleAdd} className="mb-6 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
          >
            Add
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500">Loading...</p>
        ) : todos.length === 0 ? (
          <p className="text-center text-slate-500">No tasks yet. Add one above.</p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 rounded-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
              >
                <input
                  type="checkbox"
                  checked={!!todo.done}
                  onChange={() => toggleDone(todo)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={`flex-1 ${todo.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {todo.title}
                </span>
                <button
                  onClick={() => removeTodo(todo.id)}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {todos.length > 0 && (
          <p className="mt-4 text-center text-sm text-slate-500">
            {remaining} of {todos.length} remaining
          </p>
        )}
      </div>
    </div>
  );
}
