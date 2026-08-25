const connection =
    new Postmonger.Session();

let payload = {};

let eventDefinitionKey = "";

let eventDefinitionId = "";

let eventFields = [];

let variables = {};

let activityInitialized = false;


/*
|--------------------------------------------------------------------------
| DOM READY
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    console.log(
        "Twilio Custom Activity UI loaded"
    );


    connection.trigger(
        "ready"
    );


    /*
     * Ask Journey Builder for:
     *
     * 1. Current journey
     * 2. Current entry event definition
     */

    connection.trigger(
        "requestInteraction"
    );


    connection.trigger(
        "requestTriggerEventDefinition"
    );


    $("#smsMessage").on(
        "input",
        renderPreview
    );


    $("#addVariable").on(
        "click",
        addVariable
    );


    renderPreview();
});


/*
|--------------------------------------------------------------------------
| REQUESTED INTERACTION
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedInteraction",
    function (interaction) {

        console.log(
            "Journey Blueprint received:",
            interaction
        );


        try {

            if (
                interaction &&
                interaction.triggers &&
                interaction.triggers.length
            ) {

                const trigger =
                    interaction.triggers[0];


                const key =
                    trigger
                        ?.metaData
                        ?.eventDefinitionKey;


                if (key) {

                    eventDefinitionKey =
                        key;

                    console.log(
                        "Event Definition Key from interaction:",
                        eventDefinitionKey
                    );
                }
            }

        } catch (error) {

            console.error(
                "Unable to read interaction:",
                error
            );
        }


        loadEventFields();
    }
);


/*
|--------------------------------------------------------------------------
| REQUESTED TRIGGER EVENT DEFINITION
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedTriggerEventDefinition",
    function (eventDefinition) {

        console.log(
            "Trigger Event Definition received:",
            eventDefinition
        );


        if (!eventDefinition) {

            setEventStatus(
                "Unable to retrieve the Journey Entry Event Definition.",
                "error"
            );

            return;
        }


        eventDefinitionId =
            eventDefinition.id ||
            "";


        eventDefinitionKey =
            eventDefinition.eventDefinitionKey ||
            eventDefinition.key ||
            eventDefinitionKey ||
            "";


        console.log(
            "Event Definition ID:",
            eventDefinitionId
        );


        console.log(
            "Event Definition Key:",
            eventDefinitionKey
        );


        loadEventFields();
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


        activityInitialized =
            true;


        loadExistingConfiguration();
    }
);


/*
|--------------------------------------------------------------------------
| LOAD EXISTING CONFIGURATION
|--------------------------------------------------------------------------
*/

function loadExistingConfiguration() {

    try {

        const inArguments =
            payload
                ?.arguments
                ?.execute
                ?.inArguments;


        if (
            !Array.isArray(
                inArguments
            )
        ) {

            return;
        }


        console.log(
            "Existing inArguments:",
            JSON.stringify(
                inArguments,
                null,
                2
            )
        );


        const messageArg =
            inArguments.find(
                item =>
                    item &&
                    Object.prototype.hasOwnProperty.call(
                        item,
                        "messageTemplate"
                    )
            );


        /*
         * Backward compatibility:
         *
         * Existing activity may have "message"
         * instead of "messageTemplate".
         */

        const oldMessageArg =
            inArguments.find(
                item =>
                    item &&
                    Object.prototype.hasOwnProperty.call(
                        item,
                        "message"
                    )
            );


        const message =
            messageArg
                ?.messageTemplate
            ??
            oldMessageArg
                ?.message
            ??
            "";


        $("#smsMessage")
            .val(
                message
            )
            .trigger(
                "input"
            );


        /*
         * Load saved variables.
         *
         * Example:
         *
         * {
         *   "__variable__FirstName":
         *      "{{Event.DEAudience-xxx.FirstName}}"
         * }
         */

        variables = {};


        inArguments.forEach(
            function (item) {

                if (
                    !item ||
                    typeof item !== "object"
                ) {

                    return;
                }


                Object.keys(item)
                    .forEach(
                        function (key) {

                            if (
                                !key.startsWith(
                                    "__variable__"
                                )
                            ) {

                                return;
                            }


                            const variableName =
                                key.replace(
                                    "__variable__",
                                    ""
                                );


                            const binding =
                                item[key];


                            variables[
                                variableName
                            ] = {

                                field:
                                    extractFieldFromBinding(
                                        binding
                                    ),

                                binding:
                                    binding

                            };

                        }
                    );

            }
        );


        renderVariableList();

        renderPreview();

    }

    catch (error) {

        console.error(
            "Unable to load existing configuration:",
            error
        );
    }
}


/*
|--------------------------------------------------------------------------
| EXTRACT FIELD FROM BINDING
|--------------------------------------------------------------------------
*/

function extractFieldFromBinding(
    binding
) {

    if (
        typeof binding !==
        "string"
    ) {

        return "";
    }


    /*
     * Expected:
     *
     * {{Event.DEAudience-xxx.FirstName}}
     */

    const match =
        binding.match(
            /^\{\{Event\.[^.]+\.(.+)\}\}$/
        );


    if (
        match &&
        match[1]
    ) {

        return match[1];
    }


    return "";
}


/*
|--------------------------------------------------------------------------
| LOAD EVENT FIELDS
|--------------------------------------------------------------------------
*/

let fieldsLoading =
    false;


async function loadEventFields() {

    if (
        fieldsLoading
    ) {

        return;
    }


    if (
        !eventDefinitionKey
    ) {

        setEventStatus(
            "Waiting for Journey Entry Event Definition...",
            "loading"
        );

        return;
    }


    fieldsLoading =
        true;


    setEventStatus(
        "Loading Journey Event fields...",
        "loading"
    );


    try {

        const url =
            "/event-fields?eventDefinitionKey=" +
            encodeURIComponent(
                eventDefinitionKey
            );


        console.log(
            "Loading fields from:",
            url
        );


        const response =
            await fetch(
                url,
                {

                    method:
                        "GET",

                    headers: {

                        "Accept":
                            "application/json"

                    }

                }
            );


        const data =
            await response.json();


        console.log(
            "Event fields response:",
            data
        );


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Unable to retrieve Event fields"
            );
        }


        eventFields =
            Array.isArray(
                data.fields
            )
                ? data.fields
                : [];


        if (
            !eventFields.length
        ) {

            throw new Error(
                "No fields were returned for the Journey Event Data Extension."
            );
        }


        populateFieldDropdown();


        setEventStatus(
            `${eventFields.length} Journey Event fields loaded successfully.`,
            "success"
        );

    }

    catch (error) {

        console.error(
            "EVENT FIELD LOAD ERROR:",
            error
        );


        setEventStatus(
            "Unable to load Journey Event fields. " +
            error.message,
            "error"
        );

    }

    finally {

        fieldsLoading =
            false;
    }
}


/*
|--------------------------------------------------------------------------
| POPULATE FIELD DROPDOWN
|--------------------------------------------------------------------------
*/

function populateFieldDropdown() {

    const select =
        $("#variableField");


    select.empty();


    select.append(
        $("<option>", {

            value:
                "",

            text:
                "Select Journey Event field"

        })
    );


    eventFields.forEach(
        function (field) {

            const fieldName =
                field.name ||
                field.Name;


            if (!fieldName) {

                return;
            }


            const type =
                field.type ||
                field.FieldType ||
                "";


            select.append(

                $("<option>", {

                    value:
                        fieldName,

                    text:
                        type
                            ? `${fieldName} (${type})`
                            : fieldName

                })

            );

        }
    );


    /*
     * Restore existing selected fields.
     */

    const firstVariable =
        Object.keys(
            variables
        )[0];


    if (
        firstVariable &&
        variables[firstVariable]?.field
    ) {

        select.val(
            variables[firstVariable].field
        );
    }
}


/*
|--------------------------------------------------------------------------
| ADD VARIABLE
|--------------------------------------------------------------------------
*/

function addVariable() {

    const variableName =
        $("#variableName")
            .val()
            .trim();


    const fieldName =
        $("#variableField")
            .val();


    if (!variableName) {

        alert(
            "Please enter a variable name."
        );

        return;
    }


    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(
        variableName
    )) {

        alert(
            "Variable name can contain only letters, numbers and underscore, and cannot start with a number."
        );

        return;
    }


    if (!fieldName) {

        alert(
            "Please select a Journey Event field."
        );

        return;
    }


    /*
     * Prevent duplicate variable names.
     */

    if (
        variables[
            variableName
        ] &&
        variables[
            variableName
        ].field !== fieldName
    ) {

        const overwrite =
            confirm(
                `Variable "${variableName}" already exists. Replace it?`
            );


        if (!overwrite) {

            return;
        }
    }


    const binding =
        buildEventBinding(
            fieldName
        );


    variables[
        variableName
    ] = {

        field:
            fieldName,

        binding:
            binding

    };


    console.log(
        "Variable added:",
        variableName,
        variables[
            variableName
        ]
    );


    /*
     * Clear inputs.
     */

    $("#variableName")
        .val("");

    $("#variableField")
        .val("");


    renderVariableList();

    renderPreview();

}


/*
|--------------------------------------------------------------------------
| BUILD JOURNEY EVENT BINDING
|--------------------------------------------------------------------------
*/

function buildEventBinding(
    fieldName
) {

    if (
        !eventDefinitionKey
    ) {

        throw new Error(
            "Journey Event Definition Key is not available."
        );
    }


    return (
        "{{Event." +
        eventDefinitionKey +
        "." +
        fieldName +
        "}}"
    );
}


/*
|--------------------------------------------------------------------------
| REMOVE VARIABLE
|--------------------------------------------------------------------------
*/

function removeVariable(
    variableName
) {

    delete variables[
        variableName
    ];


    renderVariableList();

    renderPreview();
}


/*
|--------------------------------------------------------------------------
| RENDER VARIABLE LIST
|--------------------------------------------------------------------------
*/

function renderVariableList() {

    const container =
        $("#variableList");


    container.empty();


    Object.keys(
        variables
    ).forEach(
        function (variableName) {

            const variable =
                variables[
                    variableName
                ];


            const item =
                $("<div>")
                    .addClass(
                        "variable-item"
                    );


            const left =
                $("<div>")
                    .addClass(
                        "variable-item-left"
                    );


            $("<div>")
                .addClass(
                    "variable-name"
                )
                .text(
                    variableName
                )
                .appendTo(
                    left
                );


            $("<div>")
                .addClass(
                    "variable-field"
                )
                .text(
                    "Journey Event field: " +
                    variable.field
                )
                .appendTo(
                    left
                );


            $("<div>")
                .addClass(
                    "variable-token"
                )
                .text(
                    "{{" +
                    variableName +
                    "}}"
                )
                .appendTo(
                    left
                );


            const remove =
                $("<button>")
                    .attr(
                        "type",
                        "button"
                    )
                    .addClass(
                        "btn-danger"
                    )
                    .text(
                        "Remove"
                    );


            remove.on(
                "click",
                function () {

                    removeVariable(
                        variableName
                    );

                }
            );


            item.append(
                left
            );


            item.append(
                remove
            );


            container.append(
                item
            );

        }
    );
}


/*
|--------------------------------------------------------------------------
| PREVIEW
|--------------------------------------------------------------------------
*/

function renderPreview() {

    const message =
        $("#smsMessage")
            .val();


    const len =
        message.length;


    $("#charCount")
        .text(
            `${len}/480`
        );


    $("#charCount")
        .toggleClass(
            "warn",
            len > 400
        );


    let segments;


    if (
        len === 0
    ) {

        segments =
            1;

    }

    else {

        segments =
            Math.max(
                1,
                Math.ceil(
                    len / 160
                )
            );
    }


    if (
        segments === 1
    ) {

        $("#segmentNote")
            .text(
                `1 segment · fits in a single SMS`
            );

    }

    else {

        $("#segmentNote")
            .text(
                `${segments} segments · message will be split into ${segments} texts`
            );
    }


    /*
     * Preview variable values.
     *
     * We intentionally don't hard-code values.
     *
     * Preview displays [FirstName]
     * until runtime.
     */

    let preview =
        message;


    Object.keys(
        variables
    ).forEach(
        function (variableName) {

            const token =
                "{{" +
                variableName +
                "}}";


            preview =
                preview.split(
                    token
                )
                .join(
                    "[" +
                    variableName +
                    "]"
                );

        }
    );


    $("#smsBubbleText")
        .text(
            preview ||
            "Type your text message here..."
        );
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function setEventStatus(
    message,
    type
) {

    const status =
        $("#eventStatus");


    status
        .removeClass(
            "status-loading status-success status-error"
        );


    if (
        type === "success"
    ) {

        status.addClass(
            "status-success"
        );

    }

    else if (
        type === "error"
    ) {

        status.addClass(
            "status-error"
        );

    }

    else {

        status.addClass(
            "status-loading"
        );
    }


    status.text(
        message
    );
}


/*
|--------------------------------------------------------------------------
| NEXT
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


        if (
            !eventDefinitionKey
        ) {

            alert(
                "Journey Entry Event Definition could not be detected."
            );

            return;
        }


        /*
         * PHONE
         */

        let dynamicPhoneBinding =
            "{{Context.DefaultMobileNumber}}";


        /*
         * Use Event.Phone if available.
         *
         * We do NOT hard-code a phone value.
         */

        const phoneField =
            eventFields.find(
                field => {

                    const name =
                        field.name ||
                        field.Name;

                    return (
                        name &&
                        name.toLowerCase() ===
                        "phone"
                    );

                }
            );


        if (
            phoneField
        ) {

            dynamicPhoneBinding =
                buildEventBinding(
                    phoneField.name ||
                    phoneField.Name
                );

        }


        /*
         * CONTACT KEY
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        /*
         * BUILD IN ARGUMENTS
         */

        const inArguments = [

            {
                contactKey:
                    contactKeyBinding
            },

            {
                phoneNumber:
                    dynamicPhoneBinding
            },

            {
                messageTemplate:
                    userMessage
            }

        ];


        /*
         * Add every personalization variable
         * as its own Journey data binding.
         *
         * Example:
         *
         * {
         *   "__variable__FirstName":
         *       "{{Event.DEAudience-xxx.FirstName}}"
         * }
         */

        Object.keys(
            variables
        ).forEach(
            function (variableName) {

                const variable =
                    variables[
                        variableName
                    ];


                inArguments.push({

                    [
                        "__variable__" +
                        variableName
                    ]:
                        variable.binding

                });

            }
        );


        /*
         * Keep backward-compatible "message".
         *
         * The actual personalization is performed
         * from messageTemplate + variables.
         */

        inArguments.push({

            message:
                userMessage

        });


        payload.arguments =
            payload.arguments ||
            {};


        payload.arguments.execute =
            payload.arguments.execute ||
            {};


        payload.arguments.execute.inArguments =
            inArguments;


        payload.arguments.execute.outArguments =
            [];


        payload.arguments.execute.url =
            payload.arguments.execute.url ||
            "/execute";


        payload.arguments.execute.verb =
            "POST";


        payload.arguments.execute.format =
            "json";


        payload.arguments.execute.useJwt =
            true;


        payload.arguments.execute.timeout =
            10000;


        payload.metaData =
            payload.metaData ||
            {};


        payload.metaData.isConfigured =
            true;


        console.log(
            "Final Activity Payload:",
            JSON.stringify(
                payload,
                null,
                2
            )
        );


        connection.trigger(
            "updateActivity",
            payload
        );
    }
);


/*
|--------------------------------------------------------------------------
| ERROR HANDLING
|--------------------------------------------------------------------------
*/

window.addEventListener(
    "error",
    function (event) {

        console.error(
            "UI error:",
            event.error ||
            event.message
        );

    }
);
