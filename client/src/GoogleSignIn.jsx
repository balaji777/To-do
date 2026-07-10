import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleSignIn() {
  const { login } = useAuth();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!CLIENT_ID) return;

    async function handleCredential(response) {
      setError("");
      try {
        const { token, username, nickname, id } = await api.googleLogin(response.credential);
        login(token, username, nickname, id);
      } catch (err) {
        setError(err.message);
      }
    }

    let cancelled = false;

    function init() {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 280,
      });
    }

    if (window.google?.accounts?.id) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          init();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [login]);

  return (
    <div className="text-center">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Sign in with Google to track your sprint work</p>

      {CLIENT_ID ? (
        <div ref={buttonRef} className="flex justify-center" />
      ) : (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Google sign-in isn&apos;t configured yet. Set VITE_GOOGLE_CLIENT_ID in client/.env.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
