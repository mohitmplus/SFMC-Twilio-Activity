const connection =
    new Postmonger.Session();


let payload = {};

let eventDefinitionKey = "";

let eventSchema = [];

let variableCounter = 0;


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    console.log(
        "Twilio Custom Activity loading..."
    );


    /*
     * Tell Journey Builder the iframe
     * is ready.
     */

    connection.trigger(
        "ready"
    );


    /*
     * Get current journey.
     */

    connection.trigger(
        "requestInteraction"
    );


    /*
     * Get the Entry Event Definition.
     */

    connection.trigger(
        "requestTriggerEventDefinition"
    );


    /*
     * Ask Journey Builder for schema.
     *
     * This is important because we DO NOT
     * hard-code fields such as FirstName,
     * LastName, Phone, etc.
     */

    connection.trigger(
        "requestSchema"
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


        /*
         * Find Event Definition Key.
         */

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
| GET TRIGGER EVENT DEFINITION
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedTriggerEventDefinition",
    function (eventDefinition) {

        console.log(
            "Trigger Event Definition:",
            eventDefinition
        );


        /*
         * Some Journey Builder configurations
         * provide the eventDefinitionKey here.
         */

        if (
            eventDefinition
        ) {

            if (
                eventDefinition
                    .metaData &&
                eventDefinition
                    .metaData
                    .eventDefinitionKey
            ) {

                eventDefinitionKey =
                    eventDefinition
                        .metaData
                        .eventDefinitionKey;

            }


            if (
                eventDefinition
                    .eventDefinitionKey
            ) {

                eventDefinitionKey =
                    eventDefinition
                        .eventDefinitionKey;

            }

        }


        console.log(
            "Final Event Definition Key:",
            eventDefinitionKey
        );

    }
);


/*
|--------------------------------------------------------------------------
| GET ENTRY EVENT SCHEMA
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedSchema",
    function (schema) {

        console.log(
            "Journey Entry Schema received:",
            schema
        );


        eventSchema =
            extractSchemaFields(
                schema
            );


        console.log(
            "Extracted Journey Fields:",
            eventSchema
        );


        renderSchemaStatus();

        refreshVariableDropdowns();

    }
);


/*
|--------------------------------------------------------------------------
| EXTRACT SCHEMA FIELDS
|--------------------------------------------------------------------------
*/

function extractSchemaFields(
    schema
) {

    const fields = [];

    /*
     * Prevent duplicates.
     */

    const seen = {};


    /*
     * Journey Builder commonly returns
     * schema as an object containing
     * a schema array.
     */

    let schemaItems = [];


    if (
        Array.isArray(schema)
    ) {

        schemaItems =
            schema;

    }

    else if (
        schema &&
        Array.isArray(
            schema.schema
        )
    ) {

        schemaItems =
            schema.schema;

    }

    else if (
        schema &&
        Array.isArray(
            schema.data
        )
    ) {

        schemaItems =
            schema.data;

    }

    else if (
        schema &&
        schema.schema &&
        Array.isArray(
            schema.schema.fields
        )
    ) {

        schemaItems =
            schema.schema.fields;

    }


    /*
     * Extract every schema item.
     */

    schemaItems.forEach(
        function (item) {

            if (!item) {
                return;
            }


            /*
             * Different Journey Builder
             * schema responses can expose
             * the field key differently.
             */

            const key =
                item.key ||
                item.Key ||
                item.name ||
                item.fieldName ||
                "";


            if (!key) {
                return;
            }


            /*
             * We need the actual Journey
             * data-binding path.
             *
             * Example:
             *
             * Event.DEAudience-xxx.FirstName
             */

            let binding = key;


            /*
             * If key already contains Event.,
             * use it directly.
             */

            if (
                !binding.startsWith(
                    "{{"
                )
            ) {

                if (
                    binding.startsWith(
                        "Event."
                    )
                ) {

                    binding =
                        "{{" +
                        binding +
                        "}}";

                }

            }


            /*
             * Extract a friendly field name.
             */

            let fieldName =
                item.name ||
                item.fieldName ||
                "";


            /*
             * If no friendly name exists,
             * derive it from the key.
             */

            if (!fieldName) {

                const parts =
                    key.split(
                        "."
                    );

                fieldName =
                    parts[
                        parts.length - 1
                    ];

            }


            /*
             * Only add valid values.
             */

            if (
                fieldName &&
                binding
            ) {

                const uniqueKey =
                    fieldName +
                    "|" +
                    binding;


                if (
                    !seen[
                        uniqueKey
                    ]
                ) {

                    seen[
                        uniqueKey
                    ] = true;


                    fields.push({

                        name:
                            fieldName,

                        key:
                            key,

                        binding:
                            binding,

                        type:
                            item.type ||
                            ""

                    });

                }

            }

        }
    );


    return fields;
}


/*
|--------------------------------------------------------------------------
| RENDER SCHEMA STATUS
|--------------------------------------------------------------------------
*/

function renderSchemaStatus() {

    const status =
        $("#schemaStatus");


    if (
        eventSchema.length > 0
    ) {

        status
            .text(
                eventSchema.length +
                " Journey Entry fields available."
            )
            .removeClass(
                "error"
            )
            .addClass(
                "success"
            );

        return;
    }


    status
        .text(
            "No Journey Entry fields were returned. Make sure the Journey Entry Event has a Data Extension schema."
        )
        .removeClass(
            "success"
        )
        .addClass(
            "error"
        );
}


/*
|--------------------------------------------------------------------------
| ADD VARIABLE
|--------------------------------------------------------------------------
*/

$("#addVariable").on(
    "click",
    function () {

        variableCounter++;


        const variableName =
            "Variable" +
            variableCounter;


        addVariableRow(
            variableName
        );

    }
);


/*
|--------------------------------------------------------------------------
| ADD VARIABLE ROW
|--------------------------------------------------------------------------
*/

function addVariableRow(
    variableName
) {

    const rowId =
        "variable-" +
        Date.now() +
        "-" +
        variableCounter;


    const row =
        $(`
            <div
                class="variable-row"
                data-row-id="${rowId}"
            >

                <div>

                    <div class="variable-label">
                        Variable
                    </div>

                    <input
                        type="text"
                        class="variable-name"
                        value="${escapeHtml(variableName)}"
                        placeholder="FirstName"
                    >

                </div>


                <div>

                    <div class="variable-label">
                        Journey Entry Field
                    </div>

                    <select
                        class="variable-field"
                    >

                        <option value="">
                            Select field...
                        </option>

                    </select>

                </div>


                <button
                    type="button"
                    class="remove-variable"
                    title="Remove variable"
                >
                    ×
                </button>

            </div>
        `);


    $("#variableRows")
        .append(
            row
        );


    /*
     * Populate fields.
     */

    populateFieldDropdown(
        row.find(
            ".variable-field"
        )
    );


    /*
     * When user changes the field,
     * automatically suggest the variable
     * name.
     */

    row.find(
        ".variable-field"
    ).on(
        "change",
        function () {

            const selected =
                $(this)
                    .find(
                        "option:selected"
                    )
                    .data(
                        "fieldName"
                    );


            const input =
                row.find(
                    ".variable-name"
                );


            /*
             * Only auto-fill when the user
             * hasn't manually changed it.
             */

            if (
                selected &&
                (
                    !input.val() ||
                    input.val()
                        .startsWith(
                            "Variable"
                        )
                )
            ) {

                input.val(
                    sanitizeVariableName(
                        selected
                    )
                );

            }


            updatePreview();

        }
    );


    /*
     * Variable name changes.
     */

    row.find(
        ".variable-name"
    ).on(
        "input",
        function () {

            updatePreview();

        }
    );


    /*
     * Remove row.
     */

    row.find(
        ".remove-variable"
    ).on(
        "click",
        function () {

            row.remove();

            updatePreview();

        }
    );


    updatePreview();

}


/*
|--------------------------------------------------------------------------
| POPULATE FIELD DROPDOWN
|--------------------------------------------------------------------------
*/

function populateFieldDropdown(
    select
) {

    select.empty();


    select.append(
        $("<option>")
            .val("")
            .text(
                "Select field..."
            )
    );


    eventSchema.forEach(
        function (field) {

            const option =
                $("<option>")
                    .val(
                        field.binding
                    )
                    .text(
                        field.name
                    );


            option.attr(
                "data-field-name",
                field.name
            );


            option.data(
                "fieldName",
                field.name
            );


            option.data(
                "binding",
                field.binding
            );


            select.append(
                option
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| REFRESH ALL DROPDOWNS
|--------------------------------------------------------------------------
*/

function refreshVariableDropdowns() {

    $(".variable-field")
        .each(
            function () {

                const select =
                    $(this);


                const previous =
                    select.val();


                populateFieldDropdown(
                    select
                );


                /*
                 * Restore previous selection
                 * if it still exists.
                 */

                if (
                    previous
                ) {

                    select.val(
                        previous
                    );

                }

            }
        );

}


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
                !Array.isArray(
                    inArguments
                )
            ) {

                return;

            }


            /*
             * Find message.
             */

            const messageArg =
                inArguments.find(
                    item =>
                        item &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                item,
                                "message"
                            )
                );


            if (
                messageArg &&
                messageArg.message !==
                    undefined
            ) {

                $("#smsMessage")
                    .val(
                        messageArg.message
                    );

            }


            /*
             * Rebuild variable rows
             * from saved arguments.
             *
             * We ignore:
             *
             * contactKey
             * phoneNumber
             * message
             *
             * Everything else is considered
             * a personalization variable.
             */

            inArguments.forEach(
                function (item) {

                    if (
                        !item ||
                        typeof item !==
                            "object"
                    ) {

                        return;

                    }


                    const keys =
                        Object.keys(
                            item
                        );


                    if (
                        keys.length !== 1
                    ) {

                        return;

                    }


                    const variable =
                        keys[0];


                    if (
                        variable ===
                            "contactKey" ||
                        variable ===
                            "phoneNumber" ||
                        variable ===
                            "message"
                    ) {

                        return;

                    }


                    const binding =
                        item[
                            variable
                        ];


                    if (
                        typeof binding !==
                            "string"
                    ) {

                        return;

                    }


                    variableCounter++;


                    addVariableRow(
                        variable
                    );


                    const lastRow =
                        $("#variableRows")
                            .children()
                            .last();


                    lastRow
                        .find(
                            ".variable-name"
                        )
                        .val(
                            variable
                        );


                    lastRow
                        .find(
                            ".variable-field"
                        )
                        .val(
                            binding
                        );

                }
            );


            updatePreview();


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
         * Validate variables.
         */

        const variables =
            [];


        let invalidVariable =
            false;


        $("#variableRows")
            .find(
                ".variable-row"
            )
            .each(
                function () {

                    const row =
                        $(this);


                    const variableName =
                        row.find(
                            ".variable-name"
                        )
                        .val()
                        .trim();


                    const binding =
                        row.find(
                            ".variable-field"
                        )
                        .val();


                    if (
                        !variableName &&
                        !binding
                    ) {

                        return;

                    }


                    if (
                        !variableName
                    ) {

                        alert(
                            "Please enter a variable name."
                        );

                        invalidVariable =
                            true;

                        return false;

                    }


                    if (
                        !binding
                    ) {

                        alert(
                            "Please select a Journey Entry field for " +
                            variableName
                        );

                        invalidVariable =
                            true;

                        return false;

                    }


                    /*
                     * Variable names must be safe.
                     *
                     * Example:
                     *
                     * FirstName
                     * OrderNumber
                     * CustomerName
                     */

                    const cleanName =
                        sanitizeVariableName(
                            variableName
                        );


                    variables.push({

                        name:
                            cleanName,

                        binding:
                            binding

                    });

                }
            );


        if (
            invalidVariable
        ) {

            return;

        }


        /*
         * Phone binding.
         *
         * We retain your existing dynamic
         * Journey Entry phone field.
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
         * ContactKey.
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        /*
         * Prepare execute arguments.
         */

        payload.arguments =
            payload.arguments ||
            {};


        payload.arguments.execute =
            payload.arguments.execute ||
            {};


        const executeArguments = [

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
         * Add every personalization variable.
         *
         * Example:
         *
         * {
         *   FirstName:
         *     "{{Event.xxx.FirstName}}"
         * }
         */

        variables.forEach(
            function (variable) {

                executeArguments.push({

                    [variable.name]:
                        variable.binding

                });

            }
        );


        payload.arguments
            .execute
            .inArguments =
                executeArguments;


        /*
         * Mark activity configured.
         */

        payload.metaData =
            payload.metaData ||
            {};


        payload.metaData.isConfigured =
            true;


        console.log(
            "=========================================="
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
            "=========================================="
        );


        /*
         * Save activity.
         */

        connection.trigger(
            "updateActivity",
            payload
        );

    }
);


/*
|--------------------------------------------------------------------------
| MESSAGE PREVIEW
|--------------------------------------------------------------------------
*/

$("#smsMessage").on(
    "input",
    function () {

        updatePreview();

    }
);


/*
|--------------------------------------------------------------------------
| UPDATE PREVIEW
|--------------------------------------------------------------------------
*/

function updatePreview() {

    const textarea =
        document.getElementById(
            "smsMessage"
        );


    const charCount =
        document.getElementById(
            "charCount"
        );


    const segmentNote =
        document.getElementById(
            "segmentNote"
        );


    const bubble =
        document.getElementById(
            "smsBubbleText"
        );


    if (!textarea) {
        return;
    }


    const message =
        textarea.value;


    const length =
        message.length;


    if (charCount) {

        charCount.textContent =
            length +
            "/480";


        charCount.classList.toggle(
            "warn",
            length > 400
        );

    }


    const segments =
        Math.max(
            1,
            Math.ceil(
                length / 160
            )
        );


    if (segmentNote) {

        if (segments === 1) {

            segmentNote.textContent =
                length === 0
                    ? "1 segment · fits in a single SMS"
                    : "1 segment · fits in a single SMS (" +
                      (160 - length) +
                      " characters left)";

        }

        else {

            segmentNote.textContent =
                segments +
                " segments · message will be split into " +
                segments +
                " texts";

        }

    }


    if (bubble) {

        bubble.textContent =
            message ||
            "Type your text message here...";

    }

}


/*
|--------------------------------------------------------------------------
| SANITIZE VARIABLE NAME
|--------------------------------------------------------------------------
*/

function sanitizeVariableName(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .replace(
            /[^a-zA-Z0-9_]/g,
            ""
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
| INITIAL RENDER
|--------------------------------------------------------------------------
*/

updatePreview();
