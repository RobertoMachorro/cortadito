import process from 'node:process'
import path from 'node:path'
import debug from 'debug'
import logger from 'morgan'
import express from 'express'
import session from 'express-session'
import RedisStore from 'connect-redis'
import {createClient} from 'redis'

const log = debug('cortadito')
log.log = console.log.bind(console)

class Cortadito {
	constructor() {
		this.app = express()
	}

	validateOptions() {
		if (this.options.listenPort === undefined) {
			throw new TypeError('Listening port must be defined in options.')
		}

		if (this.options.applicationRoot === undefined) {
			this.options.applicationRoot = process.cwd()
		}

		if (this.options.loggerFormat === undefined) {
			this.options.loggerFormat = 'common' // Morgan formats
		}

		if (this.options.viewEngine === undefined) {
			// No view engine, it's an API server
		}

		if (this.options.sessionRedisUrl === undefined || this.options.sessionSecret === undefined) {
			// No session storage, it's an API server
		}

		if (this.options.redirectSecure === undefined) {
			// No secure redirection, it's a development server
		}
	}

	async configure(options) {
		this.options = options
		this.validateOptions()

		// Configure Application

		log('Application Root:', this.options.applicationRoot)

		this.app.use(logger(this.options.loggerFormat))
		log('Logger Format:', this.options.loggerFormat)

		const staticPath = path.join(this.options.applicationRoot, 'application/public')
		this.app.use(express.static(staticPath))
		log('Static Files:', staticPath)

		/* PENDING Engine options
		this.app.use(express.json())
		this.app.use(express.urlencoded({extended: false}))
		*/

		if (this.options.viewEngine) {
			const viewsPath = path.join(this.options.applicationRoot, 'application/views')
			this.app.set('views', viewsPath)
			this.app.set('view engine', this.options.viewEngine)
			log('Views:', this.options.viewEngine, 'at', viewsPath)
		}

		if (this.options.sessionSecret && this.options.sessionRedisUrl) {
			const client = await createClient({
				url: this.options.sessionRedisUrl
			})
				.on('error', error => console.error('Redis Client Error', error))
				.connect()

			const store = new RedisStore({
				client,
				prefix: 'express-session:'
			})

			this.app.use(session({
				store,
				secret: this.options.sessionSecret,
				resave: false, // Force lightweight session keep alive (touch)
				saveUninitialized: false, // Only save session when data exists
			}))

			log('Session storage configured.')
		}

		// Ensure secure connection in production
		if (this.options.redirectSecure) {
			this.app.use((request, response, next) => {
				if (process.env.NODE_ENV === 'production' && !request.secure && request.get('x-forwarded-proto') !== 'https') {
					return response.redirect('https://' + request.get('host') + request.url)
				}

				next()
			})
		}

		// Cross Origin Resource Sharing
		/* PENDING proper implementation
		if (this.options.allowCORS) {
			this.app.options('/*', (request, response, _) => {
				response.header('Access-Control-Allow-Origin', '*')
				response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
				response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Api-Key')
				response.sendStatus(200)
			})
		}
		*/
	}

	addRoute(subPath, actions) {
		const controller = express()

		if (this.options.viewEngine) {
			const viewsPath = path.join(this.options.applicationRoot, 'application/views')
			controller.set('views', viewsPath)
			controller.set('view engine', this.options.viewEngine)
		}

		actions(controller)
		this.app.use(subPath, controller)
		log('Added Route:', subPath)
	}

	addMiddleware(middleware) {
		this.app.use(middleware)
	}

	addDefaultHandlers() {
		// File Not Found
		this.addMiddleware((request, response, _) => {
			response.status(404).json({
				code: 404,
				message: 'File Not Found'
			})
		})

		// Error handler
		this.addMiddleware((error, request, response, next) => {
			if (response.headersSent) {
				// Headers already sent, can't change the status
				return next(error)
			}

			response.status(500).json({
				code: 500,
				message: error.message || error,
				stack: request.app.get('env') === 'development' ? error.stack : ''
			})
		})
	}

	start() {
		this.app.listen(this.options.listenPort, () => {
			log('Listening on Port', this.options.listenPort)
		})
	}
}

export default Cortadito
