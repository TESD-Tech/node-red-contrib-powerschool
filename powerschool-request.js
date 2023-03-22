const axios = require( 'axios' )
const https = require( 'https' )

var _internals = {}

_internals.extractTableFromUrl = function ( url ) {
	const regex = /\/ws\/schema\/table\/([^/]+)/
	const match = url.match( regex )
	if ( match && match[1] ) {
		return match[1]
	} else {
		return null
	}
}

_internals.extractIdFromUrl = function ( url ) {
	const regex = /\/(\d+)$/
	const match = url.match( regex )
	if ( match && match[1] ) {
		return match[1]
	} else {
		return null
	}
}

_internals.reshapePayload = function (payload, url, method) {
	const table = _internals.extractTableFromUrl(url)
	method = method.toLowerCase()
	let id = _internals.extractIdFromUrl(url)

	// if (method.toLowerCase === "put") {
	// 	id = _internals.extractIdFromUrl(url)
	// } else if (method === "post") {
	// 	id = payload.tables[table].studentsdcid
	// }

	// Strip studentsdcid from URL
	url = url.replace(`/${id}`, "")

  const reshapedPayload = {
    tables: {
      [table]: {
        ...payload.tables[payload.name]
      }
    }
  }

	if( ["post", "put"].includes(method) ) {
		if (method === "post") {
			reshapedPayload.tables[table].studentsdcid = id
			return {
				method: "PUT",
				payload: reshapedPayload,
				url: url + "/" + id
			}
		} else if (method === "put") {
			reshapedPayload.name = table
			return {
				method: "POST",
				payload: reshapedPayload,
				url: url
			}
		}
	} else {
		throw new Error("Invalid method: " + method)
	}
}


_internals.sendRequest = function ( request ) {
	console.log(request)
	const instance = axios.create({
		httpsAgent: new https.Agent({  
			rejectUnauthorized: request.ps_api.ssl_reject
		})
	})

	// Build the request
	let this_request = {
		headers: {
			"Authorization": "Bearer " + request.ps_api.access_token,
			"Content-Type": "application/json",
			"Accept": "application/json"
		},
		method: request.method ?? 'POST',
		url: request.url
	}

	// Add the data if it exists and method is not GET
	if ( request.data && request.method.toLowerCase() !== 'get' ) {
		this_request.data = request.data
	}
	
	instance( this_request ).then((response) => {
		request.done( response, null )
	}).catch((error) => {
		if ( error.response.status === 404 ) {
			if( error.response.data !== undefined) {
				if( error.response.data.message.includes('Use POST to insert a new record') || error.response.data.message.includes('Use PUT to update existing records') ) {
					console.log("Reshaping payload")
					let reshaped_request = { ...request }

					const reshapedPayload = _internals.reshapePayload( request.data, request.url, request.method )

					reshaped_request.method = reshapedPayload.method
					reshaped_request.url = reshapedPayload.url
					reshaped_request.data = reshapedPayload.payload

					_internals.sendRequest( reshaped_request )
				} else {
					request.done( error.response, `URL: ${this_request.url},  Error: ${error}` )
				}
			} else {
				request.done( error.response, `URL: ${this_request.url},  Error: ${error}` )
			}
		} else {
			request.done( error.response, `URL: ${this_request.url},  Error: ${error}` )
		}
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
			const datetime = new Date().toLocaleString()
			node.status({ fill: 'blue', shape: 'circle', text: datetime })

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
							msg.error = {"error": err, "detail": result }
							node.status({fill:'red',shape:'dot',text: 'Status: ' + result.status })
							node.send( [null, msg ])
						}
					} else {
						msg.error = {"error": err, "detail": result }
						node.status({fill:'red',shape:'dot',text: 'Status: ' + result.status })
						node.send( [null, msg ])
					}
				}
			}

			getProperty( n, msg, (err,property) => {
				if (err) {
					node.warn(err)
					done()
				} else {
					request.data = property
				}
			})

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
