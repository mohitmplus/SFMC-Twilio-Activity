const connection =
    new Postmonger.Session();


let payload = {};

let eventDefinitionKey = "";


// =========================================================
// READY
// =========================================================

$(document).ready(function () {

    connection.trigger(
        "ready"
    );

    connection.trigger(
        "requestInteraction"
    );

});


// =========================================================
// JOURNEY
// =========================================================

connection.on(
    "requestedInteraction",
    async function (interaction) {

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


                eventDefinitionKey =
                    trigger
                        ?.metaData
                        ?.eventDefinitionKey ||
                    "";


                console.log(
                    "Event Definition Key:",
                    eventDefinitionKey
                );


                if (
                    eventDefinitionKey
                ) {

                    await loadEventFields();

                }

            }

        }

        catch (error) {

            console.error(
                "Unable to initialize event fields:",
                error
            );

        }

    }
);


// =========================================================
// INIT ACTIVITY
// =========================================================

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

            const args =
                payload
                    ?.arguments
                    ?.execute
                    ?.inArguments;


            if (
                Array.isArray(args)
            ) {

                const messageArg =
                    args.find(
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
                    messageArg
                ) {

                    $("#smsMessage")
                        .val(
                            messageArg.message ||
                            ""
                        )
                        .trigger(
                            "input"
                        );

                }

            }

        }

        catch (error) {

            console.error(
                "Unable to load activity:",
                error
            );

        }

    }
);


// =========================================================
// LOAD EVENT FIELDS
// =========================================================

async function loadEventFields() {

    const container =
        $("#variableFields");


    container.html(
        `
        <div class="variable-loading">
            Loading Journey Event fields...
        </div>
        `
    );


    try {

        const response =
            await fetch(

                `/event-fields?eventDefinitionKey=${
                    encodeURIComponent(
                        eventDefinitionKey
                    )
                }`

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


        window.journeyEventFields =
            data.fields || [];


        container.html(
            ""
        );


        if (
            !window.journeyEventFields.length
        ) {

            container.html(
                `
                <div class="variable-empty">
                    No Event fields found.
                </div>
                `
            );

            return;

        }


        addVariableRow();


    }

    catch (error) {

        console.error(
            error
        );


        container.html(
            `
            <div class="variable-error">
                Unable to load Journey Event fields.<br>
                ${escapeHtml(
                    error.message
                )}
            </div>
            `
        );

    }

}


// =========================================================
// ADD VARIABLE ROW
// =========================================================

function addVariableRow(
    selectedField = ""
) {

    const fields =
        window.journeyEventFields || [];


    if (
        !fields.length
    ) {

        alert(
            "Journey Event fields are not available."
        );

        return;

    }


    const id =
        `variable-${Date.now()}-${Math.floor(
            Math.random() * 10000
        )}`;


    const options =
        fields
            .map(
                field => {

                    const selected =
                        field.name ===
                        selectedField
                            ? "selected"
                            : "";


                    return `
                    <option
                        value="${escapeAttribute(
                            field.name
                        )}"
                        ${selected}
                    >
                        ${escapeHtml(
                            field.name
                        )}
                    </option>
                    `;

                }
            )
            .join("");


    const row =
        $(`
        <div
            class="variable-row"
            data-variable-id="${id}"
        >

            <select
                class="variable-select"
            >

                <option value="">
                    Select field
                </option>

                ${options}

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
                ×
            </button>

        </div>
        `);


    row.find(
        ".insert-variable"
    )
    .on(
        "click",
        function () {

            const field =
                row.find(
                    ".variable-select"
                ).val();


            if (!field) {

                alert(
                    "Please select a field."
                );

                return;

            }


            insertVariable(
                field
            );

        }
    );


    row.find(
        ".remove-variable"
    )
    .on(
        "click",
        function () {

            row.remove();

        }
    );


    containerAppend(
        row
    );

}


// =========================================================
// APPEND VARIABLE
// =========================================================

function containerAppend(
    row
) {

    $("#variableFields")
        .append(
            row
        );

}


// =========================================================
// INSERT VARIABLE
// =========================================================

function insertVariable(
    field
) {

    if (
        !eventDefinitionKey
    ) {

        alert(
            "Journey Event Definition is not available."
        );

        return;

    }


    const token =
        `{{Event.${eventDefinitionKey}.${field}}}`;


    const textarea =
        document.getElementById(
            "smsMessage"
        );


    if (!textarea) {

        return;

    }


    const start =
        textarea.selectionStart;


    const end =
        textarea.selectionEnd;


    const current =
        textarea.value;


    textarea.value =
        current.substring(
            0,
            start
        ) +
        token +
        current.substring(
            end
        );


    textarea.focus();


    textarea.selectionStart =
        textarea.selectionEnd =
            start +
            token.length;


    textarea.dispatchEvent(
        new Event(
            "input",
            {
                bubbles:
                    true
            }
        )
    );

}


// =========================================================
// NEXT
// =========================================================

connection.on(
    "clickedNext",
    function () {

        const message =
            $("#smsMessage")
                .val()
                .trim();


        if (!message) {

            alert(
                "Please enter an SMS message."
            );

            return;

        }


        let phoneBinding =
            "{{Context.DefaultMobileNumber}}";


        if (
            eventDefinitionKey
        ) {

            phoneBinding =
                `{{Event.${eventDefinitionKey}.Phone}}`;

        }


        payload.arguments =
            payload.arguments || {};


        payload.arguments.execute =
            payload.arguments.execute || {};


        payload.arguments.execute.inArguments = [

            {

                contactKey:
                    "{{Contact.Key}}"

            },

            {

                phoneNumber:
                    phoneBinding

            },

            {

                message:
                    message

            }

        ];


        payload.metaData =
            payload.metaData || {};


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


// =========================================================
// HTML ESCAPE
// =========================================================

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


// =========================================================
// ATTRIBUTE ESCAPE
// =========================================================

function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}
