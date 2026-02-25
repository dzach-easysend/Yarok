/**
 * Tests for the auth service device registration flow.
 */

import { api, setAuthToken } from "../services/api";
import * as SecureStore from "expo-secure-store";
import {
  ensureDeviceAuth,
  restoreAuth,
  logout,
  login,
  switchToAnonymous,
} from "../services/auth";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
  setAuthToken(null);
});

describe("ensureDeviceAuth", () => {
  it("restores existing device token without hitting network", async () => {
    mockGetItem.mockResolvedValueOnce("existing-device-token");
    const postMock = jest.fn();
    jest.spyOn(api, "post").mockImplementation(postMock as any);

    await ensureDeviceAuth();

    expect(api.defaults.headers.common.Authorization).toBe("Bearer existing-device-token");
    expect(postMock).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("registers a new device when no token is stored", async () => {
    // No device token, no device ID stored
    mockGetItem.mockResolvedValue(null);
    const postMock = jest
      .fn()
      .mockResolvedValue({ data: { access_token: "new-device-token", refresh_token: "r", token_type: "bearer" } });
    jest.spyOn(api, "post").mockImplementation(postMock as any);

    await ensureDeviceAuth();

    expect(postMock).toHaveBeenCalledWith("/api/v1/auth/device", {
      device_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    });
    expect(api.defaults.headers.common.Authorization).toBe("Bearer new-device-token");
    jest.restoreAllMocks();
  });

  it("is non-fatal when the backend is unreachable", async () => {
    mockGetItem.mockResolvedValue(null);
    jest.spyOn(api, "post").mockRejectedValue(new Error("Network error"));

    await expect(ensureDeviceAuth()).resolves.toBeUndefined();
    jest.restoreAllMocks();
  });
});

describe("restoreAuth", () => {
  it("returns isLoggedIn true and displayName when email token is stored and getMe succeeds", async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === "yarok_token") return Promise.resolve("email-token");
      if (key === "yarok_device_token") return Promise.resolve(null);
      return Promise.resolve("device-token");
    });
    jest.spyOn(api, "get").mockResolvedValue({
      data: { id: "u1", email: "a@b.com", display_name: "Dana" },
    } as any);
    jest.spyOn(api, "post").mockRejectedValue(new Error("no device reg")); // ensureDeviceAuth in background won't overwrite header

    const result = await restoreAuth();

    expect(result.isLoggedIn).toBe(true);
    expect(result.displayName).toBe("Dana");
    expect(api.defaults.headers.common.Authorization).toBe("Bearer email-token");
    jest.restoreAllMocks();
  });

  it("falls back to cached display_name when getMe fails", async () => {
    mockGetItem.mockImplementation((key: string) => {
      if (key === "yarok_token") return Promise.resolve("email-token");
      if (key === "yarok_display_name") return Promise.resolve("CachedName");
      return Promise.resolve("device-token");
    });
    jest.spyOn(api, "get").mockRejectedValue(new Error("Network error"));
    jest.spyOn(api, "post").mockResolvedValue({ data: {} } as any);

    const result = await restoreAuth();

    expect(result.isLoggedIn).toBe(true);
    expect(result.displayName).toBe("CachedName");
    jest.restoreAllMocks();
  });

  it("returns isLoggedIn false when no email token", async () => {
    mockGetItem.mockResolvedValueOnce(null);
    mockGetItem.mockResolvedValueOnce("stored-device-token");

    const result = await restoreAuth();

    expect(result.isLoggedIn).toBe(false);
    expect(result.displayName).toBe(null);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer stored-device-token");
  });
});

describe("login", () => {
  it("stores display_name from response", async () => {
    jest.spyOn(api, "post").mockResolvedValue({
      data: {
        access_token: "t",
        refresh_token: "r",
        token_type: "bearer",
        display_name: "Dana",
        user_id: "u1",
      },
    } as any);

    await login("a@b.com", "pass");

    expect(mockSetItem).toHaveBeenCalledWith("yarok_display_name", "Dana");
    expect(api.defaults.headers.common.Authorization).toBe("Bearer t");
    jest.restoreAllMocks();
  });
});

describe("logout", () => {
  it("clears email token and display_name and restores device token", async () => {
    mockGetItem.mockResolvedValue("device-token");

    await logout();

    expect(mockDeleteItem).toHaveBeenCalledTimes(3); // TOKEN_KEY + REFRESH_KEY + DISPLAY_NAME_KEY
    expect(api.defaults.headers.common.Authorization).toBe("Bearer device-token");
  });
});

describe("switchToAnonymous", () => {
  it("clears email auth and restores device token", async () => {
    mockGetItem.mockResolvedValue("device-token");

    await switchToAnonymous();

    expect(mockDeleteItem).toHaveBeenCalledTimes(3);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer device-token");
  });
});
