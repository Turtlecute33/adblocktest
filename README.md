<div align="center">

<img src="src/assets/toolz/icon.svg" alt="Toolz" width="120" height="120" />

# Toolz

**A small, privacy-first ad blocker test.**
Check whether your blocker, DNS filter, or VPN actually catches ads, trackers, and analytics.

[![Live](https://img.shields.io/badge/live-adblock.turtlecute.org-3b82f6?style=flat-square)](https://adblock.turtlecute.org)
[![License](https://img.shields.io/badge/license-CC--BY--NC--SA%204.0-green?style=flat-square)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Forked from](https://img.shields.io/badge/forked%20from-d3ward%2Ftoolz-lightgrey?style=flat-square)](https://github.com/d3ward/toolz)

[**Try it →**](https://adblock.turtlecute.org)

</div>

---

Hi, I'm TurtleCute, and I love testing my adblocker.
I cleaned, modernized, and debloated [d3ward's original project](https://github.com/d3ward/toolz) to keep the test online and easy to use.

## What it tests

- **Ads, analytics, trackers, social, and OEM hosts** — the most common domains across categories.
- **Cosmetic filters** — whether ad-shaped DOM elements get hidden.
- **Script blocking** — whether `ads.js` / `pagead.js` style scripts load.

## Host lists

If your blocker isn't catching enough, my list is available in two formats:

- [`d3host.txt`](https://raw.githubusercontent.com/Turtlecute33/Toolz/master/src/d3host.txt) — hosts file
- [`d3host.adblock`](https://raw.githubusercontent.com/Turtlecute33/Toolz/master/src/d3host.adblock) — adblock syntax

It's also bundled into [Blokada](https://blokada.org/) and the [OISD List](https://oisd.nl/).

## Local development

```sh
npm install
npm run dev      # webpack dev server
npm run build    # production build to /dist
```

## Contributing

Found a broken test? Want to suggest a new one? [Open an issue](https://github.com/Turtlecute33/Toolz/issues/new/choose) — contributions welcome.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — same as the upstream project.
