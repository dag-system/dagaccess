var myStorage = window.localStorage;
var $_GET = $_GET();
var app = angular.module("checkpointInfo", ['ngSanitize']);

var ws = null;
var wsUrl = 'ws://<%= websocketIp %>:<%= websocketPort%>';
var wsURLExt = 'ws://' + window.location.hostname + ':<%= websocketPort%>';
var wsCurrentUrl = wsUrl;
if(wsUrl != wsURLExt){
	wsCurrentUrl = wsURLExt;
}

var sendParam = {
  clientType : 'DAGAccessClient',
  messageType : '',
  content : ''
};
var logTX = false;
var logRX = false;


app.filter('join', function () {
    return function join(array, separator, prop) {
        if (!Array.isArray(array)) {
			return array; // if not array return original - can also throw error
        }

        return (!!prop ? array.map(function (item) {
            return item[prop];
        }) : array).join(separator);
    };
});

app.filter('reverse', function() {
  return function(items) {
    if(!items) return null;
    if(items.length > 0) return items.slice().reverse();
    return null;
  };
});

app.controller("checkpointInfoCtrl", function($scope, $http, $timeout, $interval){

  $scope.stateTTE = 'init';

  initWebSocket($scope,$http);
  $scope.tick = moment().valueOf();
  $scope.stateHwItem = {stateHw:'btn-default',isInProgress:false};
  $scope.stateHwEvent = {stateHw:'btn-default',isInProgress:false};
  $scope.stateHwSetup = {stateHw:'btn-default',isInProgress:false};
  $scope.stateHwIhm = {stateHw:'btn-default',isInProgress:false};
  $scope.stateHwOpenpass = {stateHw:'btn-default',isInProgress:false};
  $scope.stateHwData = {stateHw:'btn-default',isInProgress:false};
  $scope.nbDetections = 0;
  $scope.tcpconnectOK = false;
  $scope.redLight = 0;
  $scope.orangeLight = 0;
  $scope.greenLight = 0;
  $scope.redSystemLight = 0;
  $scope.orangeSystemLight = 0;
  $scope.greenSystemLight = 0;
  $scope.redLightClass = 'redLightOff';
  $scope.orangeLightClass = 'orangeLightOff';
  $scope.greenLightClass = 'greenLightOff';
  $scope.redSystemLightClass = 'redLightOff';
  $scope.orangeSystemLightClass = 'orangeLightOff';
  $scope.greenSystemLightclass = 'greenLightOff';
  $scope.freeTurnstileClass = '';
  $scope.antennaTuneClass = '';
  $scope.takePictureClass = '';
  $scope.stackSize = 20;
  $scope.rpiVersion = 'unknown';
  $scope.accessClientVersion = "<%= version %>";
  $scope.stateTTE = 'init';
  $scope.datas = [];
  $scope.histos = [];
  $scope.historyLength = 4;
  $scope.historyOffset = 0;
  $scope.datasMaxLength = $_GET["maxdata"] || 20;

  $scope.idReader = '01';
  $scope.idLRDReader = '00';
  $scope.idInit = false;

  $scope.txRepeatId = [];
  $scope.interval = 1000;
  $scope.dataTx = '{"msgType":"command","payLoad":{"dataType":"getInfo"}}';
  $scope.dataTxRepeat = '{"msgType":"command","payLoad":{"dataType":"getInfo"}}';
  $scope.desktop = $_GET["desktop"] || true;
  $scope.travelTime = 0;
  $scope.timeoutFinOK = 0;
  $scope.pointName = "...";
  $scope.pointCost = ".";
  $scope.DAGLiveLocalIpAddress = "<%= ip %>";
  $scope.LocalDataBaseNameIpAddress = "<%= ipdataname %>";
  $scope.showLog = false;
  $scope.showLogEvent = false;
  $scope.showLogHWY = false;
  $scope.showLogRFID = false;
  $scope.showLogPath = false;
  $scope.showLogData = false;
  $scope.historyTerminal = '';
  $scope.inputTerminal = '';
  $scope.c1Value = 0;
  $scope.c2Value = 0;
  $scope.c3Value = 0;
  $scope.dgValue = 0;
  $scope.i1Value = 0;
  $scope.i2Value = 0;
  $scope.i3Value = 0;
  $scope.i4Value = 0;
  $scope.tpValue = 0;
  $scope.volumeValue = 50;
  $scope.readerList = [];
  $scope.typeReader = 'RODINBELL_D100';
  $scope.cameraReady = true;
  $scope.powerValue = 26;
  $scope.maxPower = 26;
  $scope.thresholdValue = 0;
  $scope.cpuTemperature = 0;

  $scope.highway = 'https://highway.dag-system.com';
  $scope.idresort = 0;
  $scope.albumPath = '';
  $scope.album = new Object();
  $scope.currentPictureProduct = 'Current one';
  $scope.currentPictureDate = '';

  $scope.wavlist = {};
  $scope.bipOnDetection = false;

  $scope.activeLog = {
    logSocketTX:false,
    logSocketRX:false,
    logTCPRX:false,
    logWebTX:false,
    logWebRX:false
  }

  $interval(function(){
    $scope.systemDate = moment(new Date()).format('DD/MM/YYYY');
    $scope.systemHour = moment(new Date()).format('HH:mm');
  },800);

  $interval(function(){
    $scope.tick = moment().valueOf();
  },60000);


  $scope.configLOG = function(){
    sendParam.broadcast = false;
    sendParam.messageType = 'configLog';
    sendParam.content = $scope.activeLog;
    logTX = $scope.activeLog.logWebTX;
    logRX = $scope.activeLog.logWebRX;
    send(sendParam);
  };


  $scope.sendData = function(data,broadcast){
    sendParam.broadcast = broadcast;
    sendParam.messageType = 'tx';
    sendParam.content = data;
    send(sendParam);
  };

  $scope.clearRx = function(){
    $scope.datas = [];
  };

  $scope.clearTerminal = function(){
    $scope.historyTerminal = '';
  };

  $scope.sendDataRepeat = function(data,broadcast){
    sendParam.messageType = 'tx';
    sendParam.broadcast = broadcast;
    sendParam.content = data;
    send(sendParam);
    $scope.txRepeatId.push(
      setInterval(function(){
        sendParam.messageType = 'tx';
        sendParam.content = data;
        send(sendParam);
        },$scope.interval)
      );
  };

  $scope.stopInterval = function(){
    clearInterval($scope.txRepeatId[0]);
    $scope.txRepeatId.shift();
  }

  $scope.resetTCP = function(){
    $scope.stateTTE = 'init';
    sendParam.messageType = 'resetTCP';
    send(sendParam);
  }

  $scope.copy = function(data){
  text_to_share = JSON.stringify(data.data);
  var copyElement = document.createElement("span");
    copyElement.appendChild(document.createTextNode(text_to_share));
    copyElement.id = 'tempCopyToClipboard';
    angular.element(document.body.append(copyElement));

    // select the text
    var range = document.createRange();
    range.selectNode(copyElement);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    // copy & cleanup
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    copyElement.remove();
  };

  $scope.getTagHistory = function(tagId,offset){
    $scope.getInfoNbTagPassageByDay=false;
    $scope.histos = [];
    $scope.historyOffset += $scope.historyLength * offset;
    if(offset == 0) $scope.historyOffset = 0;
    if($scope.historyOffset < 0) $scope.historyOffset = 0;
    sendParam.broadcast = false;
    sendParam.messageType = 'getTagHisto';
    sendParam.tagId = tagId;
    sendParam.nb = $scope.historyLength;
    sendParam.offset = $scope.historyOffset;
    send(sendParam);
  };

  $scope.getHistory = function(offset){
    $scope.getInfoNbPassageByDay=false;
    $scope.histos = [];
    $scope.historyOffset += $scope.historyLength * offset;
    if(offset == 0) $scope.historyOffset = 0;
    if($scope.historyOffset < 0) $scope.historyOffset = 0;
    sendParam.broadcast = false;
    sendParam.messageType = 'getCheckpointHisto';
    sendParam.date = moment(new Date()).format('YYYY-MM-DD');
    sendParam.nb = $scope.historyLength;
    sendParam.offset = $scope.historyOffset;
    send(sendParam);
  };

  $scope.getNbPassageByDay = function(offset){
    $scope.getInfoNbPassageByDay=true;
    $scope.histos = [];
    $scope.historyOffset += $scope.historyLength * offset;
    if(offset == 0) $scope.historyOffset = 0;
    if($scope.historyOffset < 0) $scope.historyOffset = 0;
    sendParam.broadcast = false;
    sendParam.messageType = 'getNbPassageByDay';
    sendParam.nb = $scope.historyLength;
    sendParam.offset = $scope.historyOffset;
    send(sendParam);
  };

  $scope.getNbTagPassageByDay = function(tagId,offset){
    $scope.getInfoNbTagPassageByDay=true;
    $scope.histos = [];
    $scope.historyOffset += $scope.historyLength * offset;
    if(offset == 0) $scope.historyOffset = 0;
    if($scope.historyOffset < 0) $scope.historyOffset = 0;
    sendParam.broadcast = false;
    sendParam.tagId = tagId;
    sendParam.messageType = 'getNbTagPassageByDay';
    sendParam.nb = $scope.historyLength;
    sendParam.offset = $scope.historyOffset;
    send(sendParam);
  };

  $scope.getTagCtrl = function(data){
    let serialNumber = data.data.payLoad.ticket.serialNumber;
    let itemNum = data.data.payLoad.ticket.itemNum;
    if(!$scope.album[serialNumber]){
      $scope.album[serialNumber] = {
        current:$scope.albumPath + '/' + serialNumber + '/' + itemNum + '/fisrt_ctrl.jpg?dummy=' + $scope.tick,
        first:$scope.albumPath + '/' + serialNumber + '/' + itemNum + '/fisrt_ctrl.jpg?dummy=' + $scope.tick,
        last:$scope.albumPath + '/' + serialNumber + '/' + itemNum + '/last_ctrl.jpg?dummy=' + $scope.tick,
        album:[]
      }
    }
    $scope.album[serialNumber].current = $scope.albumPath + '/' + serialNumber + '/' + itemNum + '/last_ctrl.jpg?dummy=' + $scope.tick;
    $http.get($scope.highway + "?getalbum&idresort=" + $scope.idresort + "&tag=" + serialNumber + "&itemNum=" + itemNum).then(function(response) {
      if(response.data.length > 0){
        $scope.album[serialNumber].album = response.data;
        $scope.currentPictureProduct = $scope.album[serialNumber].album[$scope.album[serialNumber].album.length - 1].product;
        $scope.currentPictureDate = $scope.momentFormat($scope.album[serialNumber].album[$scope.album[serialNumber].album.length - 1].date);
        $scope.album[serialNumber].album[0].highlight = true;
        for(let i=0;i<$scope.album[serialNumber].album.length;i++){
          $scope.album[serialNumber].album[i].url = $scope.albumPath + '/' + serialNumber + '/' + itemNum + '/album/' + $scope.album[serialNumber].album[i].url + '?dummy=' + $scope.tick;
        }
        if($scope.momentFormat(data.data.payLoad.ticket.DateTicket) != $scope.momentFormat($scope.album[serialNumber].album[$scope.album[serialNumber].album.length - 1].date)){
          $scope.album[serialNumber].current = "./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick;
          $scope.currentPictureProduct = data.data.payLoad.ticket.itemDesignation;
          $scope.currentPictureDate = $scope.momentFormat(data.data.payLoad.ticket.DateTicket);
          $scope.album[serialNumber].album.push({url:"./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick,product:data.data.payLoad.ticket.itemDesignation,date:data.data.payLoad.ticket.DateTicket,checkpoint:data.data.payLoad.info[0].name});
        }
      }
      else{
        $scope.album[serialNumber].first = "./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick;
        $scope.album[serialNumber].last = "./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick;
        $scope.album[serialNumber].current = "./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick;
        $scope.currentPictureProduct = data.data.payLoad.ticket.itemDesignation;
        $scope.currentPictureDate = $scope.momentFormat(data.data.payLoad.ticket.DateTicket);
        $scope.album[serialNumber].album.push({url:"./ctrl/" + data.data.payLoad.ticket.userInfo.ctrl + "?dummy=" + $scope.tick,product:data.data.payLoad.ticket.itemDesignation,date:data.data.payLoad.ticket.DateTicket,checkpoint:data.data.payLoad.info[0].name});
      }
    })
    .catch(function(err){
      delete $scope.album[serialNumber];
    });
  }

  $scope.selectPict = function(serialNumber,index,picture){
    $scope.album[serialNumber].current = picture.url;
    for(let i=0;i<$scope.album[serialNumber].album.length;i++){
      $scope.album[serialNumber].album[i].highlight = false;
    }
    $scope.album[serialNumber].album[index].highlight = true;
    $scope.currentPictureProduct = picture.product;
    $scope.currentPictureDate = $scope.momentFormat(picture.date);
  };

  $scope.gethighlight = function(serialNumber,index){
    if($scope.album[serialNumber].album[index].highlight){
      return 'ctrlhighlight';
    }
    else{
      return '';
    }
  }

  // $scope.$watch('dgValue',function(newValue,oldValue){
  //   if(newValue != oldValue){
  //     $scope.sendToRFID('DG' + $scope.idLRDReader + newValue);
  //   }
  // });

  $scope.setDGValue = function(){
    $scope.sendToRFID('DG' + $scope.idLRDReader + $scope.dgValue);
  };

  $scope.$watch('volumeValue',function(newValue,oldValue){
    if(newValue != oldValue){
      sendParam.messageType = 'setVolume';
      sendParam.volumeValue = newValue;
      send(sendParam);
    }
  });

  // $scope.$watch('powerValue',function(newValue,oldValue){
  //   if(newValue != oldValue && newValue != null){
  //     // sendParam.messageType = 'setPower';
  //     // sendParam.powerValue = newValue;
  //     // send(sendParam);
  //     let action = 'use';
  //     if($scope.storePower){
  //       action = 'store';
  //       $scope.storePower = false;
  //     }
  //     var tx = {
  //       msgType:"command",
  //       payLoad:
  //       {
  //         dataType:"setupPower",
  //         readerType:$scope.typeReader,
  //         value:newValue.toString(),
  //         action:'action'
  //       }
  //     };
  //     $scope.sendData(JSON.stringify(tx),false);
  //   }
  // });

  $scope.setPowerValue = function(reader){
    let action = 'use';
    if(reader.storePower){
      action = 'store';
      reader.storePower = false;
    }
    if(reader.powerValue != null){
      switch(reader.typeReader){
        case 'SUC':
        case 'LRD':
          if(action == 'store') $scope.sendToRFID('SV' + $scope.idLRDReader);
          $scope.sendToRFID('PW' + $scope.idLRDReader + reader.powerValue.toString());
          break;

        default:
          var tx = {
            msgType:"command",
            payLoad:
            {
              dataType:"setupPower",
              readerType:reader.typeReader,
              value:reader.powerValue.toString(),
              action:'action'
            }
          };
          $scope.sendData(JSON.stringify(tx),false);
      }
    }
  }

  $scope.setThresholdValue = function(thresholdValue){
    let action = 'use';
    if($scope.storeThreshold){
      action = 'store';
      $scope.storeThreshold = false;
    }
    var tx = {
      msgType:"command",
      payLoad:
      {
        dataType:"rssiThreshold",
        value:Math.abs(thresholdValue).toString(),
        action:action
      }
    };
    $scope.sendData(JSON.stringify(tx),false);
  }


  // $scope.$watch('thresholdValue',function(newValue,oldValue){
  //   if(newValue != oldValue && newValue != null){
  //     // sendParam.messageType = 'setThreshold';
  //     // sendParam.thresholdValue = newValue;
  //     // send(sendParam);
  //     let action = 'use';
  //     if($scope.storeThreshold){
  //       action = 'store';
  //       $scope.storeThreshold = false;
  //     }
  //     var tx = {
  //       msgType:"command",
  //       payLoad:
  //       {
  //         dataType:"rssiThreshold",
  //         value:Math.abs(newValue).toString(),
  //         action:action
  //       }
  //     };
  //     $scope.sendData(JSON.stringify(tx),false);
  //   }
  // });

  // $scope.setThresholdValue = function(){
  //   let action = 'use';
  //   if($scope.storeThreshold){
  //     action = 'store';
  //     $scope.storeThreshold = false;
  //   }
  //   var tx = {
  //     msgType:"command",
  //     payLoad:
  //     {
  //       dataType:"rssiThreshold",
  //       value:Math.abs($scope.thresholdValue).toString(),
  //       action:action
  //     }
  //   };
  //   $scope.sendData(JSON.stringify(tx),false);
  // }

  $scope.reboot = function(){
    sendParam.messageType = 'reboot';
    send(sendParam);
  };

  $scope.offScreen = function(){
    sendParam.messageType = 'offScreen';
    send(sendParam);
  };

  $scope.onScreen = function(){
    sendParam.messageType = 'onScreen';
    send(sendParam);
  };

  $scope.freeTurnstile = function(){
    $scope.sendData(JSON.stringify({"msgType":"command","payLoad":{"dataType":"freeTurnstile"}}),false);
  };

  $scope.antennaTune = function(){
    $scope.sendData(JSON.stringify({"msgType":"command","payLoad":{"dataType":"setupAntenna","readerType":"SUC"}}),false);
  };

  $scope.timeStampFormat = function(string) {
    return moment(string).format('DD/MM/YYYY - HH:mm:ss.SSS');
  };

  $scope.momentFormat = function(string) {
    return moment(string).format('DD/MM/YYYY - HH:mm:ss');
  };

  $scope.dateFormat = function(string) {
    return moment(string).format('DD/MM/YYYY');
  };

  $scope.timeFormat = function(string) {
    return moment(string).format('HH:mm:ss');
  };

  $scope.terminalKeyDown = function(e){
    if(e.keyCode == 13) {
      // append your output to the history,
      // here I just append the input
      $scope.historyTerminal = $scope.historyTerminal + $scope.inputTerminal +'<br/>';

      // you can change the path if you want
      // crappy implementation here, but you get the idea
      $scope.sendToRFID($scope.inputTerminal);

      // clear the input
      $scope.inputTerminal = '';
    }
  };

  $scope.sendToRFID = function(data){
    var tx = {
      msgType:"command",
      payLoad:
      {
        dataType:"monitoringRFID",
        value:data
      }
    };
    $scope.sendData(JSON.stringify(tx),false);
  };

  $scope.playAudioLocal = function(file) {
    if(!$scope.bipOnDetection) return;
    if($scope.wavlist[file] == null){
      $http.get('./wav/' + file).then(function(response) {
        $scope.wavlist[file] = response.data;
        let audio = new Audio("data:audio/wav;base64," + $scope.wavlist[file]);
        audio.play();
      });
    }
    else{
      let audio = new Audio("data:audio/wav;base64," + $scope.wavlist[file]);
      audio.play();
    }
  };  

  $scope.takePicture = function(data){
    $scope.takePictureClass = 'btn-success flashit';
    var tx = {
      msgType:"command",
      payLoad:
      {
        dataType:"getPicture"
      }
    };
    $scope.sendData(JSON.stringify(tx),false);
  };

  $scope.getInfoRFID = function(){
    $scope.sendToRFID('dg' + $scope.idLRDReader);
    $timeout(()=>{
      $scope.sendToRFID('pw' + $scope.idLRDReader);
      $timeout(()=>{
        $scope.sendToRFID('i!' + $scope.idLRDReader);
      },50);
    },50);
    sendParam.messageType = 'getVolume';
    send(sendParam);
    sendParam.messageType = 'getCPUTemp';
    send(sendParam);
  };

  $scope.addToTerminal = function(data){
    if($scope.historyTerminal.length > 2000) $scope.historyTerminal = '';
    $scope.historyTerminal = $scope.historyTerminal + data.payLoad.command + '&nbsp;' + '&nbsp;' + '&nbsp;' + (data.payLoad.origin.length > 0?data.payLoad.origin + '&nbsp;' + '&nbsp;' + '&nbsp;':'') + data.payLoad.data + '<br/>';
    // $timeout(function() {
    //     var scroller = document.getElementById("history");
    //     //scroller.scrollTop = scroller.scrollHeight;
    //     scroller.scrollIntoView(false);
    //   }, 0, false);
  }

  $scope.setMaxPower = function (index){
    switch ($scope.readerList[index].typeReader) {
      case 'RODINBELL_D100':
        $scope.readerList[index].maxPower = 26;
        break;
      case 'RODINBELL_X2':
        $scope.readerList[index].maxPower = 33;
        break;
      case 'RODINBELL_X4':
        $scope.readerList[index].maxPower = 33;
        break;
      case 'IMPINJ_R420':
        $scope.readerList[index].maxPower = 30;
        break;
      case 'SUC':
      case 'LRD':
        $scope.readerList[index].maxPower = 800;
        break;
      case 'ANDEA':
        $scope.readerList[index].maxPower = 6;
        break;
      default:
    }
  }

  $(function() {
  	$('.terminal').on('click', function(){
    	 $('#input').focus();
    });
  });


});


function initWebSocket($scope,$http){
  ws = new WebSocket(wsCurrentUrl);

  ws.onopen = function (event) {
    $scope.stateTTE = 'init';
    // define parameters
    sendParam.messageType = 'init';
    sendParam.content = 'DAG Acces Client #ws://<%= websocketIp %>:<%= websocketPort%> ready.';
    send(sendParam);
  };

  ws.onclose = function (event) {
    $scope.stateTTE = 'init';
    ws = null;
    setTimeout(function(){
      initWebSocket($scope);
    }, 2000);
  };

  ws.onmessage=function(event) {
    $scope.tcpconnectOK = true;
    var message = JSON.parse(event.data);
    if(logRX) console.log("RX Message: " + event.data);
    if(message.fromUI){
      switch(message.msgType){

        case 'tagHisto':
          $scope.histos = [];
          if(message.histo.length > 0){
            for(var i=0;i<message.histo.length;i++){
              // add to
              try{
                var dataHisto = {
                  msgType: "event",
                  payLoad:JSON.parse(message.histo[i].ticket)
                }
                $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.momentFormat(message.histo[i].eventDate),date:$scope.dateFormat(message.histo[i].eventDate),time:$scope.timeFormat(message.histo[i].eventDate),data:dataHisto});
              }catch(e){

              }
            }
          }
          else{
            var dataHisto = {
              msgType: "event",
              payLoad:{type:'noData'}
            }
            $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.dateFormat(new Date()),data:dataHisto});
          }
          $scope.$apply();
          break;

        case 'checkPointHisto':
          $scope.histos = [];
          if(message.histo.length > 0){
            for(var i=0;i<message.histo.length;i++){
              // add to
              try{
                var dataHisto = {
                  msgType: "event",
                  payLoad:JSON.parse(message.histo[i].ticket)
                }
                $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.momentFormat(message.histo[i].eventDate),date:$scope.dateFormat(message.histo[i].eventDate),time:$scope.timeFormat(message.histo[i].eventDate),data:dataHisto});
              }catch(e){

              }
            }
          }
          else{
            var dataHisto = {
              msgType: "event",
              payLoad:{type:'noData'}
            }
            $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.dateFormat(new Date()),data:dataHisto});
          }
          $scope.$apply();
          break;

        case 'nbPassageByDay':
          $scope.histos = [];
          if(message.histo.length > 0){
            for(var i=0;i<message.histo.length;i++){
              // add to
              var dataHisto = {
                msgType: "event",
                payLoad:{type:'nbPassageByDay',count:message.histo[i].cpt}
              }
              $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(message.histo[i].eventDate),date:$scope.dateFormat(message.histo[i].eventDate),time:$scope.dateFormat(message.histo[i].eventDate),data:dataHisto});
            }
          }
          else{
            var dataHisto = {
              msgType: "event",
              payLoad:{type:'noData'}
            }
            $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.dateFormat(new Date()),data:dataHisto});
          }
          $scope.$apply();
          break;

        case 'nbTagPassageByDay':
          $scope.histos = [];
          if(message.histo.length > 0){
            for(var i=0;i<message.histo.length;i++){
              // add to
              try{
                var dataHisto = {
                  msgType: "event",
                  payLoad:{type:'nbTagPassageByDay',count:message.histo[i].cpt}
                }
                $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(message.histo[i].eventDate),date:$scope.dateFormat(message.histo[i].eventDate),time:$scope.dateFormat(message.histo[i].eventDate),data:dataHisto});
              }catch(e){

              }
            }
          }
          else{
            var dataHisto = {
              msgType: "event",
              payLoad:{type:'noData'}
            }
            $scope.histos.splice($scope.histos.length,0,{fulldate:$scope.dateFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.dateFormat(new Date()),data:dataHisto});
          }
          $scope.$apply();
          break;

        case 'getVolume':
          $scope.volumeValue = parseInt(message.volumeValue);
          $scope.$apply();
          break;
        //
        // case 'getPower':
        //   $scope.powerValue = parseInt(message.powerValue);
        //   $scope.$apply();
        //   break;
        //
        // case 'getThreshold':
        //   $scope.thresholdValue = parseInt(message.thresholdValue);
        //   $scope.$apply();
        //   break;

        case 'getCPUTemp':
          $scope.cpuTemperature = parseInt(message.cpuTemperature);
          $scope.$apply();
          break;


      }
    }else{
      managementTTE($scope,$http,message);
    }
  };
};

function manageLight($scope,visual){
  switch (visual.red) {
    case 0:
      $scope.redLightClass = 'redLightOff';
      break;
    case 1:
      $scope.redLightClass = 'redLightOn';
      break;
    default:
      $scope.redLightClass = 'redLightOn flashit';
  }
  switch (visual.orange) {
    case 0:
      $scope.orangeLightClass = 'orangeLightOff';
      break;
    case 1:
      $scope.orangeLightClass = 'orangeLightOn';
      break;
    default:
      $scope.orangeLightClass = 'orangeLightOn flashit';
  }
  switch (visual.green) {
    case 0:
      $scope.greenLightClass = 'greenLightOff';
      break;
    case 1:
      $scope.greenLightClass = 'greenLightOn';
      break;
    default:
      $scope.greenLightClass = 'greenLightOn flashit';

  }
  switch (visual.redSystem) {
    case 0:
      $scope.redSystemLightClass = 'redLightOff';
      break;
    case 1:
      $scope.redSystemLightClass = 'redLightOn';
      break;
    default:
      $scope.redSystemLightClass = 'redLightOn flashit';
  }
  switch (visual.orangeSystem) {
    case 0:
      $scope.orangeSystemLightClass = 'orangeLightOff';
      break;
    case 1:
      $scope.orangeSystemLightClass = 'orangeLightOn';
      break;
    default:
      $scope.orangeSystemLightClass = 'orangeLightOn flashit';
  }
  switch (visual.greenSystem) {
    case 0:
      $scope.greenSystemLightclass = 'greenLightOff';
      break;
    case 1:
      $scope.greenSystemLightclass = 'greenLightOn';
      break;
    default:
      $scope.greenSystemLightclass = 'greenLightOn flashit';

  }

}


function managementTTE($scope,$http,message){
  switch ($scope.stateTTE) {
    case 'init':
      switch(message.msgType) {
        case "hello":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.rpiVersion = message.payLoad.version;
          $scope.pointName = message.payLoad.info[0].name;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.timeoutFinOK = message.payLoad.info[0].timeoutFinOK;
          $scope.timeBeforeAlreadyKnown = message.payLoad.info[0].timeBeforeAlreadyKnown;
          $scope.batchMode = message.payLoad.info[0].batchMode;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          $scope.header = "DAG Access : " + $scope.pointName;
          $scope.highway = message.payLoad.hwyURL;
          $scope.idresort = message.payLoad.hwyResortID;
          $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
            $scope.albumPath = response.data.photoPath;
          });
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "data":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.rpiVersion = message.payLoad.version;
          $scope.pointName = message.payLoad.info[0].name;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.timeoutFinOK = message.payLoad.info[0].timeoutFinOK;
          $scope.timeBeforeAlreadyKnown = message.payLoad.info[0].timeBeforeAlreadyKnown;
          $scope.batchMode = message.payLoad.info[0].batchMode;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          $scope.stateTTE = "idle";
          $scope.header = "DAG Access : " + $scope.pointName;
          $scope.highway = message.payLoad.hwyURL;
          $scope.idresort = message.payLoad.hwyResortID;
          $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
            $scope.albumPath = response.data.photoPath;
          });
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "goodbye":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "nack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "ack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "event":
          switch(message.payLoad.type){
            case "ok":
            case "ko":
            case "alreadyOk":
            case "alreadyKo":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "freeTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = 'btn-success flashit';
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "abortTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;


            case "idle":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "data":
              break;

            default:
              if($scope.showLogEvent) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          }
          break;

        case "log":
          if($scope.showLog) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "monitoringRFID":
          if($scope.showLogRFID) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          let origin = '01';
          let readerIndex = $scope.readerList.findIndex((e)=>e.typeReader=='SUC');
          switch(message.payLoad.command){
            case "AA":
              if(message.payLoad.data == "00001"){
                $scope.antennaTuneClass = '';
                $scope.sendToRFID('i!' + $scope.idLRDReader);
              }
              else{
                $scope.antennaTuneClass = 'btn-success flashit';
              }
              break;
            case "C1":
              $scope.c1Value = parseInt(message.payLoad.data);
              break;
            case "C2":
              $scope.c2Value = parseInt(message.payLoad.data);
              break;
            case "C3":
              $scope.c3Value = parseInt(message.payLoad.data);
              break;
            case "VR":
              $scope.i1Value = parseInt(message.payLoad.data);
              break;
            case "VI":
              $scope.i2Value = parseInt(message.payLoad.data);
              break;
            case "IP":
              $scope.i3Value = parseInt(message.payLoad.data);
              break;
            case "VP":
              $scope.i4Value = parseInt(message.payLoad.data);
              break;
            case "DG":
              $scope.dgValue = parseInt(message.payLoad.data);
              break;
            case "TP":
              $scope.tpValue = parseInt(message.payLoad.data)/2;
              break;
            case "ID":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.idLRDReader = message.payLoad.origin;
                  break;
                default:
                  $scope.idReader = message.payLoad.origin;
              }
              $scope.idInit = true;
              break;
            case "PW":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.readerList[readerIndex].powerValue = parseInt(message.payLoad.data);
                  break;
                default:
              }
              break;

            default:
          }
          $scope.addToTerminal(JSON.parse(event.data));

          break;

        case "monitoringPath":
          if($scope.showLogPath) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          switch(message.payLoad.command){
            case "F0":
              break;
            case "F1":
              break;
            case "F2":
              break;
            default:
          }
          break;

        case "monitoringHWY":
          if($scope.showLogHWY) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "tcpConnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = true;
          break;

        case "tcpDisconnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = false;
          break;

        case 'getPicture':
          $scope.pictureTest = message.payLoad.picturePath;
          $scope.takePictureClass = '';
          break;

        default:
          $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
      }
      break;

    case 'idle':
      switch(message.msgType) {
        case "hello":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.pointName = message.payLoad.info[0].name;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.timeoutFinOK = message.payLoad.info[0].timeoutFinOK;
          $scope.timeBeforeAlreadyKnown = message.payLoad.info[0].timeBeforeAlreadyKnown;
          $scope.batchMode = message.payLoad.info[0].batchMode;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          $scope.header = "DAG Access : " + $scope.pointName;
          $scope.highway = message.payLoad.hwyURL;
          $scope.idresort = message.payLoad.hwyResortID;
          $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
            $scope.albumPath = response.data.photoPath;
          });
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "goodbye":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "nack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "ack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "data":
          $scope.pointName = message.payLoad.info[0].name;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.timeoutFinOK = message.payLoad.info[0].timeoutFinOK;
          $scope.timeBeforeAlreadyKnown = message.payLoad.info[0].timeBeforeAlreadyKnown;
          $scope.batchMode = message.payLoad.info[0].batchMode;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.header = "DAG Access : " + $scope.pointName;
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          // $scope.highway = message.payLoad.hwyURL;
          // $scope.idresort = message.payLoad.hwyResortID;
          // $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
          //   $scope.albumPath = response.data.photoPath;
          // });
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "event":
          switch(message.payLoad.type){
            case "ok":
            case "ko":
            case "alreadyOk":
            case "alreadyKo":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "freeTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = 'btn-success flashit';
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "abortTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "idle":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "data":
              break;

            default:
              if($scope.showLogEvent) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});

          }
          break;

        case "log":
          if($scope.showLog) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "monitoringHWY":
          if($scope.showLogHWY) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.stateHwSetup = manageHighWayState(message.payLoad.highway.setup,$scope.stateHwSetup);
          $scope.stateHwItem = manageHighWayState(message.payLoad.highway.item,$scope.stateHwItem);
          $scope.stateHwIhm = manageHighWayState(message.payLoad.highway.ihm,$scope.stateHwIhm);
          $scope.stateHwData = manageHighWayState(message.payLoad.highway.data,$scope.stateHwData);
          $scope.stateHwOpenpass = manageHighWayState(message.payLoad.highway.openpass,$scope.stateHwOpenpass);
          $scope.stateHwEvent = manageHighWayState(message.payLoad.highway.event,$scope.stateHwEvent);
          break;

        case "monitoringRFID":
          if($scope.showLogRFID) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          let origin = '01';
          let readerIndex = $scope.readerList.findIndex((e)=>e.typeReader=='SUC');
          switch(message.payLoad.command){
            case "AA":
              if(message.payLoad.data == "00001"){
                $scope.antennaTuneClass = '';
                $scope.sendToRFID('i!' + $scope.idLRDReader);
              }
              else{
                $scope.antennaTuneClass = 'btn-success flashit';
              }
              break;
            case "C1":
              $scope.c1Value = parseInt(message.payLoad.data);
              break;
            case "C2":
              $scope.c2Value = parseInt(message.payLoad.data);
              break;
            case "C3":
              $scope.c3Value = parseInt(message.payLoad.data);
              break;
            case "VR":
              $scope.i1Value = parseInt(message.payLoad.data);
              break;
            case "VI":
              $scope.i2Value = parseInt(message.payLoad.data);
              break;
            case "IP":
              $scope.i3Value = parseInt(message.payLoad.data);
              break;
            case "VP":
              $scope.i4Value = parseInt(message.payLoad.data);
              break;
            case "DG":
              $scope.dgValue = parseInt(message.payLoad.data);
              break;
            case "TP":
              $scope.tpValue = parseInt(message.payLoad.data)/2;
              break;
            case "ID":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.idLRDReader = message.payLoad.origin;
                  break;
                default:
                  $scope.idReader = message.payLoad.origin;
              }
              $scope.idInit = true;
              break;
            case "PW":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.readerList[readerIndex].powerValue = parseInt(message.payLoad.data);
                  break;
                default:
              }
              break;
  
            default:
          }
          $scope.addToTerminal(JSON.parse(event.data));

          break;

        case "monitoringPath":
          if($scope.showLogPath) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          switch(message.payLoad.command){
            case "F0":
              break;
            case "F1":
              break;
            case "F2":
              break;
            default:
          }
          break;


        case "tcpConnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = true;
          break;

        case "tcpDisconnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = false;
          break;

        case 'getPicture':
          $scope.pictureTest = message.payLoad.picturePath;
          $scope.takePictureClass = '';
          break;

        default:
          $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
        }
        break;

    default:
      switch(message.msgType) {
        case "hello":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.pointName = message.payLoad.info[0].name;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.timeoutFinOK = message.payLoad.info[0].timeoutFinOK;
          $scope.timeBeforeAlreadyKnown = message.payLoad.info[0].timeBeforeAlreadyKnown;
          $scope.batchMode = message.payLoad.info[0].batchMode;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          $scope.header = "DAG Access : " + $scope.pointName;
          $scope.highway = message.payLoad.hwyURL;
          $scope.idresort = message.payLoad.hwyResortID;
          $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
            $scope.albumPath = response.data.photoPath;
          });
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "goodbye":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "nack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "ack":
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "data":
          $scope.thresholdValue = message.payLoad.info[0].threshold;
          if(message.payLoad.info[0].reader.length>0){
            $scope.readerList = message.payLoad.info[0].reader;
            for(let i=0;i<$scope.readerList.length;i++){
              if($scope.readerList[i].typeReader != null){
                $scope.setMaxPower(i);
                //$scope.readerList[i].powerValue = 0;
                if($scope.readerList[i].typeReader != 'SUC'){
                  $scope.readerList[i].powerValue =$scope.readerList[i].outputPower;
                }
                else{
                  if($scope.readerList[i].outputPower >=100){
                    $scope.readerList[i].typeReader = 'LRD'
                    $scope.readerList[i].powerValue = $scope.readerList[i].outputPower;
                  }
                }
              }
            }
          }
          // $scope.highway = message.payLoad.hwyURL;
          // $scope.idresort = message.payLoad.hwyResortID;
          // $http.get($scope.highway + "?getphotopath&idresort=" + $scope.idresort).then(function(response) {
          //   $scope.albumPath = response.data.photoPath;
          // });
          if($scope.showLogData) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          if(!$scope.idInit){
            $scope.sendToRFID('id00');
          }
          break;

        case "event":
          switch(message.payLoad.type){
            case "ok":
            case "ko":
            case "alreadyOk":
            case "alreadyKo":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "freeTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = 'btn-success flashit';
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              $scope.playAudioLocal($scope.datas[0].data.payLoad.ticket.sound);
              break;

            case "abortTurnstile":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date(message.payLoad.ticket.DateTicket)),date:$scope.dateFormat(new Date(message.payLoad.ticket.DateTicket)),time:$scope.timeFormat(new Date(message.payLoad.ticket.DateTicket)),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "idle":
              $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
              if($scope.datas.length > $scope.datasMaxLength) $scope.datas.pop();
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "data":
              break;

            default:
              if($scope.showLogEvent) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});

          }
          break;

        case "log":
          if($scope.showLog) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "monitoringRFID":
          if($scope.showLogRFID) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          let origin = '01';
          let readerIndex = $scope.readerList.findIndex((e)=>e.typeReader=='SUC');
          switch(message.payLoad.command){
            case "AA":
              if(message.payLoad.data == "00001"){
                $scope.antennaTuneClass = '';
                $scope.sendToRFID('i!' + $scope.idLRDReader);
              }
              else{
                $scope.antennaTuneClass = 'btn-success flashit';
              }
              break;
            case "C1":
              $scope.c1Value = parseInt(message.payLoad.data);
              break;
            case "C2":
              $scope.c2Value = parseInt(message.payLoad.data);
              break;
            case "C3":
              $scope.c3Value = parseInt(message.payLoad.data);
              break;
            case "VR":
              $scope.i1Value = parseInt(message.payLoad.data);
              break;
            case "VI":
              $scope.i2Value = parseInt(message.payLoad.data);
              break;
            case "IP":
              $scope.i3Value = parseInt(message.payLoad.data);
              break;
            case "VP":
              $scope.i4Value = parseInt(message.payLoad.data);
              break;
            case "DG":
              $scope.dgValue = parseInt(message.payLoad.data);
              break;
            case "TP":
              $scope.tpValue = parseInt(message.payLoad.data)/2;
              break;
            case "ID":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.idLRDReader = message.payLoad.origin;
                  break;
                default:
                  $scope.idReader = message.payLoad.origin;
              }
              $scope.idInit = true;
              break;
            case "PW":
              origin = parseInt(message.payLoad.origin)
              switch(true){
                case origin >= 21:
                  $scope.readerList[readerIndex].powerValue = parseInt(message.payLoad.data);
                  break;
                default:
              }
              break;
  
            default:
          }
          $scope.addToTerminal(JSON.parse(event.data));
          break;

        case "monitoringPath":
          if($scope.showLogPath) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          switch(message.payLoad.command){
            case "F0":
              break;
            case "F1":
              break;
            case "F2":
              break;
            default:
          }
          break;

        case "tcpConnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = true;
          break;

        case "tcpDisconnected":
          if($scope.showLogConnect) $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = false;
          break;


        case 'getPicture':
          $scope.pictureTest = message.payLoad.picturePath;
          $scope.takePictureClass = '';
          break;

        default:
          $scope.datas.splice(0,0,{fulldate:$scope.momentFormat(new Date()),date:$scope.dateFormat(new Date()),time:$scope.timeFormat(new Date()),data:JSON.parse(event.data)});
      }
  }
  $scope.datas.splice($scope.stackSize);
  $scope.$apply();
};

function send(sendParam){
  if(logTX) console.log("tx Message:",sendParam);
  ws.send(JSON.stringify(sendParam));
};

function manageHighWayState(status,lastStateHw){
  var state = {
    stateHw:'',
    isInProgress:false
  }
  var lastResult = 'idle';
  for(var i=0;i<status.length;i++){
    if(status[i].result == 'inProgress'){
      state.isInProgress = true;
    }else{
      if(lastResult != status[i].result) {
        if(status[i].result =='error'){
          lastResult = status[i].result;
        }else{
          if(status[i].result =='success' || status[i].result =='noChange'){
            if(lastResult !='error'){
              lastResult = status[i].result;
            }
          }
        }
      }
    }
  }
  if(state.isInProgress){
    state.stateHw = lastStateHw.stateHw;
    return state;
  }
  else{
    switch (lastResult) {
      case 'idle':
        state.stateHw = 'btn-default';
        break;
      case 'inProgress':
        state.stateHw = 'btn-warning';
        break;
      case 'error':
        state.stateHw = 'btn-danger';
        break;
      case 'success':
        state.stateHw = 'btn-success';
        break;
      case 'noChange':
        state.stateHw = 'btn-success';
        break;
      default:
    }
    return state;
  }
}


function $_GET(param) {
  var vars = {};
  window.location.href.replace( location.hash, '' ).replace(
  /[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
  function( m, key, value ) { // callback
  vars[key] = value !== undefined ? value : '';
  }
  );

  if ( param ) {
  return vars[param] ? vars[param] : null;
  }
  return vars;
}

$(document).ready(function(){
  $('[data-toggle="tooltip"]').tooltip({html: true,delay: { "show": 1, "hide": 1000 }})
  .each(function() {
  $(this).data('bs.tooltip').tip().addClass('tooltipInfo');
  });
});
