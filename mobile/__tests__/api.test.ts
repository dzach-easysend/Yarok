import { setAuthToken, api, deleteMedia } from "../services/api";

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

describe("deleteMedia", () => {
  it("calls DELETE /api/v1/reports/{reportId}/media/{mediaId}", async () => {
    const deleteMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(api, "delete").mockImplementation(deleteMock as any);
    await deleteMedia("report-123", "media-456");
    expect(deleteMock).toHaveBeenCalledWith("/api/v1/reports/report-123/media/media-456");
    jest.restoreAllMocks();
  });
});
