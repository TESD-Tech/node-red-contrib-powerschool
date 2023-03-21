const axios = require( 'axios' );
const https = require( 'https' );

var _internals = {};

_internals.getToken = function (creds, cb) {
	var ssl_reject = true;

	if ( creds.ssl_reject == 'false' ) {
		ssl_reject = false;
	}

	const instance = axios.create({
		httpsAgent: new https.Agent({  
			rejectUnauthorized: ssl_reject
		})
	});
	
	const ps_hash = (new Buffer.from(
		creds.client
		+ ":" 
		+ creds.secret
	)).toString('base64');

	instance.post(
		'https://' + creds.host + '/oauth/access_token',
		null,
		{
			headers: {
				"Authorization": "Basic " + ps_hash,
				"Content-Type": "application/x-www-form-urlencoded"
			},
			params: { "grant_type": "client_credentials" }
		}
	).then((response) => {
		cb( response )
	}).catch((error) => {
		cb( error )
	})
	
};

module.exports = function(RED) {
	'use strict';

	function Node(n) {
	  
		RED.nodes.createNode(this,n);

		var node = this;
		var globalContext = this.context().global;
		
		this.on('input', function (msg) {
			
			// var creds = RED.nodes.getNode(n.creds);
			const creds = {
				client: RED.nodes.getNode(n.client),
				secret: RED.nodes.getNode(n.secret),
				host: RED.nodes.getNode(n.host),
				ssl_reject: RED.nodes.getNode(n.ssl_reject)
			}

			var ps_api = globalContext.get( 'ps_api' );
			var get_ps_token = true;

			if ( ps_api ) {
				if ( ps_api.hasOwnProperty( 'expires_in' ) ) {
					if ( ps_api.expires_in >= 120 ) { 
						get_ps_token = false;
					}
				}
			}

			if ( get_ps_token == true ) {
				node.warn( 'Generating New PS API Token' );

				_internals.getToken( creds, function(result){
					if ( result.status === 200 ) {
						msg.ps_token = result.data;
						msg.ps_token.host = creds.powerschool_host;

						msg.ps_token.expires = new Date();
						msg.ps_token.expires.setSeconds( msg.ps_token.expires.getSeconds() + result.data.expires_in );

						globalContext.set( 'ps_api', msg.ps_token );

					} else {
						node.error( result );
					}
					node.send(msg);
				});

			} else {

				ps_api.expires_in -= 120;
				globalContext.set( 'ps_api', ps_api );

				node.send( msg );


			}
		});
	}

	RED.nodes.registerType('powerschool-token', Node);
};
