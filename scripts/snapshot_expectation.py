"""Independent timestamp expectations for browser publication receipts."""

from datetime import datetime, timezone


def snapshot_expectation(timestamp, now_ms, lang):
    try:
        moment = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        moment = moment.astimezone(timezone.utc)
        age = now_ms / 1000 - moment.timestamp()
        text = (
            moment.isoformat(timespec="milliseconds")
            .replace("T", " ")
            .replace("+00:00", " UTC")
        )
        return text, age > 7 * 86400 or age < -300
    except (ValueError, TypeError, AttributeError):
        return "未核验" if lang == "zh" else "not verified", True
