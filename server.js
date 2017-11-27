var schedule = require( 'node-schedule' );
var request = require( 'request' );
var cheerio = require( 'cheerio' );

var numberRequests = 3;
var courseList = [];
var requestProcessed = 0;

// var j = schedule.scheduleJob( '0/5 */1 * * * *', function (){
var j = schedule.scheduleJob( '*/5 * * * * *', function (){
	if ( requestProcessed == 0 ){
		for ( var i = 1; i <= numberRequests; i++ ){
			makeRequest( i );
		}
	} else {
		console.log( 'Waiting some response' );
	}
});

function makeRequest ( pagination ){
	console.log( 'mensaje - realizando petición [ %d ] ', pagination );

	var urlPagination = getUrlWithPagination( pagination );

	request( urlPagination, function( error, response, body ){
		processBodyResponse( body );
	});
}

function getUrlWithPagination ( pagination ){
	if ( pagination > 1 ){
		return 'https://celexupiicsa.info/page/'+ pagination +'/?s=Listas%20de%20cursos%20de%20';
	}

	return 'https://celexupiicsa.info/?s=Listas%20de%20cursos%20de%20';
}

function processBodyResponse ( body ){
	var $ = cheerio.load( body );
	var content = $( 'h1.entry-title' );

	if ( requestProcessed == 0 ){
		courseList = [];
	}

	content.each( function ( index, element ){
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

		courseList.sort( function ( a, b ){

			if ( $( a ).text() < $( b ).text() ){
				return -1;
			}

			if ( $( a ).text() > $( b ).text() ){
				return 1;
			}

			return 0;
		});

		courseList.forEach( function ( element, index ){
			// console.log( 'title -> %s ', $( element ).text() );
			console.log( 'title -> %s <- [ %d ]', $(element).text(), index );
		});
	}

	// if ( requestProcessed == numberRequests ){
		requestProcessed = 0;
	// }

}