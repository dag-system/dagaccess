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

var mixerName = 'Headphone';
exec('amixer | grep \'Simple mixer control\'',(err, stdout, stderr) => {
  if (err) {
    logger.log('error','Get Mixer Type error :' + err.toString());
    return;
  }
  logger.log('info','Mixer Type answer :' + stdout.toString());
  mixerName = stdout.toString().split("Simple mixer control ")[1].split('\n')[0];
  logger.log('info','Mixer Type :' + mixerName);
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
logger.log('info', JSON.stringify(configJson));

if(configJson.clientId == null){
  configJson.clientId = clientId;
  fs.writeFileSync(configPath + '/config.json',JSON.stringify(config, null, 2));
}
else{
  clientId = configJson.clientId;
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
      crtlPath = data.payLoad.ctrlPath;
      crtlPath = crtlPath.replace(/C:/g,'\\\\' + configJson.tcpIp) + '/';
      console.log('crtlPath:' + crtlPath);
      serverApp.get('/ctrl/:uid/:file', function(req, res) {
        logger.log('verbose',":ctrl File : " + crtlPath + '/' + req.params.uid + '/' + req.params.file);
        res.sendFile(crtlPath + '/' + req.params.uid + '/' + req.params.file,function (err) {
          if (err) {
            logger.log('error',err.toString());
            res.status(err.status).sendFile(__dirname + '/client/image/nobody.png');
          }
          else {
            logger.log('verbose','Sent: '+ crtlPath + '/' + req.params.file.split('_')[0] + '/' + req.params.file);
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
            compress: 1
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
          logger.log('info','ticket sound : ' + data.payLoad.ticket.sound);
          if(data.payLoad.ticket.sound.length > 0){
            logger.log('info','play : ' + soundPath + data.payLoad.ticket.sound);
            player.play({
              path: soundPath + data.payLoad.ticket.sound,
            }).then(() => {
              //logger.log('info','The wav file started to be played successfully.');
            }).catch((error) => {
              logger.log('error',error.toString());
            });
          }
          // else{
          //   logger.log('info','msgAudio sound : ' + data.payLoad.ticket.audio.msgAudio);
          //   if(data.payLoad.ticket.audio.msgAudio.length > 0){
          //     logger.log('info','play : ' + soundPath + data.payLoad.ticket.audio.msgAudio.split(':')[1].replace(/>/g,''));
          //     player.play({
          //       path: soundPath + data.payLoad.ticket.audio.msgAudio.split(':')[1].replace(/>/g,''),
          //     }).then(() => {
          //       //logger.log('info','The wav file started to be played successfully.');
          //     }).catch((error) => {
          //       logger.log('error',error.toString());
          //     });
          //   }
  
          // }
          data.msgType = 'ack';
          delete data.payload;
          tcpCnx.write(data,true);
          break;
        case "idle":
        case "freeTurnstile":
          logger.log('info','msgAudio sound : ' + data.payLoad.audio.msgAudio);
          if(data.payLoad.audio.msgAudio.length > 0){
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
      }
      break;

    case 'data':
      if(data.msgId.SocketID != null){
        wsSendToOther(data,data.msgId.SocketID)
      }else{
        wsBroadcast(data);
      }
    break;

    default:
      if(data.msgId.SocketID != null){
        wsSendToOther(data,data.msgId.SocketID)
      }else{
        wsBroadcast(data);
      }

  }
};

tcpOnClose = function(cnx){
  logger.log('warn','Connection closed :' + JSON.stringify(cnx));
};

tcpOnError = function(cnx,err){
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
  logger.log('info',JSON.stringify(req.body));
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

  if (!req.files)
    return res.status(400).send('No files were uploaded.');

  // The name of the input field (i.e. "uploadFile") is used to retrieve the uploaded file
  let uploadFile = req.files.uploadFile;

  // Use the mv() method to place the file somewhere on your server
  uploadFile.mv(uploadPath + '/' + uploadFile.name, function(err) {
    if (err)
      return res.status(500).send(err);
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
          //tcpCnx.destroy();
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
  logger.log('error','Websocket error on set WebSocketServer:',JSON.stringify(e),{sessionID:'WEBSocket Managment'});
}

function wsSend(sendParam,CurrentSocketID){
  try{
   var currentSessionID = colWebSocketClient[CurrentSocketID].sessionID;
   // logger.log('verbose',"TX sendParam: ",JSON.stringify(sendParam),{sessionID:currentSessionID});
   colWebSocketClient[CurrentSocketID].send(JSON.stringify(sendParam));
  }catch (e){
    logger.log('error','TX Websocket error',JSON.stringify(e),{sessionID:'WEBSocket Managment'});
  }
};

function wsBroadcast(sendParam) {
  if(logWebTX) logger.log('verbose',"TX broadcast message " + JSON.stringify(sendParam));
  var cptTX = 0;
  for (var indice in colWebSocketClient) {
    cptTX++;
    if(colWebSocketClient[indice].readyState === WebSocketServer.OPEN){
      //var currentSessionID = colWebSocketClient[indice].sessionID;
      // logger.log('verbose',"TX broadcast message to #",cptTX,indice,JSON.stringify(sendParam),{sessionID:sessionID});
      colWebSocketClient[indice].send(JSON.stringify(sendParam));
    }
  }
  // logger.log('verbose',"TX broadcast message to ",cptTX,"Clients",{sessionID:sessionID});
};

function wsSendToOther(sendParam,id) {
  if(id != null){
    try{
      var currentSessionID = colWebSocketClient[id].sessionID;
      // logger.log('verbose',"TX message to",id,JSON.stringify(sendParam),{sessionID:currentSessionID});
      colWebSocketClient[id].send(JSON.stringify(sendParam));
    }catch (e){
      logger.log('error','TX Websocket error',JSON.stringify(e),{sessionID:'WEBSocket Managment'});
    }
  }
};

// endregion Websocket server Connexion Management
