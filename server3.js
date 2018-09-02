const cheerio = require( 'cheerio' );
const iconv = require( 'iconv' );
const iconvLite = require('iconv-lite');
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
const TAG_LINK_ITEM = 'link';
const TAG_CONTENT_ITEM = 'content\\:encoded';
const TAG_PUBLICATION_ITEM = 'pubDate';

const TAG_LIST_COURSES = 'table';
const TAG_DATA_TITLE = 'th';
const TAG_LIST_DATA = 'tr';
const TAG_DATA_INFO = 'td';

const FORMAT_ACQUISITION = 'ddd, DD MMM YYYY HH:mm:ss +0000'; // php -> 'D, d M Y H:i:s +0000' // example => Sat, 11 Aug 2018 22:24:26 +0000
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
		// content = iconvLite.decode( content, 'utf-8' );
		// content = iconvLite.decode( content, 'ISO-8859-1' );
		// content = toUTF8( content );

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
	let $ = cheerio.load( content, { xmlMode: true, decodeEntities: false } );
	// let $ = cheerio.load( content, { xmlMode: true, decodeEntities: true } );
	// let $ = cheerio.load( content, { xmlMode: true } );
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

function getTimePublicationItem ( element ){
	const textTime = getComponentItem( TAG_PUBLICATION_ITEM, element ).text();
	const timeFormat = moment( textTime, FORMAT_ACQUISITION ).format( FORMAT_SHOW );

	return timeFormat;
}

function getTitleItem ( element ){
	return getComponentItem( TAG_TITLE_ITEM, element ).text();
}

function getLinkItem ( element ){
	return getComponentItem( TAG_LINK_ITEM, element ).text();
}

function getContentItem ( element ){
	return getComponentItem( TAG_CONTENT_ITEM, element );
}

function getComponentItem ( component, element ){
	const $ = element.doc;
	const content = $( element.course ).find( component ).first();

	return content ? content : false;
}

function printInformation (){
	console.log( 'courseList.length -> ', courseList.length );
	if ( courseList.length > 0 ){

		// orderCourseList();
		const dataCourses = [];

		courseList.forEach( ( element, index ) => {
			const hasContentItem = !!getContentItem( element );

			const linkItem = getLinkItem( element );
			const publicationTimeItem = getTimePublicationItem( element );
			const titleItem = getTitleItem( element );

			console.log( `[ ${publicationTimeItem} ] title [ ${titleItem} ] [ ${index} ] content ? ${hasContentItem} ` );

			if ( !!hasContentItem ){
				classifyItem( dataCourses, element, linkItem, publicationTimeItem, titleItem );
			}
		});

		// showInformation( dataCourses );
		organizeInformation( dataCourses );
		showInformation( dataCourses );
	}

	requestProcessed = 0;
}


function showInformation ( dataCourses ){
	dataCourses.forEach(course => {
		// console.log('course -> ', JSON.stringify(course));
		console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ][ s: ${course.students.length} ] `);
		// course.students.forEach(student => {
		// 	console.log( `student -> ${student} `);
		// });
	});
}

function classifyItem ( dataCourses, item, linkItem, publicationTimeItem, titleItem ){
	let contentItem = getContentItem( item ).text();

	// contentItem = iconvLite.decode( contentItem, 'utf-8' );
	// contentItem = iconvLite.decode( contentItem, 'ISO-8859-1' );
	// contentItem = toUTF8( contentItem );

	const $$ = cheerio.load( contentItem, { xmlMode: true, decodeEntities: false } );
	// const $$ = cheerio.load( contentItem, { xmlMode: true, decodeEntities: true } );
	// const $$ = cheerio.load( contentItem, { xmlMode: true } );
	const itemLists = $$( TAG_LIST_COURSES );

	// console.log( `item[ courses ] # ${itemLists.length}`);

	const courses = [];

	itemLists.each( (index, element) => {
		const infoCourse = getInfoCourse( $$, element, linkItem, publicationTimeItem, titleItem );
		dataCourses.push( infoCourse );
	});
}

function getInfoCourse ( $, course, linkItem, publicationTimeItem, titleItem ){
	const data = $( course ).find( TAG_DATA_TITLE );
	const studentsData = getStudentsData( $, course );

	return {
		language: data.eq(1).text() ? data.eq(1).text().trim() : '-',
		semester: data.eq(3).text() ? data.eq(3).text().trim() : '-',
		level: data.eq(5).text() ? data.eq(5).text().trim() : '-',
		teacher: data.eq(8).text() ? data.eq(8).text().trim() : '-',
		schedule: data.eq(10).text() ? data.eq(10).text().trim() : '-',
		classroom: data.eq(12).text() ? data.eq(12).text().trim() : '-',
		link : linkItem,
		publication : publicationTimeItem,
		title : titleItem,
		students: studentsData,
	};
}

function getStudentsData ( $, course ){
	const students = [];

	$( course ).find( TAG_LIST_DATA ).each( ( index, student ) => {
		if ( index > 3 ){

			let dataStudent = $( student ).find( TAG_DATA_INFO ).eq( 1 ).text();
			dataStudent = getCleanDataStudent( dataStudent );

			students.push( dataStudent );
		}
	});

	if ( !students.length ) {
		$( course ).find( TAG_DATA_INFO ).each( ( index, student ) => {
			if ( index % 2 ){
				let dataStudent = $( student ).text();
				dataStudent = getCleanDataStudent( dataStudent );

				students.push( dataStudent );
			}
		});
	}

	return students;
}

function getCleanDataStudent ( dataStudent ){
	// dataStudent = toUTF8( dataStudent );
	const characters = new RegExp( /[Ã]/, 'g' );
	if ( characters.test( dataStudent ) ){
		dataStudent = iconvLite.decode( dataStudent, 'utf-8' );
	}
	// dataStudent = iconvLite.decode( dataStudent, 'ISO-8859-1' );

	return dataStudent;
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

function organizeInformation ( dataCourses ){
	sortOrderCourses( dataCourses );
}

function sortOrderCourses ( dataCourses ){
	dataCourses.sort( ( a, b ) => {
		const textA = courseToStringOrder( a );
		const textB = courseToStringOrder( b );

		if ( textA === textB ) return 0;
		if ( textA > textB ) return 1;

		return -1;
	});
}

function courseToStringOrder ( course ){
	return `c[ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ]`;
}

// function toUTF8 ( body ){
//   // convert from iso-8859-1 to utf-8
//   var ic = new iconv.Iconv( 'iso-8859-1', 'utf-8' );
//   var buf = ic.convert( body );

//   return buf.toString('utf-8');
// }