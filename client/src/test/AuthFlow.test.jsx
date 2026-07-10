import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "../AuthScreen";
import VerifyEmailConfirm from "../VerifyEmailConfirm";
import { AuthProvider } from "../AuthContext";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    signup: vi.fn(),
    login: vi.fn(),
    resendVerification: vi.fn(),
    verifyEmail: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

function renderAuthScreen() {
  return render(
    <AuthProvider>
      <AuthScreen />
    </AuthProvider>
  );
}

describe("AuthScreen", () => {
  it("defaults to the login form and toggles to signup", async () => {
    const user = userEvent.setup();
    renderAuthScreen();

    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Username")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
  });

  it("logs in successfully and stores auth", async () => {
    const user = userEvent.setup();
    api.login.mockResolvedValue({ token: "tok123", username: "dev1", nickname: "", id: 5 });
    renderAuthScreen();

    await user.type(screen.getByPlaceholderText("Email"), "dev1@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    await waitFor(() => expect(localStorage.getItem("token")).toBe("tok123"));
    expect(api.login).toHaveBeenCalledWith("dev1@example.com", "supersecret");
  });

  it("shows the check-email screen when login reports an unverified account", async () => {
    const user = userEvent.setup();
    const err = new Error("Please verify your email before logging in");
    err.code = "EMAIL_NOT_VERIFIED";
    api.login.mockRejectedValue(err);
    renderAuthScreen();

    await user.type(screen.getByPlaceholderText("Email"), "unverified@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText(/unverified@example.com/)).toBeInTheDocument();
  });

  it("shows a generic error message for a plain login failure", async () => {
    const user = userEvent.setup();
    api.login.mockRejectedValue(new Error("Invalid email or password"));
    renderAuthScreen();

    await user.type(screen.getByPlaceholderText("Email"), "dev1@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("signs up and shows the check-email screen", async () => {
    const user = userEvent.setup();
    api.signup.mockResolvedValue({ message: "Account created." });
    renderAuthScreen();

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    await user.type(screen.getByPlaceholderText("Username"), "dev1");
    await user.type(screen.getByPlaceholderText("Email"), "dev1@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(api.signup).toHaveBeenCalledWith("dev1", "dev1@example.com", "supersecret");
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("resends a verification email from the check-email screen", async () => {
    const user = userEvent.setup();
    api.signup.mockResolvedValue({ message: "Account created." });
    api.resendVerification.mockResolvedValue({ message: "sent" });
    renderAuthScreen();

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    await user.type(screen.getByPlaceholderText("Username"), "dev1");
    await user.type(screen.getByPlaceholderText("Email"), "dev1@example.com");
    await user.type(screen.getByPlaceholderText(/password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await screen.findByText(/check your email/i);
    await user.click(screen.getByRole("button", { name: /resend email/i }));

    expect(api.resendVerification).toHaveBeenCalledWith("dev1@example.com");
    expect(await screen.findByText(/email sent/i)).toBeInTheDocument();
  });
});

describe("VerifyEmailConfirm", () => {
  function withSearch(search, render_) {
    const original = window.location;
    delete window.location;
    window.location = { ...original, search };
    render_();
    window.location = original;
  }

  it("verifies the token from the URL and shows success", async () => {
    api.verifyEmail.mockResolvedValue({ verified: true });
    withSearch("?token=abc123", () => render(<VerifyEmailConfirm />));

    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
    expect(api.verifyEmail).toHaveBeenCalledWith("abc123");
  });

  it("shows an error message when verification fails", async () => {
    api.verifyEmail.mockRejectedValue(new Error("Invalid or expired verification link"));
    withSearch("?token=bad", () => render(<VerifyEmailConfirm />));

    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByText("Invalid or expired verification link")).toBeInTheDocument();
  });

  it("shows an error when no token is present in the URL", async () => {
    withSearch("", () => render(<VerifyEmailConfirm />));
    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
  });
});
