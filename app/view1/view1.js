'use strict';

angular.module('myApp.view1', ['ngRoute', 'myApp.playerInfo'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/', {
    title: 'Online Text Adventure',
    templateUrl: 'view1/view1.html',
    controller: 'View1Ctrl'
  });
}])

.controller('View1Ctrl', ['socket', '$scope', '$sce', 'playerInfo', function(socket, $scope, $sce, playerInfo) {
    $scope.messages = [];
    $scope.connectedPlayers = {};
    $scope.askingName = true;
    $scope.confirmingName = false;
    $scope.numConnected = 0;
    $scope.id = 0;

    socket.on('ask name', function(msg){
        $scope.id = msg;
        $scope.messages.push("Welcome to the game.");
        $scope.messages.push("What's your name?");
    });

    socket.on('rec speech', function(msg){
        $scope.messages.push(msg);
    });

    socket.on('new player', function(msg){
        $scope.messages.push("A new spirit manifests.");
    });

    socket.on('update players', function(data){
        $scope.connectedPlayers = data;
        $scope.numConnected = Object.keys($scope.connectedPlayers).length;
    });

    socket.on('disconnect message', function(msg){
        $scope.messages.push(msg);
    });

    socket.on('server message', function(msg){
        $scope.messages.push(msg);
    });

    $scope.potentialName = "";
    $scope.nameEntered = false;

    $scope.nameSubmission = function(){
        $scope.messages.push("> " + $scope.input);
        if($scope.askingName){
            $scope.potentialName = $scope.input;
            $scope.messages.push("Your name is " + $scope.potentialName + "? Are you sure? &lt;y/n&gt;");
            $scope.askingName = false;
            $scope.confirmingName = true;
            $scope.input = "";
            return;
        }
        else if($scope.confirmingName){
            if($scope.input === 'y' || $scope.input === 'Y'){
                playerInfo.name = $scope.potentialName;
                $scope.messages.push("Alright. Welcome, " + playerInfo.name + ".");
                $scope.messages.push("You may now speak.");
                socket.emit('confirmed named', $scope.potentialName);
                $scope.input = "";
                $scope.confirmingName = false;
                $scope.nameEntered = true;
                return;
            } else {
                playerInfo.name = $scope.potentialName;
                $scope.messages.push("Alright.");
                $scope.messages.push("What's your name?");
                $scope.confirmingName = false;
                $scope.askingName = true;
                $scope.input = "";
                return;
            }
        }
    }

    $scope.chatSubmit = function(){
        if($scope.input === ""){
            return;
        }
        $scope.messages.push("> " + $scope.input);
        socket.emit('player speech', {name: playerInfo.name, msg: $scope.input});
        $scope.input = "";
    }

    $scope.input = "";
    $scope.submit = function(){
        if (!$scope.nameEntered){
            $scope.nameSubmission();
        } else if ($scope.nameEntered){
            $scope.chatSubmit();
        }
    }

    $scope.asHtml = function(msg){
        return $sce.trustAsHtml(msg);
    }
}]);
