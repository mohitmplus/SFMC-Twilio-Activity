require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");
const https = require("https");

const {
    getConsentByMobile,
    optIn,
    optOut
} = require("./services/sfmcConsent");

const {
    sendSMS
} = require("./services/twilioService");


// =========================================================
// EXPRESS
// =========================================================

const app = express();

app.set(
    "trust proxy",
    true
);


// =========================================================
// CONFIG
// =========================================================

const PORT =
    process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET;

const PUBLIC_BASE_URL =
    process.env.WEBHOOK_API_URL ||
    process.env.WEBHOOK_BASE_URL ||
    `http://localhost:${PORT}`;

const WEBHOOK_API_KEY =
    process.env.WEBHOOK_API_KEY;


// =========================================================
// REQUIRED ENVIRONMENT VARIABLES
// =========================================================

const requiredEnvironmentVariables = [

    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",

    "JWT_SECRET",

    "SFMC_CLIENT_ID",
    "SFMC_CLIENT_SECRET",
    "SFMC_AUTH_BASE_URI",
    "SFMC_REST_BASE_URI",

    "SFMC_CONSENT_DE_KEY",
    "SFMC_TRANSACTION_DE_KEY"

];


for (
    const variable of
    requiredEnvironmentVariables
) {

    if (
        !process.env[variable]
    ) {

        console.warn(
            `WARNING: ${variable} is not configured`
        );
    }
}


// =========================================================
// STATIC
// =========================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =========================================================
// JSON
// =========================================================

app.use(
    express.json({
        limit: "1mb"
    })
);


// =========================================================
// URL ENCODED
// =========================================================

app.use(
    express.urlencoded({
        extended: false
    })
);


// =========================================================
// CORS
// =========================================================

app.use(
    function (
        req,
        res,
        next
    ) {

        res.header(
            "Access-Control-Allow-Origin",
            "*"
        );

        res.header(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key"
        );

        res.header(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,OPTIONS"
        );


        if (
            req.method ===
            "OPTIONS"
        ) {

            return res
                .sendStatus(
                    204
                );
        }


        next();
    }
);


// =========================================================
// HEALTH
// =========================================================

app.get(
    "/health",
    (req, res) => {

        return res
            .status(200)
            .json({

                status:
                    "ok",

                service:
                    "SFMC Twilio Custom Activity",

                timestamp:
                    new Date().toISOString()

            });
    }
);


// =========================================================
// HOME
// =========================================================

app.get(
    "/",
    (req, res) => {

        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);


// =========================================================
// SAVE
// =========================================================

app.post(
    "/save",
    (req, res) => {

        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY BUILDER SAVE REQUEST"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        console.log(
            "================================================"
        );


        return res
            .status(200)
            .json({});
    }
);


// =========================================================
// PUBLISH
// =========================================================

app.post(
    "/publish",
    (req, res) => {

        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY BUILDER PUBLISH REQUEST"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        console.log(
            "================================================"
        );


        return res
            .status(200)
            .json({});
    }
);


// =========================================================
// VALIDATE
// =========================================================

app.post(
    "/validate",
    (req, res) => {

        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY BUILDER VALIDATE REQUEST"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        console.log(
            "================================================"
        );


        return res
            .status(200)
            .json({});
    }
);


// =========================================================
// PHONE NORMALIZATION
// =========================================================

function normalizePhone(
    phone
) {

    if (
        phone === undefined ||
        phone === null
    ) {

        return null;
    }


    let normalized =
        String(phone)
            .trim();


    if (!normalized) {

        return null;
    }


    normalized =
        normalized.replace(
            /[\s\-().]/g,
            ""
        );


    if (
        !normalized.startsWith("+")
    ) {

        normalized =
            "+" +
            normalized;
    }


    return normalized;
}


// =========================================================
// CLEAN MOBILE
// =========================================================

function cleanMobileForSFMC(
    phone
) {

    if (
        phone === undefined ||
        phone === null
    ) {

        return null;
    }


    const cleanNumber =
        String(phone)
            .replace(
                /\D/g,
                ""
            );


    if (!cleanNumber) {

        return null;
    }


    return cleanNumber;
}


// =========================================================
// TRANSACTION ID
// =========================================================

function generateTransactionId() {

    return crypto.randomUUID();
}


// =========================================================
// SFMC AUTH
// =========================================================

async function getSFMCAccessToken() {

    const {
        getAccessToken
    } = require(
        "./services/sfmcAuth"
    );


    return getAccessToken();
}


// =========================================================
// REST BASE URL
// =========================================================

function getSFMCRESTBase() {

    const base =
        process.env.SFMC_REST_BASE_URI;


    if (!base) {

        throw new Error(
            "SFMC_REST_BASE_URI is not configured"
        );
    }


    return base.replace(
        /\/+$/,
        ""
    );
}


// =========================================================
// SOAP BASE URL
// =========================================================
//
// If SFMC_SOAP_BASE_URI exists, use it.
//
// Otherwise derive it from REST:
//
// abc.rest.marketingcloudapis.com
//
// becomes:
//
// abc.soap.marketingcloudapis.com
//
// =========================================================

function getSFMCSOAPBase() {

    if (
        process.env.SFMC_SOAP_BASE_URI
    ) {

        return process.env
            .SFMC_SOAP_BASE_URI
            .replace(
                /\/+$/,
                ""
            );
    }


    const restBase =
        getSFMCRESTBase();


    return restBase.replace(
        ".rest.marketingcloudapis.com",
        ".soap.marketingcloudapis.com"
    );
}


// =========================================================
// HTTP REQUEST HELPER
// =========================================================

function httpsRequest({

    url,

    method = "GET",

    headers = {},

    body = null

}) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const parsed =
                new URL(
                    url
                );


            const options = {

                hostname:
                    parsed.hostname,

                port:
                    parsed.port ||
                    443,

                path:
                    parsed.pathname +
                    parsed.search,

                method,

                headers

            };


            const request =
                https.request(
                    options,
                    response => {

                        let responseBody =
                            "";


                        response.on(
                            "data",
                            chunk => {

                                responseBody +=
                                    chunk.toString();

                            }
                        );


                        response.on(
                            "end",
                            () => {

                                resolve({

                                    statusCode:
                                        response.statusCode,

                                    headers:
                                        response.headers,

                                    body:
                                        responseBody

                                });

                            }
                        );

                    }
                );


            request.on(
                "error",
                reject
            );


            if (
                body !== null
            ) {

                request.write(
                    body
                );
            }


            request.end();

        }
    );
}


// =========================================================
// GET EVENT DEFINITION
// =========================================================

async function getEventDefinition(
    eventDefinitionKey
) {

    if (
        !eventDefinitionKey
    ) {

        throw new Error(
            "eventDefinitionKey is required"
        );
    }


    const token =
        await getSFMCAccessToken();


    const base =
        getSFMCRESTBase();


    const url =
        `${base}` +
        `/interaction/v1/eventDefinitions/key:` +
        encodeURIComponent(
            eventDefinitionKey
        );


    console.log(
        "EVENT DEFINITION URL:",
        url
    );


    const response =
        await httpsRequest({

            url,

            method:
                "GET",

            headers: {

                Authorization:
                    `Bearer ${token}`,

                Accept:
                    "application/json"

            }

        });


    console.log(
        "EVENT DEFINITION STATUS:",
        response.statusCode
    );


    if (
        response.statusCode < 200 ||
        response.statusCode >= 300
    ) {

        throw new Error(

            `Unable to retrieve Event Definition. ` +
            `HTTP ${response.statusCode}. ` +
            `${response.body}`

        );
    }


    let data;


    try {

        data =
            JSON.parse(
                response.body
            );

    }

    catch (error) {

        throw new Error(
            "Event Definition response was not valid JSON"
        );
    }


    return data;
}


// =========================================================
// XML ESCAPE
// =========================================================

function xmlEscape(
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
            "&apos;"
        );
}


// =========================================================
// RETRIEVE DE FIELDS THROUGH SOAP
// =========================================================
//
// DataExtensionField supports Retrieve.
// We filter by DataExtension.CustomerKey.
//
// Salesforce documents DataExtensionField as a
// retrievable SOAP object.
//
// =========================================================

async function getDataExtensionFields(
    dataExtensionCustomerKey
) {

    if (
        !dataExtensionCustomerKey
    ) {

        throw new Error(
            "Data Extension CustomerKey is required"
        );
    }


    const token =
        await getSFMCAccessToken();


    const soapBase =
        getSFMCSOAPBase();


    const soapUrl =
        `${soapBase}/Service.asmx`;


    const customerKey =
        xmlEscape(
            dataExtensionCustomerKey
        );


    const soapEnvelope =

`<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:a="http://schemas.microsoft.com/soap/envelope/">
    <s:Header>
        <fueloauth xmlns="http://exacttarget.com">
            ${xmlEscape(token)}
        </fueloauth>
    </s:Header>
    <s:Body>
        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">
            <RetrieveRequest>
                <ObjectType>DataExtensionField</ObjectType>

                <Properties>Name</Properties>
                <Properties>FieldType</Properties>
                <Properties>MaxLength</Properties>
                <Properties>IsRequired</Properties>
                <Properties>Ordinal</Properties>

                <Filter xsi:type="SimpleFilterPart"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

                    <Property>DataExtension.CustomerKey</Property>

                    <SimpleOperator>equals</SimpleOperator>

                    <Value>${customerKey}</Value>

                </Filter>

            </RetrieveRequest>
        </RetrieveRequestMsg>
    </s:Body>
</s:Envelope>`;


    console.log(
        "SOAP FIELD REQUEST FOR DE:",
        dataExtensionCustomerKey
    );


    const response =
        await httpsRequest({

            url:
                soapUrl,

            method:
                "POST",

            headers: {

                "Content-Type":
                    "text/xml; charset=utf-8",

                SOAPAction:
                    `"Retrieve"`,

                Authorization:
                    `Bearer ${token}`,

                Accept:
                    "text/xml"

            },

            body:
                soapEnvelope

        });


    console.log(
        "SOAP FIELD STATUS:",
        response.statusCode
    );


    if (
        response.statusCode < 200 ||
        response.statusCode >= 300
    ) {

        console.error(
            "SOAP FIELD RESPONSE:",
            response.body
        );


        throw new Error(

            `SFMC SOAP field retrieval failed. ` +
            `HTTP ${response.statusCode}. ` +
            `${response.body}`

        );
    }


    const fields =
        parseDataExtensionFields(
            response.body
        );


    if (
        !fields.length
    ) {

        console.error(
            "SOAP RESPONSE:",
            response.body
        );


        throw new Error(
            "SFMC returned zero Data Extension fields."
        );
    }


    return fields;
}


// =========================================================
// PARSE DATA EXTENSION FIELDS
// =========================================================

function parseDataExtensionFields(
    xml
) {

    const fields = [];

    /*
     * The SOAP response contains multiple
     * DataExtensionField elements.
     */

    const fieldMatches =
        xml.match(
            /<[^:>]*:?DataExtensionField\b[\s\S]*?<\/[^:>]*:?DataExtensionField>/gi
        );


    if (
        !fieldMatches
    ) {

        return fields;
    }


    fieldMatches.forEach(
        function (fieldXml) {

            const name =
                extractXmlValue(
                    fieldXml,
                    "Name"
                );


            if (!name) {

                return;
            }


            const fieldType =
                extractXmlValue(
                    fieldXml,
                    "FieldType"
                );


            const maxLength =
                extractXmlValue(
                    fieldXml,
                    "MaxLength"
                );


            const isRequired =
                extractXmlValue(
                    fieldXml,
                    "IsRequired"
                );


            const ordinal =
                extractXmlValue(
                    fieldXml,
                    "Ordinal"
                );


            fields.push({

                name,

                type:
                    fieldType || "",

                maxLength:
                    maxLength || "",

                isRequired:
                    isRequired || "",

                ordinal:
                    ordinal || ""

            });

        }
    );


    fields.sort(
        function (a, b) {

            return (
                Number(
                    a.ordinal || 999999
                ) -
                Number(
                    b.ordinal || 999999
                )
            );

        }
    );


    return fields;
}


// =========================================================
// EXTRACT XML VALUE
// =========================================================

function extractXmlValue(
    xml,
    tagName
) {

    const regex =
        new RegExp(

            `<(?:[A-Za-z0-9_]+:)?${tagName}>` +
            `([\\s\\S]*?)` +
            `<\\/(?:[A-Za-z0-9_]+:)?${tagName}>`,

            "i"

        );


    const match =
        xml.match(
            regex
        );


    if (
        !match
    ) {

        return "";
    }


    return decodeXmlEntities(
        match[1].trim()
    );
}


// =========================================================
// DECODE XML ENTITIES
// =========================================================

function decodeXmlEntities(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /&amp;/g,
            "&"
        )
        .replace(
            /&lt;/g,
            "<"
        )
        .replace(
            /&gt;/g,
            ">"
        )
        .replace(
            /&quot;/g,
            '"'
        )
        .replace(
            /&apos;/g,
            "'"
        );
}


// =========================================================
// EVENT FIELDS ENDPOINT
// =========================================================

app.get(
    "/event-fields",
    async (req, res) => {

        try {

            const eventDefinitionKey =
                req.query
                    .eventDefinitionKey;


            if (
                !eventDefinitionKey
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "eventDefinitionKey is required"

                    });
            }


            console.log(
                "================================================"
            );

            console.log(
                "EVENT FIELDS REQUEST"
            );

            console.log(
                "Event Definition Key:",
                eventDefinitionKey
            );

            console.log(
                "================================================"
            );


            /*
             * Step 1:
             *
             * Get Event Definition.
             */

            const eventDefinition =
                await getEventDefinition(
                    eventDefinitionKey
                );


            console.log(
                "Event Definition:",
                JSON.stringify(
                    eventDefinition,
                    null,
                    2
                )
            );


            /*
             * Step 2:
             *
             * Find Data Extension ID.
             */

            const dataExtensionId =
                eventDefinition.dataExtensionId ||
                eventDefinition.dataExtensionID ||
                eventDefinition
                    ?.metaData
                    ?.dataExtensionId ||
                "";


            /*
             * Event Definition may also expose
             * dataExtensionName.
             */

            const dataExtensionName =
                eventDefinition.dataExtensionName ||
                eventDefinition
                    ?.metaData
                    ?.dataExtensionName ||
                "";


            if (
                !dataExtensionId &&
                !dataExtensionName
            ) {

                throw new Error(

                    "Event Definition does not contain dataExtensionId or dataExtensionName."

                );
            }


            /*
             * Step 3:
             *
             * Retrieve Data Extension metadata.
             *
             * We use the REST endpoint to retrieve
             * the Data Extension by ID.
             */

            let deCustomerKey = "";


            if (
                dataExtensionId
            ) {

                const token =
                    await getSFMCAccessToken();


                const base =
                    getSFMCRESTBase();


                const deUrl =
                    `${base}` +
                    `/data/v1/customobjects/` +
                    encodeURIComponent(
                        dataExtensionId
                    );


                /*
                 * Some accounts do not expose
                 * this REST metadata endpoint.
                 *
                 * Therefore we first try it.
                 */

                console.log(
                    "Trying Data Extension REST metadata:",
                    deUrl
                );


                const deResponse =
                    await httpsRequest({

                        url:
                            deUrl,

                        method:
                            "GET",

                        headers: {

                            Authorization:
                                `Bearer ${token}`,

                            Accept:
                                "application/json"

                        }

                    });


                console.log(
                    "DE metadata status:",
                    deResponse.statusCode
                );


                if (
                    deResponse.statusCode >= 200 &&
                    deResponse.statusCode < 300
                ) {

                    try {

                        const deData =
                            JSON.parse(
                                deResponse.body
                            );


                        deCustomerKey =
                            deData
                                .customerKey ||
                            deData
                                .CustomerKey ||
                            deData
                                .key ||
                            "";

                    }

                    catch (
                        parseError
                    ) {

                        console.warn(
                            "Unable to parse DE metadata response."
                        );

                    }
                }

            }


            /*
             * If REST metadata did not give CustomerKey,
             * try the Event Definition's Data Extension
             * name as a fallback.
             *
             * In many Journey Event definitions,
             * the event's dataExtensionName is available.
             */

            if (
                !deCustomerKey &&
                dataExtensionName
            ) {

                console.log(
                    "Using Data Extension name as SOAP CustomerKey fallback:",
                    dataExtensionName
                );


                deCustomerKey =
                    dataExtensionName;
            }


            /*
             * IMPORTANT:
             *
             * If dataExtensionId is actually the
             * external key in your account, use it.
             */

            if (
                !deCustomerKey &&
                dataExtensionId
            ) {

                deCustomerKey =
                    dataExtensionId;
            }


            console.log(
                "Data Extension CustomerKey selected:",
                deCustomerKey
            );


            /*
             * Step 4:
             *
             * Get actual Data Extension fields.
             */

            const fields =
                await getDataExtensionFields(
                    deCustomerKey
                );


            console.log(
                "Retrieved fields:",
                JSON.stringify(
                    fields,
                    null,
                    2
                )
            );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    eventDefinitionKey,

                    eventDefinitionId:
                        eventDefinition.id ||
                        "",

                    dataExtensionId,

                    dataExtensionName,

                    dataExtensionCustomerKey:
                        deCustomerKey,

                    fields

                });

        }

        catch (error) {

            console.error(
                "================================================"
            );

            console.error(
                "EVENT FIELDS ERROR"
            );

            console.error(
                error
            );

            console.error(
                "================================================"
            );


            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });
        }
    }
);


// =========================================================
// TRANSACTION LOG
// =========================================================

async function logTransaction({

    transactionId,

    contactKey = "",

    mobileNumber = "",

    message = "",

    status = "",

    reason = "",

    twilioMessageSid = "",

    errorCode = "",

    errorMessage = "",

    consentStatus = ""

}) {

    console.log(
        "================================================"
    );

    console.log(
        "SFMC TRANSACTION LOG START"
    );

    console.log(
        "TransactionId:",
        transactionId
    );

    console.log(
        "================================================"
    );


    try {

        const restBase =
            process.env
                .SFMC_REST_BASE_URI;


        const deKey =
            process.env
                .SFMC_TRANSACTION_DE_KEY;


        if (!restBase) {

            throw new Error(
                "SFMC_REST_BASE_URI is not configured"
            );
        }


        if (!deKey) {

            throw new Error(
                "SFMC_TRANSACTION_DE_KEY is not configured"
            );
        }


        const token =
            await getSFMCAccessToken();


        const cleanRestBase =
            restBase.replace(
                /\/+$/,
                ""
            );


        const url =
            `${cleanRestBase}` +
            `/hub/v1/dataevents/key/` +
            encodeURIComponent(
                deKey
            ) +
            `/rowset`;


        const createdDate =
            new Date().toISOString();


        const payload = [

            {

                keys: {

                    TransactionId:
                        transactionId

                },

                values: {

                    TransactionId:
                        transactionId,

                    ContactKey:
                        contactKey || "",

                    MobileNumber:
                        mobileNumber || "",

                    Message:
                        String(
                            message || ""
                        ),

                    Status:
                        status || "",

                    Reason:
                        reason || "",

                    TwilioMessageSid:
                        twilioMessageSid || "",

                    ErrorCode:
                        errorCode || "",

                    ErrorMessage:
                        String(
                            errorMessage || ""
                        ),

                    ConsentStatus:
                        consentStatus || "",

                    CreatedDate:
                        createdDate

                }

            }

        ];


        console.log(
            "Transaction Log URL:",
            url
        );


        console.log(
            "Transaction Log Payload:",
            JSON.stringify(
                payload,
                null,
                2
            )
        );


        const response =
            await fetch(
                url,
                {

                    method:
                        "POST",

                    headers: {

                        Authorization:
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        const responseText =
            await response.text();


        console.log(
            "SFMC TRANSACTION LOG HTTP STATUS:",
            response.status
        );


        console.log(
            "SFMC TRANSACTION LOG RESPONSE:",
            responseText
        );


        if (
            !response.ok
        ) {

            throw new Error(

                `SFMC Transaction Log API failed. ` +
                `HTTP ${response.status}. ` +
                `Response: ${responseText}`

            );
        }


        console.log(
            "SFMC TRANSACTION LOG SUCCESS"
        );


        return {

            success:
                true,

            transactionId,

            statusCode:
                response.status,

            response:
                responseText

        };

    }

    catch (error) {

        console.error(
            "SFMC TRANSACTION LOG FAILED"
        );


        console.error(
            "TransactionId:",
            transactionId
        );


        console.error(
            "Error:",
            error.message
        );


        return {

            success:
                false,

            transactionId,

            error:
                error.message

        };
    }
}


// =========================================================
// JWT VERIFY
// =========================================================

function verifyJourneyJWT(
    req
) {

    if (!JWT_SECRET) {

        throw new Error(
            "JWT_SECRET is not configured"
        );
    }


    let token;


    if (
        Buffer.isBuffer(
            req.body
        )
    ) {

        token =
            req.body.toString(
                "utf8"
            );

    }

    else if (
        typeof req.body ===
        "string"
    ) {

        token =
            req.body;

    }

    else {

        throw new Error(
            "JWT request body is not valid"
        );
    }


    token =
        token.trim();


    if (!token) {

        throw new Error(
            "Empty Journey Builder JWT"
        );
    }


    return jwt.verify(
        token,
        JWT_SECRET
    );
}


// =========================================================
// PERSONALIZATION
// =========================================================
//
// Message:
//
// Hello {{FirstName}}, your order {{OrderNumber}}
//
// Runtime inArguments:
//
// __variable__FirstName = "Mohit"
// __variable__OrderNumber = "12345"
//
// Result:
//
// Hello Mohit, your order 12345
//
// =========================================================

function personalizeMessage(
    template,
    inArgs
) {

    let result =
        String(
            template || ""
        );


    /*
     * Find all variables in the template.
     *
     * Example:
     *
     * {{FirstName}}
     */

    const tokenRegex =
        /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;


    result =
        result.replace(
            tokenRegex,
            function (
                fullMatch,
                variableName
            ) {

                const argumentKey =
                    "__variable__" +
                    variableName;


                if (
                    Object.prototype.hasOwnProperty.call(
                        inArgs,
                        argumentKey
                    )
                ) {

                    const value =
                        inArgs[
                            argumentKey
                        ];


                    if (
                        value ===
                        undefined ||
                        value ===
                        null
                    ) {

                        return "";

                    }


                    return String(
                        value
                    );
                }


                /*
                 * Leave unknown variables
                 * unchanged so the problem
                 * can be identified.
                 */

                return fullMatch;

            }
        );


    return result;
}


// =========================================================
// EXECUTE
// =========================================================

app.post(

    "/execute",

    express.raw({
        type: "application/jwt"
    }),

    async (
        req,
        res
    ) => {

        const transactionId =
            generateTransactionId();


        let contactKey =
            "";

        let phone =
            "";

        let message =
            "";


        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY BUILDER EXECUTE REQUEST RECEIVED"
        );

        console.log(
            "Transaction ID:",
            transactionId
        );

        console.log(
            "Content-Type:",
            req.get(
                "content-type"
            )
        );

        console.log(
            "================================================"
        );


        try {

            /*
             * JWT
             */

            const decoded =
                verifyJourneyJWT(
                    req
                );


            console.log(
                "Journey Builder JWT verified successfully"
            );


            console.log(
                "Decoded JWT keys:",
                Object.keys(
                    decoded || {}
                )
            );


            console.log(
                "InArguments:",
                JSON.stringify(
                    decoded.inArguments,
                    null,
                    2
                )
            );


            /*
             * IN ARGUMENTS
             */

            if (
                !decoded.inArguments ||
                !Array.isArray(
                    decoded.inArguments
                ) ||
                decoded.inArguments.length === 0
            ) {

                throw new Error(
                    "No inArguments found in Journey Builder JWT"
                );
            }


            const inArgs =
                Object.assign(
                    {},
                    ...decoded.inArguments
                );


            console.log(
                "Merged InArguments:",
                JSON.stringify(
                    inArgs,
                    null,
                    2
                )
            );


            /*
             * CONTACT KEY
             */

            contactKey =
                inArgs.contactKey ||
                inArgs.ContactKey ||
                inArgs.contactkey ||
                "";


            /*
             * PHONE
             */

            const rawPhone =
                inArgs.phoneNumber ||
                inArgs.PhoneNumber ||
                inArgs.phonenumber ||
                inArgs.mobileNumber ||
                inArgs.MobileNumber ||
                inArgs.mobilenumber ||
                "";


            phone =
                normalizePhone(
                    rawPhone
                );


            /*
             * MESSAGE TEMPLATE
             */

            const messageTemplate =
                inArgs.messageTemplate ||
                inArgs.message ||
                "";


            /*
             * PERSONALIZE
             */

            message =
                personalizeMessage(
                    messageTemplate,
                    inArgs
                );


            console.log(
                "================================================"
            );

            console.log(
                "JOURNEY VALUES"
            );

            console.log(
                "ContactKey:",
                contactKey ||
                "(EMPTY)"
            );

            console.log(
                "Raw Mobile:",
                rawPhone ||
                "(EMPTY)"
            );

            console.log(
                "Normalized Mobile:",
                phone ||
                "(EMPTY)"
            );

            console.log(
                "Message Template:",
                messageTemplate
            );

            console.log(
                "Personalized Message:",
                message
            );

            console.log(
                "================================================"
            );


            /*
             * CONTACT KEY VALIDATION
             */

            if (
                !contactKey
            ) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "SKIPPED",

                    reason:
                        "MISSING_CONTACT_KEY"

                });


                return res
                    .status(200)
                    .json({

                        status:
                            "skipped",

                        reason:
                            "MISSING_CONTACT_KEY",

                        transactionId

                    });
            }


            /*
             * PHONE VALIDATION
             */

            if (
                !phone
            ) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        "",

                    message,

                    status:
                        "SKIPPED",

                    reason:
                        "MISSING_PHONE"

                });


                return res
                    .status(200)
                    .json({

                        status:
                            "skipped",

                        reason:
                            "MISSING_PHONE",

                        transactionId

                    });
            }


            /*
             * MESSAGE VALIDATION
             */

            if (
                !String(
                    message
                ).trim()
            ) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "SKIPPED",

                    reason:
                        "EMPTY_MESSAGE"

                });


                return res
                    .status(200)
                    .json({

                        status:
                            "skipped",

                        reason:
                            "EMPTY_MESSAGE",

                        transactionId

                    });
            }


            /*
             * CONSENT
             */

            const sfmcMobileNumber =
                cleanMobileForSFMC(
                    phone
                );


            console.log(
                "================================================"
            );

            console.log(
                "CONSENT CHECK"
            );

            console.log(
                "Consent lookup key:",
                sfmcMobileNumber
            );

            console.log(
                "================================================"
            );


            const consent =
                await getConsentByMobile(
                    sfmcMobileNumber
                );


            console.log(
                "Consent result:",
                JSON.stringify(
                    consent,
                    null,
                    2
                )
            );


            /*
             * NO CONSENT
             */

            if (
                !consent
            ) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "SKIPPED",

                    reason:
                        "NO_CONSENT_RECORD",

                    consentStatus:
                        "NO_RECORD"

                });


                return res
                    .status(200)
                    .json({

                        status:
                            "skipped",

                        reason:
                            "NO_CONSENT_RECORD",

                        transactionId

                    });
            }


            /*
             * OPT-IN
             */

            const isOptedIn =
                consent.SMSOptIn === true;


            console.log(
                "SMSOptIn:",
                consent.SMSOptIn
            );


            if (
                !isOptedIn
            ) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "SKIPPED",

                    reason:
                        "SMS_OPT_OUT",

                    consentStatus:
                        "OPTED_OUT"

                });


                return res
                    .status(200)
                    .json({

                        status:
                            "skipped",

                        reason:
                            "SMS_OPT_OUT",

                        transactionId

                    });
            }


            /*
             * TWILIO
             */

            console.log(
                "Calling Twilio sendSMS()..."
            );


            const twilioMessage =
                await sendSMS({

                    to:
                        phone,

                    body:
                        String(
                            message
                        )

                });


            console.log(
                "Twilio Message SID:",
                twilioMessage?.sid ||
                "(NO SID)"
            );


            console.log(
                "Twilio Status:",
                twilioMessage?.status ||
                "(UNKNOWN)"
            );


            if (
                !twilioMessage ||
                !twilioMessage.sid
            ) {

                throw new Error(
                    "Twilio did not return a Message SID"
                );
            }


            /*
             * SMS SENT
             */

            console.log(
                "TWILIO SMS ACCEPTED"
            );


            /*
             * TRANSACTION LOG
             */

            const logResult =
                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "SENT",

                    reason:
                        "",

                    twilioMessageSid:
                        twilioMessage.sid,

                    consentStatus:
                        "OPTED_IN"

                });


            if (
                !logResult ||
                logResult.success !== true
            ) {

                console.error(
                    "WARNING: SMS was sent but SFMC transaction logging failed."
                );

            }


            console.log(
                "================================================"
            );

            console.log(
                "SMS TRIGGERED SUCCESSFULLY"
            );

            console.log(
                "Transaction ID:",
                transactionId
            );

            console.log(
                "Twilio SID:",
                twilioMessage.sid
            );

            console.log(
                "SFMC Log:",
                logResult?.success
                    ? "SUCCESS"
                    : "FAILED"
            );

            console.log(
                "================================================"
            );


            return res
                .status(200)
                .json({

                    status:
                        "success",

                    transactionId,

                    twilioMessageSid:
                        twilioMessage.sid,

                    transactionLog:
                        logResult?.success
                            ? "success"
                            : "failed"

                });

        }

        catch (error) {

            console.error(
                "================================================"
            );

            console.error(
                "EXECUTE ERROR"
            );

            console.error(
                "Transaction ID:",
                transactionId
            );

            console.error(
                "Error:",
                error
            );

            console.error(
                "================================================"
            );


            /*
             * Log execution error.
             */

            const logResult =
                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone,

                    message,

                    status:
                        "ERROR",

                    reason:
                        "EXECUTE_ERROR",

                    errorCode:
                        error.code ||
                        "",

                    errorMessage:
                        error.message ||
                        "",

                    consentStatus:
                        ""

                });


            console.log(
                "Error transaction log result:",
                JSON.stringify(
                    logResult,
                    null,
                    2
                )
            );


            return res
                .status(200)
                .json({

                    status:
                        "error",

                    transactionId,

                    reason:
                        "EXECUTE_ERROR",

                    message:
                        error.message

                });
        }

    }
);


// =========================================================
// DEBUG CONSENT
// =========================================================

app.get(
    "/debug/consent",

    async (
        req,
        res
    ) => {

        try {

            const mobileNumber =
                req.query.mobileNumber;


            if (
                !mobileNumber
            ) {

                return res
                    .status(400)
                    .json({

                        found:
                            false,

                        error:
                            "mobileNumber is required"

                    });
            }


            const normalizedPhone =
                normalizePhone(
                    mobileNumber
                );


            const record =
                await getConsentByMobile(
                    cleanMobileForSFMC(
                        normalizedPhone
                    )
                );


            if (
                !record
            ) {

                return res
                    .status(404)
                    .json({

                        found:
                            false,

                        mobileNumber:
                            normalizedPhone,

                        sfmcMobileNumber:
                            cleanMobileForSFMC(
                                normalizedPhone
                            ),

                        message:
                            "No consent record found"

                    });
            }


            return res
                .status(200)
                .json({

                    found:
                        true,

                    mobileNumber:
                        normalizedPhone,

                    sfmcMobileNumber:
                        cleanMobileForSFMC(
                            normalizedPhone
                        ),

                    consent:
                        record

                });

        }

        catch (error) {

            console.error(
                "DEBUG CONSENT ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    found:
                        false,

                    error:
                        error.message

                });
        }
    }
);


// =========================================================
// DEBUG TRANSACTION LOG
// =========================================================

app.get(
    "/debug/transaction-log",

    async (
        req,
        res
    ) => {

        const transactionId =
            generateTransactionId();


        const result =
            await logTransaction({

                transactionId,

                contactKey:
                    "DEBUG_CONTACT",

                mobileNumber:
                    "916377783635",

                message:
                    "SFMC transaction log test",

                status:
                    "TEST",

                reason:
                    "DEBUG_ENDPOINT",

                twilioMessageSid:
                    "DEBUG_SID",

                errorCode:
                    "",

                errorMessage:
                    "",

                consentStatus:
                    "TEST"

            });


        return res
            .status(
                result.success
                    ? 200
                    : 500
            )
            .json({

                transactionId,

                result

            });
    }
);


// =========================================================
// DEBUG EVENT FIELDS
// =========================================================

app.get(
    "/debug/event-fields",

    async (
        req,
        res
    ) => {

        try {

            const eventDefinitionKey =
                req.query
                    .eventDefinitionKey;


            if (
                !eventDefinitionKey
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "eventDefinitionKey is required"

                    });
            }


            const eventDefinition =
                await getEventDefinition(
                    eventDefinitionKey
                );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    eventDefinition

                });

        }

        catch (error) {

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });
        }
    }
);


// =========================================================
// DEBUG PHONE
// =========================================================

app.get(
    "/debug/phone",

    (
        req,
        res
    ) => {

        const input =
            req.query.phone;


        if (
            !input
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "phone query parameter is required"

                });
        }


        const normalized =
            normalizePhone(
                input
            );


        const sfmcNumber =
            cleanMobileForSFMC(
                normalized
            );


        return res
            .status(200)
            .json({

                input,

                twilioFormat:
                    normalized,

                sfmcFormat:
                    sfmcNumber

            });
    }
);


// =========================================================
// TWILIO SIGNATURE
// =========================================================

function verifyTwilioRequest(
    req
) {

    const authToken =
        process.env
            .TWILIO_AUTH_TOKEN;


    if (
        !authToken
    ) {

        throw new Error(
            "TWILIO_AUTH_TOKEN is not configured"
        );
    }


    const signature =
        req.get(
            "X-Twilio-Signature"
        );


    if (
        !signature
    ) {

        console.error(
            "X-Twilio-Signature header missing"
        );

        return false;
    }


    const url =
        `${PUBLIC_BASE_URL}` +
        `${req.originalUrl}`;


    return twilio.validateRequest(

        authToken,

        signature,

        url,

        req.body

    );
}


// =========================================================
// TWILIO INBOUND
// =========================================================

app.post(

    "/twilio/inbound",

    async (
        req,
        res
    ) => {

        try {

            console.log(
                "================================================"
            );

            console.log(
                "TWILIO INBOUND MESSAGE"
            );

            console.log(
                "================================================"
            );


            const valid =
                verifyTwilioRequest(
                    req
                );


            if (
                !valid
            ) {

                console.error(
                    "Invalid Twilio signature"
                );

                return res
                    .status(403)
                    .send(
                        "Forbidden"
                    );
            }


            const from =
                normalizePhone(
                    req.body.From
                );


            const mobileNumber =
                cleanMobileForSFMC(
                    from
                );


            const body =
                String(
                    req.body.Body ||
                    ""
                )
                    .trim()
                    .toUpperCase();


            const messageSid =
                req.body.MessageSid ||
                "";


            console.log(
                "Twilio From:",
                from
            );

            console.log(
                "SFMC MobileNumber:",
                mobileNumber
            );

            console.log(
                "SMS Body:",
                body
            );

            console.log(
                "Message SID:",
                messageSid
            );


            const optOutKeywords = [

                "STOP",
                "UNSUBSCRIBE",
                "CANCEL",
                "END",
                "QUIT"

            ];


            const isOptOut =
                optOutKeywords.includes(
                    body
                );


            if (
                !isOptOut
            ) {

                res.type(
                    "text/xml"
                );


                return res
                    .status(200)
                    .send(

                        "<?xml version=\"1.0\" " +
                        "encoding=\"UTF-8\"?>" +
                        "<Response></Response>"

                    );
            }


            const contact =
                await getConsentByMobile(
                    mobileNumber
                );


            if (
                !contact
            ) {

                await logTransaction({

                    transactionId:
                        messageSid ||
                        generateTransactionId(),

                    contactKey:
                        "",

                    mobileNumber,

                    message:
                        body,

                    status:
                        "SKIPPED",

                    reason:
                        "NO_CONSENT_RECORD",

                    twilioMessageSid:
                        messageSid,

                    consentStatus:
                        "NO_RECORD"

                });


                res.type(
                    "text/xml"
                );


                return res
                    .status(200)
                    .send(

                        "<?xml version=\"1.0\" " +
                        "encoding=\"UTF-8\"?>" +
                        "<Response></Response>"

                    );
            }


            const contactKey =
                contact.ContactKey ||
                "";


            const result =
                await optOut({

                    contactKey,

                    mobileNumber,

                    source:
                        "Twilio",

                    consentVersion:
                        contact.ConsentVersion ||
                        "v1"

                });


            console.log(
                "SFMC OPT-OUT UPDATE SUCCESS"
            );


            console.log(
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );


            await logTransaction({

                transactionId:
                    messageSid ||
                    generateTransactionId(),

                contactKey,

                mobileNumber,

                message:
                    body,

                status:
                    "OPTED_OUT",

                reason:
                    "TWILIO_STOP",

                twilioMessageSid:
                    messageSid,

                consentStatus:
                    "OPTED_OUT"

            });


            res.type(
                "text/xml"
            );


            return res
                .status(200)
                .send(

                    "<?xml version=\"1.0\" " +
                    "encoding=\"UTF-8\"?>" +
                    "<Response></Response>"

                );

        }

        catch (error) {

            console.error(
                "TWILIO INBOUND ERROR:",
                error
            );


            res.type(
                "text/xml"
            );


            return res
                .status(200)
                .send(

                    "<?xml version=\"1.0\" " +
                    "encoding=\"UTF-8\"?>" +
                    "<Response></Response>"

                );
        }
    }
);


// =========================================================
// OPT-IN
// =========================================================

app.post(
    "/consent/optin",

    async (
        req,
        res
    ) => {

        try {

            if (

                WEBHOOK_API_KEY &&

                req.get(
                    "X-API-Key"
                ) !==
                WEBHOOK_API_KEY

            ) {

                return res
                    .status(401)
                    .json({

                        status:
                            "error",

                        reason:
                            "UNAUTHORIZED"

                    });
            }


            const {

                contactKey,

                mobileNumber,

                source,

                consentVersion

            } = req.body;


            if (
                !mobileNumber
            ) {

                return res
                    .status(400)
                    .json({

                        status:
                            "error",

                        reason:
                            "MISSING_MOBILE_NUMBER"

                    });
            }


            const normalizedPhone =
                normalizePhone(
                    mobileNumber
                );


            const sfmcMobileNumber =
                cleanMobileForSFMC(
                    normalizedPhone
                );


            const result =
                await optIn({

                    contactKey:
                        contactKey ||
                        "",

                    mobileNumber:
                        sfmcMobileNumber,

                    source:
                        source ||
                        "Preference Center",

                    consentVersion:
                        consentVersion ||
                        "v1"

                });


            return res
                .status(200)
                .json({

                    status:
                        "success",

                    contactKey:
                        contactKey ||
                        "",

                    mobileNumber:
                        sfmcMobileNumber,

                    result

                });

        }

        catch (error) {

            console.error(
                "OPT-IN ERROR:",
                error
            );


            return res
                .status(500)
                .json({

                    status:
                        "error",

                    reason:
                        "OPT_IN_FAILED",

                    message:
                        error.message

                });
        }
    }
);


// =========================================================
// 404
// =========================================================

app.use(
    (
        req,
        res
    ) => {

        return res
            .status(404)
            .json({

                status:
                    "not_found",

                path:
                    req.originalUrl

            });
    }
);


// =========================================================
// GLOBAL ERROR
// =========================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "GLOBAL ERROR:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );
        }


        return res
            .status(500)
            .json({

                status:
                    "error",

                message:
                    error.message

            });
    }
);


// =========================================================
// START
// =========================================================

app.listen(

    PORT,

    () => {

        console.log(
            "================================================"
        );

        console.log(
            "SFMC TWILIO CUSTOM ACTIVITY"
        );

        console.log(
            "================================================"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Health URL: ${PUBLIC_BASE_URL}/health`
        );

        console.log(
            `Event Fields URL: ${PUBLIC_BASE_URL}/event-fields`
        );

        console.log(
            `Twilio Webhook: ${PUBLIC_BASE_URL}/twilio/inbound`
        );

        console.log(
            `Transaction Log Test: ${PUBLIC_BASE_URL}/debug/transaction-log`
        );

        console.log(
            "Consent lookup: MOBILE NUMBER"
        );

        console.log(
            "================================================"
        );

    }
);
