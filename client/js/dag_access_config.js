var myStorage = window.localStorage;
var $_GET = $_GET();
var app = angular.module("checkpointInfo", []);

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


app.controller("checkpointInfoCtrl", function($scope, $http, $timeout, $interval){

  var ws;
  $scope.stateTTE = 'init';

  initWebSocket($scope);
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
  $scope.stackSize = 10;
  $scope.rpiVersion = 'unknown';
  $scope.stateTTE = 'init';
  $scope.datas = [];
  $scope.txRepeatId = [];
  $scope.interval = 1000;
  $scope.dataTx = '{"msgType":"command","payLoad":{"dataType":"getInfo"}}';
  $scope.dataTxRepeat = '{"msgType":"command","payLoad":{"dataType":"getInfo"}}';
  $scope.desktop = $_GET["desktop"] || true;
  $scope.travelTime = 2;
  $scope.pointName = "...";
  $scope.pointCost = ".";
  $scope.DAGLiveLocalIpAddress = "<%= ip %>";
  $scope.LocalDataBaseNameIpAddress = "<%= ipdataname %>";
  $scope.showLog = false;
  $scope.activeLog = {
    logSocketTX:false,
    logSocketRX:false,
    logTCPRX:false,
    logWebTX:false,
    logWebRX:false
  }

  $interval(function(){
    $scope.systemHour = moment(new Date()).format('DD/MM/YYYY - HH:mm:ss');
  },800);


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

  $scope.freeTurnstile = function(){
    $scope.sendData(JSON.stringify({"msgType":"command","payLoad":{"dataType":"freeTurnstile"}}),false);
  }

  $scope.momentFormat = function(string) {
    return moment(string).format('DD/MM/YYYY - HH:mm:ss.SSS');
  };

  $scope.dateFormat = function(string) {
    return moment(string).format('DD/MM/YYYY');
  };

  $scope.timeFormat = function(string) {
    return moment(string).format('HH:mm:ss');
  };


});


function initWebSocket($scope){
  ws = new WebSocket('ws://<%= websocketIp %>:<%= websocketPort%>');

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
    managementTTE($scope,message);
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

function managementTTE($scope,message){
  switch ($scope.stateTTE) {
    case 'init':
      switch(message.msgType) {
      case "hello":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.rpiVersion = message.payLoad.version;
        $scope.pointName = message.payLoad.info[0].name;
        $scope.pointCost = message.payLoad.info[0].pointCost;
        $scope.travelTime = message.payLoad.info[0].travelTime;
        $scope.nbDetections = message.payLoad.info[0].okCountDay;
        break;

      case "data":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.rpiVersion = message.payLoad.version;
        $scope.pointName = message.payLoad.info[0].name;
        $scope.pointCost = message.payLoad.info[0].pointCost;
        $scope.travelTime = message.payLoad.info[0].travelTime;
        $scope.nbDetections = message.payLoad.info[0].okCountDay;
        $scope.stateTTE = "idle";
        break;

      case "goodbye":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "nack":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "ack":
        break;

      case "event":
        switch(message.payLoad.type){
          case "ok":
          case "ko":
            $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
            $scope.nbDetections = message.payLoad.info[0].okCountDay;
            manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);

            break;
          case "freeTurnstile":
            if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
            $scope.freeTurnstileClass = 'btn-success flashit';
            $scope.nbDetections = message.payLoad.info[0].okCountDay;
            manageLight($scope,$scope.datas[0].data.payLoad.visual);
            break;

          case "idle":
            $scope.freeTurnstileClass = '';
            manageLight($scope,$scope.datas[0].data.payLoad.visual);
            break;

          case "data":
            break;

          default:
            if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        }
        break;

      case "log":
        if($scope.showLog) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "monitoringHWY":
        if($scope.showLogHWY) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "tcpConnected":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.tcpconnectOK = true;
        break;

      case "tcpDisconnected":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.tcpconnectOK = false;
        break;

      default:
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
    }
      break;

    case 'idle':
      switch(message.msgType) {
        case "hello":
          $scope.pointName = message.payLoad.info[0].name;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          break;

        case "goodbye":
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "nack":
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "ack":
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "data":
          $scope.pointName = message.payLoad.info[0].name;
          $scope.travelTime = message.payLoad.info[0].travelTime;
          $scope.pointCost = message.payLoad.info[0].pointCost;
          $scope.nbDetections = message.payLoad.info[0].okCountDay;
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "event":
          switch(message.payLoad.type){
            case "ok":
            case "ko":
              $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);

              break;
            case "freeTurnstile":
              if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
              $scope.freeTurnstileClass = 'btn-success flashit';
              $scope.nbDetections = message.payLoad.info[0].okCountDay;
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "abortTurnstile":
              if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "idle":
              if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
              $scope.freeTurnstileClass = '';
              manageLight($scope,$scope.datas[0].data.payLoad.visual);
              break;

            case "data":
              break;

            default:
              if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});

          }
          break;

        case "log":
          if($scope.showLog) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          break;

        case "monitoringHWY":
          if($scope.showLogHWY) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          $scope.stateHwSetup = manageHighWayState(message.payLoad.highway.setup,$scope.stateHwSetup);
          $scope.stateHwItem = manageHighWayState(message.payLoad.highway.item,$scope.stateHwItem);
          $scope.stateHwIhm = manageHighWayState(message.payLoad.highway.ihm,$scope.stateHwIhm);
          $scope.stateHwData = manageHighWayState(message.payLoad.highway.data,$scope.stateHwData);
          $scope.stateHwOpenpass = manageHighWayState(message.payLoad.highway.openpass,$scope.stateHwOpenpass);
          $scope.stateHwEvent = manageHighWayState(message.payLoad.highway.event,$scope.stateHwEvent);
          break;

        case "tcpConnected":
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = true;
          break;

        case "tcpDisconnected":
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
          $scope.tcpconnectOK = false;
          break;

        default:
          $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        }
        break;

    default:
      switch(message.msgType) {
        case "hello":
        $scope.pointName = message.payLoad.info[0].name;
        $scope.pointCost = message.payLoad.info[0].pointCost;
        $scope.travelTime = message.payLoad.info[0].travelTime;
        $scope.nbDetections = message.payLoad.info[0].okCountDay;
        break;

      case "goodbye":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "nack":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "ack":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "data":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "event":
        if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        switch(message.payLoad.type){
          case "ok":
          case "ko":
            $scope.nbDetections = message.payLoad.info[0].okCountDay;
            manageLight($scope,$scope.datas[0].data.payLoad.ticket.visual);
            break;

          case "freeTurnstile":
            $scope.freeTurnstileClass = 'btn-success flashit';
            $scope.nbDetections = message.payLoad.info[0].okCountDay;
            manageLight($scope,$scope.datas[0].data.payLoad.visual);
            break;

          case "abortTurnstile":
            if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
            $scope.freeTurnstileClass = '';
            manageLight($scope,$scope.datas[0].data.payLoad.visual);
            break;

          case "idle":
            if($scope.showLogEvent) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
            $scope.freeTurnstileClass = '';
            manageLight($scope,$scope.datas[0].data.payLoad.visual);
            break;

          case "data":
            break;

          default:
            $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});

        }
        break;

      case "log":
        if($scope.showLog) $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        break;

      case "tcpConnected":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.tcpconnectOK = true;
        break;

      case "tcpDisconnected":
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
        $scope.tcpconnectOK = false;
        break;

      default:
        $scope.datas.splice(0,0,{time:$scope.momentFormat(new Date()),data:JSON.parse(event.data)});
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
