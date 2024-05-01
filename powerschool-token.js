const axios = require('axios');
const https = require('https');

const BASE_URL = 'https://'; // Avoid string concatenation for the base URL

function createAxiosInstance(props) {
  return axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: props.ssl_reject,
    }),
  });
}

function getPsHash(client, secret) {
  return (new Buffer.from(`${client}:${secret}`)).toString('base64');
}

async function getAccessToken(props) {
  const instance = createAxiosInstance(props);
  const psHash = getPsHash(props.client, props.secret);

  try {
    const response = await instance.post(
      `${BASE_URL}${props.host}/oauth/access_token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${psHash}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(`Error retrieving access token: ${error}`);
  }
}

function getNodeProperties(node, context, propertyType) {
  const globalContext = context.global;
  const flowContext = context.flow;

  // Prioritize msg context first, then flow, then global
  return node[propertyType] ?? flowContext.get(node[propertyType]) ?? globalContext.get(node[propertyType]);
}

function isTokenValid(psApi) {
  if (!psApi || !psApi.expires_in) {
    return false;
  }
  const now = new Date();
  const expiry = new Date(psApi.expires);
  return expiry > now && (expiry.getTime() - now.getTime()) / 1000 >= 120; // Account for 2-minute buffer
}

module.exports = function (RED) {
  RED.nodes.createNode(this, function (n) {
    const node = this;

    // Retrieve properties using helper function
    const props = {
      client: getNodeProperties(n, this.context, 'client'),
      secret: getNodeProperties(n, this.context, 'secret'),
      host: getNodeProperties(n, this.context, 'host'),
      ssl_reject: n.ssl_reject === 'true',
    };

    this.on('input', async function (msg) {
      const datetime = new Date().toLocaleString();
      node.status({ fill: 'blue', shape: 'dot', text: datetime });

      let psApi = this.context().global.get('ps_api');
      let getPsToken = true;

      if (psApi) {
        getPsToken = !isTokenValid(psApi);
      }

      if (getPsToken) {
        node.warn('Generating New PS API Token');
        try {
          const token = await getAccessToken(props);

          if (!msg.hasOwnProperty('ps_token')) {
            msg.ps_token = {};
          }

          msg.ps_token = token;
          msg.ps_token.host = props.host;
          msg.ps_token.ssl_reject = props.ssl_reject;
          msg.ps_token.expires = new Date();
          msg.ps_token.expires.setSeconds(msg.ps_token.expires.getSeconds() + token.expires_in);
          node.warn(`Token Expires: ${msg.ps_token.expires}`);

          this.context().global.set('ps_api', msg.ps_token);
          node.send(msg);
        } catch (error) {
          node.error(error.message);
        }
      } else {
        psApi.expires_in -= 120; // Update remaining time
        this.context().global.set('ps_api', psApi);
        node.send(msg);
      }
    });
  });

  RED.nodes.registerType('powerschool-token', Node);
};
