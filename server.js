require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");

const {
    getConsentByMobile,
    optIn,
    optOut
} = require("./services/sfmcConsent");

const {
    sendSMS
} = require("./services/twilioService");

const {
    getAccessToken,
    getAuthDetails
} = require("./services/sfmcAuth");


// =========================================================
// EXPRESS
// =========================================================

const app = express();

app.set(
    "trust proxy",
    true
);


// =========================================================
// CONFIGURATION
// =========================================================

const PORT =
    process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET;

const PUBLIC_BASE_URL =
    process.env.WEBHOOK_BASE_URL ||
    `http://localhost:${PORT}`;

const WEBHOOK_API_KEY =
    process.env.WEBHOOK_API_KEY;


// =========================================================
// ENV CHECK
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
            "JOURNEY BUILDER SAVE"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
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
            "JOURNEY BUILDER PUBLISH"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
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
            "JOURNEY BUILDER VALIDATE"
        );

        console.log(
            JSON.stringify(
                req.body,
                null,
                2
            )
        );

        return res
            .status(200)
            .json({});

    }
);


// =========================================================
// PHONE NORMALIZATION
// =========================================================

function normalizePhone(phone) {

    if (
        phone === undefined ||
        phone === null
    ) {

        return null;

    }


    let value =
        String(phone)
            .trim();


    if (!value) {

        return null;

    }


    value =
        value.replace(
            /[\s\-().]/g,
            ""
        );


    if (
        !value.startsWith("+")
    ) {

        value =
            "+" +
            value;

    }


    return value;

}


// =========================================================
// SFMC MOBILE FORMAT
// =========================================================

function cleanMobileForSFMC(phone) {

    if (
        phone === undefined ||
        phone === null
    ) {

        return null;

    }


    const value =
        String(phone)
            .replace(
                /\D/g,
                ""
            );


    return value || null;

}


// =========================================================
// TRANSACTION ID
// =========================================================

function generateTransactionId() {

    return crypto.randomUUID();

}


// =========================================================
// SFMC TRANSACTION LOG
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
        "SFMC TRANSACTION LOG"
    );

    console.log(
        "TransactionId:",
        transactionId
    );


    try {

        const restBase =
            process.env.SFMC_REST_BASE_URI;

        const deKey =
            process.env.SFMC_TRANSACTION_DE_KEY;


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
            await getAccessToken();


        if (!token) {

            throw new Error(
                "SFMC access token is empty"
            );

        }


        const cleanBase =
            restBase.replace(
                /\/+$/,
                ""
            );


        const url =
            `${cleanBase}` +
            `/hub/v1/dataevents/key/` +
            `${encodeURIComponent(deKey)}` +
            `/rowset`;


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
                        new Date()
                            .toISOString()

                }

            }

        ];


        console.log(
            "Transaction URL:",
            url
        );


        console.log(
            "Transaction payload:",
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
            "SFMC LOG HTTP STATUS:",
            response.status
        );


        console.log(
            "SFMC LOG RESPONSE:",
            responseText
        );


        if (
            !response.ok
        ) {

            throw new Error(

                `SFMC Transaction Log API failed. HTTP ${response.status}. Response: ${responseText}`

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
// JOURNEY JWT
// =========================================================

function verifyJourneyJWT(req) {

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
        typeof req.body === "string"
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
// GET JOURNEY EVENT DEFINITION
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
        await getAccessToken();


    const restBase =
        process.env.SFMC_REST_BASE_URI
            .replace(
                /\/+$/,
                ""
            );


    const url =
        `${restBase}` +
        `/interaction/v1/eventDefinitions/key:` +
        `${encodeURIComponent(
            eventDefinitionKey
        )}`;


    console.log(
        "Getting Event Definition:",
        url
    );


    const response =
        await fetch(
            url,
            {

                method:
                    "GET",

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    Accept:
                        "application/json"

                }

            }
        );


    const text =
        await response.text();


    if (
        !response.ok
    ) {

        throw new Error(

            `Event Definition API failed. HTTP ${response.status}. ${text}`

        );

    }


    return JSON.parse(
        text
    );

}


// =========================================================
// XML ESCAPE
// =========================================================

function escapeXml(value) {

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
// SOAP DATA EXTENSION FIELD RETRIEVAL
// =========================================================
//
// OAuth Bearer token is used.
// NO SFMC USERNAME/PASSWORD required.
//
// =========================================================

async function getDataExtensionFields(
    dataExtensionCustomerKey
) {

    if (
        !dataExtensionCustomerKey
    ) {

        throw new Error(
            "Data Extension CustomerKey is missing"
        );

    }


    const auth =
        await getAuthDetails();


    const token =
        auth.access_token;


    let soapBase =
        auth.soap_instance_url ||
        process.env.SFMC_SOAP_BASE_URI;


    if (!soapBase) {

        throw new Error(
            "SFMC SOAP endpoint is not available"
        );

    }


    soapBase =
        soapBase.replace(
            /\/+$/,
            ""
        );


    const endpoint =
        soapBase.endsWith(
            "/Service.asmx"
        )
            ? soapBase
            : `${soapBase}/Service.asmx`;


    console.log(
        "SOAP endpoint:",
        endpoint
    );


    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:tns="http://exacttarget.com/wsdl/partnerAPI">

    <soap:Header>
        <fueloauth xmlns="http://exacttarget.com">${escapeXml(token)}</fueloauth>
    </soap:Header>

    <soap:Body>

        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">

            <RetrieveRequest>

                <ObjectType>DataExtensionField</ObjectType>

                <Properties>Name</Properties>
                <Properties>FieldType</Properties>
                <Properties>MaxLength</Properties>
                <Properties>IsRequired</Properties>
                <Properties>IsPrimaryKey</Properties>

                <Filter xsi:type="SimpleFilterPart">

                    <Property>DataExtension.CustomerKey</Property>

                    <SimpleOperator>equals</SimpleOperator>

                    <Value>${escapeXml(
                        dataExtensionCustomerKey
                    )}</Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </soap:Body>

</soap:Envelope>`;


    const response =
        await fetch(
            endpoint,
            {

                method:
                    "POST",

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    "Content-Type":
                        "text/xml; charset=utf-8",

                    SOAPAction:
                        "Retrieve"

                },

                body:
                    envelope

            }
        );


    const text =
        await response.text();


    console.log(
        "SOAP HTTP STATUS:",
        response.status
    );


    if (
        !response.ok
    ) {

        console.error(
            "SOAP ERROR:",
            text
        );


        throw new Error(

            `SFMC SOAP field retrieval failed. HTTP ${response.status}. ${text}`

        );

    }


    if (
        /<faultstring>/i.test(
            text
        )
    ) {

        const fault =
            text.match(
                /<faultstring>(.*?)<\/faultstring>/i
            );


        throw new Error(

            `SFMC SOAP error: ${
                fault
                    ? fault[1]
                    : "Unknown SOAP error"
            }`

        );

    }


    const fields = [];


    const resultRegex =
        /<Results[^>]*>([\s\S]*?)<\/Results>/gi;


    let resultMatch;


    while (
        (
            resultMatch =
                resultRegex.exec(
                    text
                )
        ) !== null
    ) {

        const block =
            resultMatch[1];


        const name =
            extractXmlValue(
                block,
                "Name"
            );


        const fieldType =
            extractXmlValue(
                block,
                "FieldType"
            );


        const maxLength =
            extractXmlValue(
                block,
                "MaxLength"
            );


        const isRequired =
            extractXmlValue(
                block,
                "IsRequired"
            );


        const isPrimaryKey =
            extractXmlValue(
                block,
                "IsPrimaryKey"
            );


        if (name) {

            fields.push({

                name,

                fieldType:
                    fieldType || "",

                maxLength:
                    maxLength || "",

                isRequired:
                    isRequired === "true",

                isPrimaryKey:
                    isPrimaryKey === "true"

            });

        }

    }


    // Fallback XML parsing if Results wrapper differs.
    if (
        fields.length === 0
    ) {

        const nameRegex =
            /<Name>(.*?)<\/Name>/gi;


        let match;


        while (
            (
                match =
                    nameRegex.exec(
                        text
                    )
            ) !== null
        ) {

            const name =
                decodeXml(
                    match[1]
                );


            if (
                name &&
                !fields.some(
                    f =>
                        f.name === name
                )
            ) {

                fields.push({

                    name,

                    fieldType:
                        "",

                    maxLength:
                        "",

                    isRequired:
                        false,

                    isPrimaryKey:
                        false

                });

            }

        }

    }


    console.log(
        "Retrieved Event DE fields:",
        fields
    );


    return fields;

}


// =========================================================
// XML VALUE
// =========================================================

function extractXmlValue(
    xml,
    tag
) {

    const regex =
        new RegExp(
            `<${tag}[^>]*>([\\\\s\\\\S]*?)<\\/${tag}>`,
            "i"
        );


    const match =
        xml.match(
            regex
        );


    return match
        ? decodeXml(
            match[1]
        )
        : "";

}


// =========================================================
// XML DECODE
// =========================================================

function decodeXml(value) {

    return String(
        value || ""
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
        )
        .replace(
            /&amp;/g,
            "&"
        );

}


// =========================================================
// EVENT FIELDS ENDPOINT
// =========================================================
//
// Browser calls:
//
// GET /event-fields?eventDefinitionKey=XXXX
//
// =========================================================

app.get(
    "/event-fields",
    async (req, res) => {

        try {

            const eventDefinitionKey =
                req.query.eventDefinitionKey;


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
                "EVENT FIELD REQUEST"
            );

            console.log(
                "Event Definition Key:",
                eventDefinitionKey
            );


            // -------------------------------------------------
            // GET EVENT DEFINITION
            // -------------------------------------------------

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


            const dataExtensionId =
                eventDefinition
                    .dataExtensionId;


            const dataExtensionName =
                eventDefinition
                    .dataExtensionName ||
                "";


            if (
                !dataExtensionId
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Event Definition does not contain dataExtensionId",

                        eventDefinition

                    });

            }


            // -------------------------------------------------
            // RETRIEVE DATA EXTENSION
            // -------------------------------------------------
            //
            // The Event Definition API gives us the DE ID.
            //
            // We need the CustomerKey to retrieve fields.
            //
            // -------------------------------------------------

            const token =
                await getAccessToken();


            const restBase =
                process.env.SFMC_REST_BASE_URI
                    .replace(
                        /\/+$/,
                        ""
                    );


            const deUrl =
                `${restBase}` +
                `/data/v1/customobjectdata/key/`;


            // -------------------------------------------------
            // First attempt:
            // use event definition schema if available.
            // -------------------------------------------------

            let fields = [];


            if (
                eventDefinition.schema &&
                Array.isArray(
                    eventDefinition
                        .schema
                        .fields
                )
            ) {

                fields =
                    eventDefinition
                        .schema
                        .fields
                        .map(
                            field => ({

                                name:
                                    field.name ||
                                    field.Name,

                                fieldType:
                                    field.type ||
                                    field.FieldType ||
                                    ""

                            })
                        )
                        .filter(
                            field =>
                                field.name
                        );

            }


            // -------------------------------------------------
            // If schema doesn't expose fields,
            // use DE CustomerKey.
            // -------------------------------------------------

            if (
                fields.length === 0
            ) {

                // Some event definitions expose
                // the DE customer key in configuration.
                const possibleKeys = [

                    eventDefinition
                        .dataExtensionKey,

                    eventDefinition
                        .dataExtensionCustomerKey,

                    eventDefinition
                        .configuration
                        ?.dataExtensionKey,

                    eventDefinition
                        .arguments
                        ?.dataExtensionKey

                ].filter(Boolean);


                if (
                    possibleKeys.length > 0
                ) {

                    fields =
                        await getDataExtensionFields(
                            possibleKeys[0]
                        );

                }

            }


            // -------------------------------------------------
            // Return error with useful information
            // -------------------------------------------------

            if (
                fields.length === 0
            ) {

                return res
                    .status(500)
                    .json({

                        success:
                            false,

                        error:
                            "Unable to retrieve Event fields",

                        eventDefinitionKey,

                        dataExtensionId,

                        dataExtensionName,

                        message:
                            "The Event Definition returned a Data Extension ID but no field metadata was available."

                    });

            }


            console.log(
                "EVENT FIELDS SUCCESS:",
                fields
            );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    eventDefinitionKey,

                    dataExtensionId,

                    dataExtensionName,

                    fields

                });

        }

        catch (error) {

            console.error(
                "EVENT FIELD ERROR:",
                error
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
// EXECUTE
// =========================================================

app.post(

    "/execute",

    express.raw({
        type: "application/jwt"
    }),

    async (req, res) => {

        const transactionId =
            generateTransactionId();


        let contactKey = "";

        let phone = "";

        let message = "";


        console.log(
            "================================================"
        );

        console.log(
            "JOURNEY BUILDER EXECUTE"
        );

        console.log(
            "TransactionId:",
            transactionId
        );


        try {

            // =================================================
            // JWT
            // =================================================

            const decoded =
                verifyJourneyJWT(
                    req
                );


            console.log(
                "JWT VERIFIED"
            );


            console.log(
                "InArguments:",
                JSON.stringify(
                    decoded.inArguments,
                    null,
                    2
                )
            );


            if (
                !Array.isArray(
                    decoded.inArguments
                ) ||
                decoded.inArguments.length === 0
            ) {

                throw new Error(
                    "No inArguments found"
                );

            }


            const inArgs =
                Object.assign(
                    {},
                    ...decoded.inArguments
                );


            console.log(
                "Resolved InArguments:",
                JSON.stringify(
                    inArgs,
                    null,
                    2
                )
            );


            // =================================================
            // CONTACT KEY
            // =================================================

            contactKey =
                inArgs.contactKey ||
                inArgs.ContactKey ||
                "";


            // =================================================
            // PHONE
            // =================================================

            const rawPhone =
                inArgs.phoneNumber ||
                inArgs.PhoneNumber ||
                inArgs.mobileNumber ||
                inArgs.MobileNumber ||
                "";


            phone =
                normalizePhone(
                    rawPhone
                );


            // =================================================
            // MESSAGE
            // =================================================
            //
            // IMPORTANT:
            //
            // Journey Builder should resolve:
            //
            // Hello {{Event.KEY.FirstName}}
            //
            // into:
            //
            // Hello Mohit
            //
            // before calling /execute.
            //
            // =================================================

            message =
                inArgs.message ||
                inArgs.Message ||
                "";


            console.log(
                "================================================"
            );

            console.log(
                "RUNTIME VALUES"
            );

            console.log(
                "ContactKey:",
                contactKey
            );

            console.log(
                "Phone:",
                phone
            );

            console.log(
                "Message:",
                message
            );

            console.log(
                "================================================"
            );


            // =================================================
            // CONTACT KEY VALIDATION
            // =================================================

            if (!contactKey) {

                await logTransaction({

                    transactionId,

                    contactKey,

                    mobileNumber:
                        phone || "",

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


            // =================================================
            // PHONE VALIDATION
            // =================================================

            if (!phone) {

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


            // =================================================
            // MESSAGE VALIDATION
            // =================================================

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


            // =================================================
            // CONSENT
            // =================================================

            const sfmcMobileNumber =
                cleanMobileForSFMC(
                    phone
                );


            console.log(
                "Consent lookup:",
                sfmcMobileNumber
            );


            const consent =
                await getConsentByMobile(
                    sfmcMobileNumber
                );


            console.log(
                "Consent:",
                JSON.stringify(
                    consent,
                    null,
                    2
                )
            );


            if (!consent) {

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


            // =================================================
            // OPT-IN
            // =================================================

            const isOptedIn =
                consent.SMSOptIn === true;


            if (!isOptedIn) {

                console.log(
                    "SMS BLOCKED - OPTED OUT"
                );


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


            // =================================================
            // TWILIO
            // =================================================

            console.log(
                "Sending SMS..."
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
                "Twilio response:",
                JSON.stringify(
                    twilioMessage,
                    null,
                    2
                )
            );


            if (
                !twilioMessage ||
                !twilioMessage.sid
            ) {

                throw new Error(
                    "Twilio did not return Message SID"
                );

            }


            // =================================================
            // LOG SUCCESS
            // =================================================

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


            console.log(
                "Transaction log result:",
                JSON.stringify(
                    logResult,
                    null,
                    2
                )
            );


            // =================================================
            // RESPONSE
            // =================================================

            return res
                .status(200)
                .json({

                    status:
                        "success",

                    transactionId,

                    twilioMessageSid:
                        twilioMessage.sid,

                    transactionLog:
                        logResult.success
                            ? "success"
                            : "failed"

                });


        }

        catch (error) {

            console.error(
                "EXECUTE ERROR:",
                error
            );


            // =================================================
            // ERROR LOG
            // =================================================

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
                        error.code || "",

                    errorMessage:
                        error.message || "",

                    consentStatus:
                        ""

                });


            return res
                .status(200)
                .json({

                    status:
                        "error",

                    transactionId,

                    reason:
                        "EXECUTE_ERROR",

                    message:
                        error.message,

                    transactionLog:
                        logResult.success
                            ? "success"
                            : "failed"

                });

        }

    }

);


// =========================================================
// DEBUG TRANSACTION LOG
// =========================================================

app.get(
    "/debug/transaction-log",
    async (req, res) => {

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
// DEBUG CONSENT
// =========================================================

app.get(
    "/debug/consent",
    async (req, res) => {

        try {

            const mobileNumber =
                req.query.mobileNumber;


            if (!mobileNumber) {

                return res
                    .status(400)
                    .json({

                        found:
                            false,

                        error:
                            "mobileNumber is required"

                    });

            }


            const normalized =
                normalizePhone(
                    mobileNumber
                );


            const record =
                await getConsentByMobile(
                    cleanMobileForSFMC(
                        normalized
                    )
                );


            if (!record) {

                return res
                    .status(404)
                    .json({

                        found:
                            false,

                        mobileNumber:
                            normalized,

                        sfmcMobileNumber:
                            cleanMobileForSFMC(
                                normalized
                            )

                    });

            }


            return res
                .status(200)
                .json({

                    found:
                        true,

                    mobileNumber:
                        normalized,

                    sfmcMobileNumber:
                        cleanMobileForSFMC(
                            normalized
                        ),

                    consent:
                        record

                });

        }

        catch (error) {

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
// OPT-IN
// =========================================================

app.post(
    "/consent/optin",
    async (req, res) => {

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


            if (!mobileNumber) {

                return res
                    .status(400)
                    .json({

                        status:
                            "error",

                        reason:
                            "MISSING_MOBILE_NUMBER"

                    });

            }


            const normalized =
                normalizePhone(
                    mobileNumber
                );


            const cleanNumber =
                cleanMobileForSFMC(
                    normalized
                );


            const result =
                await optIn({

                    contactKey:
                        contactKey || "",

                    mobileNumber:
                        cleanNumber,

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
                        contactKey || "",

                    mobileNumber:
                        cleanNumber,

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
    (req, res) => {

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
            `Health: ${PUBLIC_BASE_URL}/health`
        );

        console.log(
            `Execute: ${PUBLIC_BASE_URL}/execute`
        );

        console.log(
            `Event Fields: ${PUBLIC_BASE_URL}/event-fields`
        );

        console.log(
            `Transaction Test: ${PUBLIC_BASE_URL}/debug/transaction-log`
        );

        console.log(
            "================================================"
        );

    }
);
