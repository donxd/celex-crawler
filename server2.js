var schedule = require( 'node-schedule' );
var request = require( 'request' );
var cheerio = require( 'cheerio' );

var numberRequests = 3;
var courseList = [];
var requestProcessed = 0;

makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabd');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabem');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabenv');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabfm');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabfv');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabim');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/sabn');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/seme');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/semf');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/semfce');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/semn');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/combo');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/dome');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/domf');
makeRequestPage('https://sites.google.com/site/listascelexupiicsa/home/itasabv');

makeRequestPage = url => {
	console.log( 'mensaje - realizando petición [ %s ] ', url );
	request(url, (err, response, body) => err ? showError(err) : processResponse(body));
};

processResponse = body => {
	// console.log('body -> ', JSON.stringify(body));
	const $ = cheerio.load( body );
	const title = $( 'span#sites-page-title' ).text();
	const groups = $( '#sites-canvas-main table table');
	const infoCourse = processCourseGroups( $, groups );

	let totalStudents = 0;

	infoCourse.forEach( group => {
		totalStudents += group.students.length;
	});

	console.log( `mensaje - procesando : ${title} [${totalStudents}]` );
};

// function showError (err){
showError = err => {
	console.error(err);
};

processCourseGroups = ( $, groups ) => {
	return groups.map( ( i, group ) => processGroup( $, $( group ) ) ).get();
};

processGroup = ( $, group ) => {
	// console.log( 'group -> ', group.html() );
	const infoGroup = getInfoGroup( $, group );
	// console.log(`language[${infoGroup.language}] semester[${infoGroup.semester}]`)
	// console.log( 'infoGroup -> ', JSON.stringify( infoGroup ) );
	// console.log( JSON.stringify( infoGroup ) );
	// console.log(`grupo - [${infoGroup.language}] [${infoGroup.semester}] [${infoGroup.level}] [${infoGroup.teacher}] [${infoGroup.schedule}] [${infoGroup.classroom}] [${infoGroup.students}]`);

	return infoGroup;
};

getInfoGroup = ( $, group ) => {
	// const tableHead = $( group ).find( 'thead th' );
	const tableHead = group.find( 'thead th' );

	// tableHead.each( element => console.log( 'value -> ', element.text() ) );
	// tableHead.each( ( i, element ) => console.log( 'element -> ', $( element ).html() ) );
	// const dataHead = Array.from( tableHead );
	// const studentsData = group.find( 'tbody tr' ).map( ( i, row ) => ({ name : $( row ).find( 'td:eq(1)' ).text() }) );
	// const studentsData = group.find( 'tbody tr' ).map( ( i, row ) => ({ name : $( row ).find( 'td' ).eq( 1 ).text() }) );
	// const studentsData = group.find( 'tbody tr' ).map( ( i, row ) => ({ name : $( row ).find( 'td' ).get( 1 ).html() }) );
	// group.find( 'tbody tr' ).each( ( i, row ) => console.log( $( row ).find( 'td' ).eq(1).text() ) );
	const studentsData = group.find( 'tbody tr' ).map( ( i, row ) => ( { name  : $( row ).find( 'td' ).eq( 1 ).text() } ) ).get();
	// const studentsData = group.find( 'tbody tr' )
	// 	.map( ( i, row ) => { 
	// 		console.log( ' - ', $( row ).find( 'td' ).eq(1).text() );
	// 		// return { name  : $( row ).find( 'td' ).eq(1).text() };
	// 		return { name  : 'dsasda' };
	// 	}).get();
	// group.find( 'tbody tr' ).each( ( i, row ) => console.log( $( row ).find( 'td' ).html() ) );
	// const studentsData = group.find( 'tbody tr' ).each( ( i, student ) => console.log('student - ', $( student ).text() ) );

	return {
		language: tableHead.eq(1).text(),
		semester: tableHead.eq(3).text(),
		level: tableHead.eq(5).text(),
		teacher: tableHead.eq(8).text(),
		schedule: tableHead.eq(10).text(),
		classroom: tableHead.eq(12).text(),
		students: studentsData,
	};
};