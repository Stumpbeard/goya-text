'use strict';

angular.module('goya.gameView', ['ngRoute', 'goya.playerInfo'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/', {
    title: 'Goya',
    templateUrl: 'gameView/gameView.html',
    controller: 'GameCtrl'
  });
}])

.controller('GameCtrl', ['socket', '$scope', '$sce', 'playerInfo', function(socket, $scope, $sce, playerInfo) {
    $scope.currentRoom = {};
    $scope.state = {
        name: '',
        nameConfirmed: false,
        id: -1,
        room: 0,
        roomContents: JSON.stringify('')
    };

    $scope.messages = [];
    $scope.connectedPlayers = {};
    $scope.numConnected = 0;
    $scope.input = "";

    $scope.submit = function(){
        if($scope.input === ""){
            return;
        }
        let message = $scope.input;
        socket.emit('client message', {player: $scope.state, msg: message});
        $scope.input = '';
    };

    socket.on('send id', function(id){
        $scope.state.id = id;
        $scope.messages = [];
    });

    socket.on('server message', function(data){
        if(data.state !== undefined){
            $scope.state = data.state;
            $scope.currentRoom = JSON.parse(data.state.roomContents);
        }
        $scope.messages = $scope.messages.concat(data.messages);
    });

    socket.on('update players', function(data){
        $scope.connectedPlayers = data;
        $scope.numConnected = Object.keys($scope.connectedPlayers).length;
    });

    $scope.asHtml = function(msg){
        return $sce.trustAsHtml(msg);
    };
}]);
