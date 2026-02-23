/**
 * Tests for My Reports list screen: Hebrew labels and RTL alignment.
 * Report card content uses REPORT_CARD_*_LABEL constants; styles use textAlign: "right".
 */
import {
  REPORT_CARD_DATE_LABEL,
  REPORT_CARD_DESC_LABEL,
} from "../constants/reportCardLabels";

describe("My Reports screen — report card labels", () => {
  it("uses Hebrew label for date field", () => {
    expect(REPORT_CARD_DATE_LABEL).toBe("תאריך דיווח: ");
  });

  it("uses Hebrew label for description field", () => {
    expect(REPORT_CARD_DESC_LABEL).toBe("תיאור: ");
  });
});
