var request = require('request-promise');
var config  = require('./config');
var express = require('express');

function wait(milleseconds) {
  return new Promise(resolve => setTimeout(resolve, milleseconds))
}

base_url = "https://api.cai.tools.sap/build/v1/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id + "/builder"
auth_credentials = "Token " + dev_token
header = {
   	"Authorization": auth_credentials,
   	"Accept": "application/json",
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
	"Content-Type": "application/json"
}

var get_conditions = {
	url:    base_url + "/conditions",
   	method:  "GET",
   	headers: header
}

var condition_data
var auth_template_data

async function add_template_to_webhooks() {
	request.get(get_conditions)
	.then( async function(data) {
		condition_data = JSON.parse(data)

		condition_data.results.forEach( async function(condition) {
			condition_id = condition.id

			condition.actions.forEach( async function(action) {
				if(action.type == "http"){
					action_id = action.id
					webhook_id = action.value.id

					console.log(action.value.http_type + ": " + action.value.url)

					var put_wh_credentials = {
						url: base_url + "/conditions/" + condition_id + "/actions/" + action_id + "/webhooks/" + webhook_id,
						method:  "PUT",
					   	headers: header,
					   	body: '{ "auth": { "mode": "template", "template_name": "' + template_name + '", "type": "basic", "id": "' + auth_template_id + '"}}'
					}

					await wait(500)

					request.put(put_wh_credentials)
					.catch(function (err) {
						//console.log(err)
					})
				}
			})
		})
	}).catch(function (err) {
		//console.log(err)
	})
}

var get_templates = {
	url:    base_url + "/webhook_templates",
   	method:  "GET",
   	headers: header
}

var post_wh_auth_template_body = '{"parameters" : {"username": "' + username + '", "password": "' + password + '"}, "type": "basic", "template_name": "' + template_name + '"}'

var post_wh_auth_template = {
	url:    base_url + "/webhook_templates/auth_credentials",
   	method:  "POST",
   	headers: header,
   	body: post_wh_auth_template_body 
}

function start() {
	request.get(get_templates)
	.then( function(data) {
		webhook_data = JSON.parse(data)

		webhook_data.results.auth.forEach( function(auth_template_data) {
			if ( auth_template_data.template_name == template_name ) {
				console.log('Template already created')
				auth_template_id = auth_template_data.id
				add_template_to_webhooks()
			}
		})

		if ( typeof auth_template_id == 'undefined' ) {
			request.post(post_wh_auth_template)
			.then( function(data) {
				console.log('Template created')
				auth_template_data = JSON.parse(data);
				auth_template_id = auth_template_data.results.id
		
				add_template_to_webhooks()
			}).catch(function (err) {
				console.log(err)
			})
		} 
	})	
}			

var app = express();

var user_id
var bot_id
var version_id
var dev_token
var template_name
var username
var password

app.post('/start', function (req, res) {
	console.log(req)

	user_id = req.user_id
	bot_id = req.bot_id
	version_id = req.version_id
	dev_token = req.dev_token
	template_name = req.template_name
	username = req.username
	password = req.password

	start()
});

app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`)); 
