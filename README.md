# mmw-landing-pages
My Music Workshop landing pages (one folder per page uploaded to mymusicworkshop.com/lp/)

## Tracking on every page

Every page folder carries `lp-tracking.js` (menu taps, Monthly/Yearly toggle,
Start buttons, questions opened, videos, sections viewed, scroll depth) and
loads it from `index.html`. The master copy is `shared/lp-tracking.js`.

- **New page:** just add the folder and push. GitHub copies in the tracking
  file and adds its script tag automatically (see the "Landing page tracking"
  action). Download the page to upload only after that action finishes.
- **Changing the tracking:** edit `shared/lp-tracking.js`, then run
  `python3 tools/lp_tracking.py sync` (or push and let GitHub do it).
- The action also fails with a red X if a page loses the Meta pixel, PostHog
  or the trial_started listener.

When uploading a page to the site, upload `lp-tracking.js` along with
`index.html`.
