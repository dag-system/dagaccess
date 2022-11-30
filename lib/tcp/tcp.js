var mainServer = require('../..');

var logger = mainServer.logger;
const net = require('net');

var client = new net.Socket();
var cnx = {};
var rxBuffer = '';
var stx = '\2';
var etx = '\3';
var nbTestCnx = 0;
var maxTestCnx = 3600;
var txCpt = 0;
var isDrestoying = false;
var logSocketRX = false;
var logSocketTX = false;
var tmrClose = null;
var tmrError = null;

var txDataToWait = [];

var mOnConnect,mOnData,mOnClose,mOnError;


module.exports = {
  create: function(ip,port,onConnect,onData,onClose,onError) {
    mOnConnect = onConnect;
    mOnData = onData;
    mOnClose = onClose;
    mOnError = onError;
    cnx = {ip:ip,port:port,tryCnx:0};
    client.connect(port, ip);
    // client.connect(port, ip,function(){
    //   isDrestoying = false;
    //   nbTestCnx = 0;
    //   //logger.log('info','tcp connected to ' + ip + ':' + port);
    //   mOnConnect(cnx);
    // });

    client.on('data', function(dataRx) {
      if(logSocketRX)  logger.log('verbose','TCP RX: ' + dataRx);
      rxBuffer += dataRx;
      var data = rxBuffer.substring(rxBuffer.indexOf(stx) + 1,rxBuffer.indexOf(etx));
      if(data == stx){
        data ='';
      }
      while(data.length>0){
        rxBuffer = rxBuffer.substring(rxBuffer.indexOf(etx) + 1);
        var rxData = {};
        try{
          rxData = JSON.parse(data);
        }
        catch(e){
          logger.log('error','TCP RX format error: ' + dataRx + '\nrxBuffer: ' + rxBuffer + '\ndata: ' + data + '\n' + e.toString());
          rxData = {msgId:null};
        }
        if(rxData.msgId != null){
          if(txDataToWait[rxData.msgId.msgId]){
            //logger.log('verbose','TCP RX Ack OK:' + rxData.msgId.msgId);
            clearTimeout(txDataToWait[rxData.msgId.msgId].timeoutId);
            delete txDataToWait[rxData.msgId.msgId];
          }
        }
        mOnData(cnx,data);
        data = rxBuffer.substring(rxBuffer.indexOf(stx) + 1,rxBuffer.indexOf(etx));
        if(data == stx){
          data ='';
        }
      }
    });

    client.on('ready', function() {
      tmrClose = null;
      tmrError = null;
      isDrestoying = false;
      cnx = {ip:ip,port:port,tryCnx:0};
      logger.log('info','After close #' + nbTestCnx + ' - TCP connected to ' + ip + ':' + port);
      nbTestCnx = 0;
      mOnConnect(cnx);
    });


    client.on('close', function() {
      logger.log('verbose','Client.OnClose => Connection closed : tmrError = ' + tmrError);
      mOnClose(cnx);
      if(nbTestCnx < maxTestCnx && isDrestoying == false){
        if(!tmrError){
          nbTestCnx++;
          cnx = {ip:ip,port:port,tryCnx:nbTestCnx};
          clearTimeout(tmrClose);
          tmrClose = setTimeout(function(nbTestCnx){
            logger.log('warn','Connection closed : Try to reconnect :' + nbTestCnx);
            client.connect(cnx.port, cnx.ip);
            // client.connect(cnx.port, cnx.ip,function(nbTestCnx){
            //   tmrClose = null;
            //   tmrError = null;
            //   isDrestoying = false;
            //   cnx = {ip:ip,port:port,tryCnx:0};
            //   logger.log('info','After close #' + nbTestCnx + ' - TCP connected to ' + ip + ':' + port);
            //   nbTestCnx = 0;
            //   mOnConnect(cnx);
            // });
          },1000,nbTestCnx);
        }
      }
    });

    client.on('error', function(err) {
      logger.log('error',JSON.stringify(err));
      switch (err.code) {
        case 'ETIMEDOUT':
        case 'ECONNRESET':
        case 'ECONNREFUSED':
        case 'EINVAL':
        case 'ECANCELED':
        //case 'EISCONN':
          mOnError(cnx,err);
          if(nbTestCnx < maxTestCnx && isDrestoying == false){
            nbTestCnx++;
            cnx = {ip:ip,port:port,tryCnx:nbTestCnx};
            clearTimeout(tmrClose);
            clearTimeout(tmrError);
            tmrError = setTimeout(function(nbTestCnx){
              logger.log('warn','Connection error : Try to reconnect :' + nbTestCnx);
              client.connect(cnx.port, cnx.ip);
              // client.connect(cnx.port, cnx.ip,function(){
              //   tmrClose = null;
              //   tmrError = null;
              //   isDrestoying = false;
              //   cnx = {ip:ip,port:port,tryCnx:0};
              //   logger.log('info','After error #' + nbTestCnx + ' - TCP connected to ' + ip + ':' + port);
              //   nbTestCnx = 0;
              //   mOnConnect(cnx);
              // });
            },1000,nbTestCnx);
          }
          else {
            mOnError(cnx,err);
          }
 		      break;
        default:
          mOnError(cnx,err);
      }
    });
  },

  write: function(data,ack){
    if(!client.connecting && client.writable){
      if(data.msgId == null){
        data.msgId = {
          msgId:txCpt
        }
      }
      else{
        if(!ack) data.msgId.msgId = txCpt;
      }
      if(!ack){
        txDataToWait[txCpt] = {
          data : data,
          nbTx : 0,
          timeoutId :  setInterval(function(currentTxCpt){
              if(txDataToWait[currentTxCpt] != null){
                if(txDataToWait[currentTxCpt].nbTx < 3){
                  txDataToWait[currentTxCpt].nbTx++;
                  client.write(stx + JSON.stringify(txDataToWait[currentTxCpt].data) + etx);
                }
                else{
                	clearTimeout(txDataToWait[currentTxCpt].timeoutId);
                  delete txDataToWait[currentTxCpt];
                  mOnError(cnx,{err:'Tx Timeout'});
                }
              }
            },1000,txCpt)
        }
        txCpt++;
      }
      if(logSocketTX) logger.log('verbose','TCP TX: ' + stx + JSON.stringify(data) + etx);
      client.write(stx + JSON.stringify(data) + etx);
    }
  },

  connect: function(){
    isDrestoying = false;
    client.connect(cnx.port, cnx.ip,function(){
      tmrClose = null;
      tmrError = null;
      nbTestCnx = 0;
      //logger.log('info','tcp connected to ' + ip + ':' + port);
      mOnConnect(cnx);
    });
  },

  end: function(data){
    isDrestoying = true;
    if(data.msgId == null){
      data.msgId = {
        msgId:txCpt
      }
    }
    else{
      data.msgId.msgId = txCpt;
    }
    client.end(stx + JSON.stringify(data) + etx);
    nbTestCnx = 0;
    txCpt = 0;
    for(var key in txDataToWait){
      if(txDataToWait[key] != null){
        clearTimeout(txDataToWait[key].timeoutId);
      }
    }
    txDataToWait = [];
  },

  destroy: function(){
    //logger.log('verbose','Destroyed');
    isDrestoying = true;
    client.destroy(); // kill client after server's response
    nbTestCnx = 0;
    txCpt = 0;
    for(var key in txDataToWait){
      if(txDataToWait[key] != null){
        clearTimeout(txDataToWait[key].timeoutId);
      }
    }
    txDataToWait = [];
  },

  setLOG: function(setLogRX,setLogTX){
    logSocketRX = setLogRX;
    logSocketTX = setLogTX
  },

};
