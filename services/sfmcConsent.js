const { getAccessToken } = require("./sfmcAuth");

function getRestBaseUrl() {

    const baseUrl = process.env.SFMC_REST_BASE_URI;

    if (!baseUrl) {
        throw new Error("SFMC_REST_BASE_URI is not configured");
    }

    return baseUrl.endsWith("/")
        ? baseUrl
        : `${baseUrl}/`;
}

function requireEnv(name) {

    if (!process.env[name]) {
        throw new Error(`${name} is not configured`);
    }

    return process.env[name];
}

async function sfmcRequest(method, url, body = null) {

    const token = await getAccessToken();

    const options = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
        }
    };

    if (body !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    const responseText = await response.text();

    let responseData = {};

    try {
        responseData =
            responseText
                ? JSON.parse(responseText)
                : {};
    } catch {
        responseData = {
            raw: responseText
        };
    }

    if (!response.ok) {

        throw new Error(
            `SFMC API ${response.status}: ${JSON.stringify(responseData)}`
        );
    }

    return responseData;
}


/**
 * Get consent record by ContactKey.
 */
async function getConsent(contactKey) {

    if (!contactKey) {
        throw new Error("ContactKey is required for consent lookup");
    }

    const deKey =
        requireEnv("SFMC_CONSENT_DE_KEY");

    const encodedDEKey =
        encodeURIComponent(deKey);

    const escapedContactKey =
        String(contactKey)
            .replace(/'/g, "''");

    const filter =
        `ContactKey eq '${escapedContactKey}'`;

    const url =
        `${getRestBaseUrl()}data/v1/customobjectdata/key/${encodedDEKey}/rowset` +
        `?$filter=${encodeURIComponent(filter)}`;

    const result =
        await sfmcRequest("GET", url);

    if (
        !result ||
        !Array.isArray(result.items) ||
        result.items.length === 0
    ) {
        return null;
    }

    const item = result.items[0];

    return item.values || item;
}


/**
 * Create/update consent record.
 */
async function upsertConsent(values) {

    const deKey =
        requireEnv("SFMC_CONSENT_DE_KEY");

    const url =
        `${getRestBaseUrl()}hub/v1/dataevents/key/` +
        `${encodeURIComponent(deKey)}/rowset`;

    const payload = [
        {
            keys: {
                ContactKey: String(values.ContactKey)
            },
            values: {
                ContactKey: String(values.ContactKey),
                MobileNumber: values.MobileNumber || "",
                SMSOptIn: Boolean(values.SMSOptIn),
                OptInDate: values.OptInDate || null,
                OptOutDate: values.OptOutDate || null,
                OptInSource: values.OptInSource || "",
                OptOutSource: values.OptOutSource || "",
                ConsentVersion: values.ConsentVersion || "",
                LastUpdated:
                    values.LastUpdated ||
                    new Date().toISOString(),
                TwilioOptOutStatus:
                    values.TwilioOptOutStatus || ""
            }
        }
    ];

    return sfmcRequest("POST", url, payload);
}


/**
 * Mark contact as opted out.
 */
async function optOut({
    contactKey,
    mobileNumber,
    source = "Twilio",
    consentVersion = "v1"
}) {

    if (!contactKey) {
        throw new Error("ContactKey is required for opt-out");
    }

    const existing =
        await getConsent(contactKey);

    const now =
        new Date().toISOString();

    return upsertConsent({

        ContactKey: contactKey,

        MobileNumber:
            mobileNumber ||
            existing?.MobileNumber ||
            "",

        SMSOptIn: false,

        OptInDate:
            existing?.OptInDate ||
            null,

        OptOutDate: now,

        OptInSource:
            existing?.OptInSource ||
            "",

        OptOutSource: source,

        ConsentVersion:
            consentVersion,

        LastUpdated: now,

        TwilioOptOutStatus: "OptedOut"
    });
}


/**
 * Mark contact as opted in.
 */
async function optIn({
    contactKey,
    mobileNumber,
    source = "Preference Center",
    consentVersion = "v1"
}) {

    if (!contactKey) {
        throw new Error("ContactKey is required for opt-in");
    }

    const existing =
        await getConsent(contactKey);

    const now =
        new Date().toISOString();

    return upsertConsent({

        ContactKey: contactKey,

        MobileNumber:
            mobileNumber ||
            existing?.MobileNumber ||
            "",

        SMSOptIn: true,

        OptInDate: now,

        OptOutDate: null,

        OptInSource: source,

        OptOutSource: "",

        ConsentVersion: consentVersion,

        LastUpdated: now,

        TwilioOptOutStatus: "Active"
    });
}


module.exports = {
    getConsent,
    upsertConsent,
    optIn,
    optOut
};