const request = require('request-promise');
const rp = require('request-promise');
const config  = require('./config');
const express = require('express');
const bodyParser = require('body-parser')
//var promise = require("bluebird");

var app = express();
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded());

function wait(milleseconds) {
  return new Promise(resolve => setTimeout(resolve, milleseconds))
}

var start
var elapsed

var base_url
var header
var auth_credentials
var auth_template_id

var user_id
var bot_id
var version_id
var dev_token
var template_name
var username
var password
var skip_existing_auth

function reset_vars() {
	start = Date.now()
	elapsed = 0 

	base_url = undefined
	header = undefined
	auth_credentials = undefined
	auth_template_id = undefined

	user_id = undefined
	bot_id = undefined
	version_id = undefined
	dev_token = undefined
	template_name = undefined
	username = undefined
	password = undefined
	skip_existing_auth = undefined
}

function add_template_to_webhooks() {

	get_conditions = {
		url:    base_url + "/conditions",
	   	method:  "GET",
	   	headers: header
	}

	return request.get(get_conditions)
	.then( function(data) {
		condition_data = JSON.parse(data)

		condition_data.results.forEach( function(condition) {
			condition_id = condition.id

			/*promise.mapSeries(condition.actions, async function(action){
				if(action.type == "http" && (!override_existing_auth || !action.value.auth) ){
					action_id = action.id
					webhook_id = action.value.id

					var put_wh_credentials = {
						url: base_url + "/conditions/" + condition_id + "/actions/" + action_id + "/webhooks/" + webhook_id,
						method:  "PUT",
					   	headers: header,
					   	body: '{ "auth": { "mode": "template", "template_name": "' + template_name + '", "type": "basic", "id": "' + auth_template_id + '"}}'
					}

					console.log(put_wh_credentials.url)

					if( true ) {
						return request.put(put_wh_credentials) 
						//.delay(250)
						.then( function (val){
							console.log('*************************************')
							console.log("Added Auth to " + action.value.http_type + ": " + action.value.url)
							elapsed = ( Date.now() - start ) / 1000
							console.log("seconds elapsed = " + elapsed)
							console.log('*************************************')
						})
						.catch(function (err) {
							console.log('*************************************')
							console.log('Could not add ' + template_name + ' to ' + action.value.url)
							elapsed = ( Date.now() - start ) / 1000
							console.log("seconds elapsed = " + elapsed)
							console.log(err.message)
							console.log('*************************************')
						})	
					}
				} else {

				}
			})*/

			condition.actions.forEach( async function(action) {
				if(action.type == "http" && (!skip_existing_auth || !action.value.auth) ){
					action_id = action.id
					webhook_id = action.value.id

					var put_wh_credentials = {
						url: base_url + "/conditions/" + condition_id + "/actions/" + action_id + "/webhooks/" + webhook_id,
						method:  "PUT",
					   	headers: header,
					   	body: '{ "auth": { "mode": "template", "template_name": "' + template_name + '", "type": "basic", "id": "' + auth_template_id + '"}}'
					}

					request.put(put_wh_credentials)
					.then( function (val){
						console.log('*************************************')
						console.log("Added Auth to " + action.value.http_type + ": " + action.value.url)							
						elapsed = ( Date.now() - start ) / 1000
						console.log("seconds elapsed = " + elapsed)
						console.log('*************************************')
					})
					.catch(function (err) {
						console.log('*************************************')
						console.log('Could not add ' + template_name + ' to ' + action.value.url)
						console.log(err.message)
						elapsed = ( Date.now() - start ) / 1000
						console.log("seconds elapsed = " + elapsed)
						console.log('*************************************')
					})
				}
			})
		})
	}).catch(function (err) {
		console.log('Could not get the conditions from the bot '+ user_id + '/' + bot_id + '/' + version_id)
		console.log(err.message)
		elapsed = ( Date.now() - start ) / 1000
		console.log("seconds elapsed = " + elapsed)
	})
}

function add_auth_to_bot() {
	get_templates = {
		url:    base_url + "/webhook_templates",
	   	method:  "GET",
	   	headers: header
	}

	return request.get(get_templates)
	.then( function(data) {
		webhook_data = JSON.parse(data)

		webhook_data.results.auth.forEach( function(auth_template_data) {
			if ( auth_template_data.template_name == template_name ) {
				console.log('Existing template: ' + template_name)
				auth_template_id = auth_template_data.id
				add_template_to_webhooks()
			}
		})

		if ( typeof auth_template_id == 'undefined' ) {

			post_wh_auth_template_body = '{"parameters" : {"username": "' + username + '", "password": "' + password + '"}, "type": "basic", "template_name": "' + template_name + '"}'

			post_wh_auth_template = {
				url:    base_url + "/webhook_templates/auth_credentials",
			   	method:  "POST",
			   	headers: header,
			   	body: post_wh_auth_template_body 
			}

			request.post(post_wh_auth_template)
			.then( function(data) {
				console.log('Template created: ' + template_name)
				auth_template_data = JSON.parse(data);
				auth_template_id = auth_template_data.results.id
				console.log('Template id: ' + auth_template_id)
				add_template_to_webhooks()
			}).catch(function (err) {
				console.log('Template could not be created')
				console.log(err.message)
			})
		} else {
			console.log('Template id: ' + auth_template_id)
		}
	})	
}

app.post('/add_auth', function (req, res) {

	reset_vars()

	user_id = req.body.user_id
	bot_id = req.body.bot_id
	version_id = req.body.version_id
	dev_token = req.body.dev_token
	template_name = req.body.template_name
	username = req.body.username
	password = req.body.password
	skip_existing_auth = req.body.skip_existing_auth

	if (skip_existing_auth) {
		console.log("Applying Authentication to only webhooks without existing data")
	} else {
		console.log("Applying Authentication to all webhooks")
	}

	base_url = "https://api.cai.tools.sap/build/v1/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id + "/builder"

	header = {
	   	"Authorization": "Token " + dev_token,
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}
    
    add_auth_to_bot()
    .then( function() {
    	res.end(`Added ${template_name} to webhooks in ${user_id}\'s bot ${bot_id} and version ${version_id}`)
    })
    .catch ( function (err) {
    	res.end(`There was an error with your request`)
    	console.log(err.message)
    })
})

app.get('/', function (req, res) {
    res.end(`
        <!doctype html>
        <html>
        <body>
            <form action="/add_auth" method="post">
            	Bot Data<br>
                Bot Owner ID: <input type="text" name="user_id" /><br>
                Bot ID: <input type="text" name="bot_id" /><br>
                Version ID: <input type="text" name="version_id" /><br>
                Developer Token: <input type="text" name="dev_token" /><br>
                <br>Authentication Template Data<br>
                Template Name: <input type="text" name="template_name" /><br>
                Template Username: <input type="text" name="username" /><br>
                Template Password: <input type="text" name="password" /><br>
                <input type="checkbox" name="skip_existing_auth" value=true/> Re-run and skip webhooks with existing auth info<br>
                <button>Add Auth data</button>
            </form>
        </body>
        </html>
    `);
});

app.post('/add_auth_test', function (req, res) {

	header = {
	   	"Authorization": "Token 06be8257dac67fabeac55b32497eb475",
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}

	get_templates = {
		url:    "https://api.cai.tools.sap/build/v1/users/successfactors-sap/bots/digital-assistant-nate/versions/test-1/builder/webhook_templates",
	   	method:  "GET",
	   	headers: header
	}

	var req_array = [get_templates, get_templates, get_templates, get_templates]


	start = Date.now()
	elapsed = 0 

	Promise.mapSeries(req_array, function(requ) {

		return request.get(requ)
		.promise()
		.delay(1000)
		.then( function(data) {
			elapsed = ( Date.now() - start ) / 1000
			console.log("seconds elapsed = " + elapsed)
		})

/*		return new Promise.delay(500)(resolve => {
			
			elapsed = ( Date.now() - start ) / 1000
			console.log("seconds elapsed = " + elapsed)

			return request.get(requ)
			.promise()
			.delay(1000)


			.then( function(data) {
				return "returned data"
			})
		});*/
		
	}).then( function(result){
		console.log(result)
	})
})

app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`));