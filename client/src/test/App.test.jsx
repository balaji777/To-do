import { render, screen } from "@testing-library/react";
import App from "../App";

vi.mock("../AuthScreen", () => ({ default: () => <div>AuthScreenMock</div> }));
vi.mock("../NicknameModal", () => ({ default: () => <div>NicknameModalMock</div> }));
vi.mock("../TodoApp", () => ({ default: () => <div>TodoAppMock</div> }));
vi.mock("../VerifyEmailConfirm", () => ({ default: () => <div>VerifyEmailConfirmMock</div> }));

describe("App auth gate", () => {
  it("renders AuthScreen when not authenticated", () => {
    render(<App />);
    expect(screen.getByText("AuthScreenMock")).toBeInTheDocument();
  });

  it("renders NicknameModal when authenticated but no nickname is set", () => {
    localStorage.setItem("token", "tok");
    localStorage.setItem("username", "alice");
    render(<App />);
    expect(screen.getByText("NicknameModalMock")).toBeInTheDocument();
  });

  it("renders TodoApp once authenticated with a nickname", () => {
    localStorage.setItem("token", "tok");
    localStorage.setItem("username", "alice");
    localStorage.setItem("nickname", "Al");
    render(<App />);
    expect(screen.getByText("TodoAppMock")).toBeInTheDocument();
  });

  it("renders the verify-email confirmation page at /verify-email, bypassing auth", () => {
    const original = window.location;
    delete window.location;
    window.location = { ...original, pathname: "/verify-email" };

    render(<App />);
    expect(screen.getByText("VerifyEmailConfirmMock")).toBeInTheDocument();

    window.location = original;
  });
});
