"""In-process sliding-window rate limits (no external store).

Each gunicorn worker keeps its own counters, so with `-w 2` the effective ceiling is up to
twice the configured limit. That is enough to stop brute force and spam on a single-instance
deploy; a multi-instance deploy would need a shared store (Redis / Render Key Value).
"""

import math
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.core.rbac import CurrentUser, get_current_user


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> int:
        """Record one hit. Returns 0 when allowed, else the seconds to wait before retrying."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, math.ceil(window_seconds - (now - hits[0])))
            hits.append(now)
            return 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    """Best-effort client IP behind Render's proxy.

    Render always fronts services with Cloudflare, which sets True-Client-IP from its own
    edge (a client cannot forge it through Cloudflare). Render only appends to
    X-Forwarded-For, so earlier hops there are client-controlled: use the last one.
    """
    for header in ("true-client-ip", "cf-connecting-ip"):
        value = request.headers.get(header, "").strip()
        if value:
            return value
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",")]
    forwarded = [part for part in forwarded if part]
    if forwarded:
        return forwarded[-1]
    return request.client.host if request.client else "unknown"


def _enforce(key: str, limit: int, window_seconds: int) -> None:
    retry_after = limiter.hit(key, limit, window_seconds)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate_limited",
            headers={"Retry-After": str(retry_after)},
        )


def limit_by_ip(scope: str, limit: int, window_seconds: int) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        _enforce(f"{scope}:ip:{client_ip(request)}", limit, window_seconds)

    return dependency


def limit_by_user(scope: str, limit: int, window_seconds: int) -> Callable[..., None]:
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> None:
        _enforce(f"{scope}:user:{current_user.user_id}", limit, window_seconds)

    return dependency
