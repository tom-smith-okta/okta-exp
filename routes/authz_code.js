
const axios = require('axios')

const crypto = require('crypto')

const fs = require('fs')

var qs = require('qs')

////////////////////////////////////////////////////

module.exports = function(app){
	app.post('/code', function (req, res) {

		const client_id = process.env.client_id

		const client_secret = process.env.client_secret

		const issuer = process.env.issuer

		const redirect_uri = process.env.redirect_uri

		////////////////////////////////////////////////////

		const data = qs.stringify({
		  'grant_type': 'authorization_code',
		  'redirect_uri': redirect_uri,
		  'code': req.body.code,
		  'client_id': client_id,
		  'client_secret': client_secret,
		  'code_verifier': process.env["code_verifier"]
		})

		const c = {
		  method: 'post',
		  url: issuer + '/v1/token',
		  headers: { 
			'Accept': 'application/json', 
			'Content-Type': 'application/x-www-form-urlencoded'
		  },
		  data: data
		}
		
		axios(c)
		.then(function (response) {

			// principal token
			access_token = response.data.access_token

			id_token = response.data.id_token

			console.dir(access_token)

			const opaque_token = crypto.createHash('md5').update(access_token).digest('hex');

			fs.readFile('tokens.json', (err, data) => {
				if (err) throw err
				let tokens = JSON.parse(data)
				tokens[opaque_token] = access_token
				data = JSON.stringify(tokens)
				fs.writeFile('tokens.json', data, (err) => {
					if (err) throw err
					res.json({
						"opaque_token": opaque_token,
						"id_token": id_token
					})
					return
				})
			})
		})
		.catch(function (error) {
			console.log(error)
			res.json({"error": "something went wrong with the token request to okta"})
			return
		})		
	})
}
