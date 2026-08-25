const connection = new Postmonger.Session();

let payload = {};

let eventDefinitionKey = "";

let eventFields = [];

let variables = [];

let variableCounter = 0;


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

$(document).ready(function () {

    console.log(
        "Twilio Custom Activity UI initialized"
    );


    connection.trigger("ready");

    connection.trigger(
        "requestInteraction"
    );

    /*
     * This is the important Postmonger event.
     *
     * Journey Builder returns the Entry Event Definition.
     */

    connection.trigger(
        "requestTriggerEventDefinition"
    );


    initializeUI();
});


/*
|--------------------------------------------------------------------------
| REQUEST TRIGGER EVENT DEFINITION
|--------------------------------------------------------------------------
*/

connection.on(
    "requestedTriggerEventDefinition",
    function (eventDefinition) {

        console.log(
            "Trigger Event Definition:",
            eventDefinition
        );


        if (
            eventDefinition &&
            eventDefinition.eventDefinitionKey
        ) {

            eventDefinitionKey =
                eventDefinition.eventDefinitionKey;

        }


        if (
            !eventDefinitionKey &&
            eventDefinition &&
            eventDefinition.key
        ) {

            eventDefinitionKey =
                eventDefinition.key;

        }


        console.log(
            "Event Definition Key:",
            eventDefinitionKey
        );


        if (eventDefinitionKey) {

            loadEventFields();

        }

    }
);


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
            !eventDefinitionKey &&
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

            }

        }


        console.log(
            "Final Event Definition Key:",
            eventDefinitionKey
        );


        if (eventDefinitionKey) {

            loadEventFields();

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
                !Array.isArray(
                    inArguments
                )
            ) {

                return;

            }


            /*
             * Existing message
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
                    );

            }


            /*
             * Existing personalization variables
             *
             * Example:
             *
             * {
             *   personalization_FirstName:
             *      "{{Event.xxx.FirstName}}"
             * }
             */

            const existingVariables = [];


            inArguments.forEach(
                item => {

                    if (!item) {

                        return;

                    }


                    Object.keys(item)
                        .forEach(
                            key => {

                                if (
                                    key.startsWith(
                                        "personalization_"
                                    )
                                ) {

                                    const variableName =
                                        key.replace(
                                            "personalization_",
                                            ""
                                        );


                                    existingVariables.push({

                                        name:
                                            variableName,

                                        binding:
                                            item[key]

                                    });

                                }

                            }
                        );

                }
            );


            if (
                existingVariables.length
            ) {

                variables =
                    existingVariables;


                renderVariables();

            }


            renderMessage();

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
| UI INITIALIZATION
|--------------------------------------------------------------------------
*/

function initializeUI() {

    const textarea =
        document.getElementById(
            "smsMessage"
        );


    const addButton =
        document.getElementById(
            "addVariableBtn"
        );


    if (textarea) {

        textarea.addEventListener(
            "input",
            function () {

                renderMessage();

            }
        );

    }


    if (addButton) {

        addButton.addEventListener(
            "click",
            function () {

                addVariable();

            }
        );

    }


    renderMessage();

}


/*
|--------------------------------------------------------------------------
| LOAD EVENT FIELDS
|--------------------------------------------------------------------------
*/

async function loadEventFields() {

    if (!eventDefinitionKey) {

        console.warn(
            "Cannot load fields: Event Definition Key is empty"
        );

        return;

    }


    const loading =
        document.getElementById(
            "fieldLoading"
        );


    const errorElement =
        document.getElementById(
            "fieldError"
        );


    if (loading) {

        loading.style.display =
            "block";

    }


    if (errorElement) {

        errorElement.style.display =
            "none";

        errorElement.textContent =
            "";

    }


    try {

        const url =
            "/event-fields?eventDefinitionKey=" +
            encodeURIComponent(
                eventDefinitionKey
            );


        console.log(
            "Loading Event fields:",
            url
        );


        const response =
            await fetch(
                url,
                {
                    method: "GET",
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


        if (!response.ok) {

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


        console.log(
            "Available Event fields:",
            eventFields
        );


        renderVariables();

    }

    catch (error) {

        console.error(
            "Unable to load Event fields:",
            error
        );


        if (errorElement) {

            errorElement.style.display =
                "block";

            errorElement.textContent =
                "Unable to load Journey Event fields. " +
                error.message;

        }

    }

    finally {

        if (loading) {

            loading.style.display =
                "none";

        }

    }

}


/*
|--------------------------------------------------------------------------
| ADD VARIABLE
|--------------------------------------------------------------------------
*/

function addVariable() {

    variableCounter++;


    variables.push({

        id:
            variableCounter,

        name:
            "Variable" +
            variableCounter,

        field:
            ""

    });


    renderVariables();

}


/*
|--------------------------------------------------------------------------
| REMOVE VARIABLE
|--------------------------------------------------------------------------
*/

function removeVariable(
    index
) {

    variables.splice(
        index,
        1
    );


    renderVariables();

}


/*
|--------------------------------------------------------------------------
| UPDATE VARIABLE NAME
|--------------------------------------------------------------------------
*/

function updateVariableName(
    index,
    value
) {

    if (
        variables[index]
    ) {

        variables[index].name =
            value;

    }

}


/*
|--------------------------------------------------------------------------
| UPDATE VARIABLE FIELD
|--------------------------------------------------------------------------
*/

function updateVariableField(
    index,
    value
) {

    if (
        variables[index]
    ) {

        variables[index].field =
            value;

    }

}


/*
|--------------------------------------------------------------------------
| INSERT VARIABLE
|--------------------------------------------------------------------------
*/

function insertVariable(
    index
) {

    const variable =
        variables[index];


    if (
        !variable ||
        !variable.name
    ) {

        alert(
            "Please enter a variable name."
        );

        return;

    }


    if (
        !variable.field
    ) {

        alert(
            "Please select a Journey Event field."
        );

        return;

    }


    const textarea =
        document.getElementById(
            "smsMessage"
        );


    if (!textarea) {

        return;

    }


    const placeholder =
        "{{" +
        variable.name.trim() +
        "}}";


    insertAtCursor(
        textarea,
        placeholder
    );


    renderMessage();

}


/*
|--------------------------------------------------------------------------
| INSERT TEXT AT CURSOR
|--------------------------------------------------------------------------
*/

function insertAtCursor(
    textarea,
    text
) {

    const start =
        textarea.selectionStart;

    const end =
        textarea.selectionEnd;


    const currentValue =
        textarea.value;


    textarea.value =
        currentValue.substring(
            0,
            start
        ) +
        text +
        currentValue.substring(
            end
        );


    const newPosition =
        start +
        text.length;


    textarea.focus();


    textarea.selectionStart =
        newPosition;

    textarea.selectionEnd =
        newPosition;

}


/*
|--------------------------------------------------------------------------
| RENDER VARIABLE ROWS
|--------------------------------------------------------------------------
*/

function renderVariables() {

    const container =
        document.getElementById(
            "variableRows"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


    variables.forEach(
        (
            variable,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "variable-row";


            /*
             * Variable name
             */

            const nameInput =
                document.createElement(
                    "input"
                );


            nameInput.type =
                "text";

            nameInput.className =
                "variable-name";

            nameInput.value =
                variable.name ||
                "";


            nameInput.placeholder =
                "Variable name";


            nameInput.addEventListener(
                "input",
                function () {

                    updateVariableName(
                        index,
                        this.value
                    );

                }
            );


            /*
             * Field dropdown
             */

            const select =
                document.createElement(
                    "select"
                );


            select.className =
                "variable-field";


            const defaultOption =
                document.createElement(
                    "option"
                );


            defaultOption.value =
                "";


            defaultOption.textContent =
                eventFields.length
                    ? "Select Journey Event field"
                    : "Loading fields...";


            select.appendChild(
                defaultOption
            );


            eventFields.forEach(
                field => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        field.name;


                    option.textContent =
                        field.label ||
                        field.name;


                    if (
                        variable.field ===
                        field.name
                    ) {

                        option.selected =
                            true;

                    }


                    select.appendChild(
                        option
                    );

                }
            );


            select.addEventListener(
                "change",
                function () {

                    updateVariableField(
                        index,
                        this.value
                    );

                }
            );


            /*
             * Insert button
             */

            const insertButton =
                document.createElement(
                    "button"
                );


            insertButton.type =
                "button";

            insertButton.className =
                "variable-insert";

            insertButton.textContent =
                "Insert";


            insertButton.addEventListener(
                "click",
                function () {

                    insertVariable(
                        index
                    );

                }
            );


            /*
             * Remove
             */

            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.type =
                "button";

            removeButton.className =
                "variable-remove";

            removeButton.textContent =
                "×";


            removeButton.addEventListener(
                "click",
                function () {

                    removeVariable(
                        index
                    );

                }
            );


            row.appendChild(
                nameInput
            );

            row.appendChild(
                select
            );

            row.appendChild(
                insertButton
            );

            row.appendChild(
                removeButton
            );


            container.appendChild(
                row
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| RENDER MESSAGE PREVIEW
|--------------------------------------------------------------------------
*/

function renderMessage() {

    const textarea =
        document.getElementById(
            "smsMessage"
        );


    const charCount =
        document.getElementById(
            "charCount"
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


    if (charCount) {

        charCount.textContent =
            message.length +
            "/480";


        charCount.classList.toggle(
            "warn",
            message.length > 400
        );

    }


    if (bubble) {

        bubble.textContent =
            message ||
            "Type your text message here...";

    }

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
         */

        const contactKeyBinding =
            "{{Contact.Key}}";


        /*
         * Build inArguments
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
                message:
                    userMessage
            }

        ];


        /*
         * PERSONALIZATION
         *
         * IMPORTANT:
         *
         * Each selected Journey Event field
         * is sent as its own data-bound argument.
         *
         * Example:
         *
         * personalization_FirstName:
         * {{Event.DEAudience-xxx.FirstName}}
         *
         * Journey Builder evaluates this at runtime.
         */

        variables.forEach(
            variable => {

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


                const argumentName =
                    "personalization_" +
                    variable.name.trim();


                const binding =
                    "{{Event." +
                    eventDefinitionKey +
                    "." +
                    variable.field +
                    "}}";


                const argument = {};


                argument[
                    argumentName
                ] =
                    binding;


                inArguments.push(
                    argument
                );

            }
        );


        payload.arguments =
            payload.arguments ||
            {};


        payload.arguments.execute =
            payload.arguments.execute ||
            {};


        payload.arguments.execute.inArguments =
            inArguments;


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


        connection.trigger(
            "updateActivity",
            payload
        );

    }
);
