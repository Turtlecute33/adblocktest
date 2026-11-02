// Sponsor placement, built at runtime.
//
// Every static handle this placement ever exposed ended up in EasyList and
// AdGuard Base as a domain-scoped rule: first the asset path
// (||turtlecute.org/assets/partners/), then two wrapper classes
// (turtlecute.org##.sponsor_banner_wrap, turtlecute.org##.collab_wrap), then
// the destination itself (turtlecute.org##a[href^="https://shockvpn.com/?"]),
// then the link's rel (adblock.turtlecute.org##.notice_stack > a[rel$="sponsored"]),
// then the Umami attribute
// (adblock.turtlecute.org##.notice_stack > button[data-umami-event*="banner"]),
// then the inline background (adblock.turtlecute.org##button[style*="data:image"]),
// then the element itself (turtlecute.org##.notice_stack > button[role="link"][aria-label]),
// and then, inside the shadow root, its role and its image
// (adblock.turtlecute.org##[role="link"], adblock.turtlecute.org##[src*="blob:"])
// plus the new tab it opened (||shockvpn.com^$popup,domain=turtlecute.org).
//
// The placement renders inside a closed shadow root on the mount. Blockers
// inject cosmetic rules as user-origin stylesheets, and those do apply inside
// shadow trees, so the root alone hides nothing. A selector cannot cross the
// boundary, though (.notice_stack > anything stops matching), and procedural
// filters (:has-text, :matches-css) query from the document and cannot see in.
//
// So the tree gives a plain selector nothing to tell apart. The caveat, the
// GitHub ask and the placement each sit in an identical cell: a <div> that holds
// a <slot> and a <button> with text, each node with only a class drawn fresh on
// every load. The cells are in random order, and CSS order puts the placement
// first. The creative is a background from the run-time stylesheet, and the
// other two buttons are display:none from there. Slots are assigned by hand, so
// the light DOM gets no slot attributes and stays what the template ships. A
// rule that hides the placement also hides the caveat and the GitHub ask.
//
// See REBUILD_LIMIT: this gives up rather than looping forever. A rule that
// survives a handful of rebuilds has won that page load, and spinning would
// only cost the visitor battery.

// Both creatives are inlined into the main bundle, which also runs the test, so
// a network rule cannot block them without breaking the test. As async chunks
// they had content-hash names that only changed with the image, and a network
// rule could name them.
import wide from '../../media/wide.webp'
import narrow from '../../media/narrow.webp'

const DESTINATION = 'https://shockvpn.com/?utm_source=adblock.turtlecute.org'
const LABEL = 'Learn more about ShockVPN'
const UMAMI_EVENT = 'ShockVPN banner click'
const UMAMI_PARTNER = 'ShockVPN'

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

function shuffle(list) {
	const bytes = new Uint32Array(list.length)
	crypto.getRandomValues(bytes)
	for (let i = list.length - 1; i > 0; i--) {
		const j = bytes[i] % (i + 1)
		const swap = list[i]
		list[i] = list[j]
		list[j] = swap
	}
	return list
}

function styleSheetFor(cells) {
	// The geometry that used to live in .hero_feature. It lives in the shadow
	// root: document styles do not reach in, and a class in index.css is a class
	// a rule can name. The creative goes here too, not in a style attribute or an
	// <img src>: the lists matched button[style*="data:image"] and [src*="blob:"].
	return cells
		.map(({ wrap, button, order, sponsor }) =>
			sponsor
				? `.${wrap}{order:${order};position:relative;overflow:hidden;` +
				  `border-radius:var(--r-lg);aspect-ratio:1940/240;cursor:pointer;` +
				  `background:url("${wide}") center/100% 100% no-repeat;}` +
				  `.${wrap}:has(.${button}:focus-visible){outline:2px solid var(--focus);outline-offset:3px;}` +
				  // The accessible name and the keyboard target, visually hidden.
				  `.${button}{position:absolute;width:1px;height:1px;padding:0;border:0;` +
				  `overflow:hidden;clip-path:inset(50%);white-space:nowrap;}` +
				  `@media (max-width:48em){.${wrap}{aspect-ratio:1200/400;background-image:url("${narrow}");}}`
				: `.${wrap}{order:${order};}.${button}{display:none;}`
		)
		.join('')
}

function isHidden(el) {
	if (!el || !el.isConnected) return true
	const cs = getComputedStyle(el)
	if (cs.display === 'none' || cs.visibility === 'hidden') return true
	if (parseFloat(cs.opacity) === 0) return true
	// A :style() rule can strip the creative and leave an empty box.
	if (!cs.backgroundImage.includes('url(')) return true
	return !(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
}

export class Sponsor {
	constructor(mountSelector) {
		this.mount = document.querySelector(mountSelector)
		this.root = null
		this.items = []
		this.anchor = null
		this.rebuilds = 0
		this.node = null
		this.observer = null
		this.timers = []
	}

	async start() {
		// Without manual slot assignment, skip the placement: a root that cannot
		// show the mount's children would hide the caveat and the GitHub ask.
		if (!this.mount || !('assign' in HTMLSlotElement.prototype)) return
		this.items = [...this.mount.children]
		// The placement's slot gets an empty text node, so every slot has
		// something assigned and :has-slotted cannot tell them apart.
		this.anchor = document.createTextNode('')
		this.mount.append(this.anchor)
		this.root = this.mount.attachShadow({
			mode: 'closed',
			slotAssignment: 'manual'
		})
		this.render()
	}

	stopWatching() {
		this.timers.forEach(clearTimeout)
		this.timers = []
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}
	}

	render() {
		this.stopWatching()

		const tokens = new Set()
		const count = 2 * (this.items.length + 1)
		while (tokens.size < count) tokens.add(randomToken())
		const names = [...tokens]
		// Placement first, then the mount's children in template order.
		const cells = [this.anchor, ...this.items].map((node, order) => ({
			node,
			order,
			sponsor: node === this.anchor,
			wrap: names[2 * order],
			button: names[2 * order + 1],
			slot: document.createElement('slot')
		}))

		const style = document.createElement('style')
		style.textContent = styleSheetFor(cells)

		const wraps = cells.map((cell) => {
			const wrap = document.createElement('div')
			wrap.className = cell.wrap
			const button = document.createElement('button')
			button.className = cell.button
			button.textContent = LABEL
			wrap.append(cell.slot, button)
			if (cell.sponsor) this.node = wrap
			return wrap
		})

		// No href and no rel, at rest or on interaction. Both are rule targets,
		// and an href attached on pointerdown was matched by the href rule before
		// the click landed, so the click went nowhere. Enter and Space on the
		// hidden button arrive as a click that bubbles to the cell.
		// No data-umami-* attributes either: the lists matched
		// button[data-umami-event*="banner"], so the event is sent from here.
		// A plain click navigates this tab: the $popup rule closes any new tab
		// opened toward the destination, and it does not apply to the page's own
		// navigation. Ctrl/Cmd-click and middle-click still ask for a new tab.
		// The tracker sends with keepalive, so the event survives the navigation.
		const open = (newTab) => {
			window.umami?.track?.(UMAMI_EVENT, { partner: UMAMI_PARTNER })
			if (newTab)
				window.open(DESTINATION, '_blank', 'noopener,noreferrer')
			else window.location.assign(DESTINATION)
		}
		this.node.addEventListener('click', (event) =>
			open(event.ctrlKey || event.metaKey)
		)
		this.node.addEventListener('auxclick', (event) => {
			if (event.button === 1) open(true)
		})

		this.root.replaceChildren(style, ...shuffle(wraps))
		cells.forEach((cell) => cell.slot.assign(cell.node))
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

		// Catches a node that is removed outright and any attribute rewrite,
		// which a static check on a timer would miss.
		this.observer = new MutationObserver(() => this.verify())
		this.observer.observe(this.root, {
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
			// Drop the placement cell only. The other cells stay as they are: if
			// the winning rule hid them too, putting them back would make that
			// rule free to write.
			this.stopWatching()
			this.node.remove()
			this.node = null
			return
		}
		this.rebuilds += 1
		this.render()
	}
}
