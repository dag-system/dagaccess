var Promise = require('bluebird');
var ip = require('ip');
var fs = require('fs');
const uuidv1 = require('uuid/v1');
var queries = require('./lib/Queries/queries');
var logger = require('./lib/Logger/Logger').create();
module.exports.logger = logger;
var clientId = uuidv1();
var highwayUrl = '';
var idresort = '';
var imgPath = '';
var ctrlPath = '';
var soundPath = '';
const player = require('node-wav-player');
const { exec } = require('child_process');
logger.log('info','Node version : ' + process.version);
var projectInfo = require('./package.json');
logger.log('info',projectInfo.description + 'version : ' +  projectInfo.version);

var cpuType = 'ARM';
exec('lscpu | grep -A 0 \'Architecture\'',(err, stdout, stderr) => {
	if (err) {
		logger.log('error','CPU Type error :' + err.toString());
	return;
	}
	logger.log('info','CPU Type :' + stdout.toString());
	if(stdout.toString().indexOf('x86') > 0){
		cpuType = 'x86';
	}
	else{
		cpuType = 'ARM';
	}
	logger.log('info','CPU Type :' + cpuType);
});

var knex = null;

// region Folder Management
var configPath = __dirname+'/config';
if (!fs.existsSync(configPath)){
	fs.mkdirSync(configPath);
}

// Create Upload Directories
var uploadPath = __dirname+'/upload';
if (!fs.existsSync(uploadPath)){
	fs.mkdirSync(uploadPath);
}

var publicPath = __dirname+'/public';
if (!fs.existsSync(publicPath)){
	fs.mkdirSync(publicPath);
}
// endregion Folder Management

// region Config Management
var config = require('./config/config');
var configJson = config;

// Load config from config.json
if (fs.existsSync(configPath + '/config.json')){
	configJson = JSON.parse(fs.readFileSync(configPath + '/config.json', 'utf-8'));
}
else{
  fs.writeFileSync(configPath + '/config.json',JSON.stringify(config, null, 2));
}
logger.log('info',`configJson: ${JSON.stringify(configJson)}`);

if(configJson.clientId == null){
	configJson.clientId = clientId;
	fs.writeFileSync(configPath + '/config.json',JSON.stringify(config, null, 2));
}
else{
	clientId = configJson.clientId;
}

var ws281x = null;
var NUM_LEDS = configJson.numLed || 24;
var pixelData = new Uint32Array(NUM_LEDS);
var tmrTimeoutLED = null;
var brightnessLED = configJson.brightnessLED;
/* Config à faire sur Raspberry
La sortie audio doit être désactivée. Pour cela, nous éditons le fichier
  sudo nano /etc/modprobe.d/snd-blacklist.conf
Ici nous ajoutons la ligne suivante:
  blacklist snd_bcm2835
Nous devons également éditer le fichier de configuration:
  sudo nano /boot/config.txt
Ci-dessous se trouvent les lignes avec le contenu suivant (avec Ctrl + W vous pouvez chercher):
  # Enable audio (loads snd_bcm2835)
  dtparam=audio=on
Cette ligne du bas est commentée avec un hashtag # au début de la ligne:
  #dtparam=audio=on
*/

if(configJson.ledConnected){
	ws281x = require('rpi-ws281x-native');
	const optionsLed = {
		dma: 10,
		freq: 800000,
		gpio: 18,
		invert: false,
		brightness: brightnessLED,
		stripType: 'ws2812'
	};
	ws281x.init(NUM_LEDS,optionsLed);
	// ---- trap the SIGINT and reset before exit
	process.on('SIGINT', function () {
		clearTimeout(tmrTimeoutLED);
		ws281x.reset();
		process.nextTick(function () { process.exit(0); });
	});
}

var mixerName = 'Headphone';
if(!configJson.ledConnected){
	exec('amixer | grep \'Simple mixer control\'',(err, stdout, stderr) => {
		if (err) {
			logger.log('error','Get Mixer Type error :' + err.toString());
			return;
		}
		logger.log('info','Mixer Type answer :' + stdout.toString());
		mixerName = stdout.toString().split("Simple mixer control ")[1].split('\n')[0];
		logger.log('info','Mixer Type :' + mixerName);
	});
}


// endregion Config Management

// region tcpClient to Java Connexion Management

var tcpCnx = require('./lib/tcp/tcp');
var logTCPRX = false;

tcpOnConnect = function(cnx){
	logger.log('info','DAG Access tcpClient connected to ' + cnx.ip + ':' + cnx.port);
	tcpCnx.write({clientId:clientId,msgType:"connect"},false);
	wsBroadcast({msgType:'tcpConnected'});
};

tcpOnData = function(cnx,dataRx){
	if(logTCPRX) logger.log('verbose','Mytcp ' + cnx.ip + ':' + cnx.port + ' RX : ' + dataRx);
	var data = JSON.parse(dataRx);
	switch (data.msgType) {
		case 'hello':
			if(configJson.ledConnected){
				showLED("#FFFFFF",32,1);
			}
			imgPath = data.payLoad.imgPath;
			imgPath = imgPath.replace(/C:/g,'\\\\' + configJson.tcpIp) + '/';
			console.log('imgPath:' + imgPath);
			serverApp.get('/photo/:file', function(req, res) {
				logger.log('verbose',":File : " + imgPath + req.params.file);
				res.sendFile(imgPath + req.params.file,function (err) {
					if (err) {
						logger.log('error',err.toString());
						res.status(err.status).sendFile(__dirname + '/client/image/nobody.png');
					}
					else {
						logger.log('verbose','Sent: '+ imgPath + req.params.file);
					}
				});
			});
			ctrlPath = data.payLoad.ctrlPath;
			ctrlPath = ctrlPath.replace(/C:/g,'\\\\' + configJson.tcpIp) + '/';
			console.log('ctrlPath:' + ctrlPath);
			serverApp.get('/ctrl/:uid/:file', function(req, res) {
			logger.log('verbose',":ctrl File : " + ctrlPath + '/' + req.params.uid + '/' + req.params.file);
			res.sendFile(ctrlPath + '/' + req.params.uid + '/' + req.params.file,function (err) {
				if (err) {
				logger.log('error',err.toString());
				res.status(err.status).sendFile(__dirname + '/client/image/nobody.png');
				}
				else {
				logger.log('verbose','Sent: '+ ctrlPath + '/' + req.params.file.split('_')[0] + '/' + req.params.file);
				}
			});
			});
			soundPath = data.payLoad.soundPath;
			soundPath = soundPath.replace(/C:/g,'\\\\' + configJson.tcpIp) + '/';
			console.log('soundPath:' + soundPath);
			serverApp.get('/audio/:file', function(req, res) {
			logger.log('verbose',":File : " + soundPath + req.params.file);
			res.sendFile(soundPath + req.params.file);
			});
			highwayUrl = data.payLoad.hwyURL;
			idresort = data.payLoad.hwyResortID;

			if(data.payLoad.screenState != null){
				switch (data.payLoad.screenState) {
				case 1:
				logger.log('info','HELLO ON SCREEN');
				exec("bash -c 'sleep 0.1 && xset dpms force on'",(err, stdout, stderr) => {
					if (err) {
					logger.log('error','onScreen error :' + err.toString());
					return;
					}
				});
					
				break;
				
				case 0:
				logger.log('info','HELLO OFF SCREEN');
				exec("bash -c 'sleep 0.1 && xset dpms force off'",(err, stdout, stderr) => {
					if (err) {
					logger.log('error','offScreen error :' + err.toString());
					return;
					}
				});

				break;
				
				default:
				break;
				}
			}

			if(data.payLoad.dbInfo){
			knexConnection = {
				client: 'mysql',
				connection: {
				host : data.payLoad.dbInfo.urlDatabase,
				port : data.payLoad.dbInfo.portDatabase,
				user : data.payLoad.dbInfo.loginDatabase,
				password : data.payLoad.dbInfo.passwordDatabase,
				database : data.payLoad.dbInfo.nameDatabase,
				multipleStatements: true,
				compress: 1,
				charset: 'utf8'
				},
				pool: { min: 0, max: 20 }
			}
			// Creation of connection to Main Database
			knex = require('knex')(knexConnection);
			knex.select(knex.raw('count(*) AS cpt')).from('event_json').then((resEvent) => {
				logger.log('verbose','Number of events in database : ' + resEvent[0].cpt);
			}).
			catch((e) => {
				logger.log('error',e.toString());
			});
			data.payLoad.dbInfo = null;
			}
			wsBroadcast(data);
		break;

		case 'goodbye':
			wsBroadcast(data);
		break;

		case 'event':
			wsBroadcast(data);
			switch(data.payLoad.type){
			case "ok":
			case "ko":
			case "alreadyOk":
			case "alreadyKo":
				if(configJson.ledConnected){
					showLED_RGB(data.payLoad.ticket.visual);
				}
				logger.log('info','ticket sound : ' + data.payLoad.ticket.sound);
				if(data.payLoad.ticket.sound.length > 0 && !configJson.ledConnected){
					logger.log('info','play : ' + soundPath + data.payLoad.ticket.sound);
					player.play({
						path: soundPath + data.payLoad.ticket.sound,
					}).then(() => {
						//logger.log('info','The wav file started to be played successfully.');
					}).catch((error) => {
						logger.log('error',error.toString());
					});
				}
				data.msgType = 'ack';
				delete data.payload;
				tcpCnx.write(data,true);
				break;

			case "idle":
			case "freeTurnstile":
				if(configJson.ledConnected){
					showLED_RGB(data.payLoad.ticket.visual);
				}
				logger.log('info','msgAudio sound : ' + data.payLoad.audio.msgAudio);
				if(data.payLoad.audio.msgAudio.length > 0 && !configJson.ledConnected){
					logger.log('info','play : ' + soundPath + data.payLoad.audio.msgAudio);
					player.play({
						path: soundPath + data.payLoad.audio.msgAudio.split(':')[1].replace(/>/g,''),
					}).then(() => {
						//logger.log('info','The wav file started to be played successfully.');
					}).catch((error) => {
						logger.log('error',error.toString());
					});
				}
				data.msgType = 'ack';
				delete data.payload;
				tcpCnx.write(data,true);
				break;

			case "abortTurnstile":
				if(configJson.ledConnected){
					showLED("#000000");
				}
				break;
			default:
			}
			break;

		case 'data':
			if(data.msgId.SocketID != null){
				wsSendToOther(data,data.msgId.SocketID);
			}
			else{
				wsBroadcast(data);
			}

			if(data.payLoad.screenState != null){
				switch (data.payLoad.screenState) {
					case -1:
						case 1:
						logger.log('info','DATA ON SCREEN');
						exec("bash -c 'sleep 0.1 && xset dpms force on'",(err, stdout, stderr) => {
							if (err) {
							logger.log('error','onScreen error :' + err.toString());
							return;
							}
						});
					
						break;
					
					case 0:
						logger.log('info','DATA OFF SCREEN');
						exec("bash -c 'sleep 0.1 && xset dpms force off'",(err, stdout, stderr) => {
							if (err) {
							logger.log('error','offScreen error :' + err.toString());
							return;
							}
						});
							break;
				
					default:
					break;
				}
			}
			break;

		default:
			if(data.msgId.SocketID != null){
				wsSendToOther(data,data.msgId.SocketID)
			}
			else{
				wsBroadcast(data);
			}
	}
};

tcpOnClose = function(cnx){
	logger.log('warn','Connection closed :' + JSON.stringify(cnx));
};

tcpOnError = function(cnx,err){
	if(configJson.ledConnected){
		showLED("#FF0000",32,0.1);
	}
	logger.log('error','Connection error :' + JSON.stringify(cnx) + ' - Error :' + JSON.stringify(err));
	wsBroadcast({msgType:'tcpDisconnected'});
};

logger.log('info', 'Create tcp connection to : ' + configJson.tcpIp + ':' + configJson.tcpPort);
tcpCnx.create(configJson.tcpIp,configJson.tcpPort,tcpOnConnect,tcpOnData,tcpOnClose,tcpOnError);

// endregion tcpClient to Java Connexion Management

// region Http server Connexion Management

var express    = require('express');        // call express
var compress = require('compression');
var bodyParser = require('body-parser');
var ejs = require('ejs');

var httpPort = configJson.httpPort; // set application httpPort
var serverApp = express();
const fileUpload = require('express-fileupload');

serverApp.use(bodyParser.json()); // for parsing application/json
serverApp.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

serverApp.set('view engine', 'html');
serverApp.engine('html', ejs.renderFile);
serverApp.engine('js', ejs.renderFile);
serverApp.engine('css', ejs.renderFile);



// Open access to public folder
serverApp.use(express.static(__dirname + '/public'));
serverApp.use(express.static(__dirname + '/client/image'));

serverApp.use(fileUpload());

serverApp.all("*",function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
	res.setHeader('X-Powered-By', 'DAG System - Jetcode Engine');
	res.setHeader('Server', 'Jetcode Server - Expressjs');
	logger.log('info',`req.body: ${JSON.stringify(req.body)}`);
	next();
})



serverApp.get('/', function(req, res) {
	var platformScriptPath = __dirname + '/client/';
	res.sendFile(platformScriptPath + 'index.html');
});

serverApp.get('/:file', function(req, res) {
	var platformScriptPath = __dirname + '/client/';
	var file = req.params.file;
	if(file.indexOf('.') == -1){
	file += '.html';
	}
	res.sendFile(platformScriptPath + file);
});


serverApp.get('/image/:file', function(req, res) {
	var platformScriptPath = __dirname + '/client/image/';
	logger.log('verbose',":File : " + platformScriptPath + req.params.file);
	res.sendFile(platformScriptPath + req.params.file);
});

serverApp.get('/css/:file', function(req, res) {
	var platformScriptPath = __dirname + '/client/css/';
	res.setHeader('Content-Type', 'text/css');
	logger.log('verbose',"/css/:file : " + platformScriptPath + req.params.file);
	res.sendFile(platformScriptPath + req.params.file);
});

serverApp.get('/js/:file', function(req, res) {
	var platformScriptPath = __dirname + '/client/js/';
	logger.log('verbose',"/js/:file : " + platformScriptPath + req.params.file);
	res.setHeader('Content-Type', 'application/javascript');
	res.render(platformScriptPath + req.params.file,{ip:ip.address() + ":" + httpPort,ipdataname:configJson.ipdatabasename,websocketIp:ip.address(),websocketPort:configJson.websocketServerPort,version:projectInfo.version});
	// res.render(platformScriptPath + req.params.file,{ip:'192.168.0.74' + ":" + port,ipdataname:configJson.ipdatabasename});
});

serverApp.get('/wav/:file', function(req, res) {
	var platformScriptPath = soundPath;
	logger.log('verbose',"/wav/:file : " + platformScriptPath + req.params.file);

	res.setHeader('Content-Type', 'text/plain');
	res.send(fs.readFileSync(platformScriptPath + req.params.file,'base64'));
	// res.render(platformScriptPath + req.params.file,{ip:'192.168.0.74' + ":" + port,ipdataname:configJson.ipdatabasename});
});


serverApp.get('/upload/:file', function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT");
	res.header("Access-Control-Allow-Headers", "Content-Type");
	var uploadPath = __dirname + '/upload/';
	res.setHeader('Content-Type', 'text/plain');
	logger.log('verbose',"/upload/:file : " + uploadPath + req.params.file);
	res.sendFile(uploadPath + req.params.file);
});


// Upload route.
serverApp.post('/upload', function(req, res) {

	if (!req.files)	return res.status(400).send('No files were uploaded.');

	// The name of the input field (i.e. "uploadFile") is used to retrieve the uploaded file
	let uploadFile = req.files.uploadFile;

	// Use the mv() method to place the file somewhere on your server
	uploadFile.mv(uploadPath + '/' + uploadFile.name, function(err) {
		if (err) return res.status(500).send(err);
		res.end("File is uploaded");
			//res.send('<div style="font-size:20px">File uploaded!</div>');
	});
});

// Start Serveur for sample page with JETCodesconst WebSocket = require('ws');
serverApp.listen(httpPort);
logger.log('info','DAG Access HTTP Server listening on port ' + httpPort + ', clientId:' + clientId);

// endregion Http server Connexion Management

// region Websocket server Connexion Management

var WebSocketServer = require("ws");

var colWebSocketClient = new Object();
var NbjetcodeClient = 0;

var logWebRX = false;
var logWebTX = false;

var wsHttpConfig = {
  port: configJson.websocketServerPort,
  bundle: true,
  static: './'
};
logger.log('warn','DAG Access Websocket serveur config:' + JSON.stringify(wsHttpConfig));
var wss = new WebSocketServer.Server(wsHttpConfig);

try {
  // WebSocket Managment
  // wss.on('connection', function (ws) { // for ws version <3.0.0
  wss.on('connection', function (ws,req) { // New for ws version >3.0.0
    // Add a client
    ws.upgradeReq = req; // New for ws version >3.0.0
    SocketID = ws.upgradeReq.headers['sec-websocket-key'];
    colWebSocketClient[SocketID] = ws;
    NbjetcodeClient = wss.clients.size;
    logger.log('info','Opening WEBSocket - NbSocketOpen = ' +  NbjetcodeClient + ' Current Socket ID :' + SocketID);

    ws.on("message", function (str) {
      var objWebRx = JSON.parse(str);
      var currentSocketID = ws.upgradeReq.headers['sec-websocket-key'];
      if(logWebRX) logger.log('verbose','WEBSocket RX:' +  str + ' Current Socket ID :' + currentSocketID);

      switch (objWebRx.messageType) {
		case 'init':
			try{
				var tx = {"msgType":"command","payLoad":{"dataType":"getInfo"}};
				tx.msgId = {
					SocketID: currentSocketID
				}
				tx.clientId = clientId;
				tcpCnx.write(tx,false);
			}
			catch(e){

			}
			break;

        case 'configLog':
			if(objWebRx.content != null){
				tcpCnx.setLOG(objWebRx.content.logSocketRX,objWebRx.content.logSocketTX);
				logTCPRX = objWebRx.content.logTCPRX;
				logWebRX = objWebRx.content.logWebRX;
				logWebTX = objWebRx.content.logWebTX;
			}
			break;

        case 'tx':
			try{
				var tx = JSON.parse(objWebRx.content);
				if(objWebRx.broadcast == false || objWebRx.broadcast == null)
					if(tx.msgId == null){
					tx.msgId = {
					SocketID: currentSocketID
					}
				}
				else{
					tx.msgId.SocketID = currentSocketID;
				}
				tx.clientId = clientId;
				tcpCnx.write(tx,false);
			}catch(e){

			}
			break;

        case 'resetTCP':
			tcpCnx.end({msgType:'close',clientId:clientId});
			setTimeout(function(){
				tcpCnx.connect();
			},100);
			break;

        case 'getTagHisto':
            knex.raw(queries.reqTagHisto,{tagId:'%' + objWebRx.tagId + '%',type:knex.raw("'ok','ko'"),nb:objWebRx.nb,offset:objWebRx.offset}).then((reqTagHisto) => {
                var sendParam = {
                    fromUI:true,
                    msgType:'tagHisto',
                    nb:objWebRx.nb,
                    offset:objWebRx.offset,
                    histo:reqTagHisto[0]
                }
                wsSend(sendParam,currentSocketID);
            }).
            catch((e) => {
                logger.log('error','getTagHisto error =>',e.toString());
            });
            break;

        case 'getCheckpointHisto':
            knex.raw(queries.reqCheckPointHisto,{date:objWebRx.date,nb:objWebRx.nb,offset:objWebRx.offset}).then((reqTagHisto) => {
                var sendParam = {
                    fromUI:true,
                    msgType:'checkPointHisto',
                    nb:objWebRx.nb,
                    offset:objWebRx.offset,
                    histo:reqTagHisto[0]
                }
                wsSend(sendParam,currentSocketID);
            }).
            catch((e) => {
                logger.log('error','getCheckpointHisto error =>',e.toString());
            });
            break;

        case 'getNbPassageByDay':
            knex.raw(queries.reqNbPassageByDay,{nb:objWebRx.nb,offset:objWebRx.offset}).then((reqNbPassageByDay) => {
                var sendParam = {
                    fromUI:true,
                    msgType:'nbPassageByDay',
                    nb:objWebRx.nb,
                    offset:objWebRx.offset,
                    histo:reqNbPassageByDay[0]
                }
                wsSend(sendParam,currentSocketID);
            }).
            catch((e) => {
                logger.log('error','getNbPassageByDay error =>',e.toString());
            });
            break;

        case 'getNbTagPassageByDay':
            knex.raw(queries.reqNbTagPassageByDay,{tagId:'%' + objWebRx.tagId + '%',nb:objWebRx.nb,offset:objWebRx.offset}).then((reqNbPassageByDay) => {
                var sendParam = {
                    fromUI:true,
                    msgType:'nbTagPassageByDay',
                    nb:objWebRx.nb,
                    offset:objWebRx.offset,
                    histo:reqNbPassageByDay[0]
                }
                wsSend(sendParam,currentSocketID);
            }).
            catch((e) => {
                logger.log('error','getNbTagPassageByDay error =>',e.toString());
            });
            break;

        case 'getVolume':
            if(configJson.ledConnected){
                var sendParam = {
                    fromUI:true,
                    msgType:'getVolume',
                    volumeValue:Math.floor(brightnessLED/255*100)
                }
                logger.log('info',`getBrigthness :${Math.floor(brightnessLED/255*100)}%`);
                wsSend(sendParam,currentSocketID);
                return;
            }
            exec(`amixer sget ${mixerName} | grep 'Mono:' | awk -F'[][]' '{ print $2 }'`,(err, stdout, stderr) => {
                if (err) {
                    logger.log('error','getVolume error :' + err.toString());
                    return;
                }
                logger.log('info','getVolume :' + stdout.toString());
                var sendParam = {
                    fromUI:true,
                    msgType:'getVolume',
                    volumeValue:stdout.toString().replace('%\n','')
                }
                wsSend(sendParam,currentSocketID);
            });
            break;

        case 'setVolume':
            if(configJson.ledConnected){
                brightnessLED = Math.floor(255*objWebRx.volumeValue/100);
                logger.log('info',`setBrigthness :${objWebRx.volumeValue}%`);
                ws281x.setBrightness(brightnessLED);
                return;
            }
            exec(`amixer sset ${mixerName} ${objWebRx.volumeValue}%`,(err, stdout, stderr) => {
                if (err) {
                    logger.log('error','setVolume error :' + err.toString());
                    return;
                }
                logger.log('info','setVolume :' + objWebRx.volumeValue + '%');
                player.play({
                    path: publicPath + '/dist/wav/Ting.wav',
                }).then(() => {
                    //logger.log('info','The wav file started to be played successfully.');
                }).catch((error) => {
                    logger.log('error',error.toString());
                });
            });
            break;

        case 'getCPUTemp':
          switch(cpuType){
            case 'ARM':
                exec('/opt/vc/bin/vcgencmd measure_temp',(err, stdout, stderr) => {
                    if (err) {
                        logger.log('error','temp error :' + err.toString());
                        return;
                    }
                    logger.log('info','CPU Temp :' + stdout.toString());
                    var temp = stdout.toString().split('=')[1].replace(/\n/g,'');
                    var sendParam = {
                        fromUI:true,
                        msgType:'getCPUTemp',
                        cpuTemperature:temp
                    }
                    wsSend(sendParam,currentSocketID);
                });
                break;
            case 'x86':
                exec('sensors | grep -A 0 \'Core 0:\' | cut -c16-19',(err, stdout, stderr) => {
                    if (err) {
                        logger.log('error','temp error :' + err.toString());
                        return;
                    }
                    var temp = stdout.toString();
                var sendParam = {
                    fromUI:true,
                    msgType:'getCPUTemp',
                    cpuTemperature:temp
                }
                wsSend(sendParam,currentSocketID);
                });
                break;
            }
            break;

        case 'reboot':
          setTimeout(function(){
                logger.log('info','>>>>>>>>>>>>>>>>>>>>> REBOOT <<<<<<<<<<<<<<<<<<<<<<<<<<<<');
                exec('sudo reboot',(err, stdout, stderr) => {
                    if (err) {
                        logger.log('error','reboot error :' + err.toString());
                        return;
                    }
                });
            },2000);
          break;

        case 'offScreen':
               logger.log('info','IHM OFF SCREEN');
               exec("bash -c 'sleep 0.1 && xset dpms force off'",(err, stdout, stderr) => {
                   if (err) {
                       logger.log('error','offScreen error :' + err.toString());
                       return;
                   }
               });
          break;

        case 'onScreen':
               logger.log('info','IHM ON SCREEN');
               exec("bash -c 'sleep 0.1 && xset dpms force on'",(err, stdout, stderr) => {
                   if (err) {
                       logger.log('error','onScreen error :' + err.toString());
                       return;
                   }
               });
          break;

        default:

      }

    })

    ws.on('error', function() {
        SocketID = ws.upgradeReq.headers['sec-websocket-key'];
        delete colWebSocketClient[SocketID];
        logger.log('warn','jetcode WebSocket Error ' + type + ' : ' + SocketID + ' gone.');
    })

    ws.on("close", function() {
        SocketID = ws.upgradeReq.headers['sec-websocket-key'];
        delete colWebSocketClient[SocketID];
        NbjetcodeClient = wss.clients.size;
        logger.log('info','Closing WEBSocket - NbSocketOpen = ' + NbjetcodeClient,'Current Socket ID :' + SocketID);
    })
  });
}
catch (e) {
  logger.log('error','Websocket error on set WebSocketServer: ' + JSON.stringify(e));
}

function wsSend(sendParam,CurrentSocketID){
    try{
        colWebSocketClient[CurrentSocketID].send(JSON.stringify(sendParam));
    }catch (e){
        logger.log('error','TX Websocket error: ' + JSON.stringify(e));
    }
};

function wsBroadcast(sendParam) {
    if(logWebTX) logger.log('verbose',"TX broadcast message: " + JSON.stringify(sendParam));
    var cptTX = 0;
    for (var indice in colWebSocketClient) {
        cptTX++;
        if(colWebSocketClient[indice].readyState === WebSocketServer.OPEN){
            colWebSocketClient[indice].send(JSON.stringify(sendParam));
        }
    }
};

function wsSendToOther(sendParam,id) {
    if(id != null){
        try{
            colWebSocketClient[id].send(JSON.stringify(sendParam));
        }
        catch (e){
            logger.log('error','TX Websocket error: ' + JSON.stringify(e));
        }
    }
};

// endregion Websocket server Connexion Management

// region LED function
const rgb2hex = (rgb) => {
  if (rgb.search("rgb") === -1) return rgb;
  rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
  const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
  return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
};

function hsl2rgb(h,s,l) 
{
  let a= s*Math.min(l,1-l);
  let f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
  //return [f(0),f(8),f(4)];
  return `#${("0" + Math.ceil(f(0)*255).toString(16)).slice(-2)}${("0" + Math.ceil(f(8)*255).toString(16)).slice(-2)}${("0" + Math.ceil(f(4)*255).toString(16)).slice(-2)}`.toUpperCase();
} 

function setLEDColor(led,color){
    console.log("allume LED : " + led + " avec la couleur :",color);
    if(color.indexOf("#")>= 0){
        color = parseInt(rgb2hex(color).replace(/#/g,''),16);
    }
    pixelData[led] = color;
    ws281x.render(pixelData);
}

function setBrighness(color){
    if(color.indexOf("#")>= 0){
        color = parseInt(rgb2hex(color).replace(/#/g,''),16);
    }
    for(let i=0;i<pixelData.length;i++){
        pixelData[i] = color;
    }
    ws281x.render(pixelData);
}

function showLED(color,brightness=brightnessLED,timeoutLED=configJson.timeoutLED){
    clearTimeout(tmrTimeoutLED);
    if(color.indexOf("#")>= 0){
        color = parseInt(rgb2hex(color).replace(/#/g,''),16);
    }
    for(let i=0;i<pixelData.length;i++){
        pixelData[i] = color;
    }
    ws281x.render(pixelData);
    ws281x.setBrightness(brightness);
    if(timeoutLED > 0){
    logger.log('info',`showLED timeout = ${timeoutLED}s`);
    tmrTimeoutLED = setTimeout(showLED,timeoutLED*1000,"#000000",0,0);
    }
}

function showLED_RGB(rgb,brightness=brightnessLED,timeoutLED=configJson.timeoutLED){
  clearTimeout(tmrTimeoutLED);
  logger.log('info','showLED_RGB:' + JSON.stringify(rgb));
  switch (true) {
    case rgb.green == 1 && rgb.red == 0 && rgb.orange == 0:
        showLED("#00FF00",brightness,timeoutLED);
        break;
  
    case rgb.green == 0 && rgb.red == 1 && rgb.orange == 0:
        showLED("#FF0000",brightness,timeoutLED);
        break;
  
    case rgb.green == 0 && rgb.red == 0 && rgb.orange == 1:
        showLED("#FF8000",brightness,timeoutLED);
        break;
  
    default:
        let color = "#FF0000"
        for(let i=0;i<pixelData.length;i++){
        switch (true) {
            case i >= 0 && i < pixelData.length / 3:
                //logger.log('info','RED 1/3: ' + rgb.red);
                color = rgb.red > 1 ? hsl2rgb(Math.ceil((360/15)*rgb.red),1,0.5):rgb.red == 1 ?"#FF0000":"#000000";
                //logger.log('info','RED HSL 1/3: ' + color);
                break;
            case i >= pixelData.length / 3 && i < (pixelData.length / 3)*2:
                //logger.log('info','ORANGE 2/3: ' + rgb.orange);
                color = rgb.orange > 1? hsl2rgb(Math.ceil((360/15)*rgb.orange),1,0.5):rgb.orange == 1?"#FF8000":"#000000";
                //logger.log('info','ORANGE HSL 2/3: ' + color);
                break;
            case i >= (pixelData.length / 3)*2 && i < pixelData.length:
                //logger.log('info','GREEN 3/3: ' + rgb.green);
                color = rgb.green > 1? hsl2rgb(Math.ceil((360/15)*rgb.green),1,0.5):rgb.green == 1? "#00FF00": "#000000";
                //logger.log('info','GREEN HSL 2/3: ' + color);
                break;
            default:
                break;
        }
        color = parseInt(rgb2hex(color).replace(/#/g,''),16)
        pixelData[i] = color;
        }
        //logger.log('info',`pixelData= ${JSON.stringify(pixelData)}`);
        ws281x.render(pixelData);
        ws281x.setBrightness(brightness);
        if(timeoutLED > 0){
        logger.log('info',`showLED_RGB timeout= ${timeoutLED}s`);
        tmrTimeoutLED = setTimeout(showLED,timeoutLED*1000,"#000000",0,0);
        }
        break;
  }
}

// end region LED function
