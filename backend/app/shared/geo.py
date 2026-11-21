"""Geolocation and coverage polygon service (Google Maps API adapter for MVP)."""


def calculate_delivery_fee(base_fee: float, distance_km: float) -> float:
    """Calculate estimated delivery cost from zone base tariff and distance (RF-15)."""
    return round(base_fee, 2)
