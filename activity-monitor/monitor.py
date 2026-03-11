"""
Activity Intensity Monitor
Tracks HOW ACTIVE the user is (clicks/min, keystrokes/min, scrolls/min)
without recording WHAT was typed or WHERE was clicked.

Sends data to Supabase every 60 seconds.
"""

import threading
import time
import json
import os
import sys
from datetime import datetime, timezone

try:
    from pynput import keyboard, mouse
except ImportError:
    print("Installing pynput...")
    os.system(f"{sys.executable} -m pip install pynput")
    from pynput import keyboard, mouse

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests

# ── Configuration ────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://zgipgqzskuzbtjldoezq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
EMAIL = os.environ.get("TRACKER_EMAIL", "janis@tracker.local")
PASSWORD = os.environ.get("TRACKER_PASSWORD", "tracker2026")
FLUSH_INTERVAL = 60  # seconds
DEVICE_NAME = os.environ.get("DEVICE_NAME", os.uname().nodename if hasattr(os, 'uname') else "unknown")

# ── State ────────────────────────────────────────────────
access_token = ""
counts = {
    "keystrokes": 0,
    "clicks": 0,
    "scrolls": 0,
    "mouse_distance": 0,
}
last_mouse_pos = None
lock = threading.Lock()


# ── Auth ─────────────────────────────────────────────────
def authenticate():
    global access_token
    if not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_KEY environment variable")
        sys.exit(1)

    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"Content-Type": "application/json", "apikey": SUPABASE_KEY},
        json={"email": EMAIL, "password": PASSWORD},
    )
    if resp.ok:
        access_token = resp.json()["access_token"]
        print(f"Authenticated as {EMAIL}")
    else:
        print(f"Auth failed: {resp.status_code} {resp.text}")
        sys.exit(1)


# ── Flush to Supabase ───────────────────────────────────
def flush():
    global counts
    with lock:
        snapshot = counts.copy()
        counts = {"keystrokes": 0, "clicks": 0, "scrolls": 0, "mouse_distance": 0}

    total_activity = snapshot["keystrokes"] + snapshot["clicks"] + snapshot["scrolls"]
    if total_activity == 0:
        return  # Nothing happened — skip

    now = datetime.now(timezone.utc).isoformat()

    # Determine activity level
    if total_activity > 120:
        level = "very_active"
    elif total_activity > 40:
        level = "active"
    elif total_activity > 10:
        level = "light"
    else:
        level = "minimal"

    event = {
        "site_id": DEVICE_NAME,
        "event_type": "activity_pulse",
        "page_url": "",
        "page_title": "",
        "element_tag": level,
        "element_text": "",
        "element_id": "",
        "element_class": "",
        "metadata": {
            "keystrokes_per_min": snapshot["keystrokes"],
            "clicks_per_min": snapshot["clicks"],
            "scrolls_per_min": snapshot["scrolls"],
            "total_actions": total_activity,
            "device": DEVICE_NAME,
        },
        "created_at": now,
    }

    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/web_events",
            headers={
                "Content-Type": "application/json",
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {access_token}",
                "Prefer": "return=minimal",
            },
            json=[event],
        )
        if resp.ok:
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"keys={snapshot['keystrokes']} clicks={snapshot['clicks']} "
                f"scrolls={snapshot['scrolls']} level={level}"
            )
        else:
            print(f"Flush failed: {resp.status_code}")
            if resp.status_code == 401:
                authenticate()
    except Exception as e:
        print(f"Flush error: {e}")


def flush_loop():
    while True:
        time.sleep(FLUSH_INTERVAL)
        flush()


# ── Listeners ────────────────────────────────────────────
def on_press(key):
    with lock:
        counts["keystrokes"] += 1


def on_click(x, y, button, pressed):
    if pressed:
        with lock:
            counts["clicks"] += 1


def on_scroll(x, y, dx, dy):
    with lock:
        counts["scrolls"] += 1


# ── Main ─────────────────────────────────────────────────
def main():
    print("=" * 50)
    print("  Activity Intensity Monitor")
    print("=" * 50)
    print(f"  Device:    {DEVICE_NAME}")
    print(f"  Supabase:  {SUPABASE_URL}")
    print(f"  Interval:  {FLUSH_INTERVAL}s")
    print()
    print("  Tracking: keystrokes/min, clicks/min, scrolls/min")
    print("  NOT recording: what was typed or where was clicked")
    print("=" * 50)
    print()

    authenticate()

    # Start flush thread
    flush_thread = threading.Thread(target=flush_loop, daemon=True)
    flush_thread.start()

    # Start listeners
    keyboard_listener = keyboard.Listener(on_press=on_press)
    mouse_listener = mouse.Listener(on_click=on_click, on_scroll=on_scroll)

    keyboard_listener.start()
    mouse_listener.start()

    print("Monitoring started. Press Ctrl+C to stop.\n")

    try:
        keyboard_listener.join()
    except KeyboardInterrupt:
        print("\nStopping...")
        flush()  # Final flush
        print("Done.")


if __name__ == "__main__":
    main()
