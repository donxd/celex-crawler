let schedule = require( 'node-schedule' );
let request = require( 'request' );
let cheerio = require( 'cheerio' );

let numberRequests = getParameterNumberRequest();
let fullProcess = getParamterFullProcess();

let courseList = [];
let requestProcessed = 0;

// const URL_DATA = 'https://celexupiicsa.info/?s=ubicación -examen&feed=rss2';
const URL_DATA_ALL = 'https://celexupiicsa.info/?s=ubicaci%C3%B3n%20-examen&feed=rss2'; // all data
const URL_DATA_LINKS = 'https://celexupiicsa.info/?s=ubicaci%C3%B3n%20-examen&feed=rss'; // links

const TAG_TITLE_ITEM = 'title';

for ( let i = 1; i <= numberRequests; i++ ){
	makeRequest( i );
}

function getParameterNumberRequest (){
	if (process.env.LIMIT_PAGE && !Number.isNaN(Number.parseInt(process.env.LIMIT_PAGE))) return Number.parseInt(process.env.LIMIT_PAGE);

	return 1;
}

function getParamterFullProcess (){
	if (process.env.FULL_PROCESS) return process.env.FULL_PROCESS === 'y';

	return true;
}

function makeRequest ( pagination ){
	let urlPagination = getUrlWithPagination( pagination );
	console.log( 'mensaje - realizando petición [ %s ] ', urlPagination );

	request( urlPagination, ( error, response, content ) => {
		processXMLResponse( content );
	});
}

function getUrlWithPagination ( pagination ){
	const urlData = fullProcess ? URL_DATA_ALL : URL_DATA_LINKS;
	if ( pagination > 1 ){
		return urlData + '&paged=' + pagination;
	}

	return urlData;
}

function processXMLResponse ( content ){
	let $ = cheerio.load( content );
	// console.log('content request -> ', content);

	if ( requestProcessed == 0 ){
		courseList = [];
	}

	let elements = $( 'item' );

	elements.each((index, element) => {
		courseList.push( {doc: $, course: element} );
	});


	requestProcessed++;

	if ( requestProcessed === numberRequests ){
		printInformation();
	}
}

function getTitleItem ( element ){
	const $ = element.doc;
	return $( element.course ).find( TAG_TITLE_ITEM ).eq(0).text();
}

function printInformation (){
	console.log('courseList.length -> ', courseList.length);
	if ( courseList.length > 0 ){

		orderCourseList();

		courseList.forEach( ( element, index ) => {
			console.log( 'title -> %s <- [ %d ]', getTitleItem(element), index );
		});
	}

	requestProcessed = 0;
}

function orderCourseList (){
	courseList.sort( ( a, b ) => {

		const titleA = getTitleItem(a);
		const titleB = getTitleItem(b);

		if ( titleA < titleB ){
			return -1;
		}

		if ( titleA > titleB ){
			return 1;
		}

		return 0;
	});
}