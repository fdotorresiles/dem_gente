// This loads the environment variables from the .env file
require('dotenv-extended').load();
var botActions = require('./templates');

var builder = require('botbuilder');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');
var locationDialog = require('botbuilder-location');
var responsemodel = require('./response');
var cnf = require('./config/configuration');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request
var TYPES = require('tedious').TYPES;

var config = {
    userName: cnf.sqlserver.userName,
    password: cnf.sqlserver.password,
    server: cnf.sqlserver.server,
    options: {
        database: cnf.sqlserver.options.database,
        encrypt: cnf.sqlserver.options.encrypt,
    }
};

var connection = new Connection(config);

// Attempt to connect and execute queries if connection goes through
connection.on('connect', function (err) {
    if (err) {
        console.log(err)
    }
});


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

server.get('/', (req, res) => {
    res.json({ 'Name': cnf.appName });
});

bot.use({
    botbuilder: function (session, next) {
        recognizer.recognize(session, function (err, result) {

            // If the intent returned isn't the 'None' intent return it
            // as the prompts response.
            //result.intent == 'None'
            if (result && result.intent !== 'None') {

                var sql = "Select * from dbo.luismodelrespuestas where intent = '" + result.intent + "'";
                session.send(result.intent);
                if (result.entities.length > 0) {
                    sql += " and entity = '" + result.entities[0].type + "'"
                    session.send(result.entities[0].type);
                } else {
                    sql += " and entity is null";
                }

                var request = new Request(sql, function (err, rowCount, rows) {
                    session.send(err);
                });

                //request.addParameter('itent', TYPES.VarChar, result.intent);

                request.on('row', function (columns) {
                    var messengerActions = new botActions(session);

                    switch (columns[4].value) {
                        case 'Prompt':
                            messengerActions.responsePromptList(JSON.parse(columns[5].value));
                            break;
                        case 'textual':
                            messengerActions.responseTexto(columns[3].value);
                            break;
                        default:
                            break;
                    }

                    //Tipo
                    //columns[4].value
                    //Titulo
                    //columns[3].value
                    //Opciones
                    //columns[5].value
                    //console.log()

                    //session.send(columns[0].value);
                });

                connection.execSql(request);
            } else {
                callback(null, 0.0);
            }
        });

    },
    send: function (event, next) {
        myMiddleware.logOutgoingMessage(event, next);
    }
})
//Que documentos tengo que presentar
//Cuales son los intereses