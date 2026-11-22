"""Shared validation for WGS84 coordinates (profile address and order delivery snapshot)."""

from typing import Annotated

from pydantic import Field

Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]


def ensure_both_or_neither(lat: float | None, lng: float | None) -> None:
    """Raise ValueError when only one of the pair is present."""
    if (lat is None) != (lng is None):
        raise ValueError("lat and lng must be provided together.")
