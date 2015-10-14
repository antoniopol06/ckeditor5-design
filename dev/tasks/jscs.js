/* jshint node: true */

'use strict';

var tools = require( './utils/tools' );

module.exports = function( grunt ) {
	tools.setupMultitaskConfig( grunt, {
		task: 'jscs',
		defaultOptions: {
				config: true
			},
		addGitIgnore: 'excludeFiles',
		targets: {
			all: function() {
				return [ '**/*.js' ];
			},

			git: function() {
				return tools.getGitDirtyFiles().filter( function( file ) {
					return ( /\.js$/ ).test( file );
				} );
			}
		}
	} );

	grunt.loadNpmTasks( 'grunt-jscs' );
};