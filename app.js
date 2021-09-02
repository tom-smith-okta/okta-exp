////////////////////////////////////////////////////

require('dotenv').config()

const axios = require('axios').default

const express = require('express')

const fs = require('fs')

// const mustacheExpress = require('mustache-express')

// const Mustache = require('mustache')

///////////////////////////////////////////////////

const app = express()

const port = process.env.PORT || 3000

const sleepy_svcs = [
    "https://okta-pkce-generator.herokuapp.com",
    "https://okta-webhooks.herokuapp.com"
]

app.use(express.static('public'))

app.use(express.urlencoded({extended: true}))

app.use(express.json())

app.listen(port, function () {
	console.log('App listening on port ' + port + '...')
})

//////////////////////////////////////////////////
// wake up heroku utility apps:
// -- PKCE code challenge/verifier generator
// -- inline hook endpoint

wake_up_sleepy_svcs()

//////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////

require('./routes/authz_code')(app)

//////////////////////////////////////////////////

app.get('/favicon.ico', function (req, res) {
	res.sendStatus(200)
})

app.get('/expedia_authz', function (req, res) {

	wake_up_sleepy_svcs()

	/**************************************************/
	// DO EXPERIAN CLIENT VALIDATION HERE
	/**************************************************/

	// ...

	/**************************************************/
	// GET USER'S IDP
	/**************************************************/

	const username = req.query.username

	const url = process.env.okta_tenant + "/.well-known/webfinger?resource=okta:acct:" + username

	var config = {
		method: 'get',
		url: url
	}
	  
	axios(config)
	.then(function (response) {

		const idp_url = response.data.links[0].href

		const properties = response.data.links[0].properties

		console.dir(properties)

		const idp_type = properties['okta:idp:type']

		console.log("the idp type is:")
		console.log(idp_type)

		let idp_id

		if (idp_type == "OKTA") {
			idp_id = "OKTA"
		}
		else {
			idp_id = properties['okta:idp:id']
		}

		/**************************************************/
		// GET PKCE code_challenge
		/**************************************************/

		config = {
			method: 'get',
			url: "https://okta-pkce-generator.herokuapp.com/"
		}

		axios(config)
		.then(function (response) {

			console.dir(response)
			const code_challenge = response.data.code_challenge
			const code_verifier = response.data.code_verifier

			console.log("code challenge: " + code_challenge)
			console.log("code verifier: " + code_verifier)

			// use a real db in prod
			process.env["code_challenge"] = code_challenge
			process.env["code_verifier"] = code_verifier

			let authz_url = `${process.env.issuer}/v1/authorize?client_id=${process.env.client_id}&scope=openid profile&redirect_uri=${process.env.redirect_uri}&response_type=code&state=xyz&login_hint=${username}&code_challenge=${code_challenge}&code_challenge_method=S256`

			if (idp_id == "OKTA") {}
			else {
				authz_url += `&idp=${idp_id}`
			}

			res.redirect(authz_url)

		})
		.catch(function (error) {
			console.log(error)
		})
	})
	.catch(function (error) {
		console.log(error)
	})
})

app.get('/sign_out', function (req, res) {
	const url = process.env.okta_tenant + "/login/signout?fromURI=" + process.env.redirect_uri
	res.redirect(url)
})

// exchange an opaque token for an Okta access token (jwt)
app.post('/access_token', function(req, res) {

	const opaque_token = req.body.opaque_token

	console.log(opaque_token)

	fs.readFile('tokens.json', (err, data) => {

		if (err) throw err

		let tokens = JSON.parse(data)

		res.json({access_token: tokens[opaque_token]})

		return
	})
})

function wake_up_sleepy_svcs() {

	for (svc of sleepy_svcs) {
		console.log(svc)
	
		axios.get(svc)
		.then(function (response) {
			if (response.status == 200) {
				console.log("the " + svc + " service is awake.")
			}
		})
		.catch(function (error) {
			console.log(error);
		})
		.then(function () {
		})
	}
}
