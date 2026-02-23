# Critique: My vs All Reports Plan

**Plan Reviewed:** `yarok-04-my-vs-all-reports.md`
**Reviewer Role:** Senior Full Stack Engineer

## 1. Requirements Alignment
- **Toggle Visibility**: ✅ Correctly restricts toggle to "signed in users only" (per PDF slide 12).
- **Edit Permission**: ✅ Correctly restricts editing to "own reports only".
- **Author Display**: ✅ Correctly identifies "Who reported each ticket".
- **Anon Users**: ✅ Correctly handles anonymous users seeing "All Reports".

## 2. Technical Concerns & Risks

### 🔒 Security: Edit Permissions
The plan proposes:
> "PATCH /reports/{id} with status change only → allowed for everyone"
> "Any future field edits (description, contact_info) → owner only"

**Critique:**
- This is a good pragmatic approach, but the implementation detail matters.
- **Risk:** If the API schema for `ReportUpdate` changes in the future to include `description`, the endpoint logic *must* be updated simultaneously to enforce ownership checks on those specific fields.
- **Recommendation:** The backend logic should be explicit:
  ```python
  if update_data.description is not None:
      if not is_owner(report, user):
          raise HTTPException(403, "Only owner can edit description")
  ```
- Do not rely solely on Pydantic schemas to enforce business logic permissions.

### 👤 User Identification
The plan proposes adding `display_name` to `User`.
**Critique:**
- Good, but consider privacy.
- **Recommendation:** Ensure `display_name` is optional or defaulted to something generic (e.g. "Green Trekker") if not provided, to avoid exposing emails or IDs inadvertently.
- For anonymous users (device_id based), the plan correctly suggests showing "אנונימי".

## 3. Revised Recommendations
1.  **Explicit Field-Level Permissions:** In the backend `PATCH` handler, explicitly check which fields are being modified. If sensitive fields (description, contact) are present, enforce ownership. If only `status` is present, allow it.
2.  **Graceful Degrade for Anon:** Ensure the frontend handles `author_display: null` gracefully (e.g. "Anonymous Reporter").
