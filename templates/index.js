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
    responsePromptList(data) {

        var arrayButtons = [];

        data.opciones.forEach(function (element) {
            arrayButtons.push(new builder.CardAction.imBack(this.session, element.entity, element.titulo));
        }, this);

        const card = new builder.ThumbnailCard(this.session)
            .title(data.titulo)
            //.text(data.descripción)
            .buttons(arrayButtons)

        const message = new builder.Message(this.session)
            .addAttachment(card);
        this.sendResponse(message);
    }

    responseTexto(data){
        this.sendResponse(data);
    }

}