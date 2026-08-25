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
// REQUIRED ENVIRONMENT VARIABLE
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
// BOOLEAN CONVERSION
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
            .toLowerCase() === "true" ||
        String(value)
            .trim() === "1" ||
        String(value)
            .trim()
            .toLowerCase() === "yes"
    );
}


// =========================================================
// NORMALIZE MOBILE NUMBER
// =========================================================
//
// Twilio:
//
// +916377783635
//
// SFMC:
//
// 916377783635
//
// =========================================================

function normalizeMobileNumber(
    mobileNumber
) {

    if (
        mobileNumber === undefined ||
        mobileNumber === null
    ) {

        return "";
    }

    return String(mobileNumber)
        .replace(/\D/g, "");
}


// =========================================================
// GENERIC SFMC REQUEST
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

    }

    catch {

        responseData = {

            raw:
                responseText

        };
    }


    if (!response.ok) {

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
// NORMALIZE CONSENT RESPONSE
// =========================================================
//
// SFMC may return field names with different casing:
//
// smsoptin
// SMSOptIn
//
// mobilenumber
// MobileNumber
//
// This function makes our Node.js code consistent.
//
// =========================================================

function normalizeConsentRecord(
    record
) {

    if (!record) {

        return null;
    }


    const getValue =
        (
            camelCaseName,
            pascalCaseName,
            lowerCaseName
        ) => {

            if (
                record[
                    camelCaseName
                ] !== undefined
            ) {

                return record[
                    camelCaseName
                ];
            }

            if (
                record[
                    pascalCaseName
                ] !== undefined
            ) {

                return record[
                    pascalCaseName
                ];
            }

            if (
                record[
                    lowerCaseName
                ] !== undefined
            ) {

                return record[
                    lowerCaseName
                ];
            }

            return "";
        };


    return {

        ContactKey:
            getValue(
                "contactKey",
                "ContactKey",
                "contactkey"
            ) || "",


        MobileNumber:
            getValue(
                "mobileNumber",
                "MobileNumber",
                "mobilenumber"
            ) || "",


        SMSOptIn:
            toBoolean(
                getValue(
                    "smsOptIn",
                    "SMSOptIn",
                    "smsoptin"
                )
            ),


        OptInDate:
            getValue(
                "optInDate",
                "OptInDate",
                "optindate"
            ) || "",


        OptOutDate:
            getValue(
                "optOutDate",
                "OptOutDate",
                "optoutdate"
            ) || "",


        OptInSource:
            getValue(
                "optInSource",
                "OptInSource",
                "optinsource"
            ) || "",


        OptOutSource:
            getValue(
                "optOutSource",
                "OptOutSource",
                "optoutsource"
            ) || "",


        ConsentVersion:
            getValue(
                "consentVersion",
                "ConsentVersion",
                "consentversion"
            ) || "",


        LastUpdated:
            getValue(
                "lastUpdated",
                "LastUpdated",
                "lastupdated"
            ) || "",


        TwilioOptOutStatus:
            getValue(
                "twilioOptOutStatus",
                "TwilioOptOutStatus",
                "twiliooptoutstatus"
            ) || ""

    };
}


// =========================================================
// GET CONSENT BY CONTACT KEY
// =========================================================
//
// Used by Journey Builder.
//
// ContactKey = Salesforce Contact/Lead ID.
//
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
        "SFMC ContactKey consent lookup:",
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

        return null;
    }


    const item =
        result.items[0];


    return normalizeConsentRecord(
        item.values || item
    );
}


// =========================================================
// GET CONSENT BY MOBILE NUMBER
// =========================================================
//
// This is the main function used by Twilio.
//
// Twilio:
// +916377783635
//
// SFMC:
// 916377783635
//
// =========================================================

async function getConsentByMobile(
    mobileNumber
) {

    const cleanNumber =
        normalizeMobileNumber(
            mobileNumber
        );


    if (!cleanNumber) {

        throw new Error(
            "MobileNumber is required for consent lookup"
        );
    }


    const deKey =
        requireEnv(
            "SFMC_CONSENT_DE_KEY"
        );


    const escapedMobileNumber =
        cleanNumber.replace(
            /'/g,
            "''"
        );


    const filter =
        `MobileNumber eq '${escapedMobileNumber}'`;


    const url =
        `${getRestBaseUrl()}` +
        `data/v1/customobjectdata/key/` +
        `${encodeURIComponent(
            deKey
        )}` +
        `/rowset` +
        `?$filter=` +
        `${encodeURIComponent(
            filter
        )}`;


    console.log(
        "================================================"
    );

    console.log(
        "SFMC MOBILE CONSENT LOOKUP"
    );

    console.log(
        "Original:",
        mobileNumber
    );

    console.log(
        "SFMC MobileNumber:",
        cleanNumber
    );

    console.log(
        "================================================"
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
            "No consent record found for:",
            cleanNumber
        );

        return null;
    }


    const item =
        result.items[0];


    const record =
        normalizeConsentRecord(
            item.values || item
        );


    console.log(
        "Consent record found:",
        JSON.stringify(
            record,
            null,
            2
        )
    );


    return record;
}


// =========================================================
// UPSERT CONSENT BY MOBILE NUMBER
// =========================================================
//
// IMPORTANT:
//
// MobileNumber must be configured as a Primary Key
// in the SFMC Consent DE.
//
// =========================================================

async function upsertConsent(
    values
) {

    const deKey =
        requireEnv(
            "SFMC_CONSENT_DE_KEY"
        );


    const mobileNumber =
        normalizeMobileNumber(
            values.MobileNumber
        );


    if (!mobileNumber) {

        throw new Error(
            "MobileNumber is required for consent upsert"
        );
    }


    const url =
        `${getRestBaseUrl()}` +
        `hub/v1/dataevents/key/` +
        `${encodeURIComponent(
            deKey
        )}` +
        `/rowset`;


    const payload = [

        {

            keys: {

                MobileNumber:
                    mobileNumber

            },


            values: {

                MobileNumber:
                    mobileNumber,


                ContactKey:
                    values.ContactKey ||
                    "",


                SMSOptIn:
                    toBoolean(
                        values.SMSOptIn
                    ),


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
                    new Date().toISOString(),


                TwilioOptOutStatus:
                    values.TwilioOptOutStatus ||
                    ""

            }

        }

    ];


    console.log(
        "================================================"
    );

    console.log(
        "SFMC CONSENT UPSERT"
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


    return sfmcRequest(
        "POST",
        url,
        payload
    );
}


// =========================================================
// OPT-OUT
// =========================================================
//
// IMPORTANT:
//
// MobileNumber is the ONLY required identifier.
//
// ContactKey is optional and is preserved if available.
//
// =========================================================

async function optOut({

    contactKey = "",

    mobileNumber,

    source = "Twilio",

    consentVersion = "v1"

}) {

    const cleanNumber =
        normalizeMobileNumber(
            mobileNumber
        );


    if (!cleanNumber) {

        throw new Error(
            "MobileNumber is required for opt-out"
        );
    }


    // =====================================================
    // FIND EXISTING RECORD BY MOBILE
    // =====================================================

    const existing =
        await getConsentByMobile(
            cleanNumber
        );


    if (!existing) {

        throw new Error(
            `No consent record found for MobileNumber ${cleanNumber}`
        );
    }


    const now =
        new Date().toISOString();


    // =====================================================
    // PRESERVE EXISTING CONTACT KEY
    // =====================================================

    const existingContactKey =
        existing.ContactKey ||
        "";


    const finalContactKey =
        contactKey ||
        existingContactKey ||
        "";


    // =====================================================
    // UPDATE CONSENT
    // =====================================================

    return upsertConsent({

        ContactKey:
            finalContactKey,

        MobileNumber:
            cleanNumber,

        SMSOptIn:
            false,

        OptInDate:
            existing.OptInDate ||
            null,

        OptOutDate:
            now,

        OptInSource:
            existing.OptInSource ||
            "",

        OptOutSource:
            source,

        ConsentVersion:
            existing.ConsentVersion ||
            consentVersion,

        LastUpdated:
            now,

        TwilioOptOutStatus:
            "OptedOut"

    });
}


// =========================================================
// OPT-IN
// =========================================================
//
// MobileNumber is the primary operational identifier.
//
// ContactKey is optional. If supplied, it is stored.
// Otherwise existing ContactKey is preserved.
//
// =========================================================

async function optIn({

    contactKey = "",

    mobileNumber,

    source = "Preference Center",

    consentVersion = "v1"

}) {

    const cleanNumber =
        normalizeMobileNumber(
            mobileNumber
        );


    if (!cleanNumber) {

        throw new Error(
            "MobileNumber is required for opt-in"
        );
    }


    // =====================================================
    // FIND EXISTING RECORD
    // =====================================================

    const existing =
        await getConsentByMobile(
            cleanNumber
        );


    const now =
        new Date().toISOString();


    // =====================================================
    // PRESERVE EXISTING CONTACT KEY
    // =====================================================

    const existingContactKey =
        existing?.ContactKey ||
        "";


    const finalContactKey =
        contactKey ||
        existingContactKey ||
        "";


    // =====================================================
    // UPDATE CONSENT
    // =====================================================

    return upsertConsent({

        ContactKey:
            finalContactKey,

        MobileNumber:
            cleanNumber,

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
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

    getConsent,

    getConsentByMobile,

    upsertConsent,

    optIn,

    optOut

};
