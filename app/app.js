'use strict';

// Declare app level module which depends on views, and components
angular.module('goya', [
  'ngRoute',
  'btford.socket-io',
  'luegg.directives',
  'goya.gameView',
  'goya.playerInfo'
]).
config(['$locationProvider', '$routeProvider', function($locationProvider, $routeProvider) {
  $locationProvider.html5Mode(true);

  $routeProvider.otherwise({redirectTo: '/'});
}]).
run(['$rootScope', function($rootScope) {
    $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
        $rootScope.title = current.$$route.title;
    });
}]).
factory('socket', function (socketFactory) {
  return socketFactory();
});
