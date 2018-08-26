const cheerio = require( 'cheerio' );
const moment = require( 'moment' );
const request = require( 'request' );
// const schedule = require( 'node-schedule' );

let fullProcess = getParamterFullProcess();
let numberRequests = getParameterNumberRequest();

let courseList = [];
let requestProcessed = 0;

// const URL_DATA = 'https://celexupiicsa.info/?s=ubicación -examen&feed=rss2';
const URL_DATA_ALL = 'https://celexupiicsa.info/?s=ubicaci%C3%B3n%20-examen&feed=rss2'; // all data
const URL_DATA_LINKS = 'https://celexupiicsa.info/?s=ubicaci%C3%B3n%20-examen&feed=rss'; // links

const TAG_ELEMENT_DATA = 'item';
const TAG_TITLE_ITEM = 'title';
const TAG_TITLE_CONTENT = 'content\\:encoded';
const TAG_PUBLICATION_ITEM = 'pubDate';

const TAG_LIST_COURSES = 'table';
const TAG_LIST_DATA = 'tr';
const TAG_DATA_TITLE = 'th';
const TAG_DATA_INFO = 'td';

const FORMAT_ACQUISITION = 'ddd, DD MMM YYYY HH:mm:ss +0000';
const FORMAT_SHOW = 'YYYY-MM-DD HH:mm:ss';

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

function getTimePublication ( element ){
	const $ = element.doc;

	const textTime = $( element.course ).find( TAG_PUBLICATION_ITEM ).first().text();
	const timeFormat = moment( textTime, FORMAT_ACQUISITION ).format( FORMAT_SHOW );

	// date( 'D, d M Y H:i:s +0000' )
	// Sat, 11 Aug 2018 22:24:26 +0000
	// moment.format('ddd, DD MMM YYYY H:mm:ss +0000')

	return `${textTime} -> ${timeFormat}`;
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

		// orderCourseList();
		const dataCourses = [];

		courseList.forEach( ( element, index ) => {
			const hasContentItem = !!getContentItem( element );
			const publicationTime = getTimePublication( element );
			console.log( `title -> ${getTitleItem( element )} <- [ ${index} ] [ ${publicationTime} ] content ? ${hasContentItem} ` );

			if ( !!hasContentItem ){
				categorizeItem( dataCourses, element );
			}
		});

		showInformation( dataCourses );
	}

	requestProcessed = 0;
}


function showInformation ( dataCourses ){
	dataCourses.forEach(course => {
		// console.log('course -> ', JSON.stringify(course));
		console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ] `);
	});
}

function categorizeItem ( dataCourses, item ){
	const contentItem = getContentItem( item ).text();

	const $$ = cheerio.load( contentItem, { xmlMode: true } );
	const itemLists = $$( TAG_LIST_COURSES );

	// console.log( `item[ courses ] # ${itemLists.length}`);

	const courses = [];

	itemLists.each( (index, element) => {
		const infoCourse = getInfoCourse( $$, element );
		// console.log('course -> ', JSON.stringify(infoCourse));
		dataCourses.push( infoCourse );
	});

	// return dataCourses;
}

function getInfoCourse ( $, course ){
	const data = $( course ).find( TAG_DATA_TITLE );

	// console.log( `course.tagName -> ${course.tagName} `);
	// console.log( `data.length -> ${data.length} `);

	return {
		language: data.eq(1).text() ? data.eq(1).text().trim() : '-',
		semester: data.eq(3).text() ? data.eq(3).text().trim() : '-',
		level: data.eq(5).text() ? data.eq(5).text().trim() : '-',
		teacher: data.eq(8).text() ? data.eq(8).text().trim() : '-',
		schedule: data.eq(10).text() ? data.eq(10).text().trim() : '-',
		classroom: data.eq(12).text() ? data.eq(12).text().trim() : '-',
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