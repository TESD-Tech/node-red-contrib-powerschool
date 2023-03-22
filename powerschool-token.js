const axios = require( 'axios' );
const https = require( 'https' );

var _internals = {};

_internals.getToken = function (props, cb) {

	const instance = axios.create({
		httpsAgent: new https.Agent({  
			rejectUnauthorized: props.ssl_reject
		})
	});
	
	const ps_hash = (new Buffer.from(
		props.client
		+ ":" 
		+ props.secret
	)).toString('base64');

	instance.post(
		'https://' + props.host + '/oauth/access_token',
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

		const node = this
		const globalContext = this.context().global
		const flowContext = this.context().flow
		
		this.on('input', function (msg) {
			// Retrieve the node's properties
			const props = {
				client: n.client,
				secret: n.secret,
				host: n.host,
				ssl_reject: (n.ssl_reject == 'true')
			}

			if ( n.clientType === 'global' ) {
				props.client = globalContext.get(n.client)
			} else if ( n.clientType === 'flow' ) {
				props.client = flowContext.get(n.client)
			} else if ( n.clientType === 'msg' ) {
				props.client = msg[n.client]
			}

			if ( n.secretType === 'global' ) {
				props.secret = globalContext.get(n.secret)
			} else if ( n.secretType === 'flow' ) {
				props.secret = flowContext.get(n.secret)
			} else if ( n.secretType === 'msg' ) {
				props.secret = msg[n.secret]
			}

			if ( n.hostType === 'global' ) {
				props.host = globalContext.get(n.host)
			} else if ( n.hostType === 'flow' ) {
				props.host = flowContext.get(n.host)
			} else if ( n.hostType === 'msg' ) {
				props.host = msg[n.host]
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

				_internals.getToken( props, function(result){
					if ( result.status === 200 ) {
						msg.ps_token = result.data
						msg.ps_token.host = props.host
						msg.ps_token.ssl_reject = props.ssl_reject

						msg.ps_token.expires = new Date()
						msg.ps_token.expires.setSeconds( msg.ps_token.expires.getSeconds() + result.data.expires_in )

						globalContext.set( 'ps_api', msg.ps_token )

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
