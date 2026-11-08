"""Build try-drums/ (drum version of the live try-piano page).

Copies try-piano/, swaps piano wording for drum wording, swaps or
placeholders the piano photos and lesson videos, and keeps every
tracking piece (PostHog, Meta Pixel + pricing events, trial-start
listener) untouched. Re-runnable: rebuilds try-drums/ from try-piano/.

Run from the repository root:  python3 tools/build_try_drums.py
"""
import os
import re
import shutil

from PIL import Image, ImageDraw, ImageFont

SRC = "try-piano"
DST = "try-drums"

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def must_replace(text, old, new, count=1, label=""):
    found = text.count(old)
    if found != count:
        raise SystemExit(f"[{label}] expected {count} x {old[:70]!r}, found {found}")
    return text.replace(old, new)


def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def placeholder(path, size, title, detail, transparent=False):
    w, h = size
    bg = (0, 0, 0, 0) if transparent else (232, 241, 250, 255)
    im = Image.new("RGBA", size, bg)
    d = ImageDraw.Draw(im)
    m = max(8, w // 40)
    box = (m, m, w - m, h - m)
    if transparent:
        d.rounded_rectangle(box, radius=w // 20, fill=(255, 255, 255, 235))
    # dashed border
    dash = max(10, w // 60)
    lw = max(3, w // 260)
    x0, y0, x1, y1 = box
    for x in range(x0, x1, dash * 2):
        d.line([(x, y0), (min(x + dash, x1), y0)], fill=(11, 120, 193, 255), width=lw)
        d.line([(x, y1), (min(x + dash, x1), y1)], fill=(11, 120, 193, 255), width=lw)
    for y in range(y0, y1, dash * 2):
        d.line([(x0, y), (x0, min(y + dash, y1))], fill=(11, 120, 193, 255), width=lw)
        d.line([(x1, y), (x1, min(y + dash, y1))], fill=(11, 120, 193, 255), width=lw)
    f_tag = ImageFont.truetype(FONT_BOLD, max(14, w // 34))
    f_title = ImageFont.truetype(FONT_BOLD, max(16, w // 22))
    f_det = ImageFont.truetype(FONT_REG, max(13, w // 40))
    inner = w - 4 * m
    lines = [("PHOTO PLACEHOLDER" if "VIDEO" not in title else "VIDEO PLACEHOLDER", f_tag, (242, 154, 31))]
    lines += [(l, f_title, (11, 60, 110)) for l in wrap(d, title.replace("VIDEO: ", ""), f_title, inner)]
    lines += [(l, f_det, (60, 70, 85)) for l in wrap(d, detail, f_det, inner)]
    heights = [f.getbbox("Ag")[3] + (f.size // 2) for _, f, _ in lines]
    y = (h - sum(heights)) // 2
    for (text, f, col), lh in zip(lines, heights):
        tw = d.textlength(text, font=f)
        d.text(((w - tw) / 2, y), text, font=f, fill=col)
        y += lh
    if not transparent:
        im = im.convert("RGB")
    im.save(path, "WEBP", quality=82)


def main():
    if os.path.exists(DST):
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    A = os.path.join(DST, "assets")

    # ---------- placeholder images ----------
    hero_t = "Hero: Mr. Elias with a drum lesson on a tablet"
    hero_d = "Cut-out photo, transparent background, same layout as the piano hero"
    placeholder(f"{A}/hero-drums-desktop.webp", (1400, 1032), hero_t, hero_d, transparent=True)
    placeholder(f"{A}/hero-drums-mobile.webp", (800, 590), hero_t, hero_d, transparent=True)
    placeholder(f"{A}/hero-drums-placeholder.webp", (760, 560), hero_t, hero_d, transparent=True)

    day1_t = "Day 1: child at home holding drumsticks"
    day1_d = "e.g. tapping the printable paper drum or a practice pad, lesson on a tablet"
    day7_t = "Day 7: parent and child celebrating at the drums"
    day7_d = "e.g. high-five at a kid's drum kit or e-kit"
    for day, t, dsc, sizes in [
        (1, day1_t, day1_d, {"desktop": (1618, 959), "tablet": (1540, 1100), "mobile": (720, 405)}),
        (7, day7_t, day7_d, {"desktop": (1399, 854), "tablet": (1099, 785), "mobile": (1000, 556)}),
    ]:
        for k, sz in sizes.items():
            placeholder(f"{A}/drums-week-day-{day}-{k}.webp", sz, t, dsc)

    lessons = [
        ("drums-video-1", "VIDEO: Hold the Sticks and Find the Beat", "Getting Started clip (how to hold sticks, bass drum)"),
        ("drums-video-2", "VIDEO: Color-Coded Sticking", "Single Drum lesson clip (red = right hand, blue = left)"),
        ("drums-video-3", "VIDEO: First Groove on the Drum Set", "Groove 1 clip (bass drum and snare)"),
        ("drums-video-4", "VIDEO: Add the Hi-Hat", "3-part groove clip (hi-hat, snare, bass drum)"),
        ("drums-video-5", "VIDEO: Funk and Sixteenth-Note Grooves", "Later groove clip (funk, four on the floor, sixteenths)"),
    ]
    for name, t, dsc in lessons:
        placeholder(f"{A}/{name}.webp", (1280, 720), t, dsc)

    # remove piano-only media from the drum folder
    for f in ["hero-elias-piano-tablet-desktop-v2.webp", "hero-elias-piano-tablet-placeholder.webp",
              "week-day-1-responsive-desktop.webp", "week-day-1-responsive-tablet.webp",
              "week-day-1-responsive-mobile-v2.webp", "week-day-3-responsive-desktop.webp",
              "week-day-3-responsive-tablet.webp", "week-day-3-responsive-mobile-v2.webp",
              "week-day-7-responsive-desktop.webp", "week-day-7-responsive-tablet.webp",
              "week-day-7-responsive-mobile.webp", "video-reading-notes.webp", "video-twinkle.webp",
              "video-jam-along.webp", "video-e-minor-chord.webp", "video-chord-progression.webp",
              "cde-edc-lesson-clip.mp4", "twinkle-teaching-clip.mp4", "lesson-28-jam-both-hands-clip.mp4",
              "e-minor-chord-clip.mp4", "lesson-67-learn-clip.mp4"]:
        os.remove(f"{A}/{f}")

    # ---------- index.html ----------
    p = f"{DST}/index.html"
    t = open(p, encoding="utf-8").read()
    r = lambda old, new, n=1, lab="index": must_replace(t, old, new, n, lab)

    # head
    t = r('content="Online piano lessons built for kids ages 4–12, with bite-sized lessons, built-in practice, and rewards that keep kids engaged."',
          'content="Online drum lessons built for kids ages 4–12, with bite-sized lessons, built-in practice, and rewards that keep kids engaged."')
    t = r("<title>Online Piano Lessons for Kids | My Music Workshop</title>",
          "<title>Online Drum Lessons for Kids | My Music Workshop</title>")
    t = r("assets/hero-elias-piano-tablet-placeholder.webp", "assets/hero-drums-placeholder.webp", 2)
    t = r("assets/hero-elias-piano-tablet-desktop-v2.webp", "assets/hero-drums-desktop.webp", 2)

    # hero
    t = r("<h1>Online Piano Lessons <span>Built for Kids</span></h1>",
          "<h1>Online Drum Lessons <span>Built for Kids</span></h1>")
    t = r("build real piano skills at home through bite-sized lessons",
          "build real drum skills at home through bite-sized lessons")
    t, n = re.subn(r'(<source media="\(max-width: 700px\)" srcset=")data:image/webp;base64,[A-Za-z0-9+/=]+(")',
                   r"\1assets/hero-drums-mobile.webp\2", t)
    assert n == 1, "hero mobile data URI"
    t = r('alt="Mr. Elias presenting a piano lesson beside a tablet"',
          'alt="Placeholder: Mr. Elias presenting a drum lesson beside a tablet"')

    # first week
    t = r('srcset="assets/week-day-1-responsive-mobile-v2.webp"', 'srcset="assets/drums-week-day-1-mobile.webp"')
    t = r('srcset="assets/week-day-1-responsive-tablet.webp"', 'srcset="assets/drums-week-day-1-tablet.webp"')
    t = r('src="assets/week-day-1-responsive-desktop.webp" alt="Young beginner following a My Music Workshop piano lesson at home"',
          'src="assets/drums-week-day-1-desktop.webp" alt="Placeholder: young beginner holding drumsticks during a My Music Workshop lesson"')
    t = r("<p>They’ll recognize the keys, start playing, and feel successful from the very beginning.</p>",
          "<p>They’ll learn to hold the sticks, find a steady beat, and feel successful from the very beginning. No drum set yet? They can start on our printable paper drum.</p>")
    t = r('srcset="assets/week-day-3-responsive-mobile-v2.webp"', 'srcset="assets/program-drums.webp"')
    t = r('srcset="assets/week-day-3-responsive-tablet.webp"', 'srcset="assets/program-drums.webp"')
    t = r('src="assets/week-day-3-responsive-desktop.webp" alt="Child playing piano along with a My Music Workshop lesson"',
          'src="assets/program-drums.webp" alt="My Music Workshop drum lesson with color-coded drum notation"')
    t = r("<h3>Experience What It Feels Like to Play Piano</h3>",
          "<h3>Experience What It Feels Like to Play Drums</h3>")
    t = r('srcset="assets/week-day-7-responsive-mobile.webp"', 'srcset="assets/drums-week-day-7-mobile.webp"')
    t = r('srcset="assets/week-day-7-responsive-tablet.webp"', 'srcset="assets/drums-week-day-7-tablet.webp"')
    t = r('src="assets/week-day-7-responsive-desktop.webp" alt="A parent and child celebrating progress together at the piano"',
          'src="assets/drums-week-day-7-desktop.webp" alt="Placeholder: a parent and child celebrating progress together at the drums"')
    t = r("they’ll have learned their first song and made real progress",
          "they’ll have played their first groove and made real progress")

    # skill path
    t = r("<h2>Their Piano Skills Will Grow, <span>Step by Step.</span></h2><p>What begins with simple one-hand melodies builds toward familiar songs, playing with both hands, scales and chords, and progressions they can use in popular music.</p>",
          "<h2>Their Drum Skills Will Grow, <span>Step by Step.</span></h2><p>What begins with a steady beat on a single drum builds toward color-coded sticking, full drum-set grooves with the bass drum, snare, and hi-hat, and the funk and rock beats they hear in popular music.</p>")
    path = [
        (r'data-demo="Reading and Playing Notes" data-video="assets/cde-edc-lesson-clip.mp4" aria-label="Play reading and playing notes video preview"><span class="lesson-media"><img src="assets/video-reading-notes.webp" alt="Reading and playing notes piano lesson"',
         'data-demo="Hold the Sticks and Find the Beat" aria-label="Play hold the sticks and find the beat video preview"><span class="lesson-media"><img src="assets/drums-video-1.webp" alt="Placeholder: getting started drum lesson"',
         "Play Simple One-Hand Melodies", "Hold the Sticks and Keep a Steady Beat"),
        (r'data-demo="Twinkle, Twinkle, Little Star" data-video="assets/twinkle-teaching-clip.mp4" aria-label="Play Twinkle, Twinkle, Little Star video preview"><span class="lesson-media"><img src="assets/video-twinkle.webp" alt="Twinkle, Twinkle, Little Star piano lesson"',
         'data-demo="Color-Coded Sticking" aria-label="Play color-coded sticking video preview"><span class="lesson-media"><img src="assets/drums-video-2.webp" alt="Placeholder: color-coded sticking drum lesson"',
         "Learn Familiar Songs", "Learn Color-Coded Sticking"),
    ]
    for old, new, cap_old, cap_new in path:
        t = r(old, new)
        t = r(f'<strong class="lesson-caption">{cap_old}</strong>', f'<strong class="lesson-caption">{cap_new}</strong>')
    # remaining three cards: rewrite whole button opening generically
    for demo, video, img, alt_old, cap_old, nd, nimg, nalt, ncap in [
        ("Jam Along", "assets/lesson-28-jam-both-hands-clip.mp4", "assets/video-jam-along.webp", "Lesson 40 Jam Along piano activity",
         "Begin Playing With Both Hands", "First Groove on the Drum Set", "assets/drums-video-3.webp", "Placeholder: first drum-set groove lesson",
         "Play Their First Drum-Set Groove"),
        ("E Minor Chord", "assets/e-minor-chord-clip.mp4", "assets/video-e-minor-chord.webp", "E Minor chord piano lesson",
         "Learn Scales and Chords", "Add the Hi-Hat", "assets/drums-video-4.webp", "Placeholder: hi-hat groove lesson",
         "Add the Hi-Hat for Three-Part Grooves"),
        ("Chord Progression Lesson", "assets/lesson-67-learn-clip.mp4", "assets/video-chord-progression.webp", "Chord progression piano lesson",
         "Use Chord Progressions Found in Popular Songs", "Funk and Sixteenth-Note Grooves", "assets/drums-video-5.webp", "Placeholder: funk groove lesson",
         "Play Funk, Rock, and Sixteenth-Note Grooves"),
    ]:
        t, n = re.subn(r'data-demo="' + re.escape(demo) + r'" data-video="' + re.escape(video) + r'" aria-label="[^"]*"',
                       f'data-demo="{nd}" aria-label="Play {nd.lower()} video preview"', t)
        assert n == 1, demo
        t = r(f'src="{img}" alt="{alt_old}"', f'src="{nimg}" alt="{nalt}"')
        t = r(f'<strong class="lesson-caption">{cap_old}</strong>', f'<strong class="lesson-caption">{ncap}</strong>')

    # instrument section: drums first
    t = r("<h2>They Came for Piano. They Get a <span>Whole World of Music.</span></h2><p>Piano may be where they begin, but every plan includes full access to the entire program. They can explore drums, ukulele, singing,",
          "<h2>They Came for Drums. They Get a <span>Whole World of Music.</span></h2><p>Drums may be where they begin, but every plan includes full access to the entire program. They can explore piano, ukulele, singing,")
    lines = t.split("\n")
    i_p = next(i for i, l in enumerate(lines) if 'src="assets/program-piano.webp"' in l)
    i_d = next(i for i, l in enumerate(lines) if 'src="assets/program-drums.webp"' in l and 'class="instrument"' in l)
    assert i_d == i_p + 1, "piano/drums tiles not adjacent"
    lines[i_p], lines[i_d] = lines[i_d], lines[i_p]
    t = "\n".join(lines)
    t = r('<small>Rhythm, technique, and drum beats kids can use right away</small>',
          '<small>Step-by-step lessons from the first beat to full drum-set grooves</small>')
    t = r('<small>Step-by-step lessons from the basics to real skills</small>',
          '<small>Notes, songs, and two-hand playing, step by step</small>')

    # pricing card list
    t = r("<li>Piano, drums, singing &amp; ukulele, all included</li>", "<li>Drums, piano, singing &amp; ukulele, all included</li>")

    # 3 common questions: instrument + level
    t = r("<p><strong>Whatever you have is enough to get started.</strong></p><p>A piano, digital piano, or basic keyboard will work just fine. Weighted keys give kids the best playing experience, but they can start learning without them.",
          "<p><strong>Whatever you have is enough to get started.</strong></p><p>No drum set yet? Kids can start with a pair of drumsticks and our printable paper drum, or a practice pad. Any kid's drum set or electronic drum kit works too, and an e-kit with headphones keeps practice quiet.")
    t = r("New players can start with the basics, while children with some experience can continue building through reading music, two-hand playing, scales, chords, and chord progressions.",
          "New players start with holding the sticks and keeping a steady beat on a single drum, while children with some experience can jump to drum-set grooves, from bass and snare to hi-hat, funk, and sixteenth-note beats.")

    # FAQ
    t = r("Is previous piano experience needed?<span>+</span></button><div><p>No. The piano path begins at the complete beginner level and guides kids one step at a time.</p>",
          "Is previous drum experience needed?<span>+</span></button><div><p>No. The drum path begins at the complete beginner level, starting with how to hold the sticks, and guides kids one step at a time.</p>")
    t = r("<p>Everything: piano, drums, ukulele, singing, music reading,",
          "<p>Everything: drums, piano, ukulele, singing, music reading,")
    t = r("Do I need to know piano to help?<span>+</span>", "Do I need to know drums to help?<span>+</span>")
    faq_new = ('          <article><button aria-expanded="false">Do we need a drum set?<span>+</span></button><div><p>Not to start. Kids can begin with drumsticks and our printable paper drum, or a practice pad, and move to a drum set when you’re ready. If you already have a kid’s drum set, a short parent video shows how to set it up.</p></div></article>\n'
               '          <article><button aria-expanded="false">Won’t drums be too loud?<span>+</span></button><div><p>The paper drum and a practice pad are quiet, and an electronic drum kit with headphones keeps practice quiet on a full kit. Lessons are short, so practice fits around the rest of the household.</p></div></article>\n')
    anchor = '          <article><button aria-expanded="false">Is My Music Workshop an app?'
    t = r(anchor, faq_new + anchor)

    # closing CTA keyboard icon -> drum icon
    t, n = re.subn(r'<span class="closing-note closing-piano left" aria-hidden="true"><svg viewBox="0 0 160 84">.*?</svg></span>',
                   '<span class="closing-note closing-piano left" aria-hidden="true"><svg viewBox="0 0 160 84">'
                   '<ellipse class="keyboard-body" cx="80" cy="34" rx="56" ry="14"/>'
                   '<path class="white-key-lines" d="M24 34v28c0 8 25 14 56 14s56-6 56-14V34"/>'
                   '<path class="white-key-lines" d="M46 20 20 2M114 20 140 2"/>'
                   '</svg></span>', t, flags=re.S)
    assert n == 1, "closing icon"

    open(p, "w", encoding="utf-8", newline="").write(t)

    # ---------- script.js ----------
    p = f"{DST}/script.js"
    s = open(p, encoding="utf-8").read()
    s = must_replace(s, "'Piano, drums, singing & ukulele, all included'", "'Drums, piano, singing & ukulele, all included'", 2, "script")
    open(p, "w", encoding="utf-8", newline="").write(s)

    # drop assets no longer referenced
    refs = set(re.findall(r"assets/[A-Za-z0-9_./-]+", t + s + open(f"{DST}/site.css", encoding="utf-8").read()))
    for root, _, files in os.walk(A):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), DST).replace(os.sep, "/")
            if rel not in refs:
                os.remove(os.path.join(root, f))
    missing = [x for x in refs if not os.path.exists(os.path.join(DST, x))]
    assert not missing, missing
    print("built", DST, "assets:", len(refs))


if __name__ == "__main__":
    main()
