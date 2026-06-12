from datetime import datetime, timezone


def relative_time(dt: datetime) -> str:
    """Return a human-readable relative time string, e.g. '2h', '3d', '1w'."""
    now = datetime.now(timezone.utc)
    # make sure dt is tz-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 60:
        return "just now"
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    if seconds < 604800:
        return f"{seconds // 86400}d"
    return f"{seconds // 604800}w"
