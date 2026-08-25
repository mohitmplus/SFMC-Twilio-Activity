const connection = new Postmonger.Session();

let payload = {};
let eventDefinitionKey = "";
let eventSchema = [];

let messageTextarea;


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    messageTextarea = $("#smsMessage");

    /*
     * Tell Journey Builder that the custom activity is ready.
     */
    connection.trigger("ready");

    /*
     * Request the current Journey.
     */
    connection.trigger("requestInteraction");

    /*
     * Request the Entry Event schema.
     *
     * This is the important part.
     *
     * Journey Builder will respond with:
     *
     * requestedSchema
     */
    connection.trigger("requestSchema");

    console.log(
        "Requested Journey Entry Event schema"
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
| GET ENTRY EVENT SCHEMA
|--------------------------------------------------------------------------
|
| Journey Builder returns the fields available from the
| Entry Event / Data Extension.
|
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedSchema",
    function (schema) {

        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY ENTRY EVENT SCHEMA RECEIVED"
        );

        console.log(
            JSON.stringify(
                schema,
                null,
                2
            )
        );

        console.log(
            "================================================"
        );


        try {

            /*
             * Different Journey Builder versions can return
             * the schema slightly differently.
             */

            let fields = [];


            if (
                schema &&
                Array.isArray(
                    schema.schema
                )
            ) {

                fields =
                    schema.schema;

            }

            else if (
                schema &&
                schema.schema &&
                Array.isArray(
                    schema.schema.schema
                )
            ) {

                fields =
                    schema.schema.schema;

            }


            eventSchema =
                fields || [];


            console.log(
                "Available Entry Event Fields:",
                eventSchema
            );


            populateVariableFields();


        }

        catch (error) {

            console.error(
                "Unable to process Journey schema:",
                error
            );

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

            payload =
                data;
        }


        try {

            const inArguments =
                payload
                    ?.arguments
                    ?.execute
                    ?.inArguments;


            if (
                Array.isArray(
                    inArguments
                )
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


                    console.log(
                        "Existing SMS message loaded:",
                        messageArg.message
                    );
                }
            }

        }

        catch (error) {

            console.error(
                "Unable to load existing activity:",
                error
            );
        }
    }
);


/*
|--------------------------------------------------------------------------
| POPULATE VARIABLE DROPDOWN
|--------------------------------------------------------------------------
*/

function populateVariableFields() {

    const container =
        $("#variableContainer");


    if (
        !container.length
    ) {

        console.error(
            "variableContainer not found in HTML"
        );

        return;
    }


    /*
     * Remove old rows.
     *
     * We keep the Add Variable button.
     */

    container
        .find(".variable-row")
        .remove();


    console.log(
        "Building variable picker..."
    );


    if (
        !eventSchema ||
        eventSchema.length === 0
    ) {

        console.warn(
            "No Entry Event fields received from Journey Builder"
        );


        addVariableRow(
            []
        );

        return;
    }


    /*
     * Build clean field list.
     */

    const fields =
        eventSchema
            .map(
                function (field) {

                    /*
                     * Journey Builder normally provides:
                     *
                     * key:
                     * Event.EventKey.FieldName
                     *
                     * name:
                     * FieldName
                     */

                    const key =
                        field.key ||
                        "";


                    const name =
                        field.name ||
                        extractFieldName(
                            key
                        );


                    if (!key) {

                        return null;
                    }


                    return {

                        key,
                        name

                    };

                }
            )
            .filter(
                Boolean
            );


    console.log(
        "Variable picker fields:",
        fields
    );


    addVariableRow(
        fields
    );
}


/*
|--------------------------------------------------------------------------
| ADD VARIABLE ROW
|--------------------------------------------------------------------------
*/

function addVariableRow(
    fields
) {

    const container =
        $("#variableContainer");


    const row =
        $(`
            <div class="variable-row">

                <select class="variable-field">

                    <option value="">
                        Select field
                    </option>

                </select>

                <button
                    type="button"
                    class="insert-variable"
                >
                    Insert
                </button>

                <button
                    type="button"
                    class="remove-variable"
                >
                    Remove
                </button>

            </div>
        `);


    const select =
        row.find(
            ".variable-field"
        );


    /*
     * Add fields to dropdown.
     */

    fields.forEach(
        function (field) {

            select.append(

                $("<option>", {

                    value:
                        field.key,

                    text:
                        field.name

                })

            );

        }
    );


    container.append(
        row
    );


    /*
     * Insert button.
     */

    row.find(
        ".insert-variable"
    )
        .on(
            "click",
            function () {

                const fieldKey =
                    select.val();


                if (!fieldKey) {

                    alert(
                        "Please select a field."
                    );

                    return;
                }


                insertVariableIntoMessage(
                    fieldKey
                );
            }
        );


    /*
     * Remove button.
     */

    row.find(
        ".remove-variable"
    )
        .on(
            "click",
            function () {

                row.remove();

            }
        );
}


/*
|--------------------------------------------------------------------------
| + ADD VARIABLE BUTTON
|--------------------------------------------------------------------------
*/

$(document).on(
    "click",
    "#addVariable",
    function () {

        console.log(
            "Add Variable clicked"
        );


        /*
         * Rebuild fields from the schema.
         */

        const fields =
            eventSchema
                .map(
                    function (field) {

                        const key =
                            field.key ||
                            "";

                        const name =
                            field.name ||
                            extractFieldName(
                                key
                            );


                        if (!key) {

                            return null;
                        }


                        return {

                            key,
                            name

                        };

                    }
                )
                .filter(
                    Boolean
                );


        addVariableRow(
            fields
        );
    }
);


/*
|--------------------------------------------------------------------------
| INSERT VARIABLE INTO SMS MESSAGE
|--------------------------------------------------------------------------
*/

function insertVariableIntoMessage(
    fieldKey
) {

    const textarea =
        document.getElementById(
            "smsMessage"
        );


    if (!textarea) {

        console.error(
            "smsMessage textarea not found"
        );

        return;
    }


    /*
     * The fieldKey returned by Journey Builder
     * is already in the correct format:
     *
     * Event.DEAudience-xxx.FirstName
     *
     * We only need to wrap it.
     */

    const token =
        "{{" +
        fieldKey +
        "}}";


    const start =
        textarea.selectionStart;


    const end =
        textarea.selectionEnd;


    const currentValue =
        textarea.value;


    /*
     * Insert at cursor position.
     */

    textarea.value =
        currentValue.substring(
            0,
            start
        ) +

        token +

        currentValue.substring(
            end
        );


    /*
     * Put cursor immediately after
     * inserted variable.
     */

    const newPosition =
        start +
        token.length;


    textarea.focus();


    textarea.setSelectionRange(
        newPosition,
        newPosition
    );


    console.log(
        "Inserted variable:",
        token
    );
}


/*
|--------------------------------------------------------------------------
| EXTRACT FIELD NAME
|--------------------------------------------------------------------------
*/

function extractFieldName(
    key
) {

    if (!key) {

        return "";
    }


    const parts =
        key.split(".");


    return (
        parts[
            parts.length - 1
        ] ||
        key
    );
}


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
         */

        let dynamicPhoneBinding =
            "{{Context.DefaultMobileNumber}}";


        /*
         * Event phone field
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
         * Contact Key
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        /*
         * Make sure arguments exist.
         */

        payload.arguments =
            payload.arguments ||
            {};


        payload.arguments.execute =
            payload.arguments.execute ||
            {};


        /*
         * Save the message exactly as entered.
         *
         * Example:
         *
         * Hello {{Event.DEAudience-xxx.FirstName}}
         *
         * Journey Builder will resolve the token
         * when the journey executes.
         */

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


        /*
         * Mark activity configured.
         */

        payload.metaData =
            payload.metaData ||
            {};


        payload.metaData.isConfigured =
            true;


        console.log(
            "================================================"
        );

        console.log(
            "FINAL ACTIVITY PAYLOAD"
        );

        console.log(
            JSON.stringify(
                payload,
                null,
                2
            )
        );

        console.log(
            "================================================"
        );


        /*
         * Send configuration back to Journey Builder.
         */

        connection.trigger(
            "updateActivity",
            payload
        );
    }
);
