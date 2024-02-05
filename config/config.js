// Configuration du port d'écoute
var httpPort = process.env.PORT || 8080;        // set application port
module.exports.httpPort = httpPort;

var websocketServerPort = 8088;
module.exports.websocketServerPort = websocketServerPort;


var tcpIp = '192.168.0.45'; // set application ip
module.exports.tcpIp = tcpIp;

var tcpPort = 5300;        // set application port
module.exports.tcpPort = tcpPort;

var ipdatabasename = '127.0.0.1:8080';
module.exports.ipdatabasename = ipdatabasename;

var ledConnected = false;
module.exports.ledConnected = ledConnected;

var numLed = 24;
module.exports.numLed = numLed;

var brightnessLED = 255;
module.exports.brightnessLED = brightnessLED;

var timeoutLED = 5;
module.exports.timeoutLED = timeoutLED;