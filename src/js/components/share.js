// Share dialog: draws the result as an image, previews it in a post frame for
// X, Reddit or Instagram, and lets the visitor download it or hand it to the
// share sheet. Everything is drawn here in the browser: no image service, no
// upload, no request leaves the page.
import A11yDialog from './dialog'

const FONT =
	'-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
// The dark theme palette, fixed so the image looks the same in either theme.
const C = {
	bg: '#111827',
	bg2: '#1f2937',
	txt: '#ffffff',
	muted: '#9ca3af',
	green: '#22C55E',
	orange: '#FF851B',
	red: '#FF4132',
	blue: '#1492FF'
}
// Landscape is 16:9, the shape X and Reddit show in full. Portrait is 4:5,
// the tallest shape the Instagram feed shows without a crop.
const FORMATS = {
	landscape: { width: 1200, height: 675 },
	portrait: { width: 1080, height: 1350 }
}
// The header logo (viewBox 0 0 30 30).
const LOGO_PATH =
	'M12.787 29.698c-2.052-1.173-5.508-4.364-7.216-6.664C1.848 18.021-.01 12.477 0 6.418c.005-2.713.165-3.071 1.69-3.776C4.147 1.507 6.935.68 9.827.23c1.967-.307 5.99-.307 7.956 0 3.814.594 8.5 2.205 9.35 3.213.455.542.53 1.201.442 3.903-.077 2.353-.264 3.7-.815 5.891-1.476 5.862-4.997 11.208-9.906 15.04-2.287 1.786-2.996 2.034-4.067 1.421zm1.748-1.842c1.52-1.031 3.765-3.136 5.155-4.832 3.852-4.703 6.089-10.982 6.098-17.124.002-1.364-.046-1.426-1.584-2.038-3.637-1.449-6.481-2.001-10.334-2.007-3.798-.005-6.664.524-10.19 1.88-1.704.655-1.86.837-1.86 2.174.001 6.13 2.232 12.383 6.111 17.13 1.785 2.184 5.173 5.16 5.874 5.16.123 0 .452-.154.73-.343zm-1.928-2.936c-1.83-1.503-4.388-4.402-5.077-5.754-.297-.58-.245-1.232.123-1.542.124-.105.656-.38 1.182-.61l.957-.418.583.537c1.743 1.606 4.489 1.874 6.446.63 1.317-.839 2.356-2.353 2.541-3.704.077-.558.086-.567.745-.712 2.384-.524 2.799-.212 2.118 1.595-1.327 3.523-3.821 7.049-6.765 9.563-1.57 1.34-1.703 1.36-2.853.415zm-6.975-9.816c-.599-.42-1.502-4.042-1.737-6.962-.174-2.17-.108-2.314 1.31-2.86 2.765-1.063 5.24-1.492 8.6-1.492 3.368 0 5.835.429 8.617 1.5 1.382.53 1.489.761 1.306 2.829-.18 2.044-.21 2.07-2.734 2.486-1.02.168-1.872.282-1.892.254a49.76 49.76 0 01-.46-.724c-2.405-3.834-7.973-3.35-9.713.846-.166.403-.277 1.065-.326 1.95l-.074 1.34-1.166.516c-1.321.585-1.342.589-1.73.317z'
// post() builds the platform's own share link. Neither link can attach an
// image, so posting also downloads the card for the visitor to attach.
// Instagram has no web share link: there the share sheet or the download is
// the way in.
const enc = encodeURIComponent
const PLATFORMS = {
	x: {
		name: 'You',
		meta: '@you · now',
		label: 'X',
		post: (headline, url) =>
			'https://x.com/intent/post?text=' +
			enc(headline + ' Test yours:') +
			'&url=' +
			enc(url)
	},
	reddit: {
		name: 'u/you',
		meta: 'now',
		label: 'Reddit',
		post: (headline, url) =>
			'https://www.reddit.com/submit?url=' +
			enc(url) +
			'&title=' +
			enc(headline)
	},
	instagram: { name: 'you', meta: '', label: 'Instagram', post: null }
}

// The same ranges as the score ball and the FAQ.
function scoreColor(p) {
	return p > 30 ? (p > 60 ? C.green : C.orange) : C.red
}
function verdict(p) {
	if (p >= 100) return 'Perfect score. Nothing got through.'
	if (p > 60) return "Great, you're ready to surf."
	if (p > 30) return 'Okay, but you can do better.'
	return 'Your ad blocker may not be on.'
}

function font(weight, size) {
	return weight + ' ' + size + 'px ' + FONT
}
// Shrinks the font until the text fits, so a long label or a long localized
// date cannot run off the card.
function fitFont(ctx, text, weight, size, maxWidth) {
	let s = size
	ctx.font = font(weight, s)
	while (s > 12 && ctx.measureText(text).width > maxWidth) {
		s -= 2
		ctx.font = font(weight, s)
	}
	return s
}
function bar(ctx, x, y, w, h, color) {
	ctx.fillStyle = color
	ctx.beginPath()
	if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2)
	else ctx.rect(x, y, w, h)
	ctx.fill()
}

function drawBall(ctx, cx, cy, r, p, color) {
	ctx.save()
	ctx.beginPath()
	ctx.arc(cx, cy, r, 0, Math.PI * 2)
	ctx.fillStyle = C.bg2
	ctx.fill()
	ctx.clip()
	const fill = Math.min(Math.max(p, 0), 100) / 100
	const level = cy + r - 2 * r * fill
	const amp = fill <= 0 || fill >= 1 ? 0 : r * 0.06
	// A lighter wave behind the main one, as on the page.
	;[
		[0.4, Math.PI],
		[1, 0]
	].forEach(([alpha, phase]) => {
		ctx.beginPath()
		ctx.moveTo(cx - r, level)
		for (let x = 0; x <= 2 * r; x += 4) {
			ctx.lineTo(
				cx - r + x,
				level + Math.sin((x / (2 * r)) * Math.PI * 2 + phase) * amp
			)
		}
		ctx.lineTo(cx + r, cy + r)
		ctx.lineTo(cx - r, cy + r)
		ctx.closePath()
		ctx.globalAlpha = alpha
		ctx.fillStyle = color
		ctx.fill()
	})
	ctx.restore()
	ctx.beginPath()
	ctx.arc(cx, cy, r, 0, Math.PI * 2)
	ctx.lineWidth = r * 0.04
	ctx.strokeStyle = color
	ctx.stroke()
}

function drawBrand(ctx, x, y, size, date, rightX) {
	ctx.save()
	ctx.translate(x, y)
	ctx.scale(size / 30, size / 30)
	ctx.fillStyle = C.blue
	ctx.fill(new Path2D(LOGO_PATH))
	ctx.restore()
	ctx.textBaseline = 'middle'
	ctx.textAlign = 'left'
	ctx.fillStyle = C.txt
	ctx.font = font(700, Math.round(size * 0.75))
	ctx.fillText('AdBlockTest', x + size * 1.3, y + size / 2)
	ctx.textAlign = 'right'
	ctx.fillStyle = C.muted
	fitFont(ctx, date, 500, Math.round(size * 0.55), rightX - x - size * 7)
	ctx.fillText(date, rightX, y + size / 2)
	ctx.textBaseline = 'alphabetic'
}

// Category rows in columns, filled top to bottom.
function drawRows(ctx, rows, x, y, colW, gap, rowH, perCol, size) {
	ctx.textAlign = 'left'
	rows.forEach((row, i) => {
		const rx = x + Math.floor(i / perCol) * (colW + gap)
		const ry = y + (i % perCol) * rowH
		const count = row.blocked + '/' + row.total
		ctx.font = font(600, size)
		const countW = ctx.measureText(count).width
		ctx.fillStyle = C.muted
		ctx.textAlign = 'right'
		ctx.fillText(count, rx + colW, ry)
		ctx.textAlign = 'left'
		ctx.fillStyle = C.txt
		fitFont(ctx, row.label, 500, size, colW - countW - 16)
		ctx.fillText(row.label, rx, ry)
		const ratio = row.total ? row.blocked / row.total : 0
		const by = ry + size * 0.5
		const bh = Math.max(6, Math.round(size * 0.28))
		bar(ctx, rx, by, colW, bh, C.bg2)
		if (ratio > 0)
			bar(ctx, rx, by, colW * ratio, bh, scoreColor(ratio * 100))
	})
}

function drawFooter(ctx, x, y, size, align) {
	const lead = 'Test yours at '
	const site = 'adblock.turtlecute.org'
	ctx.font = font(500, size)
	const leadW = ctx.measureText(lead).width
	ctx.font = font(700, size)
	const siteW = ctx.measureText(site).width
	const start = align === 'center' ? x - (leadW + siteW) / 2 : x
	ctx.textAlign = 'left'
	ctx.font = font(500, size)
	ctx.fillStyle = C.muted
	ctx.fillText(lead, start, y)
	ctx.font = font(700, size)
	ctx.fillStyle = C.blue
	ctx.fillText(site, start + leadW, y)
}

function drawCard(canvas, d, format) {
	const { width: W, height: H } = FORMATS[format]
	canvas.width = W
	canvas.height = H
	const ctx = canvas.getContext('2d')
	const color = scoreColor(d.percent)
	const pct = Math.round(d.percent) + '%'
	const checks = d.blocked + ' of ' + d.total + ' checks blocked'

	const bg = ctx.createLinearGradient(0, 0, W, H)
	bg.addColorStop(0, C.bg)
	bg.addColorStop(1, '#0b1220')
	ctx.fillStyle = bg
	ctx.fillRect(0, 0, W, H)

	if (format === 'landscape') {
		const P = 56
		const cx = 230
		const cy = 290
		const r = 145
		const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2)
		glow.addColorStop(0, color + '33')
		glow.addColorStop(1, color + '00')
		ctx.fillStyle = glow
		ctx.fillRect(0, 0, W, H)
		drawBrand(ctx, P, 52, 40, d.date, W - P)
		drawBall(ctx, cx, cy, r, d.percent, color)
		const tx = 440
		const tw = W - P - tx
		ctx.textAlign = 'left'
		ctx.fillStyle = C.muted
		ctx.font = font(700, 22)
		ctx.fillText('MY AD BLOCKER SCORE', tx, 180)
		ctx.fillStyle = color
		ctx.font = font(800, 150)
		ctx.fillText(pct, tx - 6, 320)
		ctx.fillStyle = C.txt
		fitFont(ctx, verdict(d.percent), 700, 36, tw)
		ctx.fillText(verdict(d.percent), tx, 372)
		ctx.fillStyle = C.muted
		ctx.font = font(500, 24)
		ctx.fillText(checks, tx, 410)
		drawRows(ctx, d.rows, P, 476, (W - 2 * P - 48) / 2, 48, 36, 4, 20)
		drawFooter(ctx, P, 645, 22, 'left')
	} else {
		const P = 72
		const cx = W / 2
		const cy = 420
		const r = 210
		const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2)
		glow.addColorStop(0, color + '33')
		glow.addColorStop(1, color + '00')
		ctx.fillStyle = glow
		ctx.fillRect(0, 0, W, H)
		drawBrand(ctx, P, 72, 48, d.date, W - P)
		drawBall(ctx, cx, cy, r, d.percent, color)
		ctx.textAlign = 'center'
		ctx.fillStyle = C.muted
		ctx.font = font(700, 26)
		ctx.fillText('MY AD BLOCKER SCORE', cx, 720)
		ctx.fillStyle = color
		ctx.font = font(800, 180)
		ctx.fillText(pct, cx, 885)
		ctx.fillStyle = C.txt
		fitFont(ctx, verdict(d.percent), 700, 44, W - 2 * P)
		ctx.fillText(verdict(d.percent), cx, 955)
		ctx.fillStyle = C.muted
		ctx.font = font(500, 28)
		ctx.fillText(checks, cx, 1003)
		drawRows(ctx, d.rows, P, 1075, (W - 2 * P - 48) / 2, 48, 50, 4, 24)
		drawFooter(ctx, cx, 1295, 28, 'center')
	}
}

export class ShareDialog {
	// getData() returns { percent, blocked, total, rows, date }.
	// notify(message) and onError(message) show a toast.
	constructor(el, { getData, notify, onError }) {
		this.el = el
		this.getData = getData
		this.notify = notify
		this.onError = onError
		// Returns the instance the dialog component already made on load.
		this.dialog = new A11yDialog(el)
		this.format = 'landscape'
		this.platform = 'x'
		this.cache = {}
		// Shapes already downloaded. Chrome asks before a page downloads a
		// second time, so Post does not download the same image again.
		this.saved = {}
		this.preview = el.querySelector('.share_preview')
		this.img = el.querySelector('.sp_img')
		this.caption = el.querySelector('.sp_caption')
		this.name = el.querySelector('.sp_name')
		this.meta = el.querySelector('.sp_meta')
		this.download = el.querySelector('#share_download')
		this.native = el.querySelector('#share_native')
		this.post = el.querySelector('#share_post')
		this.hint = el.querySelector('.share_hint')
		el.querySelectorAll('[data-format]').forEach((b) =>
			b.addEventListener('click', () => {
				this.format = b.dataset.format
				this.update()
			})
		)
		el.querySelectorAll('[data-platform]').forEach((b) =>
			b.addEventListener('click', () => {
				this.platform = b.dataset.platform
				this.update()
			})
		)
		this.download.addEventListener('click', () => this.save())
		this.native.addEventListener('click', () => this.shareFile())
		this.post.addEventListener('click', () => this.postTo())
	}

	open() {
		// The result is fixed for this page load: Re-test reloads the page.
		if (!this.data) {
			this.data = this.getData()
			const canonical = document.querySelector('link[rel="canonical"]')
			this.url = canonical
				? canonical.href
				: location.origin + location.pathname
			this.headline =
				'My ad blocker scored ' +
				Math.round(this.data.percent) +
				'% on AdBlockTest.'
			this.text = this.headline + ' Test yours: ' + this.url
			this.caption.textContent = this.text
			this.img.alt =
				'AdBlockTest result: ' +
				Math.round(this.data.percent) +
				'%, ' +
				this.data.blocked +
				' of ' +
				this.data.total +
				' checks blocked'
		}
		this.update()
		this.dialog.show()
	}

	render(format) {
		if (!this.cache[format]) {
			this.cache[format] = new Promise((resolve, reject) => {
				const canvas = document.createElement('canvas')
				drawCard(canvas, this.data, format)
				canvas.toBlob((blob) => {
					if (!blob) return reject(new Error('toBlob failed'))
					const name =
						'adblocktest-' +
						Math.round(this.data.percent) +
						'-' +
						format +
						'.png'
					resolve({
						blob,
						name,
						url: URL.createObjectURL(blob),
						file:
							typeof File === 'function'
								? new File([blob], name, { type: 'image/png' })
								: null
					})
				}, 'image/png')
			})
		}
		return this.cache[format]
	}

	async update() {
		const format = this.format
		this.el
			.querySelectorAll('[data-format]')
			.forEach((b) =>
				b.setAttribute(
					'aria-pressed',
					String(b.dataset.format === format)
				)
			)
		this.el
			.querySelectorAll('[data-platform]')
			.forEach((b) =>
				b.setAttribute(
					'aria-pressed',
					String(b.dataset.platform === this.platform)
				)
			)
		const p = PLATFORMS[this.platform]
		this.preview.dataset.platform = this.platform
		this.preview.dataset.format = format
		this.name.textContent = p.name
		this.meta.textContent = p.meta
		this.post.hidden = !p.post
		this.post.textContent = 'Post on ' + p.label
		this.post.dataset.umamiEventPlatform = this.platform
		this.hint.textContent = p.post
			? 'Post opens ' +
			  p.label +
			  ' with the text ready and downloads the image. Attach the image to your post.'
			: 'Instagram has no share link. Download the image and post it from the app, or use Share image on your phone.'
		this.img.width = FORMATS[format].width
		this.img.height = FORMATS[format].height
		this.download.disabled = true
		try {
			const entry = await this.render(format)
			if (this.format !== format) return
			this.img.src = entry.url
			this.download.disabled = false
			// Phones (and some desktops) can pass the image straight to an app.
			this.native.hidden = !(
				entry.file &&
				navigator.canShare &&
				navigator.canShare({ files: [entry.file] })
			)
		} catch (err) {
			this.onError('Could not draw the image')
		}
	}

	async save() {
		const format = this.format
		const entry = await this.render(format)
		this.saved[format] = true
		const a = document.createElement('a')
		a.href = entry.url
		a.download = entry.name
		document.body.appendChild(a)
		a.click()
		a.remove()
	}

	postTo() {
		const p = PLATFORMS[this.platform]
		if (!p.post) return
		// Opened first and in the click itself, so no popup blocker stops it.
		window.open(
			p.post(this.headline, this.url),
			'_blank',
			'noopener,noreferrer'
		)
		if (this.saved[this.format]) {
			this.notify(
				'Attach the image you downloaded to your post on ' +
					p.label +
					'.'
			)
			return
		}
		this.save().then(
			() =>
				this.notify(
					'Image downloaded. Attach it to your post on ' +
						p.label +
						'.'
				),
			() => this.onError('Could not save the image')
		)
	}

	async shareFile() {
		const entry = await this.render(this.format)
		try {
			await navigator.share({ files: [entry.file], text: this.text })
		} catch (err) {
			// Closing the share sheet is a choice, not an error.
			if (err && err.name !== 'AbortError')
				this.onError('Could not open the share sheet')
		}
	}
}
