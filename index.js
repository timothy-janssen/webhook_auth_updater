const rp 		= require('request-promise');
const Promise 	= require("bluebird");
const express 	= require('express');
const bp 		= require('body-parser')
const config  	= require('./config');
const stringify = require('json-stringify-safe');

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

	put_wh_cred_array = []
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
				res.write(`<p>Existing template: ${template_name}</p>`)
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
				res.write(`<p>Template created: ${template_name}</p>`)
				console.log('Template created: ' + template_name)
				console.log('Template id: ' + auth_template_id)
				return add_template_to_webhooks(res)
			}).catch(function (err) {
				res.write(`<p>Template could not be created</p>`)
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
	err_count = 0;
	suc_count = 0;

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
		res.write(`<p>Added authentication to ${suc_count} webhooks (with ${err_count} errors)</p>`)
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
    	res.write(`<p>Adding ${template_name} to webhooks in ${user_id}\'s bot ${bot_id} and version ${version_id}</p>`)
    	
    })
    .catch ( function (err) {
    	res.write(`<p>There was an error with your request</p>`)
    	res.write(`<p>First, check your Owner/Bot/Version ID's</p>`)
    	res.write(`<p>Then, check your developer token here: <a href="https://cai.tools.sap/${user_id}/${bot_id}/settings/tokens">https://cai.tools.sap/${user_id}/${bot_id}/settings/tokens</a></p>`)
    	res.write(`<p>If the link doesn't work, then the Owner/Bot ID's are wrong ;)</p>`)
    	res.end()
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



app.get('/where_used', function (req, res) {

	var where_used_return_string = ''

	user_id = 'successfactors-sap'
	bot_id = 'digital-assistant-tim'
	version_id = 'v1'
	dev_token = 'd303ca6525e18f27e23ad299d90f55ce'

	search_str = 'list-type'

	base_url = "https://api.cai.tools.sap/build/v1/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id + "/builder"

	header = {
	   	"Authorization": "Token " + dev_token,
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}

	get_skills = {
		url:    base_url + "/skills",
	   	method:  "GET",
	   	headers: header
	}

	rp.get(get_skills)
	.then( function(data) {

		skills = JSON.parse(data).results

		Promise.map(skills, function(skill) {
			skill_name = skill.name

			console.log("Skill: " + skill_name)

			get_skill_tasks = {
				url:    base_url + "/skills/" + skill_name + "/task",
			   	method:  "GET",
			   	headers: header
			} 
			console.log("TASKS:")
			return rp.get(get_skill_tasks)
			.then( function(data){
				if(data) {
					tasks = JSON.parse(data).results.children
					search_str = 'money'
					num = get_count(tasks, search_str)

					if ( num > 0 ) {
						res.write(`${num} occurances of ${search_str} in ${skill_name} requirements\n`)
					}
				}
	
				get_skill_triggers = {
					url:    base_url + "/skills/" + skill_name + "/trigger",
				   	method:  "GET",
				   	headers: header
				}
				console.log("TRIGGERS:")
				return rp.get(get_skill_triggers)
				.then( function(data){				
					if(data) {
						data = JSON.parse(data)
						triggers = data.results.children
						num = get_count(triggers, search_str)

						if ( num > 0 ) {
							res.write(`${num} occurances of ${search_str} in ${skill_name} trigger\n`)
						}
					}

					get_skill_actions = {
						url:    base_url + "/skills/" + skill_name + "/results",
				   		method:  "GET",
				   		headers: header
					}

					console.log("ACTIONS:")
					return rp.get(get_skill_actions)
					.then( function(data){				
						if(data) {
							data = JSON.parse(data)
							actions = data.results.children
							num = get_count(actions, search_str)
	
							if ( num > 0 ) {
								res.write(`${num} occurances of ${search_str} in ${skill_name} actions\n`)
							}
						}
					})
				})
			})
		}, {concurrency: 1})
		.then( function() {
			res.end()
		})
	})
});


function get_count(obj, str) {
	var num = 0;
	if (obj == null || typeof obj == 'undefined') {
		return 0
	} else {
		obj.forEach( function(elem) {
			console.log('************************')
			console.log(elem)
			console.log('************************')

			// As part of condition
			if (elem.value && typeof elem.value === 'string' && elem.value.includes(str)) {
				num++
				console.log("// As part of condition")
			}

			// Set as memory variable
			if (elem.type == 'edit_memory' && elem.value && elem.value.set) {
				elem.value.set.forEach(function(item) {

					// Set variable to string
					if ( item.value && typeof item.value == 'string' && item.value.includes(str) ) {
						num++
						console.log("// Set as memory variable")
					}

					// Set variable to object
					if ( item.value && typeof item.value == 'object' ) {

						for(var prop in item.value) {
							if (prop.includes(str)) {
								num++
								console.log("// Set as memory variable (object/key)")
							} else if (item.value[prop].includes(str)) {
								num++
								console.log("// Set as memory variable (object/value)")
							}
						}
					}
				})
			}

			// Part of Message to user
			if (elem.type == 'message' && elem.value && elem.value.en) {
				console.log("checking array")
				elem.value.en.forEach(function(item) {
					console.log("message: " + item.value)
					if ( item.value.includes(str) ) {
						num++
						console.log("// Part of Message to user")
					}
				})
			}

			// as Requirement
			if (elem.data && typeof elem.data.name === 'string' && elem.data.name.includes(str)) {
				num++
			}

			// Check the element's children
			if (elem.children && elem.children.length > 0) {
				num += get_count(elem.children, str)
			}

			// Check the element's actions
			if (elem.actions && elem.actions.length > 0) {
				num += get_count(elem.actions, str)
			}

			// Left side of conditional
			if (elem.left && elem.left.length > 0) {
				i = 0
				i += get_count(elem.left, str)
				if (i > 0) {num += i; console.log("// Left side of conditional")}
			}

			// Right side of conditional
			if (elem.right && elem.right.length > 0) {
				i = 0
				i += get_count(elem.right, str)
				if (i > 0) {num += i; console.log("// Right side of conditional")}
			}

			// "If #entity is missing"
			if (elem.on_empty_condition ) {
				i = 0
				i += get_count([elem.on_empty_condition], str)
				if (i > 0) {num += i; console.log("// If #entity is missing")}
			}

			// Validators
			if (elem.on_validation_condition ) {
				i = 0
				i += get_count([elem.on_validation_condition], str)
				if (i > 0) {num += i; console.log("// Validators")}
			}
			
			// "If #entity is complete"
			if (elem.on_success_condition ) {
				i = 0
				i += get_count([elem.on_success_condition], str)
				if (i > 0) {num += i; console.log("// If #entity is complete")}
			}

		})

		return num
	}
}

app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`));