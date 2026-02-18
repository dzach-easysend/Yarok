"""E2E tests for the map search box (address/area geocoding)."""

import json
import re

from playwright.sync_api import expect


# Fake Nominatim response (Jerusalem)
NOMINATIM_FAKE_RESPONSE = [
    {
        "lat": "31.7683",
        "lon": "35.2137",
        "display_name": "Jerusalem, Israel",
        "type": "city",
    }
]


class TestMapSearchUI:
    """Search input is present and visible on the map screen."""

    def test_search_input_visible_on_map_screen(self, page):
        """Map screen shows the search box with correct placeholder."""
        expect(page.get_by_test_id("screen-map")).to_be_visible()
        search = page.get_by_test_id("map-search-input")
        expect(search).to_be_visible()
        expect(search).to_have_attribute("placeholder", "חיפוש אזור או כתובת")

    def test_search_input_focusable_and_editable(self, page):
        """User can type in the search input."""
        search = page.get_by_test_id("map-search-input")
        search.fill("תל אביב")
        expect(search).to_have_value("תל אביב")

    def test_clear_button_clears_search_input(self, page):
        """When search has text, clear (×) button is visible and clears the input."""
        search = page.get_by_test_id("map-search-input")
        search.fill("תל אביב")
        expect(search).to_have_value("תל אביב")
        clear_btn = page.get_by_test_id("map-search-clear")
        expect(clear_btn).to_be_visible()
        clear_btn.click()
        expect(search).to_have_value("")
        expect(page.get_by_test_id("map-search-clear")).to_have_count(0)


class TestMapSearchGeocode:
    """Search triggers geocoding and moves the map (Nominatim mocked)."""

    def test_search_enter_shows_success_toast(self, page):
        """Typing a query and pressing Enter triggers geocode; success toast appears."""
        # Mock Nominatim to avoid real network and flakiness
        page.route(
            "**/nominatim.openstreetmap.org/search*",
            lambda route: route.fulfill(
                status=200,
                body=json.dumps(NOMINATIM_FAKE_RESPONSE),
                headers={"Content-Type": "application/json"},
            ),
        )

        search = page.get_by_test_id("map-search-input")
        search.fill("ירושלים")
        search.press("Enter")

        expect(page.get_by_test_id("toast")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("toast")).to_contain_text(
            "המפה הוזזה למיקום המבוקש"
        )

    def test_search_empty_query_does_nothing(self, page):
        """Pressing Enter with empty search does not show a toast."""
        search = page.get_by_test_id("map-search-input")
        search.clear()
        search.press("Enter")
        # Toast should remain hidden (handler returns early for empty query)
        expect(page.get_by_test_id("toast")).to_have_class(re.compile(r"hidden"))

    def test_search_no_results_shows_error_toast(self, page):
        """When Nominatim returns no results, error toast is shown."""
        page.route(
            "**/nominatim.openstreetmap.org/search*",
            lambda route: route.fulfill(
                status=200,
                body=json.dumps([]),
                headers={"Content-Type": "application/json"},
            ),
        )

        search = page.get_by_test_id("map-search-input")
        search.fill("xyznonexistent123")
        search.press("Enter")

        expect(page.get_by_test_id("toast")).to_be_visible(timeout=5000)
        expect(page.get_by_test_id("toast")).to_contain_text("לא נמצא מיקום")


class TestMapSearchPin:
    """Search result pin appears on the map and clears when search box changes."""

    def test_successful_search_adds_pin(self, page):
        """After a successful search, one pin is shown on the map."""
        page.route(
            "**/nominatim.openstreetmap.org/search*",
            lambda route: route.fulfill(
                status=200,
                body=json.dumps(NOMINATIM_FAKE_RESPONSE),
                headers={"Content-Type": "application/json"},
            ),
        )
        search = page.get_by_test_id("map-search-input")
        search.fill("ירושלים")
        search.press("Enter")
        page.get_by_test_id("toast").wait_for(state="visible", timeout=5000)
        count = page.evaluate("window.__yarokTestHooks.getSearchPinCount()")
        assert count == 1, f"Expected 1 search pin, got {count}"

    def test_clearing_search_input_removes_pin(self, page):
        """Clearing the search box removes the search result pin."""
        page.route(
            "**/nominatim.openstreetmap.org/search*",
            lambda route: route.fulfill(
                status=200,
                body=json.dumps(NOMINATIM_FAKE_RESPONSE),
                headers={"Content-Type": "application/json"},
            ),
        )
        search = page.get_by_test_id("map-search-input")
        search.fill("ירושלים")
        search.press("Enter")
        page.get_by_test_id("toast").wait_for(state="visible", timeout=5000)
        assert page.evaluate("window.__yarokTestHooks.getSearchPinCount()") == 1
        search.clear()
        assert page.evaluate("window.__yarokTestHooks.getSearchPinCount()") == 0

    def test_changing_search_input_removes_pin(self, page):
        """Changing the search box content removes the existing pin."""
        page.route(
            "**/nominatim.openstreetmap.org/search*",
            lambda route: route.fulfill(
                status=200,
                body=json.dumps(NOMINATIM_FAKE_RESPONSE),
                headers={"Content-Type": "application/json"},
            ),
        )
        search = page.get_by_test_id("map-search-input")
        search.fill("ירושלים")
        search.press("Enter")
        page.get_by_test_id("toast").wait_for(state="visible", timeout=5000)
        assert page.evaluate("window.__yarokTestHooks.getSearchPinCount()") == 1
        search.fill("תל אביב")
        assert page.evaluate("window.__yarokTestHooks.getSearchPinCount()") == 0
