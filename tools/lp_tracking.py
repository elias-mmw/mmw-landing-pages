"""Keep the landing page tracking code on every page.

The master copy is shared/lp-tracking.js. Every page folder (a folder with an
index.html) must have an identical lp-tracking.js and load it from index.html.

  python3 tools/lp_tracking.py sync    copy the file into every page and add or
                                       update its <script> tag
  python3 tools/lp_tracking.py check   report pages that are missing anything
                                       (also run by GitHub on every push)

check also confirms each page still has the Meta pixel, PostHog and the
trial_started listener.
"""
import hashlib
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "shared", "lp-tracking.js")
SKIP = {".git", ".github", "tools", "shared"}
TAG_RE = re.compile(r'<script src="lp-tracking\.js(\?v=[^"]*)?"></script>')
REQUIRED = {
    "Meta pixel": "fbq('init', '1057398269259234')",
    "PostHog": "posthog.init(",
    "trial_started listener": "mmw_trial_started",
}


def pages():
    return sorted(
        d for d in os.listdir(ROOT)
        if d not in SKIP and os.path.isfile(os.path.join(ROOT, d, "index.html"))
    )


def master_bytes():
    with open(MASTER, "rb") as f:
        return f.read()


def tag():
    version = hashlib.sha1(master_bytes()).hexdigest()[:8]
    return f'<script src="lp-tracking.js?v={version}"></script>'


def sync():
    wanted = tag()
    for page in pages():
        shutil.copyfile(MASTER, os.path.join(ROOT, page, "lp-tracking.js"))
        path = os.path.join(ROOT, page, "index.html")
        html = open(path, encoding="utf-8").read()
        if TAG_RE.search(html):
            html = TAG_RE.sub(wanted, html)
        else:
            script = re.search(r'<script src="script\.js[^"]*"></script>', html)
            if script:
                html = html[:script.end()] + "\n  " + wanted + html[script.end():]
            else:
                html = html.replace("</body>", "  " + wanted + "\n</body>", 1)
        open(path, "w", encoding="utf-8").write(html)
        print("synced", page)


def check():
    wanted = tag()
    master = master_bytes()
    problems = []
    for page in pages():
        js = os.path.join(ROOT, page, "lp-tracking.js")
        html = open(os.path.join(ROOT, page, "index.html"), encoding="utf-8").read()
        if not os.path.isfile(js):
            problems.append(f"{page}: lp-tracking.js is missing")
        elif open(js, "rb").read() != master:
            problems.append(f"{page}: lp-tracking.js is out of date")
        if wanted not in html:
            problems.append(f"{page}: index.html does not load the current lp-tracking.js")
        for name, marker in REQUIRED.items():
            if marker not in html:
                problems.append(f"{page}: {name} not found in index.html")
    if problems:
        print("Tracking problems:\n  " + "\n  ".join(problems))
        print("\nFix: run  python3 tools/lp_tracking.py sync  (or ask Claude to).")
        sys.exit(1)
    print("All pages have current tracking:", ", ".join(pages()))


if __name__ == "__main__":
    {"sync": sync, "check": check}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
