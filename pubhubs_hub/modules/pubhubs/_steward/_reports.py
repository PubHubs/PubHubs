"""Steward reports endpoint for viewing and managing event reports.

This module allows stewards (power level 50+) to view and delete reports
for rooms they moderate, similar to the Synapse admin API but scoped to
their rooms.
"""

import logging
from typing import Any

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_integer, parse_string
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ..HubClientApiConfig import HubClientApiConfig
from .._constants import STEWARD, USER
from .._cors import set_allow_origin_header
from .._errors import BadRequestError, ForbiddenError
from .._store import HubStore
from .._validation import user_validator, get_room_id_from_request, assert_has_power_level

logger = logging.getLogger("synapse.contrib." + __name__)


class StewardReportsServlet(DirectServeJsonResource):
    """Servlet for stewards to view event reports for their rooms.

    Endpoints:
        GET /_synapse/client/steward/reports
            List all reports for rooms where user is steward

        GET /_synapse/client/steward/reports?room_id=...
            List all reports for a specific room (requires STEWARD power level)

        GET /_synapse/client/steward/reports/<report_id>?room_id=...
            Get a specific report (requires STEWARD power level in that room)
    """

    isLeaf = False

    def __init__(
        self,
        module_api: ModuleApi,
        config: HubClientApiConfig,
        store: HubStore,
    ):
        super().__init__()
        self._module_api = module_api
        self._config = config
        self._store = store

    def getChild(self, name: bytes, request: SynapseRequest) -> "DirectServeJsonResource":
        """Handle child paths for report_id."""
        if name:
            return StewardReportDetailServlet(
                self._module_api,
                self._config,
                self._store,
                name.decode("utf-8"),
            )
        return self

    @user_validator(USER)
    async def _async_render_GET(self, request: SynapseRequest, user_id: str) -> None:
        """List all event reports for steward's rooms.

        Query parameters:
            room_id (optional): Specific room to get reports for. If not provided,
                               returns reports for all rooms where user is steward.
            from (optional): Pagination offset (default: 0)
            limit (optional): Max results to return (default: 100)
            dir (optional): Direction 'b' for newest first, 'f' for oldest (default: 'b')
        """
        set_allow_origin_header(request, self._config.allowed_origins)

        room_id = get_room_id_from_request(request)

        # Parse pagination parameters
        start = parse_integer(request, "from", default=0)
        limit = parse_integer(request, "limit", default=100)
        direction = parse_string(request, "dir", default="b")

        if start < 0:
            raise BadRequestError("The 'from' parameter must be a positive integer")
        if limit < 0:
            raise BadRequestError("The 'limit' parameter must be a positive integer")

        if room_id:
            # Get reports for a specific room - verify steward permission
            await assert_has_power_level(request, user_id, self._module_api, STEWARD, room_id)
            reports, total = await self._store.get_event_reports_for_room(
                room_id=room_id,
                start=start,
                limit=limit,
                backwards=(direction == "b"),
            )
        else:
            # Get reports for all rooms where user is a steward
            room_ids = await self._store.get_rooms_with_power_level(user_id, STEWARD)
            if not room_ids:
                raise ForbiddenError("You are not a steward in any room")
            reports, total = await self._store.get_event_reports_for_rooms(
                room_ids=room_ids,
                start=start,
                limit=limit,
                backwards=(direction == "b"),
            )

        response: dict[str, Any] = {
            "event_reports": reports,
            "total": total,
        }

        if (start + limit) < total:
            response["next_token"] = start + len(reports)

        respond_with_json(request, 200, response, send_cors=True)


class StewardReportDetailServlet(DirectServeJsonResource):
    """Servlet for viewing/deleting a specific report."""

    isLeaf = True

    def __init__(
        self,
        module_api: ModuleApi,
        config: HubClientApiConfig,
        store: HubStore,
        report_id: str,
    ):
        super().__init__()
        self._module_api = module_api
        self._config = config
        self._store = store
        self._report_id = report_id

    @user_validator(STEWARD)
    async def _async_render_GET(self, request: SynapseRequest, user_id: str) -> None:
        """Get a specific event report by ID."""
        set_allow_origin_header(request, self._config.allowed_origins)

        room_id = get_room_id_from_request(request)
        if not room_id:
            raise BadRequestError("room_id query parameter is required")

        # Parse and validate report_id
        try:
            report_id = int(self._report_id)
        except ValueError:
            raise BadRequestError("report_id must be a positive integer")

        if report_id < 0:
            raise BadRequestError("report_id must be a positive integer")

        # Get the report
        report = await self._store.get_event_report(report_id)

        if not report:
            respond_with_json(
                request, 404, {"error": "Event report not found"}, send_cors=True
            )
            return

        # Verify the report belongs to the requested room
        if report.get("room_id") != room_id:
            respond_with_json(
                request,
                403,
                {"error": "Report does not belong to the specified room"},
                send_cors=True,
            )
            return

        respond_with_json(request, 200, report, send_cors=True)
