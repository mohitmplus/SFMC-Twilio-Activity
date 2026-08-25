const connection = new Postmonger.Session();

let payload = {};

let eventDefinitionKey = "";

let eventFields = [];

let variables = [];


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    connection.trigger("ready");

    connection.trigger("requestInteraction");

    /*
     * Ask Journey Builder for the Event Definition schema.
     */
    connection.trigger("requestSchema");
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
| GET EVENT DEFINITION SCHEMA
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedSchema",
    function (schema) {

        console.log(
            "Journey Event Schema received:",
            schema
        );


        try {

            eventFields = [];


            /*
             * Journey Builder schema normally contains
             * the event fields under schema.schema.
             */

            if (
                schema &&
                schema.schema &&
                schema.schema.properties
            ) {

                const properties =
                    schema.schema.properties;


                Object.keys(
                    properties
                ).forEach(
                    function (fieldName) {

                        const field =
                            properties[fieldName];


                        eventFields.push({

                            name:
                                fieldName,

                            label:
                                field.title ||
                                fieldName,

                            type:
                                field.type ||
                                "string"

                        });

                    }
                );
            }


            /*
             * Some Journey Builder responses
             * can contain fields differently.
             */

            if (
                eventFields.length === 0 &&
                schema &&
                schema.properties
            ) {

                Object.keys(
                    schema.properties
                ).forEach(
                    function (fieldName) {

                        const field =
                            schema.properties[fieldName];


                        eventFields.push({

                            name:
                                fieldName,

                            label:
                                field.title ||
                                fieldName,

                            type:
                                field.type ||
                                "string"

                        });

                    }
                );
            }


            console.log(
                "Available Event DE fields:",
                eventFields
            );


            renderVariableFields();

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


                /*
                 * --------------------------------------------------------
                 * MESSAGE TEMPLATE
                 * --------------------------------------------------------
                 */

                const templateArg =
                    inArguments.find(
                        item =>
                            item &&
                            Object.prototype.hasOwnProperty
                                .call(
                                    item,
                                    "messageTemplate"
                                )
                    );


                if (
                    templateArg &&
                    templateArg.messageTemplate !== undefined
                ) {

                    $("#smsMessage")
                        .val(
                            templateArg.messageTemplate
                        )
                        .trigger("input");

                }

                else {

                    /*
                     * Backward compatibility with
                     * your existing activity.
                     */

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


                /*
                 * --------------------------------------------------------
                 * LOAD SAVED VARIABLES
                 * --------------------------------------------------------
                 */

                const variablesArg =
                    inArguments.find(
                        item =>
                            item &&
                            Object.prototype.hasOwnProperty
                                .call(
                                    item,
                                    "variables"
                                )
                    );


                if (
                    variablesArg &&
                    Array.isArray(
                        variablesArg.variables
                    )
                ) {

                    variables =
                        variablesArg.variables.map(
                            item => ({

                                name:
                                    item.name || "",

                                field:
                                    item.field || ""

                            })
                        );


                    renderVariableFields();
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
| EXTRACT VARIABLES FROM MESSAGE
|--------------------------------------------------------------------------
|
| Example:
|
| Hi %%FirstName%%, your order %%OrderNumber%%
|
| Returns:
|
| FirstName
| OrderNumber
|
|--------------------------------------------------------------------------
*/

function extractVariables(
    message
) {

    const matches =
        String(message || "")
            .match(
                /%%([A-Za-z0-9_]+)%%/g
            );


    if (!matches) {

        return [];
    }


    const unique =
        [];


    matches.forEach(
        function (token) {

            if (
                !unique.includes(
                    token
                )
            ) {

                unique.push(
                    token
                );
            }
        }
    );


    return unique.map(
        function (token) {

            return {

                name:
                    token,

                field:
                    ""

            };

        }
    );
}


/*
|--------------------------------------------------------------------------
| MERGE VARIABLES
|--------------------------------------------------------------------------
*/

function syncVariablesFromMessage() {

    const message =
        $("#smsMessage")
            .val() || "";


    const detected =
        extractVariables(
            message
        );


    detected.forEach(
        function (newVariable) {

            const existing =
                variables.find(
                    item =>
                        item.name ===
                        newVariable.name
                );


            if (!existing) {

                variables.push(
                    newVariable
                );
            }
        }
    );


    /*
     * Remove variables which are
     * no longer present in message.
     */

    variables =
        variables.filter(
            function (item) {

                return detected.some(
                    detectedItem =>
                        detectedItem.name ===
                        item.name
                );

            }
        );


    renderVariableFields();
}


/*
|--------------------------------------------------------------------------
| RENDER VARIABLE FIELD MAPPING
|--------------------------------------------------------------------------
*/

function renderVariableFields() {

    const container =
        $("#variableList");


    if (!container.length) {

        console.warn(
            "#variableList element not found in HTML"
        );

        return;
    }


    container.empty();


    if (
        variables.length === 0
    ) {

        container.append(
            `
            <div class="variable-empty">
                Add variables in your message using
                <strong>%%VariableName%%</strong>
            </div>
            `
        );

        return;
    }


    variables.forEach(
        function (variable, index) {

            const row =
                $(`
                    <div
                        class="variable-row"
                        data-index="${index}"
                        style="margin-bottom:15px;"
                    >

                        <div
                            style="
                                display:flex;
                                gap:10px;
                                align-items:center;
                            "
                        >

                            <input
                                type="text"
                                class="variable-name"
                                value="${escapeHtml(
                                    variable.name
                                )}"
                                readonly
                                style="
                                    width:180px;
                                    padding:8px;
                                "
                            >

                            <select
                                class="variable-field"
                                style="
                                    flex:1;
                                    padding:8px;
                                "
                            >

                                <option value="">
                                    -- Select DE Field --
                                </option>

                            </select>

                            <button
                                type="button"
                                class="remove-variable"
                                data-index="${index}"
                            >
                                Remove
                            </button>

                        </div>

                    </div>
                `);


            const select =
                row.find(
                    ".variable-field"
                );


            /*
             * Populate DE fields.
             */

            eventFields.forEach(
                function (field) {

                    const option =
                        $("<option>")
                            .val(
                                field.name
                            )
                            .text(
                                field.label
                            );


                    if (
                        field.name ===
                        variable.field
                    ) {

                        option.prop(
                            "selected",
                            true
                        );
                    }


                    select.append(
                        option
                    );

                }
            );


            /*
             * Save field selection.
             */

            select.on(
                "change",
                function () {

                    const selectedField =
                        $(this).val();


                    const rowIndex =
                        Number(
                            row.attr(
                                "data-index"
                            )
                        );


                    if (
                        variables[rowIndex]
                    ) {

                        variables[rowIndex].field =
                            selectedField;


                        console.log(
                            "Variable mapping updated:",
                            variables[rowIndex]
                        );
                    }

                }
            );


            /*
             * Remove variable.
             */

            row.find(
                ".remove-variable"
            ).on(
                "click",
                function () {

                    const rowIndex =
                        Number(
                            $(this)
                                .attr(
                                    "data-index"
                                )
                        );


                    variables.splice(
                        rowIndex,
                        1
                    );


                    renderVariableFields();

                }
            );


            container.append(
                row
            );

        }
    );
}


/*
|--------------------------------------------------------------------------
| ESCAPE HTML
|--------------------------------------------------------------------------
*/

function escapeHtml(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/*
|--------------------------------------------------------------------------
| CONVERT MESSAGE TEMPLATE TO JOURNEY PERSONALIZATION
|--------------------------------------------------------------------------
|
| Example:
|
| Input:
|
| Hi %%FirstName%%, your order %%OrderNumber%%
|
| Output:
|
| Hi {{Event.DEAudience-xxx.FirstName}},
| your order {{Event.DEAudience-xxx.OrderNumber}}
|
|--------------------------------------------------------------------------
*/

function buildPersonalizedMessage(
    template
) {

    let message =
        String(
            template || ""
        );


    variables.forEach(
        function (variable) {

            if (
                !variable.name ||
                !variable.field
            ) {

                return;
            }


            if (
                !eventDefinitionKey
            ) {

                return;
            }


            const journeyBinding =
                "{{Event." +
                eventDefinitionKey +
                "." +
                variable.field +
                "}}";


            /*
             * Escape special regex characters
             * in variable name.
             */

            const escapedVariable =
                variable.name.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );


            const regex =
                new RegExp(
                    escapedVariable,
                    "g"
                );


            message =
                message.replace(
                    regex,
                    journeyBinding
                );

        }
    );


    return message;
}


/*
|--------------------------------------------------------------------------
| VALIDATE VARIABLE MAPPINGS
|--------------------------------------------------------------------------
*/

function validateVariables() {

    for (
        const variable
        of variables
    ) {

        if (
            !variable.field
        ) {

            alert(
                "Please select a DE field for " +
                variable.name
            );


            return false;
        }

    }


    return true;
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
         * Find %%variables%%
         */

        syncVariablesFromMessage();


        /*
         * Validate mapping.
         */

        if (
            !validateVariables()
        ) {

            return;
        }


        /*
         * Build final Journey Builder
         * personalization message.
         */

        const personalizedMessage =
            buildPersonalizedMessage(
                userMessage
            );


        console.log(
            "Original Message Template:",
            userMessage
        );


        console.log(
            "Variable Mapping:",
            variables
        );


        console.log(
            "Final Journey Message:",
            personalizedMessage
        );


        /*
         * --------------------------------------------------------
         * PHONE BINDING
         * --------------------------------------------------------
         */

        let dynamicPhoneBinding =
            "{{Context.DefaultMobileNumber}}";


        if (
            eventDefinitionKey
        ) {

            dynamicPhoneBinding =
                "{{Event." +
                eventDefinitionKey +
                ".Phone}}";
        }


        /*
         * --------------------------------------------------------
         * CONTACT KEY
         * --------------------------------------------------------
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        /*
         * --------------------------------------------------------
         * PAYLOAD
         * --------------------------------------------------------
         */

        payload.arguments =
            payload.arguments || {};


        payload.arguments.execute =
            payload.arguments.execute || {};


        payload.arguments.execute.inArguments = [

            /*
             * Contact Key
             */

            {
                contactKey:
                    contactKeyBinding
            },


            /*
             * Phone Number
             */

            {
                phoneNumber:
                    dynamicPhoneBinding
            },


            /*
             * FINAL MESSAGE
             *
             * This contains:
             *
             * {{Event.EventKey.Field}}
             *
             */

            {
                message:
                    personalizedMessage
            },


            /*
             * Save original template
             * for reopening the activity.
             */

            {
                messageTemplate:
                    userMessage
            },


            /*
             * Save variable mappings.
             */

            {
                variables:
                    variables
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


        /*
         * --------------------------------------------------------
         * UPDATE ACTIVITY
         * --------------------------------------------------------
         */

        connection.trigger(
            "updateActivity",
            payload
        );

    }
);


/*
|--------------------------------------------------------------------------
| MESSAGE INPUT EVENT
|--------------------------------------------------------------------------
*/

$(document).on(
    "input",
    "#smsMessage",
    function () {

        /*
         * Don't render on every character.
         *
         * Only synchronize detected variables.
         */

        syncVariablesFromMessage();

    }
);


/*
|--------------------------------------------------------------------------
| ADD VARIABLE BUTTON
|--------------------------------------------------------------------------
*/

$(document).on(
    "click",
    "#addVariable",
    function () {

        const variableName =
            prompt(
                "Enter variable name.\n\nExample: FirstName"
            );


        if (!variableName) {

            return;
        }


        const cleanName =
            variableName
                .trim()
                .replace(
                    /[^A-Za-z0-9_]/g,
                    ""
                );


        if (!cleanName) {

            alert(
                "Please enter a valid variable name."
            );

            return;
        }


        const token =
            "%%" +
            cleanName +
            "%%";


        const textarea =
            $("#smsMessage");


        const currentValue =
            textarea.val();


        textarea.val(
            currentValue +
            token
        );


        textarea.trigger(
            "input"
        );


        textarea.focus();

    }
);
