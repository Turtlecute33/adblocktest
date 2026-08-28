<div align="center">

<img src="src/assets/toolz/icon.svg" alt="AdBlockTest" width="120" height="120" />

# AdBlockTest

**A small, privacy-first ad blocker test.**
See if your blocker, DNS filter, or VPN catches ads, trackers, and analytics.

[![License](https://img.shields.io/badge/license-CC--BY--NC--SA%204.0-22c55e?style=flat-square)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Forked from](https://img.shields.io/badge/forked%20from-d3ward%2Ftoolz-475569?style=flat-square)](https://github.com/d3ward/toolz)

<br />

<a href="https://adblock.turtlecute.org">
  <img src="src/assets/cta-run-test.svg" alt="Run the test" />
</a>

<br />

</div>

---

Hi, I'm TurtleCute, and I love testing my adblocker.
I cleaned, modernized, and debloated [d3ward's original project](https://github.com/d3ward/toolz) to keep the test online.

## What it tests

- **Hosts**: ads, analytics, trackers, social, and OEM domains.
- **Cosmetic filters**: whether ad-shaped DOM elements get hidden.
- **Script blocking**: whether `ads.js` and `pagead.js` style scripts load.

## Host lists

Two formats if your blocker isn't catching enough. Subscribe to these URLs:

- [`d3host.txt`](https://adblock.turtlecute.org/d3host.txt) (hosts file) — covers the **Host** category only. A hosts file cannot pass the cosmetic filter or ad script checks, so pair it with a browser extension for a full score.
- [`d3host.adblock`](https://adblock.turtlecute.org/d3host.adblock) (adblock syntax) — covers every category, because it also carries the cosmetic and script rules.

The list ships with [Blokada](https://blokada.org/) and the [OISD List](https://oisd.nl/).

## Local development

Requires Node.js 22.15 or newer.

```sh
npm install
npm run dev      # webpack dev server
npm run build    # production build to /dist
```

## Contributing

Bug, broken test, or new test idea? [Open an issue](https://github.com/Turtlecute33/adblocktest/issues/new/choose).

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), same as the upstream project.
