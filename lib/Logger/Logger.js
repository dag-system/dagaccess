var winston = require('winston');
var fs = require( 'fs' );
//var winstond = require('winstond');

// Creation de la connection MySQL
module.exports = {
    create: function() {
//		var server = winstond.http.createServer({
//			services: ['collect', 'query', 'stream'],
//			port: 9003
//		});
		var logDir = 'log'; // directory path you want to set
		if ( !fs.existsSync( logDir ) ) {
			// Create the directory if it does not exist
			fs.mkdirSync( logDir );
		}

		var logger = winston.createLogger({
			transports: [
			new (winston.transports.Console)({handleExceptions: true,format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.align(),
          winston.format.printf((info) => {
            const {
              timestamp, level, message, ...args
            } = info;

            const ts = timestamp.slice(0, 23).replace('T', ' ');
            return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
          }),
        ),level: 'silly'}),
			//new (winston.transports.Http)({host: '127.0.0.1',port: 9003,level: 'silly'}),
			new (winston.transports.File)({handleExceptions: true,format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.align(),
          winston.format.printf((info) => {
            const {
              timestamp, level, message, ...args
            } = info;

            const ts = timestamp.slice(0, 23).replace('T', ' ');
            return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
          }),
        ),filename: logDir + '/GlobalLOG.log',level: 'silly',maxsize: 52428800,maxFiles:4})
			],
			exitOnError: false
		});
		return logger;
	}
}
