"""Small in-process sliding-window rate limiter.

Suitable for a single-process development/small deployment. In a multi-worker
deployment this should be backed by Redis; the interface is intentionally
narrow so the implementation can be swapped.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.errors import AppError


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: float):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_calls:
                raise AppError(
                    429,
                    "rate_limited",
                    "Too many requests. Please slow down and try again shortly.",
                )
            bucket.append(now)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def make_limiter(max_calls: int, window_seconds: float):
    limiter = RateLimiter(max_calls, window_seconds)

    def dependency(request: Request) -> None:
        from app.config import settings

        if settings.env.lower() == "test":
            return
        limiter.check(f"{request.url.path}:{client_ip(request)}")

    return dependency


# Public form submission and expensive exports are the sensitive endpoints.
public_submit_limiter = make_limiter(20, 60)
export_limiter = make_limiter(10, 60)
auth_limiter = make_limiter(20, 60)
