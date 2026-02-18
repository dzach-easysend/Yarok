import { setAuthToken, api } from "../services/api";

describe("setAuthToken", () => {
  it("sets the Authorization header when given a token", () => {
    setAuthToken("test-token-123");
    expect(api.defaults.headers.common.Authorization).toBe("Bearer test-token-123");
  });

  it("removes the Authorization header when given null", () => {
    setAuthToken("test-token-123");
    setAuthToken(null);
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });
});
