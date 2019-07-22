const request = require('request-promise');
const config  = require('./config');
const express = require('express');
const bodyParser = require('body-parser')

var app = express();
app.use(bodyParser.json());  
app.use(bodyParser.urlencoded());

function wait(milleseconds) {
  return new Promise(resolve => setTimeout(resolve, milleseconds))
}

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

async function add_template_to_webhooks() {

	get_conditions = {
		url:    base_url + "/conditions",
	   	method:  "GET",
	   	headers: header
	}

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
				console.log('Template already created')
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

app.post('/add_auth', function (req, res) {
	user_id = req.body.user_id
	bot_id = req.body.bot_id
	version_id = req.body.version_id
	dev_token = req.body.dev_token
	template_name = req.body.template_name
	username = req.body.username
	password = req.body.password

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
    	console.log(err)
    	res.end(`There was an error with your request`)
    })
})

app.get('/', function (req, res) {
    res.end(`
        <!doctype html>
        <html>
        <body>
            <form action="/add_auth" method="post">
            	Bot Data<br>
                user_id: <input type="text" name="user_id" /><br>
                bot_id: <input type="text" name="bot_id" /><br>
                version_id: <input type="text" name="version_id" /><br>
                dev_token: <input type="text" name="dev_token" /><br>
                <br>Authentication Template Data<br>
                template_name: <input type="text" name="template_name" /><br>
                username: <input type="text" name="username" /><br>
                password: <input type="text" name="password" /><br>
                <button>Add Auth data</button>
            </form>
        </body>
        </html>
    `);
});

app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`));