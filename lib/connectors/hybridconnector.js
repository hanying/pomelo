var util = require('util');
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var HybridSocket = require('./hybridsocket');
var Switcher = require('./hybrid/switcher');
var Handshake = require('./commands/handshake');
var Heartbeat = require('./commands/heartbeat');
var Kick = require('./commands/kick');
var protocol = require('pomelo-protocol');
var Message = require('pomelo-protocol').Message;

var curId = 1;

/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 */
var Connector = function(port, host, opts) {
  if (!(this instanceof Connector)) {
    return new Connector(port, host, opts);
  }

  EventEmitter.call(this);
  this.port = port;

  opts = opts || {};

  this.handshake = new Handshake(opts);
  this.heartbeat = new Heartbeat(opts);

  this.switcher = null;
};

util.inherits(Connector, EventEmitter);

module.exports = Connector;

/**
 * Start connector to listen the specified port
 */
Connector.prototype.start = function() {
  var self = this;
  this.tcpServer = net.createServer();
  this.switcher = new Switcher(this.tcpServer);

  this.switcher.on('connection', function(socket) {
    var hybridsocket = new HybridSocket(curId++, socket);

    hybridsocket.on('handshake',
      self.handshake.handle.bind(self.handshake, hybridsocket));

    hybridsocket.on('heartbeat',
      self.heartbeat.handle.bind(self.heartbeat, hybridsocket));

    hybridsocket.on('disconnect',
      self.heartbeat.clear.bind(self.heartbeat, hybridsocket.id));

    hybridsocket.on('closing', Kick.handle.bind(null, hybridsocket));

    self.emit('connection', hybridsocket);
  });

  this.tcpServer.listen(this.port);
};

Connector.prototype.close = function() {
  this.switcher.close();
  this.tcpServer.close();
};

Connector.prototype.composeResponse = function(msgId, route, msgBody) {
  // TODO: add message route compress
  return Message.encode(msgId, Message.TYPE_RESPONSE, 0,
                        null, protocol.strencode(JSON.stringify(msgBody)));
};

Connector.prototype.composePush = function(route, msgBody) {
  // TODO: add message route compress
  return Message.encode(0, Message.TYPE_PUSH, 0,
                        route, protocol.strencode(JSON.stringify(msgBody)));
};