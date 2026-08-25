// =========================================================
// SFMC JOURNEY BUILDER CUSTOM ACTIVITY
// Twilio SMS
// =========================================================

(function () {

    "use strict";


    // =====================================================
    // POSTMONGER
    // =====================================================

    const connection =
        new Postmonger.Session();


    // =====================================================
    // GLOBAL STATE
    // =====================================================

    let payload = {};

    let eventDefinitionKey = "";

    let journeyEventFields = [];

    let selectedPhoneField = "";


    // =====================================================
    // DOCUMENT READY
    // =====================================================

    $(document).ready(function () {

        console.log(
            "================================================"
        );

        console.log(
            "TWILIO SMS CUSTOM ACTIVITY INITIALIZING"
        );

        console.log(
            "================================================"
        );


        connection.trigger(
            "ready"
        );


        /*
         * Ask Journey Builder for the current
         * interaction / journey definition.
         */

        connection.trigger(
            "requestInteraction"
        );


        /*
         * Ask Journey Builder for activity
         * configuration.
         */

        connection.trigger(
            "requestActivity"
        );

    });


    // =====================================================
    // REQUESTED INTERACTION
    // =====================================================

    connection.on(
        "requestedInteraction",
        async function (interaction) {

            console.log(
                "================================================"
            );

            console.log(
                "REQUESTED INTERACTION"
            );

            console.log(
                JSON.stringify(
                    interaction,
                    null,
                    2
                )
            );

            console.log(
                "================================================"
            );


            try {

                eventDefinitionKey =
                    findEventDefinitionKey(
                        interaction
                    );


                console.log(
                    "Detected Event Definition Key:",
                    eventDefinitionKey
                );


                if (
                    eventDefinitionKey
                ) {

                    await loadEventFields();

                }
                else {

                    showFieldError(
                        "Unable to determine Journey Event Definition Key."
                    );

                }

            }
            catch (error) {

                console.error(
                    "Interaction initialization failed:",
                    error
                );


                showFieldError(
                    error.message
                );

            }

        }
    );


    // =====================================================
    // INIT ACTIVITY
    // =====================================================

    connection.on(
        "initActivity",
        function (data) {

            console.log(
                "================================================"
            );

            console.log(
                "INIT ACTIVITY"
            );

            console.log(
                JSON.stringify(
                    data,
                    null,
                    2
                )
            );

            console.log(
                "================================================"
            );


            if (data) {

                payload =
                    data;

            }


            restoreActivityConfiguration();

        }
    );


    // =====================================================
    // FIND EVENT DEFINITION KEY
    // =====================================================

    function findEventDefinitionKey(
        interaction
    ) {

        if (!interaction) {

            return "";

        }


        /*
         * Standard Journey Builder structure.
         */

        if (
            Array.isArray(
                interaction.triggers
            )
        ) {

            for (
                const trigger
                of interaction.triggers
            ) {

                const key =
                    trigger
                        ?.metaData
                        ?.eventDefinitionKey;


                if (key) {

                    return key;

                }

            }

        }


        /*
         * Additional fallback structures.
         */

        const candidates = [

            interaction
                ?.metaData
                ?.eventDefinitionKey,

            interaction
                ?.eventDefinitionKey,

            interaction
                ?.trigger
                ?.metaData
                ?.eventDefinitionKey,

            interaction
                ?.triggers?.[0]
                ?.eventDefinitionKey,

            interaction
                ?.triggers?.[0]
                ?.metaData
                ?.eventDefinitionKey

        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                candidate &&
                String(candidate).trim()
            ) {

                return String(
                    candidate
                ).trim();

            }

        }


        return "";

    }


    // =====================================================
    // LOAD EVENT FIELDS
    // =====================================================

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

            if (
                !eventDefinitionKey
            ) {

                throw new Error(
                    "Journey Event Definition Key is missing."
                );

            }


            const url =
                `/event-fields?eventDefinitionKey=${
                    encodeURIComponent(
                        eventDefinitionKey
                    )
                }`;


            console.log(
                "Loading Event Fields:",
                url
            );


            const response =
                await fetch(
                    url,
                    {

                        method:
                            "GET",

                        headers: {

                            Accept:
                                "application/json"

                        }

                    }
                );


            const responseText =
                await response.text();


            console.log(
                "Event Fields HTTP Status:",
                response.status
            );


            console.log(
                "Event Fields Response:",
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
                    "Event Fields API returned invalid JSON."
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
                JSON.stringify(
                    journeyEventFields,
                    null,
                    2
                )
            );


            if (
                !journeyEventFields.length
            ) {

                container.html(
                    `
                    <div class="variable-empty">
                        No Journey Event fields were found.
                    </div>
                    `
                );


                return;

            }


            /*
             * Build the first variable row.
             */

            container.html(
                ""
            );


            addVariableRow();


            /*
             * If no phone field was restored,
             * try to automatically detect one.
             */

            if (
                !selectedPhoneField
            ) {

                const detectedPhoneField =
                    detectPhoneField(
                        journeyEventFields
                    );


                if (
                    detectedPhoneField
                ) {

                    selectedPhoneField =
                        detectedPhoneField;

                }

            }


            /*
             * Build phone field selector.
             */

            renderPhoneFieldSelector();


        }
        catch (error) {

            console.error(
                "Unable to load Journey Event fields:",
                error
            );


            showFieldError(
                error.message
            );

        }

    }


    // =====================================================
    // PHONE FIELD DETECTION
    // =====================================================

    function detectPhoneField(
        fields
    ) {

        if (
            !Array.isArray(fields)
        ) {

            return "";

        }


        const priorityNames = [

            "MobileNumber",

            "Mobile_Number",

            "Mobile",

            "MobilePhone",

            "Phone",

            "PhoneNumber",

            "Phone_Number",

            "Mobile_No",

            "MobileNo",

            "CellPhone",

            "Telephone",

            "ContactMobile"

        ];


        /*
         * First check exact names.
         */

        for (
            const preferred
            of priorityNames
        ) {

            const found =
                fields.find(
                    field =>
                        String(
                            field.name ||
                            ""
                        ).toLowerCase() ===
                        preferred.toLowerCase()
                );


            if (found) {

                return found.name;

            }

        }


        /*
         * Then check partial names.
         */

        const found =
            fields.find(
                field => {

                    const name =
                        String(
                            field.name ||
                            ""
                        ).toLowerCase();


                    return (

                        name.includes(
                            "mobile"
                        ) ||

                        name.includes(
                            "phone"
                        ) ||

                        name.includes(
                            "telephone"
                        )

                    );

                }
            );


        return found
            ? found.name
            : "";

    }


    // =====================================================
    // PHONE FIELD SELECTOR
    // =====================================================

    function renderPhoneFieldSelector() {

        /*
         * The current index.html does not contain
         * a dedicated phone selector.
         *
         * Therefore create it dynamically above
         * the personalization rows.
         */

        const variablesBox =
            $(".variables-box");


        if (
            !variablesBox.length
        ) {

            return;

        }


        $("#phoneFieldSelector")
            .remove();


        const options =
            journeyEventFields
                .map(
                    field => {

                        const name =
                            field.name ||
                            "";


                        if (!name) {

                            return "";

                        }


                        const selected =
                            name ===
                            selectedPhoneField
                                ? "selected"
                                : "";


                        return `
                        <option
                            value="${escapeAttribute(name)}"
                            ${selected}
                        >
                            ${escapeHtml(name)}
                        </option>
                        `;

                    }
                )
                .join("");


        const selector =
            $(`
            <div
                id="phoneFieldSelector"
                style="
                    margin-bottom:12px;
                    padding:10px;
                    background:#F8FAFC;
                    border:1px solid #E1E7EC;
                    border-radius:7px;
                "
            >

                <div
                    style="
                        font-size:11px;
                        font-weight:600;
                        margin-bottom:6px;
                        color:#1A2B3C;
                    "
                >
                    Mobile / Phone Field
                </div>


                <div
                    style="
                        font-size:10px;
                        color:#5B6B7A;
                        margin-bottom:7px;
                        line-height:1.4;
                    "
                >
                    Select the Journey Event field containing
                    the recipient's mobile number.
                </div>


                <select
                    id="phoneField"
                    style="
                        width:100%;
                        height:34px;
                        border:1px solid #E1E7EC;
                        border-radius:6px;
                        padding:0 8px;
                        background:#fff;
                    "
                >

                    <option value="">
                        Select mobile / phone field
                    </option>

                    ${options}

                </select>

            </div>
            `);


        /*
         * Put phone selector at the beginning
         * of the variables box.
         */

        variablesBox
            .prepend(
                selector
            );


        $("#phoneField")
            .on(
                "change",
                function () {

                    selectedPhoneField =
                        $(this).val() || "";


                    console.log(
                        "Selected Phone Field:",
                        selectedPhoneField
                    );

                }
            );

    }


    // =====================================================
    // SHOW FIELD ERROR
    // =====================================================

    function showFieldError(
        message
    ) {

        $("#variableFields")
            .html(
                `
                <div class="variable-error">
                    Unable to load Journey Event fields.<br>
                    ${escapeHtml(
                        message ||
                        "Unknown error"
                    )}
                </div>
                `
            );

    }


    // =====================================================
    // ADD VARIABLE ROW
    // =====================================================

    window.addVariableRow =
        function (
            selectedField = ""
        ) {

            const fields =
                window.journeyEventFields ||
                journeyEventFields ||
                [];


            if (
                !fields.length
            ) {

                alert(
                    "Journey Event fields are not available."
                );

                return;

            }


            const container =
                $("#variableFields");


            const id =
                `variable-${Date.now()}-${Math.floor(
                    Math.random() * 10000
                )}`;


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


                            const selected =
                                name ===
                                selectedField
                                    ? "selected"
                                    : "";


                            return `
                            <option
                                value="${escapeAttribute(name)}"
                                ${selected}
                            >
                                ${escapeHtml(name)}
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


            container.append(
                row
            );

        };


    // =====================================================
    // INSERT VARIABLE
    // =====================================================

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


        /*
         * Journey Builder Event Data Binding
         */

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
                    bubbles:true
                }
            )
        );


        console.log(
            "Inserted variable:",
            token
        );

    }


    // =====================================================
    // RESTORE CONFIGURATION
    // =====================================================

    function restoreActivityConfiguration() {

        try {

            const args =
                payload
                    ?.arguments
                    ?.execute
                    ?.inArguments;


            if (
                !Array.isArray(args)
            ) {

                console.log(
                    "No previous inArguments found."
                );

                return;

            }


            console.log(
                "Restoring inArguments:",
                JSON.stringify(
                    args,
                    null,
                    2
                )
            );


            /*
             * Message
             */

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


            /*
             * Phone binding
             */

            const phoneArg =
                args.find(
                    item =>
                        item &&
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                item,
                                "phoneNumber"
                            )
                );


            if (
                phoneArg
            ) {

                const phoneValue =
                    String(
                        phoneArg.phoneNumber ||
                        ""
                    );


                const match =
                    phoneValue.match(
                        /^\{\{Event\.(.+?)\.(.+?)\}\}$/
                    );


                if (
                    match
                ) {

                    eventDefinitionKey =
                        eventDefinitionKey ||
                        match[1];


                    selectedPhoneField =
                        match[2];


                    console.log(
                        "Restored Phone Field:",
                        selectedPhoneField
                    );

                }

            }


            /*
             * If fields have already loaded,
             * refresh phone selector.
             */

            if (
                journeyEventFields.length
            ) {

                renderPhoneFieldSelector();

            }

        }
        catch (error) {

            console.error(
                "Unable to restore activity configuration:",
                error
            );

        }

    }


    // =====================================================
    // NEXT
    // =====================================================

    connection.on(
        "clickedNext",
        function () {

            console.log(
                "================================================"
            );

            console.log(
                "CLICKED NEXT"
            );

            console.log(
                "================================================"
            );


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


            /*
             * Get selected mobile field.
             */

            const phoneFieldElement =
                document.getElementById(
                    "phoneField"
                );


            if (
                phoneFieldElement
            ) {

                selectedPhoneField =
                    phoneFieldElement.value ||
                    "";

            }


            /*
             * If no phone field is explicitly
             * selected, automatically detect it.
             */

            if (
                !selectedPhoneField
            ) {

                selectedPhoneField =
                    detectPhoneField(
                        journeyEventFields
                    );

            }


            if (
                !selectedPhoneField
            ) {

                alert(
                    "Please select the Mobile / Phone field."
                );

                return;

            }


            if (
                !eventDefinitionKey
            ) {

                alert(
                    "Journey Event Definition is not available."
                );

                return;

            }


            /*
             * Build phone binding.
             */

            const phoneBinding =
                `{{Event.${eventDefinitionKey}.${selectedPhoneField}}}`;


            /*
             * Build payload.
             */

            payload =
                payload || {};


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


            /*
             * Helpful metadata.
             */

            payload.metaData
                .selectedPhoneField =
                    selectedPhoneField;


            payload.metaData
                .eventDefinitionKey =
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


            /*
             * Send configuration to Journey Builder.
             */

            connection.trigger(
                "updateActivity",
                payload
            );

        }
    );


    // =====================================================
    // PREVIOUS
    // =====================================================

    connection.on(
        "clickedBack",
        function () {

            console.log(
                "Clicked Back"
            );

            connection.trigger(
                "prevStep"
            );

        }
    );


    // =====================================================
    // CANCEL
    // =====================================================

    connection.on(
        "clickedCancel",
        function () {

            console.log(
                "Clicked Cancel"
            );

            connection.trigger(
                "cancel"
            );

        }
    );


    // =====================================================
    // HTML ESCAPE
    // =====================================================

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


    // =====================================================
    // ATTRIBUTE ESCAPE
    // =====================================================

    function escapeAttribute(
        value
    ) {

        return escapeHtml(
            value
        );

    }


})();
