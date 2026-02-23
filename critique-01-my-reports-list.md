# Critique: My Reports List Plan

**Plan Reviewed:** `yarok-01-my-reports-list.md`
**Reviewer Role:** Senior Full Stack Engineer

## 1. Requirements Alignment
- **RTL Alignment**: ✅ Correctly identifies `textAlign: "right"` requirement.
- **Captions**: ✅ Correctly adds "תאריך דיווח:" and "תיאור:" prefixes.
- **Thumbnail**: ✅ Correctly increases size to 180px.
- **Shadow**: ✅ Correctly adds card shadow.
- **Sorting**: ⚠️ Partially aligned. The plan proposes client-side sorting.

## 2. Technical Concerns & Risks

### 🚨 Client-Side vs. Server-Side Sorting
The plan suggests sorting by date *after* fetching the data:
> "Sort reports client-side by `created_at` descending... (the backend does not guarantee order in the geo-query)."

**Critique:** This is a scalability trap.
- The backend `get_reports` likely performs a spatial query (e.g., "find points within 500km").
- If the backend applies a `LIMIT` (default paging), it usually returns the *closest* results or arbitrary DB order.
- Sorting client-side means you display the "newest of the closest" rather than the actual "newest reports in the region."
- **Recommendation:** You MUST implement `order_by="created_at"` in the backend SQL query to ensure the client receives the true latest reports.

### 📍 Map Thumbnail Performance
- Embedding a `MapView` (even non-interactive) inside a `FlatList` item can be heavy on memory, especially on Android.
- **Recommendation:** Ensure `liteMode` is enabled on the native MapView if available, or consider generating static image URLs (e.g. Mapbox Static API) if list scrolling performance degrades.

## 3. Revised Recommendations
1.  **Move Sorting to Backend:** Update `GET /reports` to support `order_by=created_at_desc`.
2.  **Verify Pagination:** Ensure the sorting works correctly with any existing or future pagination logic.
