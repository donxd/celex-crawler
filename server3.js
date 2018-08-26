let schedule = require( 'node-schedule' );
let request = require( 'request' );
let cheerio = require( 'cheerio' );

let numberRequests = 3;
let courseList = [];
let requestProcessed = 0;
const URL_DATA = 'https://celexupiicsa.info/?s=ubicación -examen&feed=rss2';

for ( let i = 1; i <= numberRequests; i++ ){
	makeRequest( i );
}

function makeRequest ( pagination ){
	let urlPagination = getUrlWithPagination( pagination );
	console.log( 'mensaje - realizando petición [ %s ] ', urlPagination );

	request( urlPagination, ( error, response, body ) => {
		processBodyResponse( body );
	});
}

function getUrlWithPagination ( pagination ){
	if ( pagination > 1 ){
		return URL_DATA + '&paged=' + pagination;
	}

	return URL_DATA;
}

function processBodyResponse ( body ){
	let $ = cheerio.load( body );
	let content = $( 'h1.entry-title' );

	if ( requestProcessed == 0 ){
		courseList = [];
	}

	content.each( ( index, element ) => {
		// console.log( 'title [ %d ] -> %s ', index, $(element).text() );

		if ( $( element ).text().indexOf( 'Listas de cursos de ') != -1 ){
			courseList.push( $( element ) );
		}

	});

	requestProcessed++;

	if ( requestProcessed == numberRequests ){
		printInformation( $ );
	}

}

function printInformation ( $ ){

	if ( courseList.length > 0 ){

		courseList.sort( ( a, b ) => {

			if ( $( a ).text() < $( b ).text() ){
				return -1;
			}

			if ( $( a ).text() > $( b ).text() ){
				return 1;
			}

			return 0;
		});

		courseList.forEach( ( element, index ) => {
			// console.log( 'title -> %s ', $( element ).text() );
			console.log( 'title -> %s <- [ %d ]', $(element).text(), index );
		});
	}

	// if ( requestProcessed == numberRequests ){
		requestProcessed = 0;
	// }

}