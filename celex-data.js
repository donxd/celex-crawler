const cheerio = require( 'cheerio' );
const Iconv = require( 'iconv' ).Iconv;
const iconvLite = require('iconv-lite');
const moment = require( 'moment' );
const request = require( 'request' );
const Events = require( 'events' );

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

const TAG_LIST_COURSES = 'table.table';
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
const BAD_ENCODING_SYMBOLS = ['Ã', '', '', '‘'];
const REPEATED_SPACE = new RegExp( /[ ]+/, 'g');

const SINGLE_SPACE_FOR_STUDENT_NAME = ' ';

const CANCEL_COURSE_TEXT = 'CANCELADO';

const ACTIVE_COURSE = 'ACTIVE';
const CANCELLED_COURSE = 'CANCELLED';
const UNDEFINED_STATUS_COURSE = '';


// for ( let i = 1; i <= numberRequests; i++ ){
//     // new Persistence().showMessage();
//     makeRequest( i );
// }

class CelexData extends Events  {
    constructor() {
        super();
        // let fullProcess = this.getParamterFullProcess();
        // let numberRequests = this.getParameterNumberRequest();
        this.fullProcess = this.getParamterFullProcess();
        this.numberRequests = this.getParameterNumberRequest();
    }
    getParameterNumberRequest (){
        if ( this.isValidNumber( process.env.LIMIT_PAGE ) ){
            return Number.parseInt(process.env.LIMIT_PAGE);
        }

        return 1;
    }

    isValidNumber ( content ){
        return content && !Number.isNaN( Number.parseInt( content ) );
    }

    getParamterFullProcess (){
        if (process.env.FULL_PROCESS) return process.env.FULL_PROCESS === FLAG_PARAMETER_YES;

        return true;
    }

    makeRequest ( pagination ){
        let urlPagination = this.getUrlWithPagination( pagination );
        console.log( 'mensaje - realizando petición [ %s ] ', urlPagination );

        request( {url:urlPagination, encoding: 'binary'}, ( error, response, content ) => {
            this.processXMLResponse( content );
        });
    }

    getUrlWithPagination ( pagination ){
        const urlData = this.fullProcess ? URL_DATA_ALL : URL_DATA_LINKS;
        if ( pagination > 1 ){
            return urlData + URL_PAGINATION + pagination;
        }

        return urlData;
    }

    processXMLResponse ( content ){
        let $ = cheerio.load( content, { xmlMode: true, decodeEntities: false } );
        // let $ = cheerio.load( content, { xmlMode: true, decodeEntities: true } );
        // let $ = cheerio.load( content, { xmlMode: true } );
        // // console.log('content request -> ', content);

        if ( requestProcessed == 0 ){
            courseList = [];
        }

        let elements = $( TAG_ELEMENT_DATA );

        elements.each( (index, element) => {
            courseList.push( {doc: $, course: element} );
        });


        requestProcessed++;

        if ( requestProcessed === this.numberRequests ){
            this.printInformation();
        }
    }

    getTimePublicationItem ( element ){
        const textTime = this.getComponentItem( TAG_PUBLICATION_ITEM, element ).text();
        const timeFormat = moment( textTime, FORMAT_ACQUISITION ).format( FORMAT_SHOW );

        return timeFormat;
    }

    getTitleItem ( element ){
        return this.getComponentItem( TAG_TITLE_ITEM, element ).text();
    }

    getLinkItem ( element ){
        return this.getComponentItem( TAG_LINK_ITEM, element ).text();
    }

    getContentItem ( element ){
        return this.getComponentItem( TAG_CONTENT_ITEM, element );
    }

    getComponentItem ( component, element ){
        const $ = element.doc;
        const content = $( element.course ).find( component ).first();

        return content ? content : false;
    }

    printInformation (){
        // console.log( 'courseList.length -> ', courseList.length );
        if ( courseList.length > 0 ){

            // orderCourseList();
            const dataCourses = [];

            courseList.forEach( ( element, index ) => {
                const hasContentItem = !!this.getContentItem( element );

                const linkItem = this.getLinkItem( element );
                const publicationTimeItem = this.getTimePublicationItem( element );
                const titleItem = this.getTitleItem( element );

                // console.log( `[ ${publicationTimeItem} ] title [ ${titleItem} ] [ ${index} ] content ? ${hasContentItem} ` );

                if ( !!hasContentItem ){
                    this.classifyItem( dataCourses, element, linkItem, publicationTimeItem, titleItem );
                }
            });

            // showInformation( dataCourses );
            this.organizeInformation( dataCourses );
            this.showInformation( dataCourses );
        }

        requestProcessed = 0;
    }


    showInformation ( dataCourses ){
        dataCourses.forEach(course => {
            this.showCourseData( course );
        });
        this.emit('data-processed', dataCourses);
    }

    showCourseData ( course ){
        // // console.log('course -> ', JSON.stringify(course));
        // console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ][ s: ${course.students.length} ] `);
        course.students.forEach(student => {
            // console.log( `student -> ${student}`);
        });
    }

    classifyItem ( dataCourses, item, linkItem, publicationTimeItem, titleItem ){
        let contentItem = this.getContentItem( item ).text();

        // contentItem = iconvLite.decode( contentItem, 'utf-8' );
        // contentItem = iconvLite.decode( contentItem, 'ISO-8859-1' );
        // contentItem = toUTF8( contentItem );

        const $$ = cheerio.load( contentItem, { xmlMode: true, decodeEntities: false } );
        // const $$ = cheerio.load( contentItem, { xmlMode: true, decodeEntities: true } );
        // const $$ = cheerio.load( contentItem, { xmlMode: true } );
        const itemLists = $$( TAG_LIST_COURSES );

        // // console.log( `item[ courses ] # ${itemLists.length}`);

        const courses = [];

        itemLists.each( (index, element) => {
            const infoCourse = this.getInfoCourse( $$, element, linkItem, publicationTimeItem, titleItem );
            dataCourses.push( infoCourse );
        });
    }

    getInfoCourse ( $, course, linkItem, publicationTimeItem, titleItem ){
        const data = $( course ).find( TAG_DATA_TITLE );
        const studentsData = this.getStudentsData( $, course );

        return {
            language: this.getDataFromPosition( data, 1 ),
            semester: this.getDataFromPosition( data, 3 ),
            level: this.getDataFromPosition( data, 5 ),
            teacher: this.getDataFromPosition( data, 8 ),
            schedule: this.getDataFromPosition( data, 10 ),
            classroom: this.getDataFromPosition( data, 12 ),
            link : linkItem,
            publication : publicationTimeItem,
            title : this.cleanTitleItem( titleItem ),
            titleComponents : this.componentsTitle( titleItem ),
            titleOriginal : titleItem,
            students: studentsData,
        };
    }

    getDataFromPosition ( data, position ){
        return data.eq( position ).text() ? data.eq( position ).text().trim() : PROPERTY_EMPTY;
    }

    cleanTitleItem ( title ){
        const titleCleaningSymbols = { regex: /(&#8211;)|(-)/g, replace: TITLE_SEPARATOR };
        const titleCleanRemove = { regex: /(Listas de cursos de )|(Listas de curso de )/g, replace: '' };

        title = title.replace( titleCleaningSymbols.regex, titleCleaningSymbols.replace );
        title = title.replace( titleCleanRemove.regex, titleCleanRemove.replace );

        return title;
    }

    componentsTitle ( titleItem ){
        const cleanTitle = this.cleanTitleItem( titleItem );

        const components = cleanTitle.split( TITLE_SEPARATOR )
            .map( component => component.trim() );

        return {
            language: components[ 0 ],
            schedule: components[ 1 ],
            dateStart: components[ 2 ],
            code: components[ 3 ],
        };
    }

    getStudentsData ( $, course ){
        const students = [];

        $( course ).find( TAG_LIST_DATA ).each( ( index, student ) => {
            if ( index > 3 ){

                let dataStudent = $( student ).find( TAG_DATA_INFO ).eq( 1 ).text();
                dataStudent = this.getCleanDataStudent( dataStudent );

                students.push( dataStudent );
            }
        });

        if ( !students.length ) {
            $( course ).find( TAG_DATA_INFO ).each( ( index, student ) => {
                if ( index % 2 ){
                    let dataStudent = $( student ).text();
                    dataStudent = this.getCleanDataStudent( dataStudent );

                    students.push( dataStudent );
                }
            });
        }

        return students;
    }

    getCleanDataStudent ( dataStudent ){
        // // console.log(`=======>${dataStudent}<=======`);

        // dataStudent = this.toUTF8( dataStudent );
        let dataStudentCleaned = dataStudent.trim().replace( REPEATED_SPACE, SINGLE_SPACE_FOR_STUDENT_NAME );
        // dataStudentCleaned = iconvLite.decode( dataStudentCleaned, ENCODING_TEXT );

        // if ( dataStudentCleaned.indexOf( BAD_ENCODING_SYMBOL ) !== -1 ){
        // console.log('s i* : ', dataStudentCleaned);
        if (this.hasTextBadEncoding(dataStudentCleaned)){
            dataStudentCleaned = dataStudentCleaned.replace('ÃÂ', 'Ã', 'g'); //*?
            dataStudentCleaned = dataStudentCleaned.replace('Ã', 'Ã', 'g'); //*?
            console.log('s x  : ', dataStudentCleaned);
            dataStudentCleaned = iconvLite.decode( dataStudentCleaned, ENCODING_TEXT, {stripBOM: false} );
            // dataStudentCleaned = dataStudentCleaned.replace('Ã', 'Ã', 'g'); //*?
            dataStudentCleaned = dataStudentCleaned.replace('A', 'Ã', 'g'); //A
            dataStudentCleaned = dataStudentCleaned.replace('Á', 'Ã', 'g'); //A
            dataStudentCleaned = dataStudentCleaned.replace('Á', 'Ã', 'g'); //A *
            dataStudentCleaned = dataStudentCleaned.replace('I', 'Ã', 'g'); //I
            dataStudentCleaned = dataStudentCleaned.replace('Í', 'Ã', 'g'); //I
            dataStudentCleaned = dataStudentCleaned.replace('Í', 'Ã', 'g'); //I *
            dataStudentCleaned = dataStudentCleaned.replace('Ã', 'Ã', 'g'); //*?
            dataStudentCleaned = dataStudentCleaned.replace('ÍA', 'ÃA', 'g'); //*??
            dataStudentCleaned = dataStudentCleaned.replace('Ã‰', 'Ã', 'g'); //E
            dataStudentCleaned = dataStudentCleaned.replace('É', 'Ã', 'g'); //E
            dataStudentCleaned = dataStudentCleaned.replace('É', 'Ã', 'g'); //E *
            dataStudentCleaned = dataStudentCleaned.replace('Ã‘', 'Ã', 'g'); //N
            dataStudentCleaned = dataStudentCleaned.replace('Ñ', 'Ã', 'g'); //N
            dataStudentCleaned = dataStudentCleaned.replace('Ñ', 'Ã', 'g'); //N*
            dataStudentCleaned = dataStudentCleaned.replace('Ã“', 'Ã', 'g'); //O
            dataStudentCleaned = dataStudentCleaned.replace('Ó', 'Ã', 'g'); //O
            dataStudentCleaned = dataStudentCleaned.replace('Ó', 'Ã', 'g'); //O
            dataStudentCleaned = dataStudentCleaned.replace('Ãš', 'Ã', 'g'); //U
            dataStudentCleaned = dataStudentCleaned.replace('Ú', 'Ã', 'g'); //U
            dataStudentCleaned = dataStudentCleaned.replace('Ú', 'Ã', 'g'); //U*
            // dataStudentCleaned = dataStudentCleaned.replace('I', 'Í', 'g');
            // dataStudentCleaned = dataStudentCleaned.replace('Ã‰', 'É', 'g');

            if (this.hasTextBadEncoding(dataStudentCleaned)){
                // console.log('s i  : ', dataStudentCleaned);
                // console.log('s f2 : ', iconvLite.decode( dataStudentCleaned, ENCODING_TEXT, {stripBOM: false} )); // *********************
                dataStudentCleaned = iconvLite.decode( dataStudentCleaned, ENCODING_TEXT, {stripBOM: false} );
            }
        }

        return dataStudentCleaned;
    }

    hasTextBadEncoding (data){
        for (let x of BAD_ENCODING_SYMBOLS) {
            if ( data.indexOf( x ) !== -1 ) return true;
        }
        return false;
    }

    orderCourseList (){
        courseList.sort( ( a, b ) => {

            const titleA = this.getTitleItem(a);
            const titleB = this.getTitleItem(b);

            if ( titleA < titleB ){
                return -1;
            }

            if ( titleA > titleB ){
                return 1;
            }

            return 0;
        });
    }

    organizeInformation ( dataCourses ){
        // console.log('processData : ', JSON.stringify(dataCourses));
        this.sortOrderCourses( dataCourses );

        const courses = this.cloneArrayData( dataCourses );
        // const activeCourses = getActiveCourses( courses );
        // const cancelledCourses = getCancelledCourses( courses );

        // console.log( 'courses.length -> ', courses.length );
        // // console.log( 'activeCourses.length -> ', activeCourses.length );
        // // console.log( 'cancelledCourses.length -> ', cancelledCourses.length );

        const languageCourses = this.classifyCoursesByLanguage( courses );
        // const activeLanguageCourses = classifyCoursesByLanguage( activeCourses );
        // const cancelledLanguageCourses = classifyCoursesByLanguage( cancelledCourses );

        this.showDataCourseLanguage( languageCourses );
        // showDataCourseLanguage( activeLanguageCourses, true );
        // showDataCourseLanguage( cancelledLanguageCourses, false );

        const languageCoursesSchedule = this.classifyLanguageCoursesBySchedule( languageCourses );
        // const activeLanguageCoursesSchedule = classifyLanguageCoursesBySchedule( activeLanguageCourses );
        // const cancelledLanguageCoursesSchedule = classifyLanguageCoursesBySchedule( cancelledLanguageCourses );
        this.sortCoursesLanguageBySchedule( languageCoursesSchedule );
        this.showDataCourseLanguageSchedule( languageCoursesSchedule );
        // showDataCourseLanguageSchedule( activeLanguageCoursesSchedule, true );
        // showDataCourseLanguageSchedule( cancelledLanguageCoursesSchedule, false );
    }

    cloneArrayData ( array ){
        return JSON.parse( JSON.stringify( array ) );
    }

    getActiveCourses ( courses ){
        return courses.filter( course => course.teacher !== CANCEL_COURSE_TEXT );
    }

    getCancelledCourses ( courses ){
        return courses.filter( course => course.teacher === CANCEL_COURSE_TEXT );
    }

    classifyCoursesByLanguage ( courses ){
        return courses.reduce( ( acc, course ) => {
            const positionCourseLanguage = this.getPositionCourseLanguage( acc, course );
            if ( positionCourseLanguage.length ){
                this.addCourseOnLanguage( acc, positionCourseLanguage[ 0 ], course );
            } else {
                this.addLanguage( acc, course );
            }

            return acc;
        }, [] );
    }

    getPositionCourseLanguage ( courses, courseLanguage ){
        const positions = [];
        for ( let position = 0; position < courses.length; position++ ){
            if ( courses[ position ].language === courseLanguage.language ){
                positions.push( position );
                break;
            }
        }

        return positions;
    }

    addCourseOnLanguage ( acc, position, course ){
        acc[ position ].courses.push( course );
    }

    addLanguage ( acc, course ){
        acc.push({
            language: course.language,
            courses: [ course ],
        });
    }

    showDataCourseLanguage ( languageCourses, activeFlag = null ){
        const flag = this.getFlagData( activeFlag );

        languageCourses.forEach( courseByLanguage => {
            // console.log(`course l ${flag}[ ${courseByLanguage.language} ][ ${courseByLanguage.courses.length} ]`);
        });
    }

    sortCoursesLanguageBySchedule ( languageCoursesSchedule ){
        languageCoursesSchedule.forEach( courseByLanguage => {
            this.sortCoursesBySchedule( courseByLanguage );
        });
    }

    sortCoursesBySchedule ( courseByLanguage ){
        courseByLanguage.schedules.sort( ( a, b ) => {
            if ( a.schedule === b.schedule ) return 0;
            if ( a.schedule > b.schedule ) return 1;

            return -1;
        });
    }

    showDataCourseLanguageSchedule ( languageCoursesSchedule, activeFlag = null ){
        const flag = this.getFlagData( activeFlag );

        languageCoursesSchedule.forEach( courseByLanguage => {
            courseByLanguage.schedules.forEach( courseBySchedule => {
                // // console.log(`c ls ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ]`);
                courseBySchedule.courses.forEach( course => {
                    // console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.titleComponents.schedule} ][ ${course.titleComponents.dateStart} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ]`);
                    // // console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.title} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ]`);
                    // // console.log(`c lsc ${flag}[ ${courseBySchedule.language} ][ ${courseBySchedule.schedule} ][ ${courseBySchedule.courses.length} ][ ${course.level} ][ ${course.publication} ][ s: ${course.students.length} ][ ${course.title} ]`);
                    // // console.log(`course [ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ][ ${course.semester} ][ ${course.teacher} ][ ${course.classroom} ][ s: ${course.students.length} ] `);
                });
                // console.log('-----------------------------------------------------------------------------------------------');
            });
            // console.log('-----------------------------------------------------------------------------------------------');
        });
    }

    getFlagData ( activeFlag ){
        if ( activeFlag !== null ) return `[ -${activeFlag ? ACTIVE_COURSE : CANCELLED_COURSE}- ]`;

        return UNDEFINED_STATUS_COURSE;
    }

    classifyLanguageCoursesBySchedule ( languageCourses ){
        const courses = this.cloneArrayData( languageCourses );

        courses.forEach( languageCourse => {
            languageCourse.schedules = this.classifyCourseBySchedule( languageCourse.courses, languageCourse.language );
        });

        return courses;
    }

    classifyCourseBySchedule ( courses, language ){
        return courses.reduce( ( acc, course ) => {
            const positionCourseSchedule = this.getPositionCourseSchedule( acc, course );
            if ( positionCourseSchedule.length ){
                this.addCourseOnSchedule( acc, positionCourseSchedule[ 0 ], course );
            } else {
                this.addSchedule( acc, course, language );
            }

            return acc;
        }, [] );
    }

    getPositionCourseSchedule ( courses, courseLanguage ){
        const positions = [];
        for ( let position = 0; position < courses.length; position++ ){
            if ( courses[ position ].schedule === courseLanguage.schedule ){
                positions.push( position );
                break;
            }
        }

        return positions;
    }

    addCourseOnSchedule ( acc, position, course ){
        acc[ position ].courses.push( course );
    }

    addSchedule ( acc, course, language ){
        acc.push({
            language: language,
            schedule: course.schedule,
            courses: [ course ],
        });
    }

    sortOrderCourses ( dataCourses ){
        dataCourses.sort( ( a, b ) => {
            const textA = this.courseToStringOrder( a );
            const textB = this.courseToStringOrder( b );

            if ( textA === textB ) return 0;
            if ( textA > textB ) return 1;

            return -1;
        });
    }

    courseToStringOrder ( course ){
        return `c[ ${course.language} ][ ${course.level} ][ ${course.schedule} ][ ${course.publication} ]`;
    }

    toUTF8 ( body ){
      // convert from iso-8859-1 to utf-8
      let ic = new iconv.Iconv( 'iso-8859-1', 'utf-8' );
      let buf = ic.convert( body );

      return buf.toString('utf-8');
    }
}

module.exports = CelexData;