const axios = require( 'axios' )
const https = require( 'https' )

var _internals = {}

_internals.sendRequest = function ( ps_api, method, url, data, done, token ) {
	const instance = axios.create({
		httpsAgent: new https.Agent({  
			rejectUnauthorized: ps_api.ssl_reject
		})
	})

	const config = {
		method: method ?? "POST",
		url: url,
		headers: {
				"Authorization": "Bearer " + ps_api.access_token,
				"Content-Type": "application/json",
				"Accept": "application/json"
			}
	}

	this.warn(config)

	if ( Object.keys( data ).length > 0 ) {
		config.data = data
	}

	if ( config.method.toLowerCase() === 'get' ) {
		delete config.data
	}
	
	instance( config ).then((response) => {
		done( response, null )
	}).catch((error) => {
		done( error.response, 'URL: ' + url + ',  Error: ' + error.message )
	})
	
}

module.exports = function(RED) {
	'use strict'

	// From @node-red/nodes/core/function/10-switch.js
	function getProperty(node,msg,done) {
		if (node.propertyType === 'jsonata') {
			RED.util.evaluateJSONataExpression(node.property,msg,(err,value) => {
				if (err) {
					done(RED._("switch.errors.invalid-expr",{error:err.message}))
				} else {
					done(undefined,value)
				}
			})
		} else if ( node.propertyType === 'ignore' ) {
			done( undefined, {} )
		} else {
			RED.util.evaluateNodeProperty(node.property,node.propertyType,node,msg,(err,value) => {
				if (err) {
					done(undefined,undefined)
				} else {
					done(undefined,value)
				}
			})
		}
	}

	function Node(n) {
	  
		RED.nodes.createNode(this,n)

		var node = this
		var globalContext = this.context().global
		
		this.on('input', function (msg) {

			var url = n.url || msg.url
			var method = n.method || msg.method
			var data = {}

			const ps_api = msg.ps_api || globalContext.get('ps_api')

			getProperty( n, msg, (err,property) => {
					if (err) {
						node.warn(err)
						done()
					} else {
						data = property
					}
				})


			if ( !ps_api ) { 
				node.error( 'PowerSchool API Token Not Provided.' )
				node.send(msg)
			} else {
				_internals.sendRequest( ps_api, method, url, data, function(result, err){
					if( result ) {
						if ( result.status === 200 ) {
							msg.payload = result.data
							node.status({fill:'green',shape:'dot',text: 'Status: 200'})
							node.send([msg, null])
						} else {
							msg.error = {"error": err, "detail": result.data }
							node.status({fill:'red',shape:'dot',text: 'Status: ' + result.status })
							node.send( [null, msg ])
						}
					} else {
						msg.error = {"error": err }
						node.status({fill:'red',shape:'dot' })
						node.send( [null, msg ])
					}
					
				})
			}


		})
	}

	RED.nodes.registerType('powerschool-request', Node)
}
