define( [
	'node',
	'nodemanager',
	'tools/utils'
], function(
	Node,
	nodeManager,
	utils
) {
	'use strict';

	function TextNode() {
		Node.apply( this, arguments );
	}

	utils.extend( TextNode, Node, {
		isEmpty: true,
		isWrapped: false,
		tags: [ '#text' ],
		type: 'text',

		toData: function( options ) {
			var text = options.element.textContent;

			options.onData( options.attributes.length ? text.split( '' ).map( function( char ) {
				return [ char, options.attributes ];
			} ) : text.split( '' ) );
		},

		toDom: function( data, doc, store ) {
			var text = [], // content of the text node
				currentStyles, // previous styles to compare with current
				// top levels stack; output elements are build from that stack; we dump element to this stack when we
				// reach top level during processing (all elements are close, diffStyles == 0 or no styles)
				elementStack = [],
				// array of parent stacks [ ..., [grand-grand-parent], [grand-parent], [parent] ]
				// every item contains arrays build the same way: the element (as a first element of the array) and its children:
				// [ <elem>, child, child, [ childStack ], ... ]
				parentStack,
				// last item of the parentStack or the elementStack if parentStack is null
				currentStack;

			// F <b> o </b> o <b> b <u> a </u> r </b>
			//                          ^
			//	elementStack: [ 'F', [ <b>, o ], o ] // we didn't put the second <b> to elementStack because we still processing it
			//	parentStack: [ [ <b>, 'b' ], [ <u> ] ] // grandparent and parent; we didn't put the second array into
			//                                         // the first because we are keep processing it
			//	currentStack: [ <u> ] // last element of the parentStack is the element we are currently processing
			//
			// F <b> o </b> o <b> b <u> a </u> r </b>
			//                                 ^
			//	elementStack: [ 'F', [ <b>, o ], o ] // as above
			//	parentStack: [ [ <b>, 'b', [ <u>, 'a' ] ] ] // we left <u> so we put the second array into the first one
			//	currentStack: [ [ <b>, 'b', [ <u>, 'a' ] ] ] // as above

			// find where the two arrays of styles differ and return the difference index (-1 if they are the same)
			// [ 0 ] and [ 0 ] -> do nothing
			// [ 0 ] and [ 0, 1 ] -> open style 1
			// [ 0, 1 ] and [ 1 ] -> close style 1 and 0 then open style 1.
			function diffStyles( a, b ) {
				var diffIndex = -1;

				// second array is longer so let's swap them
				if ( b.length > a.length ) {
					var tmp = a;

					a = b;
					b = tmp;
				}

				a.some( function( value, index ) {
					// element at this index is different
					if ( value !== b[ index ] ) {
						diffIndex = index;

						return true;
					}
				} );

				return diffIndex;
			}

			// create DOM elements for the given style
			function getStyledElement( id ) {
				var styleDef = store.get( id ),
					styleConstructor = nodeManager.matchStyleForData( styleDef );

				return styleConstructor.toDom( styleDef, doc );
			}

			// prepare array of DOM elements for the given set of styles
			function getStyledElements( styles ) {
				var result = [];

				styles.forEach( function( id ) {
					var elem = getStyledElement( id );
					result.push( [ elem ] );
				} );

				return result;
			}

			// append children elements to parent element located at index = 0
			function appendToParent( stack ) {
				if ( utils.isArray( stack ) ) {
					var parent = stack.shift();

					stack.forEach( function( child ) {
						parent.appendChild(
							Array.isArray( child ) ? appendToParent( child ) : child
						);
					} );

					return parent;
				}

				return stack;
			}

			// create a text node from the buffer, push it to the current stack and empty the
			function flushTextBuffer() {
				if ( text.length ) {
					var textNode = doc.createTextNode( text.join( '' ) );
					text.length = 0;
					currentStack.push( textNode );
				}
			}

			// append current elements to elementStack when the all tags are closed and we reach the top level
			function flushParentStack() {
				if ( parentStack && parentStack.length ) {
					// TODO: concat.apply
					for ( var j = parentStack.length - 1; j > 0; j-- ) {
						parentStack[ j - 1 ].push( parentStack[ j ] );
					}

					elementStack.push( parentStack[ 0 ] );
					parentStack = null;
				}
			}


			for ( var i = 0, len = data.length; i < len; i++ ) {
				var item = data[ i ];

				// it's a styled text
				if ( utils.isArray( item ) ) {
					var styles = item[ 1 ];
					// an index on which two style arrays differ
					var diffIndex = diffStyles( styles, currentStyles || [] );

					// no styled items before or styles are completely different
					// anyway we need to close all element and open new ones, see diffStyles
					if ( diffIndex === 0 ) {
						currentStyles = styles;
						flushTextBuffer();
						flushParentStack();

						parentStack = getStyledElements( styles );
						currentStack = parentStack[ parentStack.length - 1 ];

						// styles are different at some point
					} else if ( diffIndex > 0 ) {
						currentStyles = styles;
						flushTextBuffer();

						var removed = parentStack.splice( diffIndex, parentStack.length - diffIndex );

						// append removed elements to their parents
						if ( removed.length ) {
							// Array of arrays -> array
							// TODO: concat.apply
							for ( var j = removed.length - 1; j > 0; j-- ) {
								removed[ j - 1 ].push( removed[ j ] );
							}

							// append it to the last element of the parent stack
							parentStack[ parentStack.length - 1 ].push( removed[ 0 ] );
						}

						var toAdd = styles.slice( diffIndex );

						// add new elements to the parent stack
						if ( toAdd.length ) {
							var newStyledElements = getStyledElements( toAdd );
							parentStack = parentStack.concat( newStyledElements );
						}

						currentStack = parentStack[ parentStack.length - 1 ];
					}

					// add the item's text to the buffer
					text.push( item[ 0 ] );

					// a plain text
				} else {
					// append current elements to their parents
					flushParentStack();

					// set the currentStack back to the elementStack
					if ( currentStack !== elementStack ) {
						flushTextBuffer();
						currentStack = elementStack;
						// clear styles
						currentStyles = null;
					}
					// it's a plain text so just push it to the buffer
					text.push( item );
				}
			}

			// append final data
			flushParentStack();
			flushTextBuffer();

			// append child elements to its parents
			elementStack = elementStack.map( appendToParent );

			return elementStack;
		}
	} );

	utils.inherit( TextNode, Node );

	nodeManager.register( TextNode );

	return TextNode;
} );