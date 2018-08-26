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

const TAG_ELEMENT_DATA = 'item';
const TAG_TITLE_ITEM = 'title';
const TAG_TITLE_CONTENT = 'content\\:encoded';

const TAG_LIST_COURSES = 'table';
const TAG_LIST_DATA = 'tr';
const TAG_DATA_INFO = 'td';

for ( let i = 1; i <= numberRequests; i++ ){
	makeRequest( i );
}

function getParameterNumberRequest (){
	if ( isValidNumber( process.env.LIMIT_PAGE ) ){
		return Number.parseInt(process.env.LIMIT_PAGE);
	}

	return 1;
}

function isValidNumber ( content ){
	return content && !Number.isNaN( Number.parseInt( content ) );
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
	let $ = cheerio.load( content, { xmlMode: true } );
	// console.log('content request -> ', content);

	if ( requestProcessed == 0 ){
		courseList = [];
	}

	let elements = $( TAG_ELEMENT_DATA );

	elements.each( (index, element) => {
		courseList.push( {doc: $, course: element} );
	});


	requestProcessed++;

	if ( requestProcessed === numberRequests ){
		printInformation();
	}
}

function getTitleItem ( element ){
	const $ = element.doc;

	return $( element.course ).find( TAG_TITLE_ITEM ).first().text();
}

function getContentItem ( element ){
	const $ = element.doc;
	const content = $( element.course ).find( TAG_TITLE_CONTENT ).first();

	return content ? content : false;
}

function printInformation (){
	console.log( 'courseList.length -> ', courseList.length );
	if ( courseList.length > 0 ){

		orderCourseList();
		const dataCourses = [];

		courseList.forEach( ( element, index ) => {
			const hasContentItem = !!getContentItem( element );
			console.log( `title -> ${getTitleItem( element )} <- [ ${index} ] content ? ${hasContentItem} ` );

			if ( !!hasContentItem ){
				categorizeItem( dataCourses, element );
			}
		});
	}

	requestProcessed = 0;
}

function categorizeItem ( dataCourses, item ){
	const contentItem = getContentItem( item ).text();

	const $$ = cheerio.load( contentItem, { xmlMode: true } );
	const itemLists = $$( TAG_LIST_COURSES );

	console.log( `item[ courses ] # ${itemLists.length}`);

	// const courses = [];

	// itemLists.each( (index, element) => {
	// 	console.log( `item[ ${index} ]`);
	// 	const infoCourse = getInfoCourse( $, element );
	// });

	return dataCourses;
}

function getInfoCourse ( $, course ){
	const data = $( course ).find( TAG_LIST_DATA ).eq( 0 );

	const cells = $( data ).find( TAG_DATA_INFO );

	cells.each( (index, element) => {
		console.log( `cell [ ${index} ] -> ${element.text()} `);
	});

	return {
		// language: tableHead.eq(1).text(),
		// semester: tableHead.eq(3).text(),
		// level: tableHead.eq(5).text(),
		// teacher: tableHead.eq(8).text(),
		// schedule: tableHead.eq(10).text(),
		// classroom: tableHead.eq(12).text(),
		// students: studentsData,
	};
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