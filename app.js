// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');
var locationDialog = require('botbuilder-location');
var responsemodel = require('./response');
var cnf = require('./config/configuration');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request

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
connection.on('connect', function(err) {
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

server.post('/api/messages', connector.listen());

server.get('/', (req, res) => {
    res.json( { 'Name': cnf.appName } );
});

var bot = new builder.UniversalBot(connector, function (session) {
    session.send(responsemodel.ErrorMessages.Ups.message);
});

bot.library(locationDialog.createLibrary(process.env.BING_MAPS_KEY));

var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.use({
    botbuilder: function (session, next) {
    var convesation = {
        idUsuario: 1,
        conversacion: session.message.text,
        animo: 50.1
    };
    saveDialog(convesation, () => {

    });
    console.log(session.message.text, next);
    },
    send: function (event, next) {
        myMiddleware.logOutgoingMessage(event, next);
    }
})

bot.dialog('Información', function (session, args) {
    if (args.intent.entities.length > 0) {
        switch (args.intent.entities[0].type) {
            case 'Condiciones':
                switch (args.intent.entities[0].entity) {
                    case 'desembolsar':
                        session.send('Tardamos 7 días en desembolsar el crédito')
                        break;
                    case 'aprobar':
                        session.send('Tardamos 2 días en aprobar su crédito')
                        break;
                    case 'plazo' && 'plazos' && 'período':
                        session.send('Ofrecemos plazos desde 24 meses hasta 60 meses')
                        break;
                    default:
                        session.send('NA')
                        break;
                }
                break;
            case 'Sucursales':
                //session.send('Seleccione su ubicación')

                var options = {
            prompt: "Where should I ship your order?",
            useNativeControl: true,
            reverseGeocode: true,
            skipFavorites: false,
            skipConfirmationAsk: true,
            requiredFields:
                locationDialog.LocationRequiredFields.streetAddress |
                locationDialog.LocationRequiredFields.locality |
                locationDialog.LocationRequiredFields.region |
                locationDialog.LocationRequiredFields.postalCode |
                locationDialog.LocationRequiredFields.country
        };

        locationDialog.getLocation(session, options);
                    
                break;
            case 'Horarios':
                session.send('Nuestros horarios son de 7:00 am a 8:00 pm, por favor no deje de visitarnos.')
                break;

            default:
                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(responsemodel.ayuda.map(ayudaAsAttachment));
                session.send(message);
                break;
        }
    } else {
        session.send('Podemos realizar las siguiente acciones:')
        var message = new builder.Message()
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(responsemodel.ayuda.map(ayudaAsAttachment));
        session.send(message);
    }
}).triggerAction({
    matches: 'Información'
});

/*bot.dialog('Saludos', function (session, args) {
    var message =  new builder.Prompts.choice(session,
            'What do yo want to do today?',
            ["Uno", "Otro"],
            { listStyle: builder.ListStyle.button });
        
    session.send(message);
}).triggerAction({
    matches: 'Saludos'
});*/

bot.dialog('Saludos', [
    function (session) {
        var options = {
            prompt: "Where should I ship your order?",
            useNativeControl: true,
            reverseGeocode: true,
            skipFavorites: false,
            skipConfirmationAsk: true,
            requiredFields:
                locationDialog.LocationRequiredFields.streetAddress |
                locationDialog.LocationRequiredFields.locality |
                locationDialog.LocationRequiredFields.region |
                locationDialog.LocationRequiredFields.postalCode |
                locationDialog.LocationRequiredFields.country
        };

        locationDialog.getLocation(session, options);
    },
    function (session, results) {
        if (results.response) {
            var place = results.response;
            var formattedAddress = 
            session.send("Thanks, I will ship to " + this.getFormattedAddressFromPlace(place, ", "));
        }
    }
]).triggerAction({
    matches: 'Saludos'
});

bot.dialog('Despedida', function (session, args) {
    session.endDialog(responsemodel.despedida);
}).triggerAction({
    matches: 'Despedida'
});

// Spell Check
if (process.env.IS_SPELL_CORRECTION_ENABLED === 'true') {
    bot.use({
        botbuilder: function (session, next) {
            spellService
                .getCorrectedText(session.message.text)
                .then(function (text) {
                    session.message.text = text;
                    next();
                })
                .catch(function (error) {
                    console.error(error);
                    next();
                });
        }
    });
}

function getFormattedAddressFromPlace(place, separator) {
    var addressParts = [place.streetAddress, place.locality, place.region, place.postalCode, place.country];
    return addressParts.filter(i => i).join(separator);
};

    // You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
    // This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/
    
function ayudaAsAttachment(ayuda) {
    return new builder.HeroCard()
        .title(ayuda.titulo)
        .subtitle(ayuda.subtitle)
        .buttons([
            new builder.CardAction()
                .title('Elegir')
                .type('postBack')
                .value(ayuda.postBack)
        ]);
};

function accionesBtnsAttachment(ayuda) {
    return new builder.CardAction()
            .title('Elegir')
            .type('postBack')
            .value(ayuda.postBack)
};

function reviewAsAttachment(review) {
    return new builder.ThumbnailCard()
        .title(review.title)
        .text(review.text)
        .images([new builder.CardImage().url(review.image)]);
};

function saveDialog(dialogo, callback) {
    request = new Request("INSERT INTO chatbotlog (usuario_id, conversacion, estado_animo) VALUES (@usuario_id, @conversacion, @estado_animo)", function(err) {  
        if (err) {  
        console.log(err);}  
    });  
    var TYPES = require('tedious').TYPES;
    request.addParameter('usuario_id', TYPES.Int, dialogo.idUsuario);  
    request.addParameter('conversacion', TYPES.NVarChar, dialogo.conversacion);
    request.addParameter('estado_animo', TYPES.Float, dialogo.animo);
        
    connection.execSql(request);  
    callback();
} 