import json
import os
import signal
import sys
import time

WORKER_NAME = "{{workerName}}"
RUN_ONCE = os.environ.get("RUN_ONCE", "").lower() in ("1", "true")

shutdown = False


def handle_signal(_signum, _frame):
    global shutdown
    shutdown = True


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def load_config(name, fallback=None):
    try:
        with open(name, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return fallback or {}


def run_cycle(tick):
    print(f"[{WORKER_NAME}] cycle {tick}")
    return True


def main():
    print(f"[{WORKER_NAME}] starting")
    tick = 0
    while not shutdown:
        tick += 1
        run_cycle(tick)
        print("cycle complete")
        if RUN_ONCE:
            break
        time.sleep(5)
    print(f"[{WORKER_NAME}] shutdown")


if __name__ == "__main__":
    main()
