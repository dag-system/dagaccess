
var myStorage = window.localStorage;
var $_GET = $_GET();
var app = angular.module("checkpointConfig", []);
app.controller("checkpointConfigCtrl", function($scope, $http, $timeout, $interval){
	$scope.Cpt = [];
	$scope.CptGlobal = [];
	$scope.listPersonne = [];
	$scope.listPersonneName = [];
	$scope.NumeroLigne = [];
	$scope.pointName = [];
	$scope.listDetectionPoint = [];
	$scope.searchDevice = false;
	$scope.reboot = false;
	$scope.loadDataBaseFail = false;
	$scope.master = $_GET['master'];
	var timoutLoadDataBase = 10000;
	var timoutTemperature = 5000;
	var timoutRefresh = 100;


	$scope.DAGLiveLocalIpAddress = "<%= ip %>";
	$scope.LocalDataBaseNameIpAddress = "<%= ipdataname %>"; // Setting by config.js on the server

	$scope.isNameServer = $scope.DAGLiveLocalIpAddress.split(':')[0] == $scope.LocalDataBaseNameIpAddress.split(':')[0];

	if($scope.master != null){
		$scope.expandDetails = true;
	}

	$scope.masterMode = function(){
		if($scope.master == null){
			window.open(window.location.href + "?master=true","_self");
		}
		else{
			window.open(window.location.origin + window.location.pathname,"_self");
		}
	}

	$scope.getMissingPersonList = function(detectionPoint){
		var missingPersonList = [];
		switch (detectionPoint.type) {
			case 'IN/OUT':
				for(var dag in $scope.listPersonneName) {
					// For all detectionPoint with same NumeroLigne
					if(missingPersonList.findIndex(checkExistDag,dag) == -1){
						missingPersonList.push($scope.listPersonneName[dag]);
					}
					var nbPointDetection = $scope.listDetectionPoint.length;
					for (var idxPointDetection = 0; idxPointDetection < nbPointDetection; idxPointDetection++) {
						var currentDetectionPoint = $scope.listDetectionPoint[idxPointDetection]
						if(currentDetectionPoint.NumeroLigne == detectionPoint.NumeroLigne){
							var nb = $scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress].length;
							for (var i = 0; i < nb; i++) {
								if($scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress][i].DAG == dag){
									$scope.listPersonneName[dag][11] = $scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress][i].LastDetection;
									if($scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress][i].Position == "IN"){
										$scope.listPersonneName[dag][10] = "P";
									}
									else{
										if($scope.listPersonneName[dag][10] != "P"){
											$scope.listPersonneName[dag][10] = "A";
										}
									}
								}
							}
						}
					}
				}
				break;

			case 'IN':
				var found = false;
				for(var dag in $scope.listPersonneName) {
					if($scope.listPersonneName[dag][10] == "P"){
						found = false;
						// For all detectionPoint with same NumeroLigne
						var nbPointDetection = $scope.listDetectionPoint.length;
						for (var idxPointDetection = 0; idxPointDetection < nbPointDetection; idxPointDetection++) {
							var currentDetectionPoint = $scope.listDetectionPoint[idxPointDetection]
							if(currentDetectionPoint.NumeroLigne == detectionPoint.NumeroLigne){
								var nb = $scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress].length;
								for (var i = 0; i < nb; i++) {
									if($scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress].length > 0){
										if($scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress][i].DAG == dag && $scope.listPersonne[currentDetectionPoint.DAGLiveIpAddress][i].Position == "IN"){
											found = true;
											// remove it if exit
											missingPersonList.splice(missingPersonList.findIndex(checkExistDag,dag),1);
										}
									}
								}
								if(found == false){
									if(missingPersonList.findIndex(checkExistDag,dag) == -1){
										missingPersonList.push($scope.listPersonneName[dag]);
									}
								}
							}
						}
					}
				}
				break;
			default:
		}
		return missingPersonList;
	};

	$scope.expand = function(detectionPoint){
		if(!detectionPoint.expand){
			detectionPoint.expand = true;
		}
		else{
			detectionPoint.expand = false;
		}
	};

	$scope.getListDetectionPoint = function () {
	    var groupArray = [];
	    var groupListDetectionPoint = [];
	    angular.forEach($scope.listDetectionPoint, function (item, idx) {
	        if (groupArray.indexOf(parseInt(item.NumeroLigne)) == -1) {
	            groupArray.push(parseInt(item.NumeroLigne));
							groupListDetectionPoint.push(item);
	        }
	    });
	    return groupListDetectionPoint.sort();
	};

	$scope.getCptGlobal = function(NumeroLigne){
		var nb = 0;
		var nbPointDetection = $scope.listDetectionPoint.length;
		for (var i = 0; i < nbPointDetection; i++) {
			if($scope.listDetectionPoint[i].NumeroLigne == NumeroLigne){
				nb += $scope.Cpt[$scope.listDetectionPoint[i].DAGLiveIpAddress]
			}
		}
		return nb;
	};

	$scope.setAsDatabaseNameServer = function(detectionPoint){
		var ipObj = {
			ipaddress: detectionPoint.DAGLiveIpAddress.split(':')[0] + ':8080'
		};
		var nbPointDetection = $scope.listDetectionPoint.length;
		for (var i = 0; i < nbPointDetection; i++) {
			$http.post('http://' + $scope.listDetectionPoint[i].DAGLiveIpAddress + '/ipdatabasename?credential=aqwzsxed&fields=',ipObj).then(function(data) {
				if(data.data == detectionPoint.DAGLiveIpAddress){
				}
			})
			.catch(function(data) {
				console.log( "failure message: " + JSON.stringify({data: data}));
			});
		}
	}

	$scope.eraseDevice = function(){
		$scope.listDetectionPoint = [];
		$scope.listUUID = [];
		myStorage.setItem('listDetectionPoint', JSON.stringify($scope.listDetectionPoint));
	};

	$scope.initDevice = function(detectionPoint){
		detectionPoint.reboot = false;
		detectionPoint.temperature = '';
		$scope.Cpt[detectionPoint.DAGLiveIpAddress] = '/';
		$scope.NumeroLigne[detectionPoint.DAGLiveIpAddress] = detectionPoint.NumeroLigne;
		$scope.pointName[detectionPoint.DAGLiveIpAddress] = detectionPoint.NumeroLigne;
		$scope.getNbIN(detectionPoint);
		if($scope.master){
			$scope.getTemperature(detectionPoint);
		}
	}

	$scope.listDevice = function(){
		$scope.searchDevice = true;
		$http.get('http://' + $scope.DAGLiveLocalIpAddress + '/list?credential=aqwzsxed&fields=').then(function(data) {
			if(data.data.length > 0){
				$scope.listDetectionPoint = [];
				$scope.listUUID = [];
				// getting list of IP
				var listIP = data.data;
				listIP = listIP.replace(/\n/g,':8088,');
				var tabIP = listIP.split(',');
				tabIP.push($scope.DAGLiveLocalIpAddress);
				var nbIP = tabIP.length;
				for (var i = 0; i < nbIP; i++) {
					if(tabIP[i].length > 0){
						// check if exist
						$http.get('http://' + tabIP[i] + '/getversion?credential=aqwzsxed&fields=').then(function(data) {
							if(data.data.CredentialName == 'DAG System'){
								var urlInfo = getLocation(data.config.url);
								// check if UUID does not already exist
								if($scope.listUUID.indexOf(data.data.UUID) == -1){
									// Add to device list
									// Retreive NumeroLigne
									$scope.listUUID.push(data.data.UUID);
									$http.get('http://' + urlInfo.host + '/currentlinenumber?credential=aqwzsxed&fields=').then(function(data) {
										if(data.data != null){
											// Add to device list
											var urlInfo = getLocation(data.config.url);
											$scope.listDetectionPoint.push({DAGLiveIpAddress:urlInfo.host,NumeroLigne:data.data.address,interTime:data.data.interTime});
											$scope.initDevice($scope.listDetectionPoint[$scope.listDetectionPoint.length - 1]);
											myStorage.setItem('listDetectionPoint', JSON.stringify($scope.listDetectionPoint));
											$scope.searchDevice = false;
										}
									})
									.catch(function(data) {
										console.log( "failure message: " + JSON.stringify({data: data}));
									});
								}
							}
						})
						.catch(function(data) {
							console.log( "failure message: " + JSON.stringify({data: data}));
						});
					}
				}
			}
		})
		.catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
		});
	};

	$scope.restartDevice = function(detectionPoint){
		$http.get('http://' + detectionPoint.DAGLiveIpAddress + '/reboot?credential=aqwzsxed&fields=').then(function(data) {
			if(data.data.length > 0){
				// Device is rebooting
					detectionPoint.reboot = true;
					$scope.reboot = true;
			}
		})
		.catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
		});
	};

	$scope.restartAllDevice = function(){
		var nbPointDetection = $scope.listDetectionPoint.length;
		for (var i = 0; i < nbPointDetection; i++) {
			$scope.restartDevice($scope.listDetectionPoint[i]);
		}
	};


	$scope.resetAllData = function(){
		var nbPointDetection = $scope.listDetectionPoint.length;
		for (var i = 0; i < nbPointDetection; i++) {
			$scope.resetData($scope.listDetectionPoint[i]);
		}
	};

	$scope.checkReboot = function(){
		var nbPointDetection = $scope.listDetectionPoint.length;
		var reboot = false;
		for (var i = 0; i < nbPointDetection; i++) {
			if($scope.listDetectionPoint[i].reboot){
				reboot = true;
				break;
			}
		}
		$scope.reboot = reboot;
	};

	$scope.resetData = function(detectionPoint){
		var query = `
			DELETE det.*
			FROM
			personne
			JOIN pointdetection ON pointdetection.IDPersonne = personne.IDPersonne
			JOIN prestation ON prestation.IDPersonne = pointdetection.IDPersonne AND prestation.EnCours = 1
			JOIN detection det ON det.IDPointDetection = pointdetection.IDPointDetection AND det.IDPrestation = prestation.IDPrestation AND det.Supprimee = 0
			WHERE
			personne.Credential = 'aqwzsxed'
		`

		var dqlObj = {
			dql: query
		};
		$http.post('http://' + detectionPoint.DAGLiveIpAddress + '/dql?credential=aqwzsxed&fields=', dqlObj).then(function(data) {
			if(data.length > 0){
			}
		})
		.catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
		});
	};

	$scope.getNbIN = function(detectionPoint){
		var query1 = `
			SELECT count(DAG) as NbIN
			FROM
				(SELECT
					Information AS DAG,
					MAX(detection.DateDetection) AS LastDetection,
					CASE WHEN MOD(count(IDDetection), 2)= 0 THEN 'OUT' ELSE 'IN' END AS Position,
					count(IDDetection) AS NbDetection
					FROM
					personne
					JOIN pointdetection ON pointdetection.IDPersonne = personne.IDPersonne
					JOIN prestation ON prestation.IDPersonne = pointdetection.IDPersonne AND prestation.EnCours = 1
					JOIN detection ON detection.IDPointDetection = pointdetection.IDPointDetection AND detection.IDPrestation = prestation.IDPrestation AND detection.Supprimee = 0
					WHERE
					personne.Credential = 'aqwzsxed'
					AND pointdetection.NumLigneEnCours = '%1'
					GROUP BY Information
				) Q1
			WHERE Q1.Position = 'IN'
			GROUP BY Q1.Position
			`;

		var query2 = `
		SELECT
		pointdetection.TypeModule,
		pointdetection.NomUtilisateur,
		detection.NumeroLigne,
		Information AS DAG,
		MAX(detection.DateDetection)AS LastDetection,
		CASE WHEN MOD(count(IDDetection), 2)= 0 THEN 'OUT' ELSE 'IN' END AS Position,
		count(IDDetection)AS NbDetection
		FROM
		personne
		LEFT JOIN pointdetection ON pointdetection.IDPersonne = personne.IDPersonne AND pointdetection.NumLigneEnCours = '%1'
		LEFT JOIN prestation ON prestation.IDPersonne = pointdetection.IDPersonne AND prestation.EnCours = 1
		LEFT JOIN detection ON detection.IDPointDetection = pointdetection.IDPointDetection AND detection.IDPrestation = prestation.IDPrestation AND detection.Supprimee = 0
		WHERE
		personne.Credential = 'aqwzsxed'
		GROUP BY
		Information,detection.NumeroLigne
		order by NumeroLigne, LastDetection DESC
		`;
		var dataObj = {
			dql: query1.replace(/%1/g,detectionPoint.NumeroLigne) + ";" + query2.replace(/%1/g,detectionPoint.NumeroLigne)
		};

		if(detectionPoint.reboot){
			$timeout(function(){
				$http.get('http://' + detectionPoint.DAGLiveIpAddress + '/temperature?credential=aqwzsxed&fields=').then(function(data) {
					if(data.data != null){
						detectionPoint.reboot = false;
						$scope.getNbIN(detectionPoint);
					}
				})
				.catch(function(data) {
					console.log( "failure message: " + JSON.stringify({data: data}));
					$scope.getNbIN(detectionPoint);
				});
			},timoutRefresh);
		}else{
			$http.post('http://' + detectionPoint.DAGLiveIpAddress + '/dql?credential=aqwzsxed&fields=', dataObj).then(function(data) {
				if(data.data.length > 0){
					if(data.data[0].length > 0){
						$scope.Cpt[detectionPoint.DAGLiveIpAddress] = data.data[0][0].NbIN;
					}
					else{
						$scope.Cpt[detectionPoint.DAGLiveIpAddress] = 0;
					}
					if(data.data[1][0].NbDetection > 0){
						$scope.listPersonne[detectionPoint.DAGLiveIpAddress] = data.data[1];
					}else{
						$scope.listPersonne[detectionPoint.DAGLiveIpAddress] = [];
					}
					detectionPoint.pointName = data.data[1][0].NomUtilisateur;
					detectionPoint.type = data.data[1][0].TypeModule;
					detectionPoint.reboot = false;
					$scope.checkReboot();
					$scope.pointName[detectionPoint.DAGLiveIpAddress] = data.data[1][0].NomUtilisateur;
					$timeout(function(){
						$scope.getNbIN(detectionPoint);
					},timoutRefresh);
				}
				else{
					$timeout(function(){
						$scope.getNbIN(detectionPoint);
					},timoutRefresh);
				}
			})
			.catch(function(data) {
				console.log( "failure message: " + JSON.stringify({data: data}));
				$timeout(function(){
					$scope.getNbIN(detectionPoint);
				},timoutRefresh);
			});

		}

	};

	$scope.$watch('Cpt',function(newValue,oldValue){
		if(newValue != oldValue){
			// document.body.className = 'flash';
			// $timeout(function(){
			// 	document.body.className = '';
			// },400);
		}
	});

	$scope.view = function(detectionPoint){
		window.open('http://' + detectionPoint.DAGLiveIpAddress.split(':')[0] + ':8080?desktop=true');
    return false;
	};

	$scope.setLineNumber = function(detectionPoint){
		var cfgLineNumber = {
			address : detectionPoint.newNumeroLigne
		}
		$http.post('http://' + detectionPoint.DAGLiveIpAddress + '/currentlinenumber?credential=aqwzsxed&fields=', cfgLineNumber).then(function(data) {
			if(data.data.length > 0){
				detectionPoint.NumeroLigne = data.data;
				$scope.initDevice(detectionPoint);
			}
		})
		.catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
		});
	};

	$scope.setInterTime = function(detectionPoint){
		var cfgInterTime = {
			interTime : detectionPoint.newInterTime
		}
		$http.post('http://' + detectionPoint.DAGLiveIpAddress + '/currentInterTime?credential=aqwzsxed&fields=', cfgInterTime).then(function(data) {
			if(data.data.length > 0){
				detectionPoint.interTime = data.data;
				$scope.initDevice(detectionPoint);
			}
		})
		.catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
		});
	};



	$scope.momentFormat = function(string) {
			if(!string) return "";
			return moment(string).format('DD/MM/YYYY - HH:mm:ss');
	};

	$scope.copy = function(personne){
		text_to_share = personne.DAG;
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

	$scope.loadDataBase = function(){
		$http.get('http://' + $scope.DAGLiveLocalIpAddress + '/ipdatabasename?credential=aqwzsxed').then(function(data) {
			if(data.data.length > 0){
				$scope.LocalDataBaseNameIpAddress = data.data;
			}
			// Load Name Database
			jQuery.get('http://'+ $scope.LocalDataBaseNameIpAddress + '/upload/Perenco.txt', function(data) {
				if(data.length > 0){
					$scope.loadDataBaseFail = false;
					$scope.listPersonneName = [];
					myStorage.setItem('listPersonne', data);
					if(data.split('\r\n')[0] != 'empty'){
						// Load Database
						var listPersonneOrg = data.split('\r\n');
						// Remove fisrt line
						listPersonneOrg.shift();
						var arrayLength = listPersonneOrg.length;
						for (var i = 0; i < arrayLength; i++) {
							var UID = listPersonneOrg[i].split('\t')[0];
							if(UID.length > 0){
								$scope.listPersonneName[UID] = listPersonneOrg[i].split('\t');
								$scope.listPersonneName[UID][10] = "A"
							}
						}
					}
				}
				$timeout(function(){
					$scope.loadDataBase();
				},timoutLoadDataBase);
			}).fail(function() {
				$scope.loadDataBaseFail = true;
				// try with localstorage
				var data = myStorage.getItem('listPersonne');
				if(data.length > 0){
					$scope.listPersonneName = [];
					if(data.split('\r\n')[0] != 'empty'){
						// Load Database
						var listPersonneOrg = data.split('\r\n');
						// Remove fisrt line
						listPersonneOrg.shift();
						var arrayLength = listPersonneOrg.length;
						for (var i = 0; i < arrayLength; i++) {
							var UID = listPersonneOrg[i].split('\t')[0];
							if(UID.length > 0){
								$scope.listPersonneName[UID] = listPersonneOrg[i].split('\t');
								$scope.listPersonneName[UID][10] = "A"
							}
						}
					}
				}
				$timeout(function(){
					$scope.loadDataBase();
				},timoutLoadDataBase);
			});
		}).catch(function(data) {
			console.log( "failure message: " + JSON.stringify({data: data}));
			$timeout(function(){
				$scope.loadDataBase();
			},timoutLoadDataBase);
		});
	};



	$scope.getTemperature = function(detectionPoint){
		if(!detectionPoint.reboot){
			$http.get('http://' + detectionPoint.DAGLiveIpAddress + '/temperature?credential=aqwzsxed&fields=').then(function(data) {
				if(data.data != null){
					detectionPoint.temperature = parseFloat(data.data.temperature.split('\'')[0]);
				}
				if($scope.master){
					$timeout(function () {
						$scope.getTemperature(detectionPoint);
					}, timoutTemperature);
				}
			})
			.catch(function(data) {
				console.log( "failure message: " + JSON.stringify({data: data}));
			});
		}else{
			$timeout(function () {
				$scope.getTemperature(detectionPoint);
			}, timoutTemperature);
		}
	};


	// Init detection point from last Local DetectionPoint List
	var data = myStorage.getItem('listDetectionPoint');
	if(data != null){
		try{
			$scope.listDetectionPoint = JSON.parse(data);
			// init each device
			for(var detectionpoint in $scope.listDetectionPoint){
				$scope.initDevice($scope.listDetectionPoint[detectionpoint]);
			}
		}
		catch(e){

		}
	}



	$scope.loadDataBase(); // Launch database name  polling refresh


});

var getLocation = function(href) {
    var l = document.createElement("a");
    l.href = href;
    return l;
};

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
};

function checkExistDag(dag) {
    return dag[0] == this;
}
