# Cortadito

A small module that makes building WebApps and API services with Express quick.

## Features

* Docker container ready
* Express 5 based HTTP handling and routes
* Async ready
* Uses Modules instead of Common
* Familiar MVC-like folder structure and URL paths (controllers, views, public folder for static content, etc)
* Optional shared session management using Redis
* CORS support - HTTP OPTIONS (still needs some work...)
* Flexible logging formatting using Morgan (defaults to Apache style)
* Out of the box support for EJS templates in Views, and partials
* Use any Node based data access module for storage
* Custom error handling
* Tiny and clean; outside of NPM dependencies, the code is about ~180 lines

## Setup and First WebApp

1. Follow these steps to get started with your first Cortadito webapp:

```bash
mkdir test-app
cd test-app
npm init
npm install express --save
npm install cortadito --save
mkdir -p application/models
mkdir -p application/controllers
mkdir -p application/views
mkdir -p application/adapters
mkdir -p application/public
```

At some point this will be automated by a script, for now, it will involve some keystrokes.

2. Create a sample controller *(application/controllers/sample.mjs)* with some endpoints:

```javascript
export default function sample(controller) {
	controller.get('/', async (request, response) => {
		const hi = await Promise.resolve('Hi! I ran async.')
		response.send(hi)
	})

	controller.get('/fail', async (request, response) => { // eslint-disable-line no-unused-vars
		await Promise.reject(new Error('REJECTED!'))
	})

	controller.get('/denied', async (request, response) => {
		response.status(403).send('Not here')
	})

	controller.get('/set', (request, response) => {
		request.session.timestamp = Date.now()
		response.json({session: request.session})
	})

	controller.get('/get', (request, response) => {
		response.json({session: request.session})
	})
}
```

This should be familiar to any Express user.

4. Add an entry point index.js on the root folder. This contains your app options and can be configurable via env-vars for container usage:

```javascript
#!/usr/bin/env node

import process from 'node:process'
import Cortadito from 'cortadito'
import sample from './application/controllers/sample.mjs'

const options = {
	listenPort: process.env.PORT // Mandatory
}

const app = new Cortadito()
await app.configure(options)
app.addRoute('/', sample)
app.addDefaultHandlers()
app.start()
```

This creates the application based on the options, then takes the **sample** controller and adds it to the document root. Other controllers will have their own route/path. The HTTP 404 and 500 handling is added via the *addDefaultHandlers* method. Finally the app starts on the *listenPort* specified.

Other options, as follows (showing default values):

```javascript
const options = {
	listenPort: process.env.PORT, // Mandatory!
	applicationRoot: process.cwd() // Path to application structure
	loggerFormat: 'common' // Morgan formats
	viewEngine: 'ejs', // Any views supported by Express5
	sessionRedisUrl: "redis://......", // Used for Session Storage
	sessionSecret: "<hard secret>", // Used for Session Storage
	redirectSecure: false // Redirects to HTTPS if on HTTP
}
```

The error handling can be customized to return plain JSON, HTTP codes or an EJS rendered page, your choice as follows:

```javascript
// REMOVE app.addDefaultHandlers()
app.addMiddleware((request, response, _) => {
	response.status(404).render('error', {
		pageTitle: 'File Not Found',
		status: 404,
		message: 'Sorry! The path you specified doesn\'t exist.',
		stack: request.url
	})
})
app.addMiddleware((error, request, response, next) => {
	if (response.headersSent) {
		// Headers already sent, can't change the status
		return next(error)
	}

	response.status(500).render('error', {
		pageTitle: 'Oops!',
		status: 500,
		message: error.message || error,
		stack: request.app.get('env') === 'development' ? error.stack : ''
	})
})
```

A sample repo can be cloned or templated with the code above at: [cortadito-sample](https://github.com/RobertoMachorro/cortadito-sample).

## Docker Support

Add the following file to the root folder and _docker build_:

```Dockerfile
FROM node:latest

WORKDIR /app
ADD . /app

RUN npm install

CMD ["npm","start"]
```

## Also Checkout

1. [EJS Templates](https://ejs.co) - this is what the views use
2. [Express](https://expressjs.com) - this is what powers the HTTP communication
