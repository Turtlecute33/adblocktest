// Sponsor placement, built at runtime.
//
// Every static handle this placement ever exposed ended up in EasyList and
// AdGuard Base as a domain-scoped rule: first the asset path
// (||turtlecute.org/assets/partners/), then two wrapper classes
// (turtlecute.org##.sponsor_banner_wrap, turtlecute.org##.collab_wrap), then
// the destination itself (turtlecute.org##a[href^="https://shockvpn.com/?"]),
// and then the link's rel (adblock.turtlecute.org##.notice_stack > a[rel$="sponsored"]).
//
// A filter rule can only name something that is identical on every visit, so
// nothing here is. The class names, the creative URL and the delivery mechanism
// are drawn fresh on each page load, the destination never enters the DOM,
// and the node rebuilds itself under new
// names if something hides it. This module also lives in the same bundle as the
// test itself, so the bundle cannot be blocked without breaking the product.
//
// See REBUILD_LIMIT: this gives up rather than looping forever. A rule that
// survives a handful of rebuilds has won that page load, and spinning would
// only cost the visitor battery.

// Two creatives, one per breakpoint, imported dynamically so a visitor
// downloads the one that matches. Webpack emits each as its own content-hashed
// chunk, which means the request URL changes on every deploy.
const CREATIVES = {
	wide: () => import('../../media/wide.webp'),
	narrow: () => import('../../media/narrow.webp')
}

const DESTINATION = 'https://shockvpn.com/?utm_source=adblock.turtlecute.org'
const LABEL = 'Learn more about ShockVPN (opens in a new tab)'
const UMAMI_EVENT = 'ShockVPN banner click'
const UMAMI_PARTNER = 'ShockVPN'

const WIDE_QUERY = '(min-width: 48.0625em)'
const REBUILD_LIMIT = 5
// A cosmetic rule applies before first paint, a procedural one can take a frame
// or two, and a rule shipped mid-session arrives whenever the list updates.
// These three checks cover the first two cases; the observer covers the rest.
const VISIBILITY_CHECKS_MS = [0, 400, 1500]
const OBSERVER_LIFETIME_MS = 15000

function randomToken() {
	// Shape and length both vary, so the class cannot be matched by a prefix or
	// a length-based pattern either. Starts with a letter to stay a valid ident.
	const alphabet = 'abcdefghijklmnopqrstuvwxyz'
	const digits = alphabet + '0123456789'
	const length = 6 + Math.floor(Math.random() * 6)
	const bytes = new Uint8Array(length)
	crypto.getRandomValues(bytes)
	let token = alphabet[bytes[0] % alphabet.length]
	for (let i = 1; i < length; i++) token += digits[bytes[i] % digits.length]
	return token
}

function styleSheetFor(cls, mode) {
	// The geometry that used to live in .hero_feature. Written out here rather
	// than kept in index.css because a class in the stylesheet is a class a rule
	// can name; this one only exists for the lifetime of one page load.
	const paint =
		mode === 'background'
			? 'background-position:center;background-size:100% 100%;background-repeat:no-repeat;'
			: ''
	return (
		`.${cls}{display:block;overflow:hidden;width:100%;line-height:0;` +
		`text-decoration:none;border-radius:var(--r-lg);` +
		`aspect-ratio:1940/240;${paint}` +
		// .i_box is carried for camouflage (see mount); neutralise its box, and
		// the global button styles (a fixed height would defeat aspect-ratio).
		`padding:0;border:0;background-color:transparent;` +
		`height:auto;box-shadow:none;cursor:pointer;}` +
		`.${cls}>img{display:block;width:100%;height:100%;object-fit:cover;}` +
		`.${cls}:focus-visible{outline:2px solid var(--focus);outline-offset:3px;}` +
		`@media (max-width:48em){.${cls}{aspect-ratio:1200/400;}}`
	)
}

function isHidden(el) {
	if (!el || !el.isConnected) return true
	const cs = getComputedStyle(el)
	if (cs.display === 'none' || cs.visibility === 'hidden') return true
	if (parseFloat(cs.opacity) === 0) return true
	return !(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
}

// Turning the inlined creative into a blob: URL gives it a per-load random
// address, so neither a src pattern nor a data: prefix matches. Falls back to
// the data URI the import already produced if Blob construction is unavailable.
async function toBlobUrl(dataUri) {
	try {
		const response = await fetch(dataUri)
		const blob = await response.blob()
		return URL.createObjectURL(blob)
	} catch (error) {
		return dataUri
	}
}

export class Sponsor {
	constructor(mountSelector) {
		this.mount = document.querySelector(mountSelector)
		this.rebuilds = 0
		this.node = null
		this.styleNode = null
		this.blobUrl = null
		this.observer = null
		this.timers = []
		this.creative = null
	}

	async start() {
		if (!this.mount) return
		const wide = window.matchMedia(WIDE_QUERY).matches
		const module = await (wide ? CREATIVES.wide() : CREATIVES.narrow())
		this.creative = module.default
		this.render()
	}

	teardown() {
		this.timers.forEach(clearTimeout)
		this.timers = []
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}
		if (this.blobUrl) {
			URL.revokeObjectURL(this.blobUrl)
			this.blobUrl = null
		}
		if (this.styleNode) {
			this.styleNode.remove()
			this.styleNode = null
		}
		if (this.node) {
			this.node.remove()
			this.node = null
		}
	}

	async render() {
		this.teardown()

		const cls = randomToken()
		// Alternate the delivery between an <img> holding a blob: URL and a
		// background-image holding the data URI. Neither ##img[src^="blob:"] nor
		// :matches-css(background-image,...) catches both, so a rule that works
		// on one load misses the next.
		const mode = Math.random() < 0.5 ? 'image' : 'background'

		this.styleNode = document.createElement('style')
		this.styleNode.textContent = styleSheetFor(cls, mode)
		document.head.appendChild(this.styleNode)

		const link = document.createElement('button')
		// .i_box is deliberate: the accuracy caveat and the GitHub ask carry it
		// too, so a rule written against it takes both of those down as well.
		// The random class above neutralises everything .i_box paints.
		link.className = `i_box ${cls}`
		link.type = 'button'
		link.setAttribute('role', 'link')
		link.setAttribute('aria-label', LABEL)
		link.setAttribute('data-umami-event', UMAMI_EVENT)
		link.setAttribute('data-umami-event-partner', UMAMI_PARTNER)

		// No href and no rel, at rest or on interaction. Both are rule targets,
		// and an href attached on pointerdown was matched by the href rule before
		// the click landed, so the click went nowhere. With no href this is not a
		// crawlable link, so rel="sponsored" has nothing to qualify. A <button>
		// rather than an <a>: Umami tracks a button from its data attributes but
		// skips an <a> with no href. Enter and Space on a button arrive as click.
		const open = () => window.open(DESTINATION, '_blank', 'noopener,noreferrer')
		link.addEventListener('click', open)
		link.addEventListener('auxclick', (event) => {
			if (event.button === 1) open()
		})

		if (mode === 'image') {
			this.blobUrl = await toBlobUrl(this.creative)
			const img = document.createElement('img')
			img.src = this.blobUrl
			img.alt = ''
			img.decoding = 'async'
			link.appendChild(img)
		} else {
			link.style.backgroundImage = `url("${this.creative}")`
		}

		this.mount.insertBefore(link, this.mount.firstChild)
		this.node = link
		this.watch()
	}

	watch() {
		VISIBILITY_CHECKS_MS.forEach((delay) => {
			this.timers.push(
				setTimeout(() => {
					requestAnimationFrame(() => this.verify())
				}, delay)
			)
		})

		// Catches a node that is removed outright (uBO's :remove()) and any
		// attribute rewrite, which a static check on a timer would miss.
		this.observer = new MutationObserver(() => this.verify())
		this.observer.observe(this.mount, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'hidden']
		})
		this.timers.push(
			setTimeout(() => {
				if (this.observer) this.observer.disconnect()
				this.observer = null
			}, OBSERVER_LIFETIME_MS)
		)
	}

	verify() {
		if (!this.node) return
		if (!isHidden(this.node)) return
		if (this.rebuilds >= REBUILD_LIMIT) {
			this.teardown()
			return
		}
		this.rebuilds += 1
		this.render()
	}
}
