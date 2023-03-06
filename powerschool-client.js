module.exports = function(RED) {
    function RemoteServerNode(n) {
        RED.nodes.createNode(this,n);
        this.powerschool_host = n.powerschool_host;
        this.client_id = n.client_id;
        this.client_secret = n.client_secret;
    }
    RED.nodes.registerType("powerschool-client", RemoteServerNode);
}