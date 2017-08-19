// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var responemodel = require('./response');
var restify = require('restify');
var Store = require('./store');
var spellService = require('./spell-service');

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


var bot = new builder.UniversalBot(connector, function (session) {
    session.send('Ups \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});

// You can provide your own model by specifing the 'LUIS_MODEL_URL' environment variable
// This Url can be obtained by uploading or creating your model from the LUIS portal: https://www.luis.ai/
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.dialog('SearchHotels', [
    function (session, args, next) {
        session.send('Welcome to the Hotels finder! We are analyzing your message: \'%s\'', session.message.text);

        // try extracting entities
        var cityEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.geography.city');
        var airportEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'AirportCode');
        if (cityEntity) {
            // city entity detected, continue to next step
            session.dialogData.searchType = 'city';
            next({ response: cityEntity.entity });
        } else if (airportEntity) {
            // airport entity detected, continue to next step
            session.dialogData.searchType = 'airport';
            next({ response: airportEntity.entity });
        } else {
            // no entities detected, ask user for a destination
            builder.Prompts.text(session, 'Please enter your destination');
        }
    },
    function (session, results) {
        var destination = results.response;

        var message = 'Looking for hotels';
        if (session.dialogData.searchType === 'airport') {
            message += ' near %s airport...';
        } else {
            message += ' in %s...';
        }

        session.send(message, destination);

        // Async search
        Store
            .searchHotels(destination)
            .then(function (hotels) {
                // args
                session.send('I found %d hotels:', hotels.length);

                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(hotels.map(hotelAsAttachment));

                session.send(message);

                // End
                session.endDialog();
            });
    }
]).triggerAction({
    matches: 'SearchHotels',
    onInterrupted: function (session) {
        session.send('Please provide a destination');
    }
});

bot.dialog('ShowHotelsReviews', function (session, args) {
    // retrieve hotel name from matched entities
    var hotelEntity = builder.EntityRecognizer.findEntity(args.intent.entities, 'Hotel');
    if (hotelEntity) {
        session.send('Looking for reviews of \'%s\'...', hotelEntity.entity);
        Store.searchHotelReviews(hotelEntity.entity)
            .then(function (reviews) {
                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(reviews.map(reviewAsAttachment));
                session.endDialog(message);
            });
    }
}).triggerAction({
    matches: 'ShowHotelsReviews'
});

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
                
                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(responemodel.ayuda.map(accionesBtnsAttachment));
                    session.send(message);
                    
                break;
            case 'Horarios':
                session.send('Nuestros horarios son de 7:00 am a 8:00 pm, por favor no deje de visitarnos.')
                break;

            default:
                var message = new builder.Message()
                    .attachmentLayout(builder.AttachmentLayout.carousel)
                    .attachments(responemodel.ayuda.map(ayudaAsAttachment));
                session.send(message);
                break;
        }
    } else {
        session.send('Podemos realizar las siguiente acciones:')
        var message = new builder.Message()
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(responemodel.ayuda.map(ayudaAsAttachment));
        session.send(message);
    }
}).triggerAction({
    matches: 'Información'
});

bot.dialog('Saludos', function (session, args) {
    session.endDialog(responemodel.saludo);
}).triggerAction({
    matches: 'Saludos'
});

bot.dialog('Despedida', function (session, args) {
    session.endDialog(responemodel.despedida);
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

// Helpers
function hotelAsAttachment(hotel) {
    return new builder.HeroCard()
        .title(hotel.name)
        .subtitle('%d stars. %d reviews. From $%d per night.', hotel.rating, hotel.numberOfReviews, hotel.priceStarting)
        .images([new builder.CardImage().url(hotel.image)])
        .buttons([
            new builder.CardAction()
                .title('More details')
                .type('openUrl')
                .value('https://www.bing.com/search?q=hotels+in+' + encodeURIComponent(hotel.location))
        ]);
}

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
}

function accionesBtnsAttachment(ayuda) {
    return new builder.CardAction()
            .title('Elegir')
            .type('postBack')
            .value(ayuda.postBack)
}

function reviewAsAttachment(review) {
    return new builder.ThumbnailCard()
        .title(review.title)
        .text(review.text)
        .images([new builder.CardImage().url(review.image)]);
}