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
const URL_PAGINATION = '&paged=';

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

const FLAG_PARAMETER_YES = 'y';

const PROPERTY_EMPTY = '-';
const TITLE_SEPARATOR = '–';

const ENCODING_TEXT = 'utf-8';

const BAD_ENCODING_SYMBOL = 'Ã';
const REPEATED_SPACE = new RegExp( /[ ]+/, 'g');

const SINGLE_SPACE_FOR_STUDENT_NAME = ' ';

const CANCEL_COURSE_TEXT = 'CANCELADO';

const ACTIVE_COURSE = 'ACTIVE';
const CANCELLED_COURSE = 'CANCELLED';
const UNDEFINED_STATUS_COURSE = '';

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
	if (process.env.FULL_PROCESS) return process.env.FULL_PROCESS === FLAG_PARAMETER_YES;

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
		return urlData + URL_PAGINATION + pagination;
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
		showCourseData( course );
	});
}

function showCourseData ( course ){
	// console.log('course -> ', JSON.stringify(course));
	console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ][ s: ${course.students.length} ] `);
	course.students.forEach(student => {
		console.log( `student -> ${student}`);
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
		language: getDataFromPosition( data, 1 ),
		semester: getDataFromPosition( data, 3 ),
		level: getDataFromPosition( data, 5 ),
		teacher: getDataFromPosition( data, 8 ),
		schedule: getDataFromPosition( data, 10 ),
		classroom: getDataFromPosition( data, 12 ),
		link : linkItem,
		publication : publicationTimeItem,
		title : cleanTitleItem( titleItem ),
		titleComponents : componentsTitle( titleItem ),
		titleOriginal : titleItem,
		students: studentsData,
	};
}

function getDataFromPosition ( data, position ){
	return data.eq( position ).text() ? data.eq( position ).text().trim() : PROPERTY_EMPTY;
}

function cleanTitleItem ( title ){
	const titleCleaningSymbols = { regex: /(&#8211;)|(-)/g, replace: TITLE_SEPARATOR };
	const titleCleanRemove = { regex: /(Listas de cursos de )|(Listas de curso de )/g, replace: '' };

	title = title.replace( titleCleaningSymbols.regex, titleCleaningSymbols.replace );
	title = title.replace( titleCleanRemove.regex, titleCleanRemove.replace );

	return title;
}

function componentsTitle ( titleItem ){
	const cleanTitle = cleanTitleItem( titleItem );

	const components = cleanTitle.split( TITLE_SEPARATOR )
		.map( component => component.trim() );

	return {
		language: components[ 0 ],
		schedule: components[ 1 ],
		dateStart: components[ 2 ],
		code: components[ 3 ],
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
	// console.log(`=======>${dataStudent}<=======`);

	// dataStudent = toUTF8( dataStudent );
	let dataStudentCleaned = dataStudent.trim().replace( REPEATED_SPACE, SINGLE_SPACE_FOR_STUDENT_NAME );

	if ( dataStudentCleaned.indexOf( BAD_ENCODING_SYMBOL ) !== -1 ){
		dataStudentCleaned = iconvLite.decode( dataStudentCleaned, ENCODING_TEXT );
	}
	// dataStudent = iconvLite.decode( dataStudent, 'ISO-8859-1' );

	return dataStudentCleaned;
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

	const courses = cloneArrayData( dataCourses );
	// const activeCourses = getActiveCourses( courses );
	// const cancelledCourses = getCancelledCourses( courses );

	console.log( 'courses.length -> ', courses.length );
	// console.log( 'activeCourses.length -> ', activeCourses.length );
	// console.log( 'cancelledCourses.length -> ', cancelledCourses.length );

	const languageCourses = classifyCoursesByLanguage( courses );
	// const activeLanguageCourses = classifyCoursesByLanguage( activeCourses );
	// const cancelledLanguageCourses = classifyCoursesByLanguage( cancelledCourses );

	showDataCourseLanguage( languageCourses );
	// showDataCourseLanguage( activeLanguageCourses, true );
	// showDataCourseLanguage( cancelledLanguageCourses, false );

	const languageCoursesSchedule = classifyLanguageCoursesBySchedule( languageCourses );
	// const activeLanguageCoursesSchedule = classifyLanguageCoursesBySchedule( activeLanguageCourses );
	// const cancelledLanguageCoursesSchedule = classifyLanguageCoursesBySchedule( cancelledLanguageCourses );
	sortCoursesLanguageBySchedule( languageCoursesSchedule );
	showDataCourseLanguageSchedule( languageCoursesSchedule );
	// showDataCourseLanguageSchedule( activeLanguageCoursesSchedule, true );
	// showDataCourseLanguageSchedule( cancelledLanguageCoursesSchedule, false );
}

function cloneArrayData ( array ){
	return JSON.parse( JSON.stringify( array ) );
}

function getActiveCourses ( courses ){
	return courses.filter( course => course.teacher !== CANCEL_COURSE_TEXT );
}

function getCancelledCourses ( courses ){
	return courses.filter( course => course.teacher === CANCEL_COURSE_TEXT );
}

function classifyCoursesByLanguage ( courses ){
	return courses.reduce( ( acc, course ) => {
		const positionCourseLanguage = getPositionCourseLanguage( acc, course );
		if ( positionCourseLanguage.length ){
			addCourseOnLanguage( acc, positionCourseLanguage[ 0 ], course );
		} else {
			addLanguage( acc, course );
		}

		return acc;
	}, [] );
}

function getPositionCourseLanguage ( courses, courseLanguage ){
	const positions = [];
	for ( let position = 0; position < courses.length; position++ ){
		if ( courses[ position ].language === courseLanguage.language ){
			positions.push( position );
			break;
		}
	}

	return positions;
}

function addCourseOnLanguage ( acc, position, course ){
	acc[ position ].courses.push( course );
}

function addLanguage ( acc, course ){
	acc.push({
		language: course.language,
		courses: [ course ],
	});
}

function showDataCourseLanguage ( languageCourses, activeFlag = null ){
	const flag = getFlagData( activeFlag );

	languageCourses.forEach( courseByLanguage => {
		console.log(`course l ${flag}[ ${courseByLanguage.language} ][ ${courseByLanguage.courses.length} ]`);
	});
}

function sortCoursesLanguageBySchedule ( languageCoursesSchedule ){
	languageCoursesSchedule.forEach( courseByLanguage => {
		sortCoursesBySchedule( courseByLanguage );
	});
}

function sortCoursesBySchedule ( courseByLanguage ){
	courseByLanguage.schedules.sort( ( a, b ) => {
		if ( a.schedule === b.schedule ) return 0;
		if ( a.schedule > b.schedule ) return 1;

		return -1;
	});
}

function showDataCourseLanguageSchedule ( languageCoursesSchedule, activeFlag = null ){
	const flag = getFlagData( activeFlag );

	languageCoursesSchedule.forEach( courseByLanguage => {
		courseByLanguage.schedules.forEach( courseBySchedule => {
			// console.log(`c ls ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ]`);
			courseBySchedule.courses.forEach( course => {
				console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.titleComponents.schedule} ][ ${course.titleComponents.dateStart} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ]`);
				// console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.title} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ]`);
				// console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ][ ${course.title} ]`);
				// console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ][ s: ${course.students.length} ] `);
			});
			console.log('-----------------------------------------------------------------------------------------------');
		});
		console.log('-----------------------------------------------------------------------------------------------');
	});
}

function getFlagData ( activeFlag ){
	if ( activeFlag !== null ) return `[ -${activeFlag ? ACTIVE_COURSE : CANCELLED_COURSE}- ]`;

	return UNDEFINED_STATUS_COURSE;
}

function classifyLanguageCoursesBySchedule ( languageCourses ){
	const courses = cloneArrayData( languageCourses );

	courses.forEach( languageCourse => {
		languageCourse.schedules = classifyCourseBySchedule( languageCourse.courses, languageCourse.language );
	});

	return courses;
}

function classifyCourseBySchedule ( courses, language ){
	return courses.reduce( ( acc, course ) => {
		const positionCourseSchedule = getPositionCourseSchedule( acc, course );
		if ( positionCourseSchedule.length ){
			addCourseOnSchedule( acc, positionCourseSchedule[ 0 ], course );
		} else {
			addSchedule( acc, course, language );
		}

		return acc;
	}, [] );
}

function getPositionCourseSchedule ( courses, courseLanguage ){
	const positions = [];
	for ( let position = 0; position < courses.length; position++ ){
		if ( courses[ position ].schedule === courseLanguage.schedule ){
			positions.push( position );
			break;
		}
	}

	return positions;
}

function addCourseOnSchedule ( acc, position, course ){
	acc[ position ].courses.push( course );
}

function addSchedule ( acc, course, language ){
	acc.push({
		language: language,
		schedule: course.schedule,
		courses: [ course ],
	});
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