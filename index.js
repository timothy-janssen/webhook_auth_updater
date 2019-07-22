var request = require('request-promise');
var config  = require('./config');

function wait(milleseconds) {
  return new Promise(resolve => setTimeout(resolve, milleseconds))
}

base_url = "https://api.cai.tools.sap/build/v1/users/" + config.USER_ID + "/bots/" + config.BOT_ID + "/versions/" + config.VERSION_ID + "/builder"
auth_credentials = "Token " + config.DEV_TOKEN
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
					   	body: '{ "auth": { "mode": "template", "template_name": "' + config.TEMPLATE_NAME + '", "type": "basic", "id": "' + auth_template_id + '"}}'
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

var post_wh_auth_template_body = '{"parameters" : {"username": "' + config.USERNAME + '", "password": "' + config.PASSWORD + '"}, "type": "basic", "template_name": "' + config.TEMPLATE_NAME + '"}'

var post_wh_auth_template = {
	url:    base_url + "/webhook_templates/auth_credentials",
   	method:  "POST",
   	headers: header,
   	body: post_wh_auth_template_body 
}

function create_auth_template() {
	request.get(get_templates)
	.then( function(data) {
		webhook_data = JSON.parse(data)

		webhook_data.results.auth.forEach( function(auth_template_data) {
			if ( auth_template_data.template_name == config.TEMPLATE_NAME ) {
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

create_auth_template()


		
		

			
