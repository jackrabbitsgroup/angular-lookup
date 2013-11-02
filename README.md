# AngularJS look (more robust filter, with paging) directive

Expands ng-filter to add paging and backend loading.

## Why? / When to use?
Why not just use AngularJS built in ng-filter directive? This module uses that but adds a few features:
1. handles paging / loading more (i.e. when scroll to bottom)
2. can be used with a backend lookup call to load more results AND a queue is used so the NEXT page's items are ALREADY loaded - the backend / AJAX call is done right AFTER the previous page load so it should always be pretty fast.

## Demo
http://jackrabbitsgroup.github.io/angular-lookup/

## Dependencies
- required:
	- angular (tested with 2.0.rc3)
	- lesshat
- optional
	- [none]

See `bower.json` and `index.html` in the `gh-pages` branch for a full list / more details

## Install
1. download the files
	1. Bower
		1. add `"angular-lookup": "latest"` to your `bower.json` file then run `bower install` OR run `bower install angular-lookup`
2. include the files in your app
	1. `lookup.js`
	2. `lookup.less`
3. include the module in angular (i.e. in `app.js`) - `jackrabbitsgroup.angular-lookup`

See the `gh-pages` branch, files `bower.json` and `index.html` for a full example.


## Documentation
See the `lookup.js` file top comments for usage examples and documentation
https://github.com/jackrabbitsgroup/angular-lookup/blob/master/lookup.js