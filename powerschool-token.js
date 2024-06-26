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
        "grant_type=client_credentials",
        {
            headers: {
                "Authorization": "Basic " + ps_hash,
								"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            }
        }

    ).then(response => {
      cb(response.data, null);
    }).catch(error => {
      cb(null, {error: error, props: props});
    });
};

module.exports = function(RED) {
	'use strict';

	function Node(n) {
	  
		RED.nodes.createNode(this,n);

		const node = this
		const globalContext = this.context().global
		const flowContext = this.context().flow
		
		this.on('input', function (msg) {
			const datetime = new Date().toLocaleString()
			node.status({ fill: 'blue', shape: 'dot', text: datetime })

			// Retrieve the node's properties
			const props = {
				client: n.client ?? process.env.POWERSCHOOL_CLIENT_ID,
				secret: n.secret ?? process.env.POWERSCHOOL_CLIENT_SECRET,
				host: n.host ?? process.env.POWERSCHOOL_HOST,
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

				_internals.getToken( props, function(result, error){
          if (!msg.ps_token) {
            msg.ps_token = {
              host: props.host,
              ssl_reject: props.ssl_reject
            };
          } 
          else if (!msg.ps_token.host || !msg.ps_token.ssl_reject) {
            msg.ps_token.host = props.host;
            msg.ps_token.ssl_reject = props.ssl_reject;
          }

					// if ( error?.error && error?.error != {} ) {
					// 	node.status({ fill: 'red', shape: 'dot', text: JSON.stringify(error) })
					// 	node.error( JSON.stringify(error) );
					// 	return;
					// }

					// node.error(`Result: ${JSON.stringify(result)}`)

					if ( msg && msg.hasOwnProperty( 'ps_token' ) ) {
            try {
              msg.ps_token = result
              msg.ps_token.host = props.host
              msg.ps_token.ssl_reject = props.ssl_reject
  
              msg.ps_token.expires = new Date()
              msg.ps_token.expires.setSeconds( msg.ps_token.expires.getSeconds() + result.expires_in )
              node.warn( 'Token Expires: ' + msg.ps_token.expires )
              globalContext.set( 'ps_api', msg.ps_token )
              node.send(msg);
              
            } catch (error) {
              console.log(result, error)
            }

					} else {
						node.error( JSON.stringify(result) );
            node.send(msg);
					}
					
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