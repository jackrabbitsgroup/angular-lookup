/**
@todo
- remove jQuery dependency

Uses one associative array (raw data) to build a concatenated scalar (final/display) array of items to search / filter.
	Adds upon ng-filter directive with the following features:
	- handles paging / loading more when scroll to bottom
	- can be used with a backend lookup call to load more results (if "loadMore" attr/scope function is passed in)
		- loadMore function is called when have less than full results among current filtered items stored in javascript, which happens 1 of 2 ways:
			1. when scroll to end of page / load more results
			2. when change search text
	- NOTE: a queue is used to pre-fill the NEXT page's content so more results should always appear fast since the next page's items should already be in javascript by the time "load more" is clicked (i.e. the AJAX / external call is done right AFTER the previous page is loaded rather than right before the new page is loaded)
	
@toc
//0.5. init
//1. formItems
//2. $scope.filterItems
//3. $scope.clickInput
//3.5. $scope.clearInput
//4. $scope.changeInput
//5. $scope.$watch('itemsRaw',..
//5.1. $scope.$watch('opts.searchText',..
//5.5. $scope.$on('jrgLookupReformItems',..
//6. $scope.loadMoreDir
//7. getMoreItems
//8. addLoadMoreItems
//9. checkForScrollBar

@param {Object} scope (attrs that must be defined on the scope (i.e. in the controller) - they can't just be defined in the partial html). REMEMBER: use snake-case when setting these on the partial!
	@param {Array} itemsRaw array of arrays {}, one per each "type". Each type must contain an "items" field that's a scalar array of the items for this type
		NOTE: itemsRaw MUST have this structure and at least the 'main' key
		@example
		{
			'main':{
				'items':[
					{'first':'john', 'last':'smith'},
					{'first':'joe', 'last':'bob'},
					..
				],
			}
			'extra':{
				'items':[
					{'first':'sally', 'last':'sue'},
					{'first':'barbara', 'last':'ann'},
					..
				],
			}
		}
	@param {Array} itemsFiltered array placeholder for where the final, concatenated items will be stored; this is the array that will actually be displayed and searched through and is a combination of the itemsRaw[type].items arrays
	@param {Array} filterFields all fields in each items array to search for match
		@example ['first', 'last', 'header.title']
			NOTE: 'header.title' will search in header['title'] if filterFieldsDotNotation is set to true. Otherwise it will look in a NON-NESTED key that has a "." as part of it
				i.e. array['header.title'] VS array['header']['title']
	@param {Object} opts ={} Additional scope variables that can be used
		@param {String} [searchText =''] text to search for (will be used as ng-model for input)
		@param {Array} [watchItemKeys ='main'] keys to $watch; if these are updated in $scope (i.e. outside the directive), it will re-form itemsFiltered in the directive
	@param {Function} loadMore function to call to load more results (this should update $scope.itemsRaw, which will then update in the directive via $watch). OR '0' if don't have loadMore function at all

@param {Object} attrs REMEMBER: use snake-case when setting these on the partial! i.e. my-attr='1' NOT myAttr='1'
	@param {Boolean} [filterFieldsDotNotation =true] true to change all periods to sub array's (i.e. so 'header.title' as a filterField would search in header['title'] for a match)
	@param {Number} [scrollLoad =0] 1 to do paging via scrolling
	@param {Number} [pageScroll =0] 1 to do paging via scrolling for entire window as opposed to a specific div (good for mobile / touch screens where only 1 scroll bar works well)
	@param {Number} [pageSize =10] how many results to show at a time (will load more in increments of pageSize as scroll down / click "more")
	@param {Number} [loadMorePageSize =20] how many results to load (& thus store in queue) at a time - must be at least as large as pageSize (and typically should be at least 2 times as big as page size?? maybe not? just need to ensure never have to AJAX twice to display 1 page)
	@param {String} [loadMoreItemsKey ='extra'] matches a key in the itemsRaw array - this is where items from backend will be loaded into
	@param {String} [placeholder ='search'] input search placeholder
	@param {Number} [minSearchLength =2] The minimum number of characters for which to actually search/filter the results (for performance - low number of characters still lead to lots of results)
	@param {Number} [minSearchShowAll =1] 1 to show ALL items if search term is below the minSearchLength and 0 to show NONE (no items) if below the minSearchLength
	@param {String} [classInput =''] Style class to apply to input element
	@param {String} [classInputCont =''] Style class to apply to input container element


@usage
partial / html:
	<div jrg-lookup items-raw='usersRaw' items-filtered='users' filter-fields='filterFields' load-more='loadMore' opts='opts'>
		<!-- custom display code to ng-repeat and display the results (items-filtered) goes below -->
		<div class='friends-user' ng-repeat='user in users'>
			{{user.name}}
		</div>
		<!-- end: custom display code -->
	</div>

controller / js:
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

//end: usage
*/

'use strict';

angular.module('jackrabbitsgroup.angular-lookup', []).directive('jrgLookup', ['$filter', '$timeout', function ($filter, $timeout) {

	/**
	//returns the value of an array when given the array base and the keys to read
	@param arrayBase =array starting point (after which the array keys are added in)
	@param params
		keys (required) =dotNotation version of keys to add in order (i.e. 'header.title')
		noDotNotation =boolean true if keys is an array [] rather than a dot notation string
	@return array {}
		val =value of this array after the keys have been added
		valid =1 if val was figured out; 0 if error
		msg =notes on what happened (i.e. error message if valid =0)
	//EXAMPLE:
	$scope.formVals ={
		'header':{
			'title':'Save Bears',
		},
	};
	//then to get the value of header.title (i.e. "Save Bears"), would do:
	//WITH noDotNotation
	evalArray($scope.formVals, {'keys':['header', 'title']});
	//WITHOUT noDotNotation
	evalArray($scope.formVals, {'keys':'header.title'});
	*/
	function evalArray(arrayBase, params) {
		var retArray ={'val':'', 'valid':1, 'msg':''};
		if(params.noDotNotation ===undefined || !params.noDotNotation) {
			params.keys =params.keys.split(".");
		}
		if(params.keys.length ==1) {
			if(arrayBase[params.keys[0]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]];
			}
		}
		else if(params.keys.length ==2) {
			if(arrayBase[params.keys[0]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]][params.keys[1]];
			}
		}
		else if(params.keys.length ==3) {
			if(arrayBase[params.keys[0]] !==undefined && arrayBase[params.keys[0]][params.keys[1]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]][params.keys[1]][params.keys[2]];
			}
		}
		else if(params.keys.length ==4) {
			if(arrayBase[params.keys[0]] !==undefined && arrayBase[params.keys[0]][params.keys[1]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]];
			}
		}
		else if(params.keys.length ==5) {
			if(arrayBase[params.keys[0]] !==undefined && arrayBase[params.keys[0]][params.keys[1]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]][params.keys[4]];
			}
		}
		else if(params.keys.length ==6) {
			if(arrayBase[params.keys[0]] !==undefined && arrayBase[params.keys[0]][params.keys[1]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]] !==undefined && arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]][params.keys[4]] !==undefined) {
				retArray.val =arrayBase[params.keys[0]][params.keys[1]][params.keys[2]][params.keys[3]][params.keys[4]][params.keys[5]];
			}
		}
		else {
			retArray.valid =0;
			retArray.msg ='Too deep / too many keys; can only handle key length up to 6';
		}
		return retArray;
	}
	
	return {
		restrict: 'A',
		transclude: true,
		scope: {
			itemsRaw: '=',
			itemsFiltered: '=',
			filterFields:'=',
			loadMore:'&',
			opts: '='
		},

		compile: function(element, attrs) {
			var defaults ={'pageSize':10, 'placeholder':'search', 'scrollLoad':'0', 'loadMorePageSize':20, 'loadMoreItemsKey':'extra', 'filterFieldsDotNotation':true, 'pageScroll':0, minSearchLength: 2, minSearchShowAll:1, classInput:'', classInputCont:''};
			for(var xx in defaults) {
				if(attrs[xx] ===undefined) {
					attrs[xx] =defaults[xx];
				}
			}
			//convert to int
			var attrsToInt =['pageSize', 'loadMorePageSize', 'scrollLoad', 'minSearchLength', 'minSearchShowAll'];
			for(var ii=0; ii<attrsToInt.length; ii++) {
				attrs[attrsToInt[ii]] =parseInt(attrs[attrsToInt[ii]], 10);
			}
			//ensure loadMorePageSize is at least as large as pageSize
			if(attrs.loadMorePageSize <attrs.pageSize) {
				attrs.loadMorePageSize =attrs.pageSize;
			}
			if(attrs.id ===undefined) {
				attrs.id ="jrgLookup"+Math.random().toString(36).substring(7);
			}
			var id1 =attrs.id;
			attrs.ids ={
				'input':id1+"Input",
				'contentBottom':id1+"ContentBottom",
				'inputBelow':id1+"InputBelow",
				'scrollContent':id1+"ScrollContent"
			};
			
			var html="<div class='jrg-lookup'>"+
				"<div class='jrg-lookup-top'>"+
					"<div class='jrg-lookup-input-div "+attrs.classInputCont+"'>"+
						"<input type='text' ng-change='changeInput({})' placeholder='"+attrs.placeholder+"' class='jrg-lookup-input "+attrs.classInput+"' ng-model='opts.searchText' ng-click='clickInput({})' />"+
						"<div class='jrg-lookup-input-x' ng-click='clearInput({})'>X</div>"+
					"</div>"+
					//"<div>page: {{page}} totFilteredItems: {{totFilteredItems}} queuedItems: {{queuedItems.length}}</div>"+		//TESTING
					//"<div>hasScrollbar: {{hasScrollbar}} | scrollLoad: {{scrollLoad}}</div>"+		//TESTING
					"<div class='text-warning' ng-show='!trigs.loading && itemsFiltered.length <1 && opts.searchText.length >=minSearchLength'>No matches</div>"+
				"</div>"+
				"<div id='"+attrs.ids.scrollContent+"' class='jrg-lookup-content' ng-transclude></div>"+
				"<div id='"+attrs.ids.contentBottom+"'>"+
					"<div ng-hide='trigs.loading || (noMoreLoadMoreItems && queuedItems.length <1) || (scrollLoad && hasScrollbar)' class='jrg-lookup-more btn-link' ng-click='loadMoreDir({})'>Load More</div>"+
					"<div class='text-warning' ng-show='trigs.loading && opts.searchText.length >=minSearchLength'>Loading..</div>"+
					"<div ng-show='!trigs.loading && noMoreLoadMoreItems && queuedItems.length <1 && opts.searchText.length >=minSearchLength' class='jrg-lookup-no-more muted'>No More Results!</div>"+
				"</div>"+
			"</div>";
				
			element.replaceWith(html);

			return function(scope, element, attrs) {
			};
		},
		
		controller: function($scope, $element, $attrs) {
			var defaults ={
			};
			for(var xx in defaults) {
				if($scope[xx] ===undefined) {
					$scope[xx] =defaults[xx];
				}
			}
			
			if($scope.opts ===undefined) {
				$scope.opts ={};
			}
			var defaultOpts ={
				searchText: '',
				watchItemKeys: ['main']
			};
			$scope.opts =angular.extend(defaultOpts, $scope.opts);
			
			//copy some attributes onto scope for use in html
			$scope.minSearchLength =$attrs.minSearchLength;

			$scope.trigs ={'loading':false,
				skipWatch: false		//used for skipping $watch updating/resetting when load more items (i.e. 'extra' key)
			};
			$scope.items =[];
			$scope.page =1;		//will store what page (broken up by pageSize attr) we're on
			$scope.totFilteredItems =0;
			$scope.queuedItems =[];		//will hold load more items (i.e. from backend) so can always load at least a page ahead and be fast; i.e. when need to display more items, will just load them from queue (without AJAXing / talking to backend) and THEN after displaying (& removing from queue) the new items, IF still don't have enough for the NEXT page, THEN go to backend to preload the next page's worth of items. This way the AJAXing happens AFTER each page is loaded so it should be ready for the next page as opposed to BEFORE (in which case there's a lag while waiting for the items to return)
			var cursors ={		//will hold cursors for items to know where to append to / load more from
				//'extra':0,
			};
			cursors[$attrs.loadMoreItemsKey] =0;
			if($scope.itemsRaw[$attrs.loadMoreItemsKey] ===undefined) {
				$scope.itemsRaw[$attrs.loadMoreItemsKey] ={
					'items':[]
				};
			}
			$scope.itemsRaw[$attrs.loadMoreItemsKey].items =[];
			$scope.noMoreLoadMoreItems =false;		//boolean that will be set to true if (backend) has no more items (i.e. we're at the end of the list and can't load any more)
			$scope.scrollLoad =$attrs.scrollLoad;
			
			//if scroll load style, ensure attrs.ids.scrollContent has scrollable styles (height & overflow)
			if($scope.scrollLoad) {
				if(!$attrs.pageScroll) {
					var ele1 =document.getElementById($attrs.ids.scrollContent);
					var eleAng =angular.element(ele1);
					var height1 =eleAng.css('height');
					var overflow1 =eleAng.css('overflow');
					if(!height1 || !overflow1) {
						eleAng.addClass('jrg-lookup-content-scroll');
					}
				}
				
				$scope.hasScrollbar =false;		//init
			}
			
			$scope.testFxn =function(params) {
				alert("test");
			};
			
			var timeoutInfo ={
				'search': {
					'trig':false,
					'delay':750
				},
				'scrolling':{
					'trig':false,
					'delay':750
				}
			};
			
			/*
			var keycodes ={
				'enter':13,
			};
			
			$("#"+attrs.ids.input).keyup(function(evt) {
				$scope.keyupInput(evt, {});
			});
			*/
			
			//add scroll handle to load more
			if($attrs.scrollLoad) {
				if($attrs.pageScroll) {
					window.onscroll =function() {
						$timeout.cancel(timeoutInfo.scrolling.trig);
						timeoutInfo.scrolling.trig =$timeout(function() {
							//console.log('jrgLookup timeout scrolling loading');
							var buffer =25;
							var scrollPos =$(window).scrollTop();
							var scrollHeight =$(document).height();
							var viewportHeight =$(window).height();
							//console.log("pos: "+scrollPos+" height: "+scrollHeight+" height: "+viewportHeight);
							if(scrollPos >=(scrollHeight-viewportHeight-buffer)) {
								$scope.loadMoreDir({'noDelay':true, 'next':true});
							}
							//prev version
							if(scrollPos <=buffer) {
								$scope.loadMoreDir({'noDelay':true, 'prev':true});
							}
						}, timeoutInfo.scrolling.delay);
					};
				}
				else {
					document.getElementById($attrs.ids.scrollContent).onscroll =function() {
						$timeout.cancel(timeoutInfo.scrolling.trig);
						$timeout.cancel(timeoutInfo.search.trig);
						timeoutInfo.scrolling.trig =$timeout(function() {
							//console.log('jrgLookup timeout scrolling loading');
							var buffer =25;
							var ele =document.getElementById($attrs.ids.scrollContent);
							var scrollPos =ele.scrollTop;
							var scrollHeight =ele.scrollHeight;
							//var height1 =$(ele).height();
							var height1 =ele.clientHeight;
							//console.log("pos: "+scrollPos+" height: "+scrollHeight+" height: "+height1);
							if(scrollPos >=(scrollHeight-height1-buffer)) {
								$scope.loadMoreDir({'noDelay':true});
							}
						}, timeoutInfo.scrolling.delay);
					};
				}
			}
			
			//0.5.
			function init(params) {
				formItems({});
				if($scope.queuedItems.length <$attrs.pageSize && $scope.totFilteredItems <$scope.page*$attrs.pageSize) {		//load more externally if don't have enough
					$scope.loadMoreDir({});
				}
			}
			
			//0.75.
			function resetItems(params) {
				$scope.page =1;		//reset
				checkForScrollBar({});
				$scope.noMoreLoadMoreItems =false;
				$scope.queuedItems =[];
				cursors ={
					//'extra':0,
				};
				cursors[$attrs.loadMoreItemsKey] =0;
				$scope.itemsRaw[$attrs.loadMoreItemsKey].items =[];
				document.getElementById($attrs.ids.scrollContent).scrollTop =0;
				//$("#"+$attrs.ids.scrollContent).scrollTop(0);
			}
			
			//1.
			/*
			concats all types in itemsRaw into a final set of items to be selected from / displayed
			@param params
				OPTIONAL
				keys =array [] of which itemsRaw keys to copy over; otherwise all will be copied over
			*/
			function formItems(params) {
				var keys;
				if(params.keys !==undefined) {
					keys =params.keys;
				}
				else {		//copy them all
					keys =[];
					var counter =0;
					for(var xx in $scope.itemsRaw) {
						keys[counter] =xx;
						counter++;
					}
				}
				$scope.items =[];		//reset first
				for(var ii =0; ii<keys.length; ii++) {
					$scope.items =$scope.items.concat($scope.itemsRaw[keys[ii]].items);
				}
				
				$scope.filterItems({});		//search / re-filter
			}
			
			//2.
			$scope.filterItems =function(params) {
				//$scope.itemsFiltered =$filter('filter')($scope.items, {name:$scope.opts.searchText});
				var curItem =false;
				var searchText1 =$scope.opts.searchText.toLowerCase();
				if(searchText1.length <$attrs.minSearchLength) {
					if($attrs.minSearchShowAll) {		//show all
						$scope.itemsFiltered =$scope.items;
					}
					else {		//show none & reset
						$scope.itemsFiltered =[];
						resetItems({});
						$scope.noMoreLoadMoreItems =true;		//hide loading
					}
				}
				else {		//filter
					$scope.itemsFiltered =$filter('filter')($scope.items, function(item) {
						var match =false;
						var curItem;
						for(var ii=0; ii<$scope.filterFields.length; ii++) {
							if($attrs.filterFieldsDotNotation && $scope.filterFields[ii].indexOf('.') >-1) {
								var retArray1 =evalArray(item, {'keys':$scope.filterFields[ii]});
								if(retArray1.val !==undefined) {
									curItem =retArray1.val;
								}
								else {
									curItem =false;
								}
							}
							else {
								if(item[$scope.filterFields[ii]] !==undefined) {
									curItem =item[$scope.filterFields[ii]];
								}
								else {
									curItem =false;
								}
							}
							if(curItem) {
								curItem =curItem.toLowerCase();
								if(curItem.indexOf(searchText1) >-1) {
									match =true;
									break;
								}
							}
						}
						return match;
					});
				}
				$scope.totFilteredItems =$scope.itemsFiltered.length;
				$scope.itemsFiltered =$scope.itemsFiltered.slice(0, $scope.page*$attrs.pageSize);
				checkForScrollBar({});
			};
			
			//3.
			$scope.clickInput =function(params) {
				$scope.filterItems({});
			};
			
			/**
			@toc 3.5.
			@method $scope.clearInput
			*/
			$scope.clearInput =function(params) {
				$scope.opts.searchText ='';
				$scope.changeInput({});
			};
			
			//4.
			$scope.changeInput =function(params) {
				resetItems({});
				//$scope.filterItems({});
				formItems({});
				//reset timeout
				if(timeoutInfo.search.trig) {
					$timeout.cancel(timeoutInfo.search.trig);
				}
				//set timeout if don't have full items
				if($scope.totFilteredItems <$scope.page*$attrs.pageSize) {
					//show loading
					$scope.trigs.loading =true;
					// if(!$scope.$$phase) {
						// $scope.$apply();
					// }
					timeoutInfo.search.trig =$timeout(function() {
						getMoreItems({});
					}, timeoutInfo.search.delay);
				}
			};
			
			//5.
			/*
			//doesn't work - have to watch a sub array piece
			$scope.$watch('itemsRaw', function(newVal, oldVal) {
				if(!angular.equals(oldVal, newVal)) {		//very important to do this for performance reasons since $watch runs all the time
					formItems({});
				}
			});
			*/
			//for(var xx in $scope.itemsRaw) {
			for(var ii =0; ii<$scope.opts.watchItemKeys.length; ii++) {
				xx =$scope.opts.watchItemKeys[ii];
				//$scope.$watch('itemsRaw', function(newVal, oldVal) {
				//$scope.$watch('itemsRaw['+xx+'].items[0]', function(newVal, oldVal) {
				//$scope.$watch('itemsRaw.extra.items[0]', function(newVal, oldVal) {
				//$scope.$watch('itemsRaw.extra', function(newVal, oldVal) {
				//$scope.$watch('itemsRaw.'+xx, function(newVal, oldVal) {
				$scope.$watch('itemsRaw.'+xx+'.items', function(newVal, oldVal) {
					if(!$scope.trigs.skipWatch && !angular.equals(oldVal, newVal)) {		//very important to do this for performance reasons since $watch runs all the time
						if($scope.totFilteredItems <$scope.page*$attrs.pageSize) {		//if only on first page, reset (otherwise load more button / triggers will be set to false since there's no more in queue / from backend)
							resetItems({});
						}
						formItems({});
						/*
						if($scope.queuedItems.length <$attrs.pageSize && $scope.totFilteredItems <$scope.page*$attrs.pageSize) {		//load more externally if don't have enough
							$scope.loadMoreDir({});
						}
						*/
					}
				});
			}
			
			//5.1.
			$scope.$watch('opts.searchText', function(newVal, oldVal) {
				if(!angular.equals(oldVal, newVal)) {
					$scope.changeInput({});
				}
			});
			
			//5.5. $watch not firing all the time... @todo figure out & fix this.. (also this will reform ALL instances - should pass in an instance id - which means the directive would have to pass an instance back somehow..)
			$scope.$on('jrgLookupReformItems', function(evt, params) {
				formItems({});
			});

			
			//6.
			/*
			Starts the load more process - checks if need to load more (may already have more items in the existing javascript filtered items array, in which case can just load more internally) and IF need to load more external items, sets a timeout to do so (for performance to avoid rapid firing external calls)
				This is paired with the getMoreItems function below - which handles actually getting the items AFTER the timeout
			@param params
				noDelay =boolean true to skip the timeout before loading more (i.e. if coming from scroll, in which case already have waited)
			*/
			$scope.loadMoreDir =function(params) {
				var getMoreItemsTrig =false;
				//if have more filtered items left, increment page & show them
				if($scope.totFilteredItems >$scope.page*$attrs.pageSize) {
					//if this next NEXT page will be less than full, get more items (i.e. from backend) to fill queue
					if($scope.totFilteredItems <($scope.page+2)*$attrs.pageSize) {
						getMoreItemsTrig =true;
					}
					$scope.page++;
					//checkForScrollBar({});
					$scope.filterItems({});
				}
				else {
					getMoreItemsTrig =true;
				}
				//set timeout to get more from backend if function has been given for how to do so
				params.noDelay =true;		//never want to timeout here? Handle that outside this function (should only have on search and on scroll and it's already handled there?)
				if(getMoreItemsTrig) {
					if(params.noDelay) {
						getMoreItems({});
					}
					else {
						$scope.trigs.loading =true;
						// if(!$scope.$$phase) {
							// $scope.$apply();
						// }
						timeoutInfo.search.trig =$timeout(function() {
							getMoreItems({});
						}, timeoutInfo.search.delay);
					}
				}
			};
			
			//7.
			/*
			Handles loading items from the queue and calling the external loadMore function to pre-fill the queue for the next page (this is the function that runs AFTER the timeout set in $scope.loadMoreDir function)
			If have items in queue, they're added to itemsRaw and then formItems is re-called to re-form filtered items & update display
			*/
			function getMoreItems(params) {
				if($scope.loadMore !==undefined && $scope.loadMore() !==undefined && typeof($scope.loadMore()) =='function') {		//this is an optional scope attr so don't assume it exists
					/*
					$scope.loadMore();
					*/
					var retQueue =addItemsFromQueue({});
					var ppTemp ={};
					if(!retQueue.pageFilled) {
						ppTemp.partialLoad =true;
						ppTemp.numToFillCurPage =$attrs.pageSize-retQueue.numItemsAdded;
						if($scope.page*$attrs.pageSize >$scope.totFilteredItems && $scope.totFilteredItems >(($scope.page-1)*$attrs.pageSize)) {		//if have page partially filled by filtered items (but not completely blank), have to subtract that as well
							ppTemp.numToFillCurPage -=$scope.page*$attrs.pageSize -$scope.totFilteredItems;
						}
					}
					//if AFTER loading items from queue, remaining items are less than pageSize, NOW load more (i.e. AJAX to backend) to re-populate queue
					if($scope.queuedItems.length <$attrs.pageSize) {
						if(!$scope.noMoreLoadMoreItems) {		//only try to load more if have more left to load
							var loadPageSize =$attrs.loadMorePageSize;
							if(ppTemp.partialLoad) {		//need to load extra since need to immediately fill the existing page first
								if(loadPageSize <($attrs.pageSize+ppTemp.numToFillCurPage)) {
									loadPageSize =$attrs.pageSize+ppTemp.numToFillCurPage;
									ppTemp.loadPageSize =loadPageSize;
								}
							}
							$scope.loadMore()({'cursor':cursors[$attrs.loadMoreItemsKey], 'loadMorePageSize':loadPageSize, 'searchText':$scope.opts.searchText}, function(results, ppCustom) {
								addLoadMoreItems(results, ppCustom, ppTemp);
							});
						}
					}
				}
				else {		//just reset and remove load more button
					$scope.noMoreLoadMoreItems =true;
					$scope.trigs.loading =false;		//reset
				}
			}
			
			//7.5.
			/*
			@param params
				OPTIONAL
				numToAdd =int of number of items to pull from queue (if not set, will take a full page's worth or the number left in queue, whichever is greater)
				partialLoad =boolean true if just filling the existing page (don't increment page counter)
			@return array {}
				pageFilled =boolean if had enough items in queue to fill the current page (otherwise need to add more immediately to fill it)
				numItemsAdded =int of how many items were added from query
			*/
			function addItemsFromQueue(params) {
				var numFromQueue;
				var retArray ={'pageFilled':false, 'numItemsAdded':0};
				//add items from queue (if exists)
				if($scope.queuedItems.length >0) {
					if(params.numToAdd) {
						numFromQueue =params.numToAdd;
						if($scope.queuedItems.length <numFromQueue) {
							numFromQueue =$scope.queuedItems.length;
						}
					}
					else if($scope.queuedItems.length >=$attrs.pageSize) {
						numFromQueue =$attrs.pageSize;
						retArray.pageFilled =true;
					}
					else {
						numFromQueue =$scope.queuedItems.length;
					}
					retArray.numItemsAdded =numFromQueue;
					$scope.trigs.skipWatch =true;		//skip watch on this itemsRaw update
					//add to itemsRaw then update filtered items
					$scope.itemsRaw[$attrs.loadMoreItemsKey].items =$scope.itemsRaw[$attrs.loadMoreItemsKey].items.concat($scope.queuedItems.slice(0, numFromQueue));
					$timeout(function() {
						$scope.trigs.skipWatch =false;		//reset
					}, 250);
					if(params.partialLoad ===undefined || !params.partialLoad || numFromQueue ==$attrs.pageSize) {		//partial load can be set if need to load a new page so may still need to increment page if loading same number of items as page size
						$scope.page++;
						//checkForScrollBar({});
					}
					formItems({});
					//remove from queue
					$scope.queuedItems =$scope.queuedItems.slice(numFromQueue, $scope.queuedItems.length);
				}
				return retArray;
			}
			
			//8.
			/*
			This is the callback function that is called from the outer (non-directive) controller with the externally loaded items. These items are added to the queue and the cursor is updated accordingly.
				- Additionally, the noMoreLoadMoreItems trigger is set if the returned results are less than the loadMorePageSize
				- Also, it immediately will load from queue if the current page isn't full yet (if params.partialLoad & params.numToFillCurPage are set)
			@param results =array [] of items (will be appended to queue)
			@param ppCustom =params returned from callback
			@param params
				partialLoad =boolean true if need to immediately fill the current page
				numToFillCurPage =int of how many to immediately load from queue
				loadPageSize =int of how many were attempted to be loaded externally (may be larger than $attrs.loadMorePageSize if are doing a partial load as well as the next page load)
			*/
			function addLoadMoreItems(results, ppCustom, params) {
				//$scope.queuedItems.push(results);		//doesn't work - nests array too deep; use concat instead..
				$scope.queuedItems =$scope.queuedItems.concat(results);
				cursors[$attrs.loadMoreItemsKey] +=results.length;		//don't just add $attrs.loadMorePageSize in case there weren't enough items on the backend (i.e. results could be LESS than this)
				//if don't have enough results, assume backend is done so are out of items
				if(results.length <$attrs.loadMorePageSize || (params.loadPageSize !==undefined && results.length <params.loadPageSize)) {
					$scope.noMoreLoadMoreItems =true;
				}
				//if current page isn't full, immediately pull some from queue
				if(params.partialLoad) {
					var retQueue =addItemsFromQueue({'partialLoad':true, 'numToAdd':params.numToFillCurPage});
				}
				$scope.trigs.loading =false;		//reset
			}
			
			//9.
			function checkForScrollBar(params) {
				if($scope.scrollLoad) {
					$timeout(function() {		//need timeout to wait for items to load / display so scroll height is correct
						var scrollHeight;
						if($attrs.pageScroll) {
							//var scrollPos =$(window).scrollTop();
							scrollHeight =$(document).height();
							var viewportHeight =$(window).height();
							//console.log("pos: "+scrollPos+" height: "+scrollHeight+" height: "+height1);
							if(scrollHeight >viewportHeight) {
								$scope.hasScrollbar =true;
							}
							else {
								$scope.hasScrollbar =false;
							}
						}
						else {
							var ele =document.getElementById($attrs.ids.scrollContent);
							//var scrollPos =ele.scrollTop;
							scrollHeight =ele.scrollHeight;
							var height1 =ele.clientHeight;
							//console.log('checkForScrollBar scrollHeight: '+scrollHeight+' height1: '+height1);
							if(scrollHeight >height1) {
								$scope.hasScrollbar =true;
							}
							else {
								$scope.hasScrollbar =false;
							}
						}
					}, 100);
				}
			}
			
			init({});		//init (called once when directive first loads)
		}
	};
}]);