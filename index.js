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

app.get('/add_auth', function (req, res) {

    res.end(`
        <!doctype html>
        <html>
        <body>
            <form action="/add_auth" method="post">
            	Bot Data<br>
                Bot Owner ID: <input type="text" name="user_id" /><br>
                Bot ID: <input type="text" name="bot_id" /><br>
                Version ID: <input type="text" name="version_id" /><br>
                Developer Token: <input type="text" name="dev_token" size="33" /><br>
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

app.post('/add_auth', function (req, res) {

	reset_vars()

	user_id = req.body.user_id
	bot_id = req.body.bot_id
	version_id = req.body.version_id
	dev_token = req.body.dev_token
	template_name = req.body.template_name
	username = req.body.username
	password = req.body.password

	if  ( typeof user_id == 'undefined' 	|| user_id.length == 0 		||
		  typeof bot_id == 'undefined' 		|| bot_id.length == 0 		||
		  typeof version_id == 'undefined' 	|| version_id.length == 0 	||
		  typeof dev_token == 'undefined' 	|| dev_token.length == 0 ) {

		res.send('Please enter all the valid bot data')
		return
	}

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

app.get('/where_used', function (req, res) {
	res.end(`
        <!doctype html>
        <html>
        <body>
            <form action="/where_used" method="post">
            	Bot Data<br>
                Bot Owner ID: <input type="text" name="user_id" /><br>
                Bot ID: <input type="text" name="bot_id" /><br>
                Version ID: <input type="text" name="version_id" /><br>
                Developer Token: <input type="text" name="dev_token" size="33" /><br>
                <br>Search<br>
                Entity or variable name: <input type="text" name="search_str" /><br>
                <button>Search bot</button>
            </form>
        </body>
        </html>
    `);
})

app.post('/where_used', function (req, res) {

	var user_id =  req.body.user_id
	var bot_id =  req.body.bot_id
	var version_id = req.body.version_id
	var dev_token = req.body.dev_token

	var search_str = req.body.search_str

	if  ( typeof user_id == 'undefined' || user_id.length == 0 ) {
		res.send('Please enter a bot owner ID')
		return
	}

	if  ( typeof bot_id == 'undefined' || bot_id.length == 0 ) {
		res.send('Please enter a bot ID')
		return
	}

	if  ( typeof version_id == 'undefined' || version_id.length == 0 ) {
		res.send('Please enter a version ID')
		return
	}

	if  ( typeof dev_token == 'undefined' || dev_token.length == 0 ) {
		res.send('Please enter a valid developer token')
		return
	}

	if  ( typeof search_str == 'undefined' || search_str.length == 0 ) {
		res.send('Please enter an entity or variable name')
		return
	}

	res.write(`<p>Searching for ${search_str} in version ${version_id} of <a href="https://cai.tools.sap/${user_id}/${bot_id}">this bot</a><p><br>`)

	build_url = "https://api.cai.tools.sap/build/v1/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id
	train_url = "https://api.cai.tools.sap/train/v2/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id

	var err_skills = '<p>There was an error with retrieving data for the following skills:'
	err_skills_check = err_skills

	header = {
	   	"Authorization": "Token " + dev_token,
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}

	header_train = {
	   	"Authorization": "Bearer ec4b01e0a3969d1e3ef2bbeffa34540e",
	   	"Accept": "application/json",
		"Cache-Control": "no-cache",
		"Connection": "keep-alive",
		"Content-Type": "application/json"
	}

	get_skills = {
		url:    build_url + "/builder/skills",
	   	method:  "GET",
	   	headers: header
	}

	get_entities = {
		url:    train_url + "/dataset/entities",
	   	method:  "GET",
	   	headers: header_train
	}

	// rp.get(get_skills)
	// .then( function(data) {

	// 	skills = JSON.parse(data).results

	// 	Promise.map(skills, function(skill) {
	// 		var skill_name = skill.slug
	// 		var skill_str_to_user = '<pre><a href="https://cai.tools.sap/' + user_id + '/' + bot_id + '/skills/' + skill_name + '">' + skill_name + '</a>'
	// 		var skill_str_to_user_check = skill_str_to_user

	// 		console.log("Skill: " + skill_name)

	// 		get_skill_triggers = {
	// 			url:    build_url + "/builder/skills/" + skill_name + "/trigger",
	// 		   	method:  "GET",
	// 		   	headers: header
	// 		}

	// 		console.log("TRIGGERS: " + skill_name)
	// 		return rp.get(get_skill_triggers)
	// 		.then( function(data){				
	// 			if(data) {
	// 				data = JSON.parse(data)
	// 				triggers = data.results.children
	// 				num = get_count(triggers, search_str)

	// 				if ( num > 0 ) {
	// 					skill_str_to_user += '<br>\tTriggers: ' + num
	// 					//res.write(`${num} occurances of ${search_str} in ${skill_name} trigger\n`)
	// 				}
	// 			}

	// 			get_skill_tasks = {
	// 				url:    build_url + "/builder/skills/" + skill_name + "/task",
	// 			   	method:  "GET",
	// 			   	headers: header
	// 			}

	// 			console.log("TASKS: " + skill_name)
	// 			return rp.get(get_skill_tasks)
	// 			.then( function(data){
	// 				if(data) {
	// 					tasks = JSON.parse(data).results.children
	// 					num = get_count(tasks, search_str)
	
	// 					if ( num > 0 ) {
	// 						skill_str_to_user += '<br>\tRequirements: ' + num
	// 						//res.write(`${num} occurances of ${search_str} in ${skill_name} requirements\n`)
	// 					}
	// 				}
	
	// 				get_skill_actions = {
	// 					url:    build_url + "/builder/skills/" + skill_name + "/results",
	// 			   		method:  "GET",
	// 			   		headers: header
	// 				}

	// 				console.log("ACTIONS: " + skill_name)
	// 				return rp.get(get_skill_actions)
	// 				.then( function(data){				
	// 					if(data) {
	// 						data = JSON.parse(data)
	// 						actions = data.results.children
	// 						if(skill_name == 'cooler') {num = get_count(actions, search_str, true)}
	// 						else {num = get_count(actions, search_str)}
	
	// 						if ( num > 0 ) {
	// 							skill_str_to_user += '<br>\tActions: ' + num
	// 							//res.write(`${num} occurances of ${search_str} in ${skill_name} actions\n`)
	// 						}
	// 					}
	// 					if (skill_str_to_user.length > skill_str_to_user_check.length) {
	// 						res.write(`${skill_str_to_user}</pre>`)
	// 					}
	// 				})
	// 				.catch( function(err) {
	// 					console.log(err.message)
	// 					err_skills += '<br>' + skill_name + ' (Actions)'
	// 				})
	// 			})
	// 			.catch( function(err) {
	// 				console.log(err.message)
	// 				err_skills += '<br>' + skill_name + ' (Requirements)'
	// 			})
	// 		})
	// 		.catch( function(err) {
	// 			console.log(err.message)
	// 			err_skills += '<br>' + skill_name + ' (Triggers)'
	// 		})
	// 	}, {concurrency: 5})
	// 	.then( function() {
	// 		if (err_skills > err_skills_check) {
	// 			res.write(err_skills + '</p>')
	// 		}
	// 	})
	// }).then( function() {
		rp.get(get_entities)
		.then( function(data) {
			entities = JSON.parse(data).results

			Promise.map(entities, function(entity) {
				entity_id = entity.id
				entity_slug = entity.slug

				var ent_str_to_usr = '<pre><a href="https://cai.tools.sap/' + user_id + '/' + bot_id + '/train/entities/' + entity_slug + '/enrichment">' + entity_slug + '</a>' 
				var ent_str_to_usr_check = ent_str_to_usr

				if(entity.custom) {

					get_entity_keys = {
						url:    train_url + "/dataset/entities/" + entity_slug + "/keys",
					   	method:  "GET",
					   	headers: header_train
					}

					return rp.get(get_entity_keys)
					.then( function(data){
						keys = JSON.parse(data).results

						Promise.map(keys, function(key) {
							key_id = key.id
							key_slug = key.slug

							get_enrichments = {
								url:    train_url + "/dataset/entities/" + entity_slug + "/keys/" + key_id + "/enrichments",
							   	method:  "GET",
							   	headers: header_train
							}

							return rp.get(get_enrichments)
							.then( function (data){
								enrichments = JSON.parse(data).results.enrichments

								Promise.map(enrichments, function(enrichment) {
									if(enrichment.value.includes(search_str)){
										ent_str_to_usr += '<br>\t' + key_slug + ': ' + enrichment.value
									}
								}, {concurrency: 1})
							})
							.catch(function(err) {
								console.log(err.message)
							})
						}, {concurrency: 5})
					})
					.then( function(){
						if(ent_str_to_usr > ent_str_to_usr_check){
							res.write(`${ent_str_to_usr}</pre>`)
						}	
						res.end()
					})
					.catch(function(err) {
						console.log(err.message)
					})
				}
			}, {concurrency: 5})
			
		})
		.catch(function(err) {
			console.log(err.message)
			res.end()
		})
/*	})
	.catch( function(err) {
		console.log(err.message)
		
		res.write(`<p>There was an error with your request</p>`)
    	res.write(`<p>First, check your Owner/Bot/Version ID's</p>`)
    	res.write(`<p>Then, check your developer token here: <a href="https://cai.tools.sap/${user_id}/${bot_id}/settings/tokens">https://cai.tools.sap/${user_id}/${bot_id}/settings/tokens</a></p>`)
    	res.write(`<p>If the link doesn't work, then the Owner/Bot ID's are wrong ;)</p>`)
    	res.end()
	})*/
});


function get_count(obj, str, debug) {
	var num = 0;
	if (obj == null || typeof obj == 'undefined') {
		return 0
	} else {
		obj.forEach( function(elem) {
			if (debug) {
				console.log('************************')
				console.log(elem)
				console.log('************************')
			}

			// As part of condition
			if (elem.value && typeof elem.value === 'string' && elem.value.includes(str)) {
				num++
				if (debug) {
					console.log("// As part of condition")
				}
			}

			// Set as memory variable
			if (elem.type == 'edit_memory' && elem.value && elem.value.set) {
				elem.value.set.forEach(function(item) {

					// Set variable to string
					if ( item.value && typeof item.value == 'string' && item.value.includes(str) ) {
						num++
						if (debug) {
							console.log("// Set as memory variable")
						}
					}

					// Set variable to object
					if ( item.value && typeof item.value == 'object' ) {
						check_obj(item.value, str, debug)
					}
				})

				elem.value.unset.forEach(function(item) {
					if  (typeof item == 'string' && item.includes(str) ) {
						num++
						if (debug) {
							console.log("// Unset memory variable")
						}
					}
				})
			}

			if(elem.type == 'http' && elem.value && typeof elem.value.url == 'string') {
				if(elem.value.url.includes(str)){
					num++
					if (debug) {
						console.log("// Part of http URL")
					}
				}

				if(elem.value.header && elem.value.header.parameters) {
					num += check_obj(elem.value.header.parameters, str, debug)
					if (debug) {
						console.log("// Part of http header")
					}
				}
				if ( elem.value.body ) {
					num += check_obj(elem.value.body, str, debug)
					if (debug) {
						console.log("// Part of http body")
					}
				}
			}

			// Part of Message to user
			if (elem.type == 'message' && elem.value && elem.value.en) {
				elem.value.en.forEach(function(item) {
					if ( item.value.includes(str) ) {
						num++
						if (debug) {
							console.log("// Part of Message to user")
						}
					}
				})
			}

			// as Requirement
			if (elem.data && typeof elem.data.name === 'string' && elem.data.name.includes(str)) {
				num++
				if (debug) {
					console.log("// Part of Requirement")
				}
			}

			// Check the element's children
			if (elem.children && elem.children.length > 0) {
				num += get_count(elem.children, str, debug)
			}

			// Check the element's actions
			if (elem.actions && elem.actions.length > 0) {
				num += get_count(elem.actions, str, debug)
			}

			// Left side of conditional
			if (elem.left && elem.left.length > 0) {
				num += get_count(elem.left, str, debug)
			}

			// Right side of conditional
			if (elem.right && elem.right.length > 0) {
				num += get_count(elem.right, str, debug)
			}

			// "If #entity is missing"
			if (elem.on_empty_condition ) {
				num += get_count([elem.on_empty_condition], str, debug)
			}

			// Validators
			if (elem.on_validation_condition ) {
				num += get_count([elem.on_validation_condition], str, debug)
			}
			
			// "If #entity is complete"
			if (elem.on_success_condition ) {
				num += get_count([elem.on_success_condition], str, debug)
			}

		})

		return num
	}
}

function check_obj(obj, str, debug){
	var num = 0
	for(var prop in obj) {
		if (prop.includes(str)) {
			num++
			if (debug) {
				console.log("// Set as memory variable (object/key)")
			}
		} else if (obj[prop] && obj[prop].includes(str)) {
			num++
			if (debug) {
				console.log("// Set as memory variable (object/value)")
			}
		}
	}
	return num
}


app.listen(config.PORT, () => console.log(`App started on port ${config.PORT}`));