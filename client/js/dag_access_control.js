var myStorage = window.localStorage;
var $_GET = $_GET();
var app = angular.module("checkpointInfo", ["ngSanitize"]);
var highwayurl = "https://highway-dev.dag-system.com/V1";

app.filter("trustUrl", function ($sce) {
	return function (url) {
		return $sce.trustAsResourceUrl(url);
	};
});

app.controller("checkpointInfoCtrl",function ($scope, $sce, $http, $timeout, $interval) {
	$scope.useraccesstoken = "";
	// Get useraccesstoken
	$http.get(`${highwayurl}/useraccesstoken?customerid=1&appid=ApplicationDAGSystem&apppassword=aqwzsxedcrfv`).then((data) => {
		$scope.useraccesstoken = data.data.access_token;
		if ($scope.useraccesstoken != "") {
			let idList = $_GET["idlist"].split(';').join();
			let dql = {
				useraccesstoken:$scope.useraccesstoken,
				idresort:$_GET["idresort"],
				dql:`SELECT * FROM pointdetection WHERE idpointdetection IN (${idList})`
			}
			return $http.post(`${highwayurl}`,dql);
		}
	}).then((data) => {
		$scope.detectionpointList = data.data.data;

		$scope.controlURL = [];
		for (let i = 0; i < $scope.detectionpointList.length; i++) {
			if($scope.detectionpointList[i].AdresseIP != ""){
				$scope.controlURL.push(
					$sce.trustAsResourceUrl(`http://${$scope.detectionpointList[i].AdresseIP}:8080/control`)
				);
			}
		}
	})
	.catch(function (data) {
		console.log("failure message: " + JSON.stringify({ data: data }));
	});

});

function $_GET(param) {
	var vars = {};
	window.location.href.replace(location.hash, "").replace(
		/[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
		function (m, key, value) {
			// callback
			vars[key] = value !== undefined ? value : "";
		}
	);

	if (param) {
		return vars[param] ? vars[param] : null;
	}
	return vars;
}

$(document).ready(function () {
	$('[data-toggle="tooltip"]')
		.tooltip({ html: true, delay: { show: 1, hide: 1000 } })
		.each(function () {
			$(this).data("bs.tooltip").tip().addClass("tooltipInfo");
		});
});
