// Configuration du port d'écoute
var httpPort = process.env.PORT || 8080;        // set application port
module.exports.httpPort = httpPort;

var websocketServerPort = 8088;
module.exports.websocketServerPort = websocketServerPort;


var tcpIp = '192.168.0.149'; // set application ip
module.exports.tcpIp = tcpIp;

var tcpPort = 5300;        // set application port
module.exports.tcpPort = tcpPort;

var ipdatabasename = '127.0.0.1:8080';
module.exports.ipdatabasename = ipdatabasename;

var ledConnected = true;
module.exports.ledConnected = ledConnected;