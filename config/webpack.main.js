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
		}, {})
	},
	output: {
		filename: 'js/[name].js',
		// The sponsor creative is an async chunk (see js/components/sponsor.js),
		// so its request URL is a content hash that changes on every deploy and
		// carries no word worth writing a network rule against. Not under js/:
		// the lists block ||adblock.turtlecute.org/js/*ad, and a hex hash can
		// contain "ad".
		chunkFilename: '[contenthash].js',
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
				use: ['html-loader', 'template-ejs-loader']
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
