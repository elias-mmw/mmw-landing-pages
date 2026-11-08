"""Build the GitHub Pages preview from the page folders on main.

Copies every page folder into the given output directory and switches off
tracking in the copies only: a stub defines fbq and posthog before the real
snippets run, so the Meta pixel and PostHog never load on the preview site.
The live files on main are not changed.

Usage: python3 tools/build_preview.py OUTPUT_DIR
"""
import os
import shutil
import sys

STUB = (
    "<script>/* PREVIEW ONLY: tracking switched off */"
    "window.fbq=function(){};window._fbq=window.fbq;"
    "window.posthog={__loaded:true,__SV:1,init:function(){},capture:function(){},"
    "identify:function(){},register:function(){},people:{set:function(){}}};</script>"
)
SKIP = {".git", ".github", "tools"}

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1])
pages = sorted(
    d for d in os.listdir(root)
    if d not in SKIP and os.path.isfile(os.path.join(root, d, "index.html"))
)
for page in pages:
    dest = os.path.join(out, page)
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(
        os.path.join(root, page), dest,
        ignore=shutil.ignore_patterns(".*"),
    )
    path = os.path.join(dest, "index.html")
    html = open(path, encoding="utf-8").read()
    head = html.index("<head>") + len("<head>")
    html = html[:head] + STUB + html[head:]
    html = html.replace("<title>", "<title>[Preview] ", 1)
    open(path, "w", encoding="utf-8").write(html)

links = "".join(f'<li><a href="{p}/">{p}</a></li>' for p in pages)
with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
    f.write(
        "<!DOCTYPE html><meta charset=utf-8><meta name=robots content=noindex>"
        "<title>MMW landing page previews</title>"
        "<h1>MMW landing page previews</h1>"
        "<p>Tracking is switched off on these copies. Live pages are on mymusicworkshop.com.</p>"
        f"<ul>{links}</ul>"
    )
open(os.path.join(out, "robots.txt"), "w").write("User-agent: *\nDisallow: /\n")
open(os.path.join(out, ".nojekyll"), "w").close()
print("built", ", ".join(pages))
