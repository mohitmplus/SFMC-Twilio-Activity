const connection = new Postmonger.Session();

let payload = {};

let eventDefinitionKey = "";


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    connection.trigger("ready");

    connection.trigger(
        "requestInteraction"
    );
});


/*
|--------------------------------------------------------------------------
| GET JOURNEY BLUEPRINT
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedInteraction",
    function (interaction) {

        console.log(
            "Journey Blueprint received:",
            interaction
        );


        if (
            interaction &&
            interaction.triggers &&
            interaction.triggers.length > 0
        ) {

            const trigger =
                interaction.triggers[0];


            if (
                trigger.metaData &&
                trigger.metaData.eventDefinitionKey
            ) {

                eventDefinitionKey =
                    trigger
                        .metaData
                        .eventDefinitionKey;


                console.log(
                    "Event Definition Key:",
                    eventDefinitionKey
                );
            }
        }
    }
);


/*
|--------------------------------------------------------------------------
| INITIALIZE EXISTING ACTIVITY
|--------------------------------------------------------------------------
*/

connection.on(
    "initActivity",
    function (data) {

        console.log(
            "initActivity:",
            data
        );


        if (data) {
            payload = data;
        }


        try {

            const inArguments =
                payload
                    ?.arguments
                    ?.execute
                    ?.inArguments;


            if (
                Array.isArray(inArguments)
            ) {

                const messageArg =
                    inArguments.find(
                        item =>
                            item &&
                            Object.prototype.hasOwnProperty
                                .call(
                                    item,
                                    "message"
                                )
                    );


                if (
                    messageArg &&
                    messageArg.message !== undefined
                ) {

                    $("#smsMessage")
                        .val(
                            messageArg.message
                        )
                        .trigger("input");
                }
            }

        } catch (error) {

            console.error(
                "Unable to load existing activity:",
                error
            );
        }
    }
);


/*
|--------------------------------------------------------------------------
| NEXT / DONE
|--------------------------------------------------------------------------
*/

connection.on(
    "clickedNext",
    function () {

        const userMessage =
            $("#smsMessage")
                .val()
                .trim();


        if (!userMessage) {

            alert(
                "Please enter an SMS message."
            );

            return;
        }


        /*
         * Phone binding
         *
         * Existing dynamic binding is retained.
         */

        let dynamicPhoneBinding =
            "{{Context.DefaultMobileNumber}}";


        /*
         * If an Event Definition Key exists,
         * use the Journey Event phone field.
         */

        if (
            eventDefinitionKey
        ) {

            dynamicPhoneBinding =
                "{{Event." +
                eventDefinitionKey +
                ".Phone}}";
        }


        /*
         * ContactKey
         *
         * Journey Builder resolves this at runtime.
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        payload.arguments =
            payload.arguments || {};


        payload.arguments.execute =
            payload.arguments.execute || {};


        payload.arguments.execute.inArguments = [

            {
                contactKey:
                    contactKeyBinding
            },

            {
                phoneNumber:
                    dynamicPhoneBinding
            },

            {
                message:
                    userMessage
            }
        ];


        payload.metaData =
            payload.metaData || {};


        payload.metaData.isConfigured =
            true;


        console.log(
            "Activity payload:",
            payload
        );


        connection.trigger(
            "updateActivity",
            payload
        );
    }
);