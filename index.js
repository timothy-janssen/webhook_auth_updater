const rp 		= require('request-promise');
const Promise 	= require("bluebird");
const express 	= require('express');
const bp 		= require('body-parser')
const config  	= require('./config');

var app = express();
app.use(bp.json());  
app.use(bp.urlencoded());

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

function add_auth_to_bot(res) {
	get_templates = {
		url:    base_url + "/webhook_templates",
	   	method:  "GET",
	   	headers: header
	}

	return rp.get(get_templates)
	.then( function(data) {
		webhook_data = JSON.parse(data)

		webhook_data.results.auth.forEach( function(auth_template_data) {
			if ( auth_template_data.template_name == template_name ) {
				auth_template_id = auth_template_data.id
				res.write(`Existing template: ${template_name}\n`)
				console.log('Existing template: ' + template_name)
				console.log('Template id: ' + auth_template_id)
				return add_template_to_webhooks(res)
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

			return rp.post(post_wh_auth_template)
			.then( function(data) {
				auth_template_data = JSON.parse(data);
				auth_template_id = auth_template_data.results.id
				res.write(`Template created: ${template_name}\n`)
				console.log('Template created: ' + template_name)
				console.log('Template id: ' + auth_template_id)
				return add_template_to_webhooks(res)
			}).catch(function (err) {
				res.write(`Template could not be created\n`)
				res.end()
				console.log('Template could not be created')
				console.log(err.message)
			})
		}
	})	
}

var put_wh_cred_array = []
var wh_cred_obj
var wh_cred_req

function add_template_to_webhooks(res) {

	get_conditions = {
		url:    base_url + "/conditions",
	   	method:  "GET",
	   	headers: header
	}

	rp.get(get_conditions)
	.then( function(data) {
		condition_data = JSON.parse(data)

		condition_data.results.forEach( function(condition) {
			condition_id = condition.id

			condition.actions.forEach( function(action) {
				if (action.type == "http"){
					action_id = action.id
					webhook_id = action.value.id

					wh_cred_req = {
						url: base_url + "/conditions/" + condition_id + "/actions/" + action_id + "/webhooks/" + webhook_id,
						method:  "PUT",
					   	headers: header,
					   	body: '{ "auth": { "mode": "template", "template_name": "' + template_name + '", "type": "basic", "id": "' + auth_template_id + '"}}'
					}

					wh_cred_obj = {
						opt: wh_cred_req,
						err_msg: 'Could not add ' + template_name + ' to ' + action.value.url,
						suc_msg: 'Added Auth to ' + action.value.http_type + ': ' + action.value.url
					}

					console.log(action.value.url)

					put_wh_cred_array.push(wh_cred_obj)
				}
			})
		})

		return call_add_auths(put_wh_cred_array, res)

	}).catch(function (err) {
		res.write(`Could not get the conditions from the bot ${user_id}/${bot_id}/${version_id}`)
		res.end()
		console.log('Could not get the conditions from the bot '+ user_id + '/' + bot_id + '/' + version_id)
		console.log(err.message)
	})
}

function call_add_auths(reqs, res) {
	var err_count = 0;
	var suc_count = 0;

	return Promise.map(reqs, function(req) {
		return rp.put(req.opt)
		.then( function (){
			suc_count++
			console.log(req.suc_msg)
		})
		.catch(function (err) {
			err_count++
			console.log(req.err_msg)
			console.log(err.message)
		})
	}, {concurrency: 5})
	.then( function(val) {
		res.write(`Added authentication to ${suc_count} webhooks (with ${err_count} errors)`)
		res.end()
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

	base_url = "https://api.cai.tools.sap/build/v1/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id + "/builder"

	header = {
	   	"Authorization": "Token " + dev_token,
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}
    
    add_auth_to_bot(res)
    .then( function() {
    	res.write(`Adding ${template_name} to webhooks in ${user_id}\'s bot ${bot_id} and version ${version_id}\n`)
    })
    .catch ( function (err) {
    	res.send(`There was an error with your request \n check your token: https://cai.tools.sap/${user_id}/${bot_id}/settings/tokens`)
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
                <button>Add Auth data</button>
            </form>
        </body>
        </html>
    `);
});

app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`));