var request = require('request');
var builder = require('botbuilder');

module.exports = class Templates {

    constructor(session) {
        this.session = session;
    }

    sendResponse(data) {
        this.session.send(data);
    }

    //Templates bellow
    promptList(data) {


        var arrayButtons = [];

        data.opciones.forEach(function (element) {
            arrayButtons.push(new builder.CardAction.imBack(this.session, element.entity, element.entity));
        }, this);

        const card = new builder.ThumbnailCard(this.session)
            .title(data.titulo)
            .text(data.descripción)
            .buttons(arrayButtons)


        const message = new builder.Message(this.session)
            .addAttachment(card);
        this.sendResponse(message);

        /*const card = new builder.ThumbnailCard(this.session)
            .title(title)
            .buttons([
                new builder.CardAction.imBack(session, 'Red', 'Red'),
                new builder.CardAction.imBack(session, 'Blue', 'Blue'),
                new builder.CardAction.imBack(session, 'Green', 'Green'),
            ]);
        const message = new builder.Message(this.session).addAttachment(card);
        this.sendResponse(message);*/
    }

}