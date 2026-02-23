# Critique: Report Card View Plan

**Plan Reviewed:** `yarok-02-report-card-view.md`
**Reviewer Role:** Senior Full Stack Engineer

## 1. Requirements Alignment
- **Add/Delete Media**: ❌ **Critical Gap.** The PDF explicitly asks for "Ability to **add**/delete media." The plan only addresses *delete*.
- **Static Map**: ⚠️ **Integration Mismatch.** The PDF asks for a "leading static map snippet to the **media carousel**" (like Strava), implying a horizontal swipe. The plan describes increasing the height of the existing map block *below* the description.
- **RTL**: ✅ Correctly identifies `textAlign: "right"`.
- **Remove Address/Media Count**: ✅ Correctly identified.
- **Report Date**: ✅ Correctly identified.
- **Invalid Reports**: ✅ Correctly identified.
- **View Count**: ✅ Correctly identified.

## 2. Technical Concerns & Risks

### 📈 Scalability: "View Count" Implementation
The plan proposes incrementing `view_count` directly on the `reports` table for every `GET /reports/{id}` read.
**Critique:**
- In SQL databases, a write locks the row. If a report becomes popular (e.g., shared in a group), simultaneous reads will cause **lock contention**, slowing down read performance significantly.
- It turns a cheap "read" operation into a more expensive "write" operation.
- **Recommendation:** Acceptable for MVP/low traffic. If scaling, move to a separate `report_views` table (log inserts, aggregate later) or buffer updates in memory/Redis.

### 🖼️ UX: Deleting the Last Image
The plan allows deleting individual media items.
**Critique:**
- The UI (`ReportCard`) heavily relies on a map thumbnail or an image. If a user deletes the *last* image, does the layout break?
- **Recommendation:**
    1.  **Backend:** Prevent deleting the last image (return 400 "Cannot delete last image").
    2.  **OR Frontend:** Ensure the `ReportCard` and `ReportDetail` have a robust fallback UI for "No Images" (e.g., a placeholder icon or just the map).

## 3. Revised Recommendations
1.  **Add "Add Media" Feature:** The plan must include adding new photos/videos (reuse logic from `create.tsx`).
2.  **Move Map to Carousel:** Integrate the static map as the *first item* in the horizontal `FlatList` media carousel.
3.  **Handle "Zero Images" State:** Ensure layout robustness when deleting media.
4.  **Implement Optimistic Updates:** For status changes, update the local cache immediately for a snappier feel.
