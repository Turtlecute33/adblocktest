// Share dialog: draws the result as an image, landscape or portrait, and
// lets the visitor download it. Everything is drawn here in the browser: no
// image service, no upload, no request leaves the page.
import A11yDialog from './dialog'

const FONT =
	'-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
// The dark theme palette, fixed so the image looks the same in either theme.
const C = {
	bg: '#111827',
	line: '#4b5563',
	txt: '#ffffff',
	muted: '#9ca3af',
	green: '#22C55E',
	orange: '#FF851B',
	red: '#FF4132',
	blue: '#1492FF'
}
// Landscape is 16:9. Portrait is 4:5, the tallest shape most feeds show
// without a crop. The layout uses these sizes; the image has SCALE times
// the pixels, so it stays sharp on high-density screens.
const FORMATS = {
	landscape: { width: 1200, height: 675 },
	portrait: { width: 1080, height: 1350 }
}
const SCALE = 2
// The header logo (viewBox 0 0 30 30).
const LOGO_PATH =
	'M12.787 29.698c-2.052-1.173-5.508-4.364-7.216-6.664C1.848 18.021-.01 12.477 0 6.418c.005-2.713.165-3.071 1.69-3.776C4.147 1.507 6.935.68 9.827.23c1.967-.307 5.99-.307 7.956 0 3.814.594 8.5 2.205 9.35 3.213.455.542.53 1.201.442 3.903-.077 2.353-.264 3.7-.815 5.891-1.476 5.862-4.997 11.208-9.906 15.04-2.287 1.786-2.996 2.034-4.067 1.421zm1.748-1.842c1.52-1.031 3.765-3.136 5.155-4.832 3.852-4.703 6.089-10.982 6.098-17.124.002-1.364-.046-1.426-1.584-2.038-3.637-1.449-6.481-2.001-10.334-2.007-3.798-.005-6.664.524-10.19 1.88-1.704.655-1.86.837-1.86 2.174.001 6.13 2.232 12.383 6.111 17.13 1.785 2.184 5.173 5.16 5.874 5.16.123 0 .452-.154.73-.343zm-1.928-2.936c-1.83-1.503-4.388-4.402-5.077-5.754-.297-.58-.245-1.232.123-1.542.124-.105.656-.38 1.182-.61l.957-.418.583.537c1.743 1.606 4.489 1.874 6.446.63 1.317-.839 2.356-2.353 2.541-3.704.077-.558.086-.567.745-.712 2.384-.524 2.799-.212 2.118 1.595-1.327 3.523-3.821 7.049-6.765 9.563-1.57 1.34-1.703 1.36-2.853.415zm-6.975-9.816c-.599-.42-1.502-4.042-1.737-6.962-.174-2.17-.108-2.314 1.31-2.86 2.765-1.063 5.24-1.492 8.6-1.492 3.368 0 5.835.429 8.617 1.5 1.382.53 1.489.761 1.306 2.829-.18 2.044-.21 2.07-2.734 2.486-1.02.168-1.872.282-1.892.254a49.76 49.76 0 01-.46-.724c-2.405-3.834-7.973-3.35-9.713.846-.166.403-.277 1.065-.326 1.95l-.074 1.34-1.166.516c-1.321.585-1.342.589-1.73.317z'
// The same ranges as the score ball and the FAQ.
function scoreColor(p) {
	return p > 30 ? (p > 60 ? C.green : C.orange) : C.red
}

function font(weight, size) {
	return weight + ' ' + size + 'px ' + FONT
}
// Shrinks the font until the text fits, so a long score cannot run off the
// card.
function fitFont(ctx, text, weight, size, maxWidth) {
	let s = size
	ctx.font = font(weight, s)
	while (s > 12 && ctx.measureText(text).width > maxWidth) {
		s -= 2
		ctx.font = font(weight, s)
	}
	return s
}
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath()
	if (ctx.roundRect) ctx.roundRect(x, y, w, h, r)
	else ctx.rect(x, y, w, h)
}

// One square per check, in rows of `cols`. A square is three quarters of
// the pitch. The pitch gets smaller if a longer list does not fit.
function gridSize(total, cols, maxW, maxH, maxPitch) {
	const rows = Math.ceil(total / cols)
	const pitch = Math.min(maxPitch, maxW / (cols - 0.25), maxH / (rows - 0.25))
	return {
		cols,
		pitch,
		width: pitch * (cols - 0.25),
		height: pitch * (rows - 0.25)
	}
}
// Blocked checks first, as filled squares; the misses as outlines.
function drawGrid(ctx, x, y, g, d, color) {
	const cell = g.pitch * 0.75
	const r = cell * 0.22
	const lw = Math.max(2, cell * 0.07)
	for (let i = 0; i < d.total; i++) {
		const cx = x + (i % g.cols) * g.pitch
		const cy = y + Math.floor(i / g.cols) * g.pitch
		if (i < d.blocked) {
			ctx.fillStyle = color
			roundRect(ctx, cx, cy, cell, cell, r)
			ctx.fill()
		} else {
			ctx.strokeStyle = C.line
			ctx.lineWidth = lw
			roundRect(ctx, cx + lw / 2, cy + lw / 2, cell - lw, cell - lw, r)
			ctx.stroke()
		}
	}
}

// The logo and the site address, centred on y.
function drawLink(ctx, x, y, size) {
	ctx.save()
	ctx.translate(x, y - size / 2)
	ctx.scale(size / 30, size / 30)
	ctx.fillStyle = C.blue
	ctx.fill(new Path2D(LOGO_PATH))
	ctx.restore()
	ctx.textAlign = 'left'
	ctx.textBaseline = 'middle'
	ctx.fillStyle = C.muted
	ctx.font = font(500, Math.round(size * 0.78))
	ctx.fillText('adblock.turtlecute.org', x + size * 1.4, y)
	ctx.textBaseline = 'alphabetic'
}

// The score, then two lines under it, left aligned at x. y is the baseline
// of the score.
function drawScore(ctx, d, x, y, size, maxW, lineSize, lineGap) {
	ctx.textAlign = 'left'
	ctx.textBaseline = 'alphabetic'
	ctx.fillStyle = scoreColor(d.percent)
	fitFont(ctx, Math.round(d.percent) + '%', 800, size, maxW)
	ctx.fillText(Math.round(d.percent) + '%', x - size * 0.04, y)
	ctx.fillStyle = C.txt
	ctx.font = font(600, lineSize)
	ctx.fillText(d.blocked + ' of ' + d.total + ' ad and', x, y + lineGap)
	ctx.fillText(
		'tracker checks blocked',
		x,
		y + lineGap + Math.round(lineSize * 1.24)
	)
}

function drawCard(canvas, d, format) {
	const { width: W, height: H } = FORMATS[format]
	canvas.width = W * SCALE
	canvas.height = H * SCALE
	const ctx = canvas.getContext('2d')
	ctx.scale(SCALE, SCALE)
	const color = scoreColor(d.percent)
	const P = 88

	ctx.fillStyle = C.bg
	ctx.fillRect(0, 0, W, H)

	if (format === 'landscape') {
		// Text on the left, the grid on the right; the link sits on the
		// grid's bottom line.
		const g = gridSize(d.total, 13, 460, H - 2 * P, 36)
		const gx = W - P - g.width
		const gy = (H - g.height) / 2
		drawGrid(ctx, gx, gy, g, d, color)
		drawScore(ctx, d, P, gy + 150, 190, gx - P - 56, 34, 72)
		drawLink(ctx, P, gy + g.height - 19, 38)
	} else {
		// Text on top, the grid across the middle, the link at the bottom.
		drawScore(ctx, d, P, P + 172, 240, W - 2 * P, 44, 80)
		const linkY = H - P - 23
		const top = P + 172 + 80 + 55 + 64
		const bottom = linkY - 23 - 64
		const g = gridSize(d.total, 13, W - 2 * P, bottom - top, 80)
		drawGrid(
			ctx,
			(W - g.width) / 2,
			top + (bottom - top - g.height) / 2,
			g,
			d,
			color
		)
		drawLink(ctx, P, linkY, 46)
	}
}

export class ShareDialog {
	// getData() returns { percent, blocked, total }.
	// onError(message) shows a toast.
	constructor(el, { getData, onError }) {
		this.el = el
		this.getData = getData
		this.onError = onError
		// Returns the instance the dialog component already made on load.
		this.dialog = new A11yDialog(el)
		this.format = 'landscape'
		this.cache = {}
		this.preview = el.querySelector('.share_preview')
		this.img = el.querySelector('.share_img')
		this.download = el.querySelector('#share_download')
		el.querySelectorAll('[data-format]').forEach((b) =>
			b.addEventListener('click', () => {
				this.format = b.dataset.format
				this.update()
			})
		)
		this.download.addEventListener('click', () => this.save())
	}

	open() {
		// The result is fixed for this page load: Re-test reloads the page.
		if (!this.data) {
			this.data = this.getData()
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
					resolve({
						url: URL.createObjectURL(blob),
						name:
							'adblocktest-' +
							Math.round(this.data.percent) +
							'-' +
							format +
							'.png'
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
		this.preview.dataset.format = format
		this.img.width = FORMATS[format].width
		this.img.height = FORMATS[format].height
		this.download.disabled = true
		try {
			const entry = await this.render(format)
			if (this.format !== format) return
			this.img.src = entry.url
			this.download.disabled = false
		} catch (err) {
			this.onError('Could not draw the image')
		}
	}

	async save() {
		const entry = await this.render(this.format)
		const a = document.createElement('a')
		a.href = entry.url
		a.download = entry.name
		document.body.appendChild(a)
		a.click()
		a.remove()
	}
}
