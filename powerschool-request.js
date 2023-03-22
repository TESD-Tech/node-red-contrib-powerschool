const axios = require( 'axios' )
const https = require( 'https' )

var _internals = {}

_internals.sendRequest = function ( request ) {
	const instance = axios.create({
		httpsAgent: new https.Agent({  
			rejectUnauthorized: request.ps_api.ssl_reject
		})
	})

	if ( request.method.toLowerCase() === 'get' ) {
		delete request.data
	}
	
	instance( request ).then((response) => {
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

			const request = {
				url: n.url || msg.url,
				method: n.method || msg.method,
				data: msg.payload || {},
				ps_api: msg.ps_api || globalContext.get('ps_api'),
				done: function(result, err) {
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
						msg.error = {"error": err, "detail": result.data }
						node.status({fill:'red',shape:'dot',text: 'Status: ' + result.status })
						node.send( [null, msg ])
					}
				}
			}

			node.warn( request )

			getProperty( n, msg, (err,property) => {
				if (err) {
					node.warn(err)
					done()
				} else {
					request.data = property
				}
			})

			node.warn( request )

			if ( !request.ps_api ) { 
				node.error( 'PowerSchool API Token Not Provided.' )
				node.send(msg)
			} else {
				_internals.sendRequest( request )
			}
		})
	}

	RED.nodes.registerType('powerschool-request', Node)
}
