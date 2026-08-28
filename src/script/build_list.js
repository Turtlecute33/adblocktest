const https = require('https')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const HOST_TIMEOUT_MS = 5000
function center(s, max, c) {
	return s
		.padStart(s.length + Math.floor((max - s.length) / 2), c)
		.padEnd(max, c)
}
const header = (entries, date, comment) => {
	let ext = comment === '#' ? '.txt' : '.adblock'
	// A hosts file can only answer the Host category. Claiming it covers "all the
	// tests" is the single most-quoted piece of evidence against this tool: people
	// add the list, still score ~60%, and conclude the test is broken. The adblock
	// syntax build does cover everything, because it also ships the cosmetic and
	// script rules appended in list().
	let coverage =
		comment === '#'
			? ' Covers the Host category of https://adblock.turtlecute.org — a hosts file cannot pass the cosmetic filter or ad script checks. Pair it with a browser extension for a full score.\n'
			: ' Covers every category on https://adblock.turtlecute.org, including the cosmetic filter and ad script checks.\n'
	return (
		comment +
		' Title: Turtlecute Host List\n' +
		comment +
		' Expires: 1 days\n' +
		comment +
		' Description: Simple and small list with the most popular advertising, tracking, analytics and social advertising services\n' +
		comment +
		' Homepage: https://adblock.turtlecute.org\n' +
		comment +
		' License: CC BY-NC-SA\n' +
		comment +
		' Source: https://adblock.turtlecute.org/d3host' +
		ext +
		'\n\n' +
		comment +
		coverage +
		comment +
		' Type : Stable\n' +
		comment +
		' Entries : ' +
		entries +
		'\n' +
		comment +
		' Updated On: ' +
		date +
		'\n' +
		comment +
		' Created by: Turtlecute'
	)
}
function collectHosts(obj) {
	let hosts = []
	Object.keys(obj).forEach((category) => {
		let value = obj[category]
		Object.keys(value).forEach((key) => {
			let value2 = value[key]
			if (value2) hosts.push(...value2)
		})
	})
	return hosts
}
function probeHost(host) {
	return new Promise((resolve) => {
		const req = https.get('https://' + host, (res) => {
			res.resume()
			resolve({ host, statusCode: res.statusCode })
		})
		req.setTimeout(HOST_TIMEOUT_MS, () => {
			req.destroy(new Error('timeout'))
		})
		req.on('error', (error) => {
			resolve({ host, error })
		})
	})
}
async function validateHosts(obj) {
	const results = await Promise.all(
		collectHosts(obj).map((host) => probeHost(host))
	)
	let hasFailures = false
	results.forEach((result) => {
		if (result.error) {
			console.error(chalk.red(`${result.host}: ${result.error.message}`))
			hasFailures = true
			return
		}
		if (result.statusCode >= 200 && result.statusCode < 300) {
			console.log(chalk.green(`${result.host}: ${result.statusCode}`))
		} else if (result.statusCode >= 300 && result.statusCode < 400) {
			console.log(chalk.blue(`${result.host}: ${result.statusCode}`))
		} else {
			console.log(chalk.yellow(`${result.host}: ${result.statusCode}`))
			hasFailures = true
		}
	})
	return !hasFailures
}
function build(obj, comment, pre, post) {
	let txt = ''
	let entries = 0
	Object.keys(obj).forEach((category) => {
		let value = obj[category]
		txt += '\n\n' + comment + center(' ' + category + ' ', 30, '=') + '\n'
		Object.keys(value).forEach((key) => {
			let value2 = value[key]
			txt += '\n' + comment + ' --- ' + key + '\n'
			if (value2)
				value2.forEach((v) => {
					entries++
					txt += pre + v + post + '\n'
				})
		})
	})
	if (pre === '||')
		txt +=
			'\n*$3p,domain=adblock.turtlecute.org\n/pagead.js$domain=adblock.turtlecute.org\n@@*$redirect-rule,domain=adblock.turtlecute.org\nadblock.turtlecute.org##.textads'
	const date = new Date()
	const d =
		date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear()
	return header(entries, d, comment) + txt
}
async function write(output, input) {
	await fs.promises.writeFile(output, input, { encoding: 'utf8' })
	console.log('Created \n' + output)
}
fs.readFile(
	path.resolve(__dirname, '../data/adblock_data.json'),
	'utf8',
	async (err, jsonString) => {
		if (err) {
			console.log('Error reading file from disk:', err)
			return
		}
		try {
			const obj = JSON.parse(jsonString)
			const validationPassed = await validateHosts(obj)
			await write(
				path.resolve(__dirname, '../d3host.txt'),
				build(obj, '#', '0.0.0.0 ', '')
			)
			await write(
				path.resolve(__dirname, '../d3host.adblock'),
				build(obj, '!', '||', '^')
			)
			if (!validationPassed) process.exitCode = 1
		} catch (err) {
			console.log('Error parsing JSON string:', err)
		}
	}
)
