const CelexData = require('./celex-data');
const data = new CelexData();

let numberRequests = data.getParameterNumberRequest();

for ( let i = 1; i <= numberRequests; i++ ){
	// new Persistence().showMessage();
	data.makeRequest( i );
}

data.on('data-processed', () => {
	console.log('data processed - OK');
});