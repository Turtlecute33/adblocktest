const HTMLWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const config = require('./config')
const pages = config.pages

module.exports = {
	context: config.src,
	entry: {
		...pages.reduce((acc, page) => {
			acc[page] = `./js/${page}.js`
			return acc
		}, {}),
		// Two extra chunks that exist only to emit css/banner_wide.css and
		// css/banner_narrow.css. The sponsor creative is base64 in CSS (no
		// blockable request URL), and splitting it per breakpoint means a visitor
		// downloads one creative instead of both. They are not in `pages`, so
		// HTMLWebpackPlugin does not inject them and purgecss does not touch them;
		// head.ejs links them with media queries. Their stub JS bundles are
		// deleted after the build by config/purgecss.mjs.
		banner_wide: './js/banner_wide.js',
		banner_narrow: './js/banner_narrow.js'
	},
	output: {
		filename: 'js/[name].js',
		path: config.build,
		clean: false,
		assetModuleFilename: '[path][name][ext]',
		publicPath: '/'
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{
					from: './robots.txt',
					to: 'robots.txt'
				},
				{
					from: './sitemap.xml',
					to: 'sitemap.xml'
				},
				{
					from: './assets',
					to: 'assets',
					globOptions: {
						ignore: [
							'*.DS_Store',
							'**/css/*.css',
							'**/js/*.js',
							'**/*.html'
						]
					},
					noErrorOnMissing: true
				},
				{
					from: './js/pagead.js',
					to: 'js/pagead.js'
				},
				{
					from: './js/widget/ads.js',
					to: 'js/widget/ads.js'
				},
				// Served from this domain so the lists people paste into Pi-hole,
				// uBlock and OISD cite adblock.turtlecute.org rather than a
				// raw.githubusercontent.com path tied to one repository name.
				{
					from: './d3host.txt',
					to: 'd3host.txt'
				},
				{
					from: './d3host.adblock',
					to: 'd3host.adblock'
				}
			]
		}),
		new MiniCssExtractPlugin({
			filename: 'css/[name].css',
			chunkFilename: '[name].css'
		}),
		...pages.map(
			(page) =>
				new HTMLWebpackPlugin({
					template: `./${page}.ejs`,
					filename: `${page}.html`,
					chunks: [page],
					minify: {
						collapseWhitespace: true,
						removeComments: true,
						removeRedundantAttributes: true,
						removeScriptTypeAttributes: true,
						removeStyleLinkTypeAttributes: true,
						useShortDoctype: true,
						minifyCSS: true,
						minifyJS: true
					},
					sources: false
				})
		)
	],
	module: {
		rules: [
			{
				test: /\.(png|svg|jpg|jpeg|gif)$/i,
				type: 'asset/resource'
			},
			{
				test: /\.webp$/i,
				type: 'asset/inline'
			},
			{
				test: /\.ejs$/i,
				use: [
					{
						loader: 'html-loader',
						options: {
							sources: {
								// The banner stylesheets are emitted by their own
								// webpack entries, so they do not exist yet when
								// html-loader walks the template. Everything else
								// (the favicon path, for one) still resolves.
								urlFilter: (attribute, value) =>
									!/^\/css\/banner_/.test(value)
							}
						}
					},
					'template-ejs-loader'
				]
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: 'babel-loader'
			},
			{
				test: /\.(sa|sc|c)ss$/,
				use: [
					MiniCssExtractPlugin.loader, // Extract CSS from commonjs
					'css-loader', // Turn css into commonjs
					{
						loader: 'sass-loader',
						options: {
							api: 'modern'
						}
					}
				]
			}
		]
	}
}
