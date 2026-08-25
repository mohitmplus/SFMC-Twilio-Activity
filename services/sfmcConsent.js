const { getAccessToken } = require("./sfmcAuth");


// =========================================================
// SFMC REST BASE URL
// =========================================================

function getRestBaseUrl() {

    const baseUrl =
        process.env.SFMC_REST_BASE_URI;

    if (!baseUrl) {
        throw new Error(
            "SFMC_REST_BASE_URI is not configured"
        );
    }

    return baseUrl.endsWith("/")
        ? baseUrl
        : `${baseUrl}/`;
}


// =========================================================
// ENVIRONMENT VARIABLE
// =========================================================

function requireEnv(name) {

    if (!process.env[name]) {

        throw new Error(
            `${name} is not configured`
        );
    }

    return process.env[name];
}


// =========================================================
// SFMC API REQUEST
// =========================================================

async function sfmcRequest(
    method,
    url,
    body = null
) {

    const token =
        await getAccessToken();


    const options = {

        method,

        headers: {

            Authorization:
                `Bearer ${token}`,

            Accept:
                "application/json"
        }
    };


    if (body !== null) {

        options.headers[
            "Content-Type"
        ] = "application/json";

        options.body =
            JSON.stringify(body);
    }


    console.log(
        "SFMC Request:",
        method,
        url
    );


    const response =
        await fetch(
            url,
            options
        );


    const responseText =
        await response.text();


    let responseData = {};


    try {

        responseData =
            responseText
                ? JSON.parse(
                    responseText
                )
                : {};

    } catch {

        responseData = {

            raw:
                responseText
        };
    }


    console.log(
        "SFMC Response Status:",
        response.status
    );


    if (!response.ok) {

        console.error(
            "SFMC API Error:",
            responseData
        );


        throw new Error(

            `SFMC API ${response.status}: ` +

            `${JSON.stringify(
                responseData
            )}`
        );
    }


    return responseData;
}


// =========================================================
// GET VALUE FROM SFMC RECORD
// =========================================================
//
// SFMC API can return Data Extension fields with
// lowercase field names.
//
// Example:
//
// smsoptin
// mobilenumber
// optindate
//
// This helper supports both:
//
// SMSOptIn
// smsoptin
//
// =========================================================

function getField(
    record,
    fieldName,
    defaultValue = null
) {

    if (!record) {
        return defaultValue;
    }


    // Exact field name
    if (
        Object.prototype.hasOwnProperty.call(
            record,
            fieldName
        )
    ) {

        return record[fieldName];
    }


    // Lowercase field name
    const lowerField =
        fieldName.toLowerCase();


    if (
        Object.prototype.hasOwnProperty.call(
            record,
            lowerField
        )
    ) {

        return record[lowerField];
    }


    // Case-insensitive search
    const actualKey =
        Object.keys(record)
            .find(
                key =>
                    key.toLowerCase() ===
                    lowerField
            );


    if (actualKey) {

        return record[actualKey];
    }


    return defaultValue;
}


// =========================================================
// CONVERT VALUE TO BOOLEAN
// =========================================================

function toBoolean(value) {

    if (
        value === true ||
        value === 1
    ) {

        return true;
    }


    if (
        value === false ||
        value === 0 ||
        value === null ||
        value === undefined
    ) {

        return false;
    }


    return (
        String(value)
            .trim()
            .toLowerCase() ===
        "true"
    );
}


// =========================================================
// NORMALIZE CONSENT RECORD
// =========================================================
//
// Converts SFMC response:
//
// smsoptin
// mobilenumber
//
// into a predictable Node.js object:
//
// SMSOptIn
// MobileNumber
//
// =========================================================

function normalizeConsentRecord(
    record
) {

    if (!record) {
        return null;
    }


    return {

        ContactKey:
            getField(
                record,
                "ContactKey",
                ""
            ),

        MobileNumber:
            getField(
                record,
                "MobileNumber",
                ""
            ),

        SMSOptIn:
            toBoolean(
                getField(
                    record,
                    "SMSOptIn",
                    false
                )
            ),

        OptInDate:
            getField(
                record,
                "OptInDate",
                null
            ),

        OptOutDate:
            getField(
                record,
                "OptOutDate",
                null
            ),

        OptInSource:
            getField(
                record,
                "OptInSource",
                ""
            ),

        OptOutSource:
            getField(
                record,
                "OptOutSource",
                ""
            ),

        ConsentVersion:
            getField(
                record,
                "ConsentVersion",
                ""
            ),

        LastUpdated:
            getField(
                record,
                "LastUpdated",
                null
            ),

        TwilioOptOutStatus:
            getField(
                record,
                "TwilioOptOutStatus",
                ""
            )
    };
}


// =========================================================
// GET CONSENT BY CONTACT KEY
// =========================================================

async function getConsent(
    contactKey
) {

    if (!contactKey) {

        throw new Error(
            "ContactKey is required for consent lookup"
        );
    }


    const deKey =
        requireEnv(
            "SFMC_CONSENT_DE_KEY"
        );


    const encodedDEKey =
        encodeURIComponent(
            deKey
        );


    const escapedContactKey =
        String(contactKey)
            .replace(
                /'/g,
                "''"
            );


    const filter =
        `ContactKey eq '${escapedContactKey}'`;


    const url =
        `${getRestBaseUrl()}` +
        `data/v1/customobjectdata/key/` +
        `${encodedDEKey}` +
        `/rowset` +
        `?$filter=` +
        `${encodeURIComponent(
            filter
        )}`;


    console.log(
        "Consent lookup by ContactKey:",
        contactKey
    );


    const result =
        await sfmcRequest(
            "GET",
            url
        );


    if (
        !result ||
        !Array.isArray(
            result.items
        ) ||
        result.items.length === 0
    ) {

        console.log(
            "No consent record found for ContactKey:",
            contactKey
        );

        return null;
    }


    const item =
        result.items[0];


    const record =
        item.values ||
        item;


    console.log(
        "Raw SFMC consent record:",
        JSON.stringify(
            record,
            null,
            2
        )
    );


    const normalized =
        normalizeConsentRecord(
            record
        );


    console.log(
        "Normalized consent record:",
        JSON.stringify(
            normalized,
            null,
            2
        )
    );


    return normalized;
}


// =========================================================
// GET CONSENT BY MOBILE NUMBER
// =========================================================
//
// Your DE stores:
//
// 916377783635
//
// This function therefore removes:
//
// +
// spaces
// -
// ()
// .
//
// before searching.
//
// =========================================================

async function getConsentByMobile(
    mobileNumber
) {

    if (!mobileNumber) {

        throw new Error(
            "MobileNumber is required for consent lookup"
        );
    }


    const deKey =
        requireEnv(
            "SFMC_CONSENT_DE_KEY"
        );


    const encodedDEKey =
        encodeURIComponent(
            deKey
        );


    // -----------------------------------------------------
    // Clean mobile number
    // -----------------------------------------------------

    const cleanMobile =
        String(mobileNumber)
            .replace(
                /\D/g,
                ""
            );


    if (!cleanMobile) {

        throw new Error(
            "Invalid MobileNumber"
        );
    }


    console.log(
        "Consent mobile lookup:",
        cleanMobile
    );


    const filter =
        `MobileNumber eq '${cleanMobile}'`;


    const url =
        `${getRestBaseUrl()}` +
        `data/v1/customobjectdata/key/` +
        `${encodedDEKey}` +
        `/rowset` +
        `?$filter=` +
        `${encodeURIComponent(
            filter
        )}`;


    const result =
        await sfmcRequest(
            "GET",
            url
        );


    if (
        !result ||
        !Array.isArray(
            result.items
        ) ||
        result.items.length === 0
    ) {

        console.log(
            "No consent record found for mobile:",
            cleanMobile
        );

        return null;
    }


    const item =
        result.items[0];


    const record =
        item.values ||
        item;


    console.log(
        "Raw mobile consent record:",
        JSON.stringify(
            record,
            null,
            2
        )
    );


    return normalizeConsentRecord(
        record
    );
}


// =========================================================
// UPSERT CONSENT RECORD
// =========================================================

async function upsertConsent(
    values
) {

    if (!values.ContactKey) {

        throw new Error(
            "ContactKey is required for consent upsert"
        );
    }


    const deKey =
        requireEnv(
            "SFMC_CONSENT_DE_KEY"
        );


    const url =
        `${getRestBaseUrl()}` +
        `hub/v1/dataevents/key/` +
        `${encodeURIComponent(
            deKey
        )}` +
        `/rowset`;


    // -----------------------------------------------------
    // Normalize mobile
    // -----------------------------------------------------

    const mobileNumber =
        values.MobileNumber
            ? String(
                values.MobileNumber
            ).replace(
                /\D/g,
                ""
            )
            : "";


    // -----------------------------------------------------
    // Normalize Boolean
    // -----------------------------------------------------

    const smsOptIn =
        toBoolean(
            values.SMSOptIn
        );


    // -----------------------------------------------------
    // Current date
    // -----------------------------------------------------

    const now =
        new Date().toISOString();


    const payload = [

        {

            keys: {

                ContactKey:
                    String(
                        values.ContactKey
                    )
            },

            values: {

                ContactKey:
                    String(
                        values.ContactKey
                    ),

                MobileNumber:
                    mobileNumber,

                SMSOptIn:
                    smsOptIn,

                OptInDate:
                    values.OptInDate ||
                    null,

                OptOutDate:
                    values.OptOutDate ||
                    null,

                OptInSource:
                    values.OptInSource ||
                    "",

                OptOutSource:
                    values.OptOutSource ||
                    "",

                ConsentVersion:
                    values.ConsentVersion ||
                    "",

                LastUpdated:
                    values.LastUpdated ||
                    now,

                TwilioOptOutStatus:
                    values.TwilioOptOutStatus ||
                    ""
            }
        }
    ];


    console.log(
        "Consent upsert payload:",
        JSON.stringify(
            payload,
            null,
            2
        )
    );


    return sfmcRequest(
        "POST",
        url,
        payload
    );
}


// =========================================================
// OPT OUT
// =========================================================
//
// Trigger:
//
// Customer sends STOP
//
// Result:
//
// SMSOptIn = false
// OptOutDate = NOW
// OptOutSource = Twilio
// TwilioOptOutStatus = OptedOut
//
// =========================================================

async function optOut({

    contactKey,

    mobileNumber,

    source = "Twilio",

    consentVersion = "v1"

}) {

    if (!contactKey) {

        throw new Error(
            "ContactKey is required for opt-out"
        );
    }


    // -----------------------------------------------------
    // Get existing record
    // -----------------------------------------------------

    const existing =
        await getConsent(
            contactKey
        );


    const now =
        new Date().toISOString();


    // -----------------------------------------------------
    // Existing values are already normalized.
    // -----------------------------------------------------

    const existingMobile =
        existing?.MobileNumber ||
        "";


    const existingOptInDate =
        existing?.OptInDate ||
        null;


    const existingOptInSource =
        existing?.OptInSource ||
        "";


    const existingConsentVersion =
        existing?.ConsentVersion ||
        consentVersion ||
        "";


    // -----------------------------------------------------
    // Upsert opted-out record
    // -----------------------------------------------------

    const result =
        await upsertConsent({

            ContactKey:
                contactKey,

            MobileNumber:
                mobileNumber ||
                existingMobile,

            SMSOptIn:
                false,

            OptInDate:
                existingOptInDate,

            OptOutDate:
                now,

            OptInSource:
                existingOptInSource,

            OptOutSource:
                source,

            ConsentVersion:
                existingConsentVersion,

            LastUpdated:
                now,

            TwilioOptOutStatus:
                "OptedOut"
        });


    console.log(
        "Contact opted out:",
        contactKey
    );


    return result;
}


// =========================================================
// OPT IN
// =========================================================
//
// Trigger:
//
// Preference Center / API
//
// Result:
//
// SMSOptIn = true
// OptInDate = NOW
// OptOutDate = NULL
// OptInSource = source
// OptOutSource = blank
// TwilioOptOutStatus = Active
//
// =========================================================

async function optIn({

    contactKey,

    mobileNumber,

    source = "Preference Center",

    consentVersion = "v1"

}) {

    if (!contactKey) {

        throw new Error(
            "ContactKey is required for opt-in"
        );
    }


    // -----------------------------------------------------
    // Get existing record
    // -----------------------------------------------------

    const existing =
        await getConsent(
            contactKey
        );


    const now =
        new Date().toISOString();


    const existingMobile =
        existing?.MobileNumber ||
        "";


    // -----------------------------------------------------
    // Upsert opted-in record
    // -----------------------------------------------------

    const result =
        await upsertConsent({

            ContactKey:
                contactKey,

            MobileNumber:
                mobileNumber ||
                existingMobile,

            SMSOptIn:
                true,

            OptInDate:
                now,

            OptOutDate:
                null,

            OptInSource:
                source,

            OptOutSource:
                "",

            ConsentVersion:
                consentVersion,

            LastUpdated:
                now,

            TwilioOptOutStatus:
                "Active"
        });


    console.log(
        "Contact opted in:",
        contactKey
    );


    return result;
}


// =========================================================
// MODULE EXPORTS
// =========================================================

module.exports = {

    getConsent,

    getConsentByMobile,

    upsertConsent,

    optIn,

    optOut

};
