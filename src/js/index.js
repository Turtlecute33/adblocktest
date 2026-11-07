import '../sass/index.sass'
import data from '../data/adblock_data.json'
import CATEGORY_LABELS from '../data/category_labels.json'
import { icons } from '../data/icons'
import { navbar } from './components/navbar'
// Imported for its side effect: it wires up every [data-a11y-dialog] on load.
import './components/dialog'
import { themeManager } from './components/themeManager'
import { gotop } from './components/gotop'
import { aos } from './components/aos'
import { fadeIn, fadeOut } from './components/fade'
import { Snackbar } from './components/snackbar'
import { Sponsor } from './components/sponsor'
import { ShareDialog } from './components/share'

// These icons always accompany visible text, so exposing them as unnamed
// images only adds noise and creates invalid accessibility-tree entries.
Object.keys(icons).forEach((key) => {
	icons[key] = icons[key]
		.replace(/\srole=(['"])img\1/g, '')
		.replace('<svg ', "<svg aria-hidden='true' focusable='false' ")
})

// The cosmetic and script checks: two of each.
const PAGE_CHECKS = 4
const HOST_FETCH_TIMEOUT_MS = 8000
const HOST_FETCH_CONCURRENCY = 50
// Gecko on macOS stalls when many blocked requests are in flight at once, so it
// gets a smaller window and a shorter timeout. Concurrency 1 was too defensive:
// with 128 hosts and a 2.5 s timeout it took minutes to reach a verdict on a
// blackhole resolver, which is exactly the Pi-hole/AdGuard Home setup this test
// is used to check. Six keeps the stall away and bounds the run to ~1 minute.
const FIREFOX_MAC_HOST_FETCH_TIMEOUT_MS = 2500
const FIREFOX_MAC_HOST_FETCH_CONCURRENCY = 6
const TASK_YIELD_INTERVAL = 10
const FIREFOX_MAC_TASK_YIELD_INTERVAL = 5
// The page is scroll-locked only while the cosmetic and script checks measure
// element geometry. That window is ~1.2 s; the cap is a backstop so a hanging
// measurement can never leave the page unscrollable.
const SCROLL_LOCK_MAX_MS = 2500

function waitForNextPaint() {
	return new Promise((resolve) => {
		requestAnimationFrame(() => setTimeout(resolve, 0))
	})
}

async function runTasksWithConcurrency(
	tasks,
	limit = HOST_FETCH_CONCURRENCY,
	yieldInterval = TASK_YIELD_INTERVAL
) {
	if (tasks.length === 0) return
	let index = 0
	let completed = 0
	const workers = Array.from(
		{ length: Math.min(limit, tasks.length) },
		async () => {
			while (index < tasks.length) {
				const taskIndex = index++
				await tasks[taskIndex]()
				completed += 1
				if (completed % yieldInterval === 0) {
					await waitForNextPaint()
				}
			}
		}
	)
	await Promise.all(workers)
}

function isFirefoxBasedMac() {
	const ua = navigator.userAgent || ''
	const platform = navigator.platform || ''
	// Every iOS user agent contains the literal "like Mac OS X", and Firefox for
	// iOS reports "FxiOS/". Without this guard both of those match and iPhones
	// and iPads get throttled to the Gecko workaround, which they do not need:
	// Firefox on iOS is WebKit and cannot have the Gecko stall.
	const isIOS = /iPhone|iPad|iPod|FxiOS|CriOS|EdgiOS/.test(ua)
	if (isIOS) return false
	const isFirefoxFamily =
		/\b(Firefox|Waterfox|LibreWolf|IceCat|PaleMoon)\//.test(ua)
	const isGecko =
		/\bGecko\/\d/.test(ua) &&
		!/AppleWebKit|Chrome|Chromium|Edg|OPR|Safari/.test(ua)
	const isMac =
		/MacIntel|MacPPC|Mac68K/.test(platform) || /Macintosh/.test(ua)

	return (isFirefoxFamily || isGecko) && isMac
}

function getHostFetchConcurrency() {
	return isFirefoxBasedMac()
		? FIREFOX_MAC_HOST_FETCH_CONCURRENCY
		: HOST_FETCH_CONCURRENCY
}

function getHostFetchTimeout() {
	return isFirefoxBasedMac()
		? FIREFOX_MAC_HOST_FETCH_TIMEOUT_MS
		: HOST_FETCH_TIMEOUT_MS
}

function getTaskYieldInterval() {
	return isFirefoxBasedMac()
		? FIREFOX_MAC_TASK_YIELD_INTERVAL
		: TASK_YIELD_INTERVAL
}

// Earlier versions kept the last 10 results, the settings and a changelog
// version in localStorage. Nothing reads them now, so remove them from the
// visitor's browser instead of leaving them there for good.
try {
	localStorage.removeItem('adb_tool')
	localStorage.removeItem('toolz')
} catch (e) {
	/* localStorage unavailable */
}

function resetTestState() {
	abt.total = 0
	abt.blocked = 0
	abt.notblocked = 0
	abt.cosmetic_test.static = null
	abt.cosmetic_test.dynamic = null
	abt.script.ads = null
	abt.script.pagead = null
	abt.hosts = {}
}
const snackbar = new Snackbar({
	topPos: '10px',
	classNames: 'success',
	autoClose: true,
	autoCloseTimeout: 2000
})
async function copyToClip(str, message = 'URL copied to clipboard') {
	try {
		await navigator.clipboard.writeText(str)
		snackbar.show(message)
	} catch (err) {
		const txt = document.createElement('textarea')
		txt.value = str
		txt.setAttribute('readonly', '')
		txt.style.position = 'absolute'
		txt.style.left = '-9999px'
		document.body.appendChild(txt)

		txt.select()
		txt.setSelectionRange(0, 99999)
		const copied = document.execCommand('copy')
		txt.remove()
		if (!copied) throw err
		snackbar.show(message)
	}
}
let abt = {
	total: 0,
	blocked: 0,
	notblocked: 0,
	cosmetic_test: {
		static: null,
		dynamic: null
	},
	script: {
		ads: null,
		pagead: null
	},
	hosts: {}
}
const testWrapper = document.getElementById('test')

// Pre-calculate total test count from data to avoid race conditions (#5)
function countTotalTests() {
	let count = 0
	Object.keys(data).forEach((key) => {
		const category = data[key]
		Object.keys(category).forEach((keyC) => {
			if (Object.prototype.hasOwnProperty.call(category, keyC)) {
				count += category[keyC].length
			}
		})
	})
	return count
}

function fetchWithTimeout(resource, config, timeoutMs) {
	if (typeof AbortController !== 'undefined') {
		const controller = new AbortController()
		const abortTimeout = setTimeout(() => {
			controller.abort()
		}, timeoutMs)
		return fetch(resource, {
			...config,
			signal: controller.signal
		}).finally(() => {
			clearTimeout(abortTimeout)
		})
	}

	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			const timeoutError = new Error('timeout')
			timeoutError.name = 'TimeoutError'
			reject(timeoutError)
		}, timeoutMs)

		fetch(resource, config)
			.then((response) => {
				clearTimeout(timeout)
				resolve(response)
			})
			.catch((error) => {
				clearTimeout(timeout)
				reject(error)
			})
	})
}

function markUnknownHost(url, hostDiv, parent, k1, k2) {
	hostDiv.innerHTML = icons['v']
	const urlSpan = document.createElement('span')
	urlSpan.textContent = url
	hostDiv.appendChild(urlSpan)
	abt.blocked += 1
	Object.assign(abt.hosts[k1][k2], { [url]: true })
}

//Function to check a host blocking status
async function check_url(url, div, parent, k1, k2) {
	const config = {
		method: 'HEAD',
		mode: 'no-cors'
	}
	const hostDiv = document.createElement('div')
	hostDiv.onclick = () => {
		copyToClip(url)
	}
	div.appendChild(hostDiv)
	const urlSpan = document.createElement('span')
	urlSpan.textContent = url
	try {
		await fetchWithTimeout(
			'https://' + url + '/fakepage.html',
			config,
			getHostFetchTimeout()
		)
		// With mode: 'no-cors', a successful response is opaque (status 0).
		// Any response means the request was NOT blocked.
		parent.dataset.hasFailure = 'true'
		parent.style.background = 'var(--red)'
		hostDiv.innerHTML = icons['x']
		hostDiv.appendChild(urlSpan)
		abt.notblocked += 1
		Object.assign(abt.hosts[k1][k2], { [url]: false })
	} catch (error) {
		if (
			error &&
			(error.name === 'AbortError' || error.name === 'TimeoutError')
		) {
			markUnknownHost(url, hostDiv, parent, k1, k2)
			return
		}
		hostDiv.innerHTML = icons['v']
		hostDiv.appendChild(urlSpan)
		abt.blocked += 1
		Object.assign(abt.hosts[k1][k2], { [url]: true })
	}
}

// Track elements that already have click listeners
const _clickListenerElements = new WeakSet()

//Function to collapse a test
function collapse_category(cc, c) {
	const others = document.querySelectorAll('.test_collapse')
	others.forEach((element) => {
		if (cc === true) element.parentElement.classList.add('show')
		else element.parentElement.classList.remove('show')
		if (c === true && !_clickListenerElements.has(element)) {
			_clickListenerElements.add(element)
			element.addEventListener('click', () => {
				element.parentElement.classList.toggle('show')
			})
		}
	})
}

// Function to fetch all the tests
async function fetchTests() {
	let tasks = []
	Object.keys(data).forEach((key) => {
		const catEl = document.createElement('div')
		catEl.className = 'grid'
		catEl.id = key
		// Display label only. The data key stays as-is because it is also the
		// element id and the key stored in saved results.
		catEl.innerHTML =
			'<div><h2>' +
			icons[key] +
			'&nbsp;&nbsp;' +
			(CATEGORY_LABELS[key] || key) +
			'</h2></div>'
		testWrapper.appendChild(catEl)
		const category = data[key]
		abt.hosts[key] = {}
		const dd_left = document.createElement('div')
		dd_left.classList.add('col-6')
		const dd_right = document.createElement('div')
		dd_right.classList.add('col-6')

		catEl.appendChild(dd_left)
		catEl.appendChild(dd_right)
		let i = 0
		Object.keys(category).forEach((keyC) => {
			const div = document.createElement('div')
			const dw = document.createElement('div')
			div.classList.add('test')
			div.id = keyC
			div.style.background = 'var(--green)'
			let tc = icons[keyC] != undefined ? icons[keyC] + '&nbsp;' : ''
			div.innerHTML =
				"<span class='test_collapse'>" + tc + keyC + '</span>'
			div.appendChild(dw)
			if (i % 2 == 0) {
				dd_left.appendChild(div)
			} else {
				dd_right.appendChild(div)
			}
			i++
			Object.assign(abt.hosts[key], { [keyC]: {} })
			if (Object.prototype.hasOwnProperty.call(category, keyC)) {
				const value = category[keyC]
				for (let j = 0; j < value.length; j++) {
					tasks.push(() =>
						check_url(value[j], dw, div, key, keyC).then(() => {
							set_liquid()
						})
					)
				}
			}
		})
	})

	await runTasksWithConcurrency(
		tasks,
		getHostFetchConcurrency(),
		getTaskYieldInterval()
	)
}

function ad_script_test() {
	return new Promise((resolve) => {
		const sfa1 = document.querySelector('#sfa_1')
		const sfa2 = document.querySelector('#sfa_2')

		abt.script.ads = typeof s_test_ads === 'undefined'
		abt.script.pagead = typeof s_test_pagead === 'undefined'
		sfa1.classList.add(abt.script.ads ? '_bg-green' : '_bg-red')
		sfa2.classList.add(abt.script.pagead ? '_bg-green' : '_bg-red')
		abt.blocked += (abt.script.ads ? 1 : 0) + (abt.script.pagead ? 1 : 0)
		abt.notblocked += (abt.script.ads ? 0 : 1) + (abt.script.pagead ? 0 : 1)
		set_liquid()
		resolve()
	})
}
const ctd = document.querySelector('#ctd_test')

//Static — returns a promise so Promise.all can wait for it (#25)
function cosmetic_test_static() {
	return new Promise((resolve) => {
		setTimeout(function () {
			const cts = document.querySelector('#cts_test')
			abt.cosmetic_test.static =
				!cts || !(cts.clientHeight || cts.offsetHeight) ? true : false
			abt.blocked += abt.cosmetic_test.static ? 1 : 0
			abt.notblocked += abt.cosmetic_test.static ? 0 : 1
			document
				.querySelector('#ct_static')
				.classList.add(
					abt.cosmetic_test.static ? '_bg-green' : '_bg-red'
				)
			set_liquid()
			resolve()
		}, 1200)
	})
}
//Dynamic — returns a promise so Promise.all can wait for it (#25)
function cosmetic_test_dynamic() {
	return new Promise((resolve) => {
		const existing = document.querySelector('#ad_ctd')
		if (existing) existing.remove()
		const ad = document.createElement('div')
		ad.id = 'ad_ctd'
		ad.className =
			'textads banner-ads banner_ads ad-unit afs_ads ad-zone ad-space adsbox'
		ad.innerHTML = '&nbsp;'
		ctd.appendChild(ad)
		setTimeout(function () {
			const adt = document.querySelector('#ad_ctd')
			abt.cosmetic_test.dynamic =
				!adt || !(adt.offsetHeight || adt.clientHeight) ? true : false
			abt.blocked += abt.cosmetic_test.dynamic ? 1 : 0
			abt.notblocked += abt.cosmetic_test.dynamic ? 0 : 1
			document
				.querySelector('#ct_dynamic')
				.classList.add(
					abt.cosmetic_test.dynamic ? '_bg-green' : '_bg-red'
				)
			set_liquid()
			resolve()
		}, 1200)
	})
}

const lt_particles = document.querySelector('.lt_particles')
const lt_cwrap = document.querySelector('.lt_cwrap')

let scrollLockTimer = null
function lockScroll() {
	document.body.classList.add('_overflowhidden')
	if (scrollLockTimer) clearTimeout(scrollLockTimer)
	scrollLockTimer = setTimeout(unlockScroll, SCROLL_LOCK_MAX_MS)
}
function unlockScroll() {
	if (scrollLockTimer) {
		clearTimeout(scrollLockTimer)
		scrollLockTimer = null
	}
	document.body.classList.remove('_overflowhidden')
}

async function startAdBlockTesting() {
	lockScroll()
	resetTestState()
	testWrapper.innerHTML = ''
	// Pre-calculate total so percentage doesn't jump (#5)
	abt.total = countTotalTests() + PAGE_CHECKS

	// Make #adb_test visible for measurement (cosmetic tests need offsetHeight)
	document.querySelector('#adb_test').classList.add('measuring')

	document.querySelector('.lt_wrap').classList.add('start')
	lt_cwrap.classList.add('start')
	// Only these checks read element geometry, so only these need the page held
	// still. The host sweep does not, and it is the part that takes seconds.
	const measured = [
		cosmetic_test_static(),
		cosmetic_test_dynamic(),
		ad_script_test()
	]

	// Hand scrolling back the moment the measurement window closes rather than
	// after every host has answered. Both arms release, so a rejected check
	// cannot strand the lock, and it never becomes an unhandled rejection —
	// Promise.all(tests) below is what actually surfaces the error.
	Promise.all(measured).then(unlockScroll, unlockScroll)

	const tests = measured.concat([fetchTests()])
	await Promise.all(tests)
}

function set_liquid() {
	if (abt.total === 0) return
	const p = (100 / abt.total) * abt.blocked
	const c =
		p > 30 ? (p > 60 ? 'var(--green)' : 'var(--orange)') : 'var(--red)'
	document.body.style.setProperty('--liquid-percentage', 45 - p + '%')
	document.body.style.setProperty('--liquid-color', c)
	document.body.style.setProperty(
		'--liquid-title',
		"'" + Math.round(p) + "%'"
	)
}

function stopAdBlockTesting() {
	unlockScroll()
	if (lt_particles) {
		fadeOut(lt_particles, () => {
			document.querySelector('.lt_wrap').classList.remove('start')
			fadeIn(lt_particles, 'flex')
		})
	}
	if (lt_cwrap) lt_cwrap.classList.remove('start')
}

// What the share image shows: the score, and blocked/total per category.
function shareData() {
	const rows = Object.keys(abt.hosts).map((key) => {
		let blocked = 0
		let total = 0
		Object.values(abt.hosts[key]).forEach((group) => {
			Object.values(group).forEach((isBlocked) => {
				total += 1
				if (isBlocked) blocked += 1
			})
		})
		return { label: CATEGORY_LABELS[key] || key, blocked, total }
	})
	const cosmetic = [abt.cosmetic_test.static, abt.cosmetic_test.dynamic]
	const scripts = [abt.script.ads, abt.script.pagead]
	rows.push({
		label: 'Cosmetic filter',
		blocked: cosmetic.filter(Boolean).length,
		total: cosmetic.length
	})
	rows.push({
		label: 'Ad scripts',
		blocked: scripts.filter(Boolean).length,
		total: scripts.length
	})
	return {
		percent: abt.total === 0 ? 0 : (100 / abt.total) * abt.blocked,
		blocked: abt.blocked,
		total: abt.total,
		rows,
		date: new Date().toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	}
}

document.addEventListener('DOMContentLoaded', function () {
	new navbar()
	new themeManager()
	document.querySelectorAll('.theme-toggle').forEach(function (toggle) {
		toggle.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				toggle.click()
			}
		})
	})
	new gotop()
	new aos()
	// Not awaited: the test below is what the visitor came for. A rejection here
	// means the placement could not be built, which is a non-event for the page.
	new Sponsor('.notice_stack').start().catch(() => {})

	const shareButton = document.querySelector('#share_result')
	const shareDialog = new ShareDialog(document.querySelector('#dlg_share'), {
		getData: shareData,
		notify: (message) => snackbar.show(message),
		onError: (message) => snackbar.show(message, 'error')
	})
	shareButton.addEventListener('click', () => shareDialog.open())

	let testRunning = false
	async function runTest() {
		if (testRunning) return
		testRunning = true
		try {
			await startAdBlockTesting()
			collapse_category(true, true)
			const r = document.querySelector('#adb_test_r')
			r.innerHTML =
				'<span>' +
				icons['cdot'] +
				' Total: ' +
				abt.total +
				'</span><span>' +
				icons['v'] +
				' ' +
				abt.blocked +
				' blocked</span><span>' +
				icons['x'] +
				' ' +
				abt.notblocked +
				' not blocked</span>'
			shareButton.disabled = false
		} catch (error) {
			console.error('Ad block test failed:', error)
			snackbar.show('Test failed. Please retry.', 'error')
		} finally {
			stopAdBlockTesting()
			const adbTest = document.querySelector('#adb_test')
			adbTest.classList.remove('measuring')
			fadeIn(adbTest, 'flex')
			testRunning = false
		}
	}

	// Delay test start to allow LCP to complete first
	const startDeferred = () => setTimeout(runTest, 100)
	if ('requestIdleCallback' in window) {
		requestIdleCallback(startDeferred, { timeout: 2000 })
	} else {
		setTimeout(startDeferred, 1000)
	}

	document.querySelector('#start_test').addEventListener('click', () => {
		location.reload()
	})
	// First-party URLs on purpose: these are the addresses people paste into
	// Pi-hole, uBlock and OISD, so they should cite this domain instead of a
	// raw.githubusercontent.com path tied to one repository name.
	document.querySelectorAll('[data-copy]').forEach((el) => {
		el.addEventListener('click', (e) => {
			e.preventDefault()
			copyToClip(el.dataset.copy, el.dataset.copyMessage).catch(() => {
				snackbar.show('Could not copy the address', 'error')
			})
		})
	})
})
