#!/usr/bin/env python3
"""Tell IndexNow engines (Bing, Yandex, ...) about a-to-mind.com's pages. Run after a deploy."""
import json
import urllib.error
import urllib.request

KEY = "7c1e5a9d4b2f4a8e9d3c6b1f0a2e8d57"


def submit_to_indexnow():
    payload = {
        "host": "a-to-mind.com",
        "key": KEY,
        "keyLocation": f"https://a-to-mind.com/{KEY}.txt",
        "urlList": [
            "https://a-to-mind.com/",
            "https://a-to-mind.com/cheat-codes/",
        ],
    }
    req = urllib.request.Request(
        "https://api.indexnow.org/indexnow",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req) as response:
            print(f"IndexNow status: {response.status} (200/202 = accepted)")
    except urllib.error.HTTPError as e:
        print(f"IndexNow error: {e.code} - {e.reason}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    submit_to_indexnow()
