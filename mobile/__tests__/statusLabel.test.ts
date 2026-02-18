import { statusLabel, STATUS_OPTIONS } from "../utils/statusLabel";

describe("statusLabel", () => {
  it("translates open to פתוח", () => {
    expect(statusLabel("open")).toBe("פתוח");
  });

  it("translates in_progress to בטיפול", () => {
    expect(statusLabel("in_progress")).toBe("בטיפול");
  });

  it("translates cleaned to נוקה", () => {
    expect(statusLabel("cleaned")).toBe("נוקה");
  });

  it("translates invalid to לא תקין", () => {
    expect(statusLabel("invalid")).toBe("לא תקין");
  });

  it("returns original string for unknown status", () => {
    expect(statusLabel("unknown_status")).toBe("unknown_status");
  });
});

describe("STATUS_OPTIONS", () => {
  it("has 4 options", () => {
    expect(STATUS_OPTIONS).toHaveLength(4);
  });

  it("includes all valid statuses", () => {
    const values = STATUS_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["open", "in_progress", "cleaned", "invalid"]);
  });
});
