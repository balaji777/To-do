import { render, screen } from "@testing-library/react";
import { AuthProvider } from "../AuthContext";

describe("GoogleSignIn", () => {
  it("renders the sign-in subtext and the Google button container when configured", async () => {
    const { default: GoogleSignIn } = await import("../GoogleSignIn");
    render(
      <AuthProvider>
        <GoogleSignIn />
      </AuthProvider>
    );

    expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
  });

  it("shows a configuration warning when VITE_GOOGLE_CLIENT_ID is unset", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.resetModules();
    // Re-import AuthContext too, so the provider and consumer share the same
    // (freshly reset) module instance and context identity.
    const { default: GoogleSignIn } = await import("../GoogleSignIn");
    const { AuthProvider: FreshAuthProvider } = await import("../AuthContext");

    render(
      <FreshAuthProvider>
        <GoogleSignIn />
      </FreshAuthProvider>
    );

    expect(screen.getByText(/Google sign-in isn't configured yet/i)).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
