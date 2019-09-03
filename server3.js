const CelexData = require('./celex-data');
const Persistence = require('./persistence');

const data = new CelexData();
const persistence = new Persistence();

let numberRequests = data.getParameterNumberRequest();

for ( let i = 1; i <= numberRequests; i++ ){
	data.makeRequest( i );
}

data.on('data-processed', dataCourses => {
	persistence.processData( dataCourses );
});