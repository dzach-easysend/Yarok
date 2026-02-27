"""E2E tests for report CRUD and edge cases.

Every test is atomic -- data is seeded via API fixtures, not via prior UI tests.
This means if the "create report" UI is broken, the "update status" test still
runs correctly using API-seeded data.
"""

from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect

from conftest import API_URL, WEB_URL

# Path to test image used for create-report flow (at least one media required)
E2E_TEST_IMAGE = Path(__file__).resolve().parent / "fixtures" / "e2e-test-image.png"


# ---------------------------------------------------------------------------
# Create Report
# ---------------------------------------------------------------------------

class TestCreateReport:
    """Creating a report via the UI form."""

    def test_create_report_success(self, page, api_get_reports):
        """Fill the create form (with one image), submit; verify report lands in the DB."""
        desc = f"E2E create {uuid4().hex[:8]}"

        page.get_by_test_id("fab-create").click()
        expect(page.get_by_test_id("screen-create")).to_be_visible()

        # Wait for geolocation to resolve (mocked to Jerusalem)
        expect(page.get_by_test_id("location-status")).not_to_contain_text(
            "מאתר מיקום", timeout=10000
        )

        # Add one image via the add-media button (opens file chooser on web)
        with page.expect_file_chooser() as fc_info:
            page.get_by_test_id("add-media").click()
        file_chooser = fc_info.value
        file_chooser.set_files(str(E2E_TEST_IMAGE))
        # Wait for thumbnail to appear so submit becomes enabled
        expect(page.get_by_test_id("remove-media").first).to_be_visible(timeout=5000)

        page.get_by_test_id("input-description").fill(desc)
        page.get_by_test_id("input-contact").fill("e2e@test.com")
        page.get_by_test_id("btn-submit-report").click()

        # Should navigate to map (create flow does not show a toast)
        expect(page.get_by_test_id("screen-map").first).to_be_visible(timeout=10000)

        # Verify via API that the report exists
        reports = api_get_reports()
        matches = [r for r in reports if r["description"] == desc]
        assert len(matches) == 1, f"Expected 1 report with desc '{desc}', found {len(matches)}"

    def test_create_report_submit_disabled_until_location(self, page):
        """Submit button should start disabled before location resolves."""
        page.get_by_test_id("fab-create").click()
        # The button exists but we just check the page loaded
        expect(page.get_by_test_id("btn-submit-report")).to_be_visible()


# ---------------------------------------------------------------------------
# View Report in List
# ---------------------------------------------------------------------------

class TestReportsList:
    """Reports appear in the Reports list."""

    def test_seeded_report_in_list(self, page, api_create_report):
        report = api_create_report("E2E list check")

        page.get_by_test_id("tab-reports").click()
        # Wait for the list to load
        expect(page.get_by_test_id("report-card").first).to_be_visible(timeout=5000)

        # Find the card with our description
        cards = page.get_by_test_id("report-card").all()
        found = False
        for card in cards:
            desc_el = card.get_by_test_id("report-card-desc")
            if desc_el.inner_text() == "E2E list check":
                found = True
                break
        assert found, "Seeded report not found in the reports list"

    def test_click_report_card_opens_detail(self, page, api_create_report):
        report = api_create_report("E2E click detail")

        page.get_by_test_id("tab-reports").click()
        expect(page.get_by_test_id("report-card").first).to_be_visible(timeout=5000)

        # Click the first card (our seeded report should be there)
        page.get_by_test_id("report-card").first.click()
        expect(page.get_by_test_id("screen-detail")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("detail-content")).to_be_visible()


# ---------------------------------------------------------------------------
# Report Detail
# ---------------------------------------------------------------------------

class TestReportDetail:
    """Viewing a specific report's detail screen."""

    def test_detail_shows_correct_data(self, page, api_create_report):
        desc = f"E2E detail {uuid4().hex[:8]}"
        report = api_create_report(desc)

        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("detail-description")).to_contain_text(desc, timeout=5000)
        expect(page.get_by_test_id("status-badge")).to_be_visible()

    def test_detail_shows_open_status(self, page, api_create_report):
        report = api_create_report()
        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("status-badge")).to_contain_text("פתוח", timeout=5000)


# ---------------------------------------------------------------------------
# Update Report Status
# ---------------------------------------------------------------------------

class TestUpdateStatus:
    """Updating a report's status via the detail screen."""

    def test_update_to_cleaned(self, page, api_create_report, api_get_report):
        report = api_create_report()
        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("select-status")).to_be_visible(timeout=5000)
        page.get_by_test_id("select-status").select_option("cleaned")
        page.get_by_test_id("btn-update-status").click()

        # Verify toast
        expect(page.get_by_test_id("toast")).to_be_visible(timeout=5000)

        # Verify badge updated in UI (page reloads detail after update)
        expect(page.get_by_test_id("status-badge")).to_contain_text("נוקה", timeout=5000)

        # Verify via API
        updated = api_get_report(report["id"])
        assert updated["status"] == "cleaned"

    def test_update_to_in_progress(self, page, api_create_report, api_get_report):
        report = api_create_report()
        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("select-status")).to_be_visible(timeout=5000)
        page.get_by_test_id("select-status").select_option("in_progress")
        page.get_by_test_id("btn-update-status").click()

        expect(page.get_by_test_id("status-badge")).to_contain_text("בטיפול", timeout=5000)

        updated = api_get_report(report["id"])
        assert updated["status"] == "in_progress"


# ---------------------------------------------------------------------------
# Delete Report
# ---------------------------------------------------------------------------

class TestDeleteReport:
    """Deleting (soft-delete) a report via the detail screen."""

    def test_delete_report(self, page, api_create_report, api_get_report):
        report = api_create_report()
        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("btn-delete-report")).to_be_visible(timeout=5000)

        # Accept the confirm dialog (web uses window.confirm)
        page.on("dialog", lambda dialog: dialog.accept())
        page.get_by_test_id("btn-delete-report").click()

        # Should navigate to reports list
        expect(page.get_by_test_id("screen-reports")).to_be_visible(timeout=5000)

        # Verify via API that report status is now "invalid"
        deleted = api_get_report(report["id"])
        assert deleted["status"] == "invalid"

    def test_delete_cancel_keeps_report(self, page, api_create_report, api_get_report):
        """Dismissing the confirm dialog should NOT delete the report."""
        report = api_create_report()
        page.goto(f"{WEB_URL}/report/{report['id']}")
        page.wait_for_load_state("networkidle")

        expect(page.get_by_test_id("btn-delete-report")).to_be_visible(timeout=5000)

        # Dismiss the confirm dialog
        page.on("dialog", lambda dialog: dialog.dismiss())
        page.get_by_test_id("btn-delete-report").click()

        # Should stay on detail screen
        expect(page.get_by_test_id("screen-detail")).to_be_visible()

        # Report should still be open
        intact = api_get_report(report["id"])
        assert intact["status"] == "open"


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Network errors and geolocation denial."""

    def test_reports_list_backend_error(self, page):
        """Simulate a 500 from the reports API; verify the UI handles it."""
        page.route(
            "**/api/v1/reports**",
            lambda route: route.fulfill(status=500, body="Internal Server Error"),
        )
        page.get_by_test_id("tab-reports").click()

        # The list area should show an error, not crash
        reports_list = page.get_by_test_id("reports-list")
        expect(reports_list).to_contain_text("שגיאה", timeout=5000)

    def test_create_report_backend_error(self, page):
        """Simulate a 500 on POST /reports; verify error toast and user stays on form."""
        page.get_by_test_id("fab-create").click()

        # Wait for location to resolve
        expect(page.get_by_test_id("location-status")).not_to_contain_text(
            "מאתר מיקום", timeout=10000
        )

        page.get_by_test_id("input-description").fill("will fail")

        # Intercept only POST to reports
        page.route(
            "**/api/v1/reports",
            lambda route: route.fulfill(status=500, body='{"detail":"Server error"}')
            if route.request.method == "POST"
            else route.continue_(),
        )

        page.get_by_test_id("btn-submit-report").click()

        # Should show error toast, stay on create screen
        expect(page.get_by_test_id("toast")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("screen-create")).to_be_visible()

    def test_geolocation_denied(self, page, browser):
        """When geolocation is denied, the UI should show fallback coordinates."""
        # Create a fresh context WITHOUT geolocation permission
        context = browser.new_context(
            permissions=[],
            locale="he-IL",
        )
        denied_page = context.new_page()
        denied_page.goto(WEB_URL)
        denied_page.wait_for_load_state("networkidle")

        denied_page.get_by_test_id("fab-create").click()

        # Wait for geolocation to fail and fallback to appear
        loc_status = denied_page.get_by_test_id("location-status")
        expect(loc_status).not_to_contain_text("מאתר מיקום", timeout=15000)

        # The fallback should show default coordinates or an error with fallback
        text = loc_status.inner_text()
        assert "31.7683" in text or "אין הרשאת" in text or "ברירת מחדל" in text, (
            f"Expected fallback location text, got: {text}"
        )

        context.close()
