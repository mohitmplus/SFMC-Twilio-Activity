const connection = new Postmonger.Session();

let payload = {};
let eventDefinitionKey = "";
let journeyEventFields = [];


// =========================================================
// READY
// =========================================================

$(document).ready(function () {

    console.log("Custom Activity loading...");

    connection.trigger("ready");

    connection.trigger("requestInteraction");

});


// =========================================================
// JOURNEY BLUEPRINT
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
                interaction.triggers.length > 0
            ) {

                const trigger =
                    interaction.triggers[0];

                eventDefinitionKey =
                    trigger?.metaData?.eventDefinitionKey ||
                    trigger?.metaData?.eventDefinitionId ||
                    "";

                console.log(
                    "Event Definition Key:",
                    eventDefinitionKey
                );

                if (eventDefinitionKey) {

                    await loadEventFields();

                }
                else {

                    showFieldError(
                        "Unable to determine Journey Event Definition Key."
                    );

                }

            }
            else {

                showFieldError(
                    "Unable to determine Journey Event."
                );

            }

        }
        catch (error) {

            console.error(
                "Unable to initialize event fields:",
                error
            );

            showFieldError(
                error.message
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

            payload = data;

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

                console.log(
                    "Existing InArguments:",
                    JSON.stringify(
                        args,
                        null,
                        2
                    )
                );


                // =================================================
                // MESSAGE
                // =================================================

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

                if (messageArg) {

                    $("#smsMessage")
                        .val(
                            messageArg.message || ""
                        );

                }


                // =================================================
                // PHONE FIELD
                // =================================================

                const phoneArg =
                    args.find(
                        item =>
                            item &&
                            (
                                Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        item,
                                        "phoneNumber"
                                    ) ||
                                Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        item,
                                        "mobileNumber"
                                    )
                            )
                    );


                if (phoneArg) {

                    const savedPhoneBinding =
                        phoneArg.phoneNumber ||
                        phoneArg.mobileNumber ||
                        "";

                    console.log(
                        "Saved phone binding:",
                        savedPhoneBinding
                    );

                    $("#phoneField")
                        .val(
                            extractFieldName(
                                savedPhoneBinding
                            )
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

        if (!eventDefinitionKey) {

            throw new Error(
                "Event Definition Key is not available."
            );

        }


        const url =
            `/event-fields?eventDefinitionKey=${encodeURIComponent(
                eventDefinitionKey
            )}`;


        console.log(
            "Loading Event Fields:",
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


        const responseText =
            await response.text();


        console.log(
            "Event fields HTTP status:",
            response.status
        );

        console.log(
            "Event fields response:",
            responseText
        );


        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        }
        catch (error) {

            throw new Error(
                `Invalid response from server. HTTP ${response.status}`
            );

        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to retrieve Event fields"
            );

        }


        journeyEventFields =
            Array.isArray(
                data.fields
            )
                ? data.fields
                : [];


        window.journeyEventFields =
            journeyEventFields;


        console.log(
            "Journey Event Fields:",
            journeyEventFields
        );


        container.html("");


        if (
            journeyEventFields.length === 0
        ) {

            container.html(
                `
                <div class="variable-empty">
                    No Journey Event fields found.
                </div>
                `
            );

            return;

        }


        // =====================================================
        // PHONE FIELD SELECTOR
        // =====================================================

        renderPhoneFieldSelector();


        // =====================================================
        // MESSAGE VARIABLE
        // =====================================================

        addVariableRow();


    }
    catch (error) {

        console.error(
            "EVENT FIELD LOAD ERROR:",
            error
        );


        showFieldError(
            error.message
        );

    }

}


// =========================================================
// PHONE FIELD SELECTOR
// =========================================================

function renderPhoneFieldSelector() {

    const container =
        $("#phoneFieldContainer");


    if (
        !container.length
    ) {

        console.warn(
            "phoneFieldContainer not found in HTML."
        );

        return;

    }


    const fields =
        journeyEventFields || [];


    const options =
        fields
            .map(
                field => {

                    const name =
                        field.name ||
                        "";

                    if (!name) {

                        return "";

                    }

                    return `
                        <option
                            value="${escapeAttribute(
                                name
                            )}"
                        >
                            ${escapeHtml(
                                name
                            )}
                        </option>
                    `;

                }
            )
            .join("");


    container.html(
        `
        <label
            for="phoneField"
        >
            Mobile / Phone Field
        </label>

        <select
            id="phoneField"
            class="phone-field-select"
        >

            <option value="">
                Select mobile/phone field
            </option>

            ${options}

        </select>

        <div class="field-help">
            Select the Journey Event field containing
            the recipient mobile number.
        </div>
        `
    );

}


// =========================================================
// ADD VARIABLE ROW
// =========================================================

function addVariableRow(
    selectedField = ""
) {

    const fields =
        journeyEventFields || [];


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

                    const fieldName =
                        field.name ||
                        "";

                    if (!fieldName) {

                        return "";

                    }


                    const selected =
                        fieldName ===
                        selectedField
                            ? "selected"
                            : "";


                    return `
                    <option
                        value="${escapeAttribute(
                            fieldName
                        )}"
                        ${selected}
                    >
                        ${escapeHtml(
                            fieldName
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


    if (!field) {

        return;

    }


    const token =
        `{{Event.${eventDefinitionKey}.${field}}}`;


    const textarea =
        document.getElementById(
            "smsMessage"
        );


    if (!textarea) {

        console.error(
            "smsMessage textarea not found."
        );

        return;

    }


    const start =
        typeof textarea.selectionStart === "number"
            ? textarea.selectionStart
            : textarea.value.length;


    const end =
        typeof textarea.selectionEnd === "number"
            ? textarea.selectionEnd
            : textarea.value.length;


    const current =
        textarea.value || "";


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


    console.log(
        "Inserted Journey variable:",
        token
    );

}


// =========================================================
// NEXT
// =========================================================

connection.on(
    "clickedNext",
    function () {

        console.log(
            "Next clicked."
        );


        // =====================================================
        // MESSAGE
        // =====================================================

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


        // =====================================================
        // PHONE FIELD
        // =====================================================

        let selectedPhoneField =
            $("#phoneField")
                .val();


        /*
         * Fallback:
         *
         * If the HTML does not contain #phoneField,
         * use Phone when available.
         */

        if (
            !selectedPhoneField
        ) {

            const phoneField =
                journeyEventFields.find(
                    field =>
                        String(
                            field.name || ""
                        ).toLowerCase() ===
                        "phone"
                );


            if (phoneField) {

                selectedPhoneField =
                    phoneField.name;

            }

        }


        if (
            !selectedPhoneField
        ) {

            alert(
                "Please select the Mobile / Phone field."
            );

            return;

        }


        // =====================================================
        // PHONE BINDING
        // =====================================================

        let phoneBinding =
            selectedPhoneField;


        if (
            eventDefinitionKey
        ) {

            phoneBinding =
                `{{Event.${eventDefinitionKey}.${selectedPhoneField}}}`;

        }


        console.log(
            "Selected phone field:",
            selectedPhoneField
        );

        console.log(
            "Phone binding:",
            phoneBinding
        );


        // =====================================================
        // CONTACT KEY
        // =====================================================

        const contactKeyBinding =
            "{{Contact.Key}}";


        // =====================================================
        // PAYLOAD
        // =====================================================

        payload =
            payload || {};


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


        // =====================================================
        // STORE SELECTED FIELD
        // =====================================================

        /*
         * These values are useful for debugging
         * and restoring the activity.
         */

        payload.metaData.phoneField =
            selectedPhoneField;


        payload.metaData.eventDefinitionKey =
            eventDefinitionKey;


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


        // =====================================================
        // UPDATE ACTIVITY
        // =====================================================

        connection.trigger(
            "updateActivity",
            payload
        );

    }
);


// =========================================================
// EXTRACT FIELD NAME
// =========================================================

function extractFieldName(
    binding
) {

    if (!binding) {

        return "";

    }


    const value =
        String(
            binding
        ).trim();


    /*
     * Example:
     *
     * {{Event.APIEvent-xxx.Phone}}
     *
     * returns:
     *
     * Phone
     */

    const match =
        value.match(
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


// =========================================================
// ERROR
// =========================================================

function showFieldError(
    message
) {

    $("#variableFields")
        .html(
            `
            <div class="variable-error">

                Unable to load Journey Event fields.

                <br><br>

                ${escapeHtml(
                    message ||
                    "Unknown error"
                )}

            </div>
            `
        );

}


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(
    value
) {

    return String(
        value ?? ""
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
