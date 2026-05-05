<div align="center">

<img src="src/assets/toolz/icon.svg" alt="AdBlockTest" width="120" height="120" />

# AdBlockTest

**A small, privacy-first ad blocker test.**
See if your blocker, DNS filter, or VPN catches ads, trackers, and analytics.

<a href="https://adblock.turtlecute.org">
  <img src="https://img.shields.io/badge/▶%20Run%20the%20test-0ea5e9?style=for-the-badge&labelColor=0c4a6e" alt="Run the test" />
</a>

[![License](https://img.shields.io/badge/license-CC--BY--NC--SA%204.0-22c55e?style=flat-square)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Forked from](https://img.shields.io/badge/forked%20from-d3ward%2Ftoolz-475569?style=flat-square)](https://github.com/d3ward/toolz)

</div>

---

Hi, I'm TurtleCute, and I love testing my adblocker.
I cleaned, modernized, and debloated [d3ward's original project](https://github.com/d3ward/toolz) to keep the test online.

## What it tests

- **Hosts**: ads, analytics, trackers, social, and OEM domains.
- **Cosmetic filters**: whether ad-shaped DOM elements get hidden.
- **Script blocking**: whether `ads.js` and `pagead.js` style scripts load.

## Host lists

Two formats if your blocker isn't catching enough:

- [`d3host.txt`](https://raw.githubusercontent.com/Turtlecute33/adblocktest/master/src/d3host.txt) (hosts file)
- [`d3host.adblock`](https://raw.githubusercontent.com/Turtlecute33/adblocktest/master/src/d3host.adblock) (adblock syntax)

The list ships with [Blokada](https://blokada.org/) and the [OISD List](https://oisd.nl/).

## Local development

```sh
npm install
npm run dev      # webpack dev server
npm run build    # production build to /dist
```

## Contributing

Bug, broken test, or new test idea? [Open an issue](https://github.com/Turtlecute33/adblocktest/issues/new/choose).

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), same as the upstream project.
