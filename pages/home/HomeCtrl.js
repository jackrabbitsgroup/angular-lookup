/**
*/

'use strict';

angular.module('myApp').controller('HomeCtrl', ['$scope', function($scope) {
	$scope.opts ={};
	$scope.filterFields =['name'];
	$scope.users =[];
	$scope.usersRaw ={
		'main':{
			'items':[
				{'_id':'d1', 'name':'john smith'},
				{'_id':'d2', 'name':'joe bob'},
				{'_id':'d3', 'name':'joe james'},
				{'_id':'d4', 'name':'ron artest'},
				{'_id':'d5', 'name':'kobe bryant'},
				{'_id':'d6', 'name':'steve balls'},
			]
		},
		'extra':{
			'items':[
			]
		}
	};
	
	//handle load more (callbacks)
	var itemsMore =
	[
		{'_id':'l1', 'name':'sean battier'},
		{'_id':'l2', 'name':'lebron james'},
		{'_id':'l3', 'name':'dwayne wade'},
		{'_id':'l4', 'name':'rajon rondo'},
		{'_id':'l5', 'name':'kevin garnett'},
		{'_id':'l6', 'name':'ray allen'},
		{'_id':'l7', 'name':'dwight howard'},
		{'_id':'l8', 'name':'pau gasol'},
	];
	
	//@param params
	//	@param {String} searchText
	//	@param {Number} cursor Where to load from
	//	@param {Number} loadMorePageSize How many to return
	$scope.loadMore =function(params, callback) {
		var results =itemsMore.slice(params.cursor, (params.cursor+params.loadMorePageSize));
		callback(results, {});
	};
}]);