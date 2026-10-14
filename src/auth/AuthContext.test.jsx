import { act, renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

describe("auth flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("registers a user and logs them in with email and password", async () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register({
        name: "Alice",
        email: "alice@example.com",
        password: "secret123",
        phone: "0722333444",
      });
    });

    expect(result.current.user).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
    });

    await act(async () => {
      result.current.logout();
    });

    await act(async () => {
      await result.current.login("alice@example.com", "secret123");
    });

    expect(result.current.user).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
    });
  });
});
