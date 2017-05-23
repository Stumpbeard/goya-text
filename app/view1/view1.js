'use strict';

angular.module('myApp.view1', ['ngRoute', 'myApp.playerInfo'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {
    title: 'Online Text Adventure',
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['$scope', '$sce', 'playerInfo', function($scope, $sce, playerInfo) {
    $scope.messages = [
        "Welcome to the game.",
        "What's your name?"
    ];

    $scope.potentialName = "";

    $scope.input = "";
    $scope.submit = function(){
        $scope.messages.push("> " + $scope.input);
        if($scope.messages[$scope.messages.length - 2] === "What's your name?"){
            $scope.potentialName = $scope.input;
            $scope.messages.push("Your name is " + $scope.potentialName + "? Are you sure? &lt;y/n&gt;");
            $scope.input = "";
            return;
        }
        else if($scope.messages[$scope.messages.length - 2] === "Your name is " + $scope.potentialName + "? Are you sure? &lt;y/n&gt;"){
            if($scope.input === 'y' || $scope.input === 'Y'){
                playerInfo.name = $scope.potentialName;
                $scope.messages.push("Alright. Welcome, " + playerInfo.name + ".");
                $scope.input = "";
                return;
            } else {
                playerInfo.name = $scope.potentialName;
                $scope.messages.push("Alright.");
                $scope.messages.push("What's your name?");
                $scope.input = "";
                return;
            }
        }
        $scope.messages.push($sce.trustAsHtml($scope.input));
        $scope.input = "";
    }

    $scope.asHtml = function(msg){
        return $sce.trustAsHtml(msg);
    }
}]);
