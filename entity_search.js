export var entity_search = function(req, res) {

	var obj = {}

	obj.output = ""

	obj.user_id =  req.body.user_id
	obj.bot_id =  req.body.bot_id
	obj.version_id = req.body.version_id
	obj.dev_token = req.body.dev_token
	obj.search_str = req.body.search_str

	res.write(`<p>Searching for ${obj.search_str} in version ${obj.version_id} of <a href="https://cai.tools.sap/${obj.user_id}/${obj.bot_id}">this bot</a><p><br>`)

	obj.url = "https://api.cai.tools.sap/train/v2/users/" + user_id + "/bots/" + bot_id + "/versions/" + version_id

	obj.get_entities = function() {
		
		var get_entities = {
			url:    obj.url + "/dataset/entities",
		   	method:  "GET",
		   	headers: obj.header
		}
	
		return rp.get(get_entities)	
	}
	
	obj.get_entity_enrich_keys = function(data) {
	
		var entities = JSON.parse(data).results
	
		return Promise.map(entities, function(entity) {
			var entity_slug = entity.slug
			
			if(entity.custom) {
				var get_enrich_keys = {
					url:    obj.url + "/dataset/entities/" + entity_slug + "/keys",
				   	method:  "GET",
				   	headers: obj.header
				}
	
				return rp.get(get_enrich_keys).then( data => { return obj.get_entity_enrich_values(data, entity_slug) })
			}
		})
	}
	
	obj.get_entity_enrich_values  = function(data, entity_slug) {
		var keys = JSON.parse(data).results
	
		Promise.map(keys, function(key) {
			var key_id = key.id
			var key_slug = key.slug
	
			var get_enrich_values = {
				url:    obj.url + "/dataset/entities/" + entity_slug + "/keys/" + key_id + "/enrichments",
			   	method:  "GET",
			   	headers: obj.header
			}
	
			return rp.get(get_enrich_values).then( data => { return obj.find_search_str_in_value(data) })
		})
	}
	
	obj.find_search_str_in_value = function(data) {
		var enrichments = JSON.parse(data).results.enrichments
		
		return Promise.map(enrichments, function(enrichment) {
			console.log(obj.search_str + " " + enrichment.value)
			if(enrichment.value.includes(search_str)){
				obj.output += '<br>\t' + key_slug + ': ' + enrichment.value
			}
		}, {concurrency: 1})
	}

	return obj
}