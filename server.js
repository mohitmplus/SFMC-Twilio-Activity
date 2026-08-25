require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
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

app.set("trust proxy", true);


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
// ENVIRONMENT CHECK
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

for (const variable of requiredEnvironmentVariables) {

    if (!process.env[variable]) {

        console.warn(
            `WARNING: ${variable} is not configured`
        );

    }

}


// =========================================================
// STATIC FILES
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
// IMPORTANT
// =========================================================
//
// DO NOT put express.json() before /execute.
//
// Journey Builder sends JWT as:
//
// application/jwt
//
// We handle /execute with express.raw().
//
// =========================================================


// =========================================================
// HEALTH
// =========================================================

app.get(
    "/health",
    (req, res) => {

        return res.status(200).json({

            status: "ok",

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
// JSON BODY PARSER
// =========================================================
//
// Only JSON requests use this.
// JWT /execute is handled separately.
//
// =========================================================

app.use(
    express.json({
        limit: "1mb",
        type: [
            "application/json",
            "application/*+json"
        ]
    })
);

app.use(
    express.urlencoded({
        extended: false
    })
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

        return res.status(200).json({});

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

        return res.status(200).json({});

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

        return res.status(200).json({});

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
        String(phone).trim();

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
            "+" + value;

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
// SAFE ERROR TEXT
// =========================================================

function safeErrorText(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value)
        .replace(
            /Bearer\s+[A-Za-z0-9._\-]+/gi,
            "Bearer [REDACTED]"
        );

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
            `${cleanBase}/hub/v1/dataevents/key/` +
            `${encodeURIComponent(deKey)}/rowset`;

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
                        new Date().toISOString()

                }

            }

        ];

        const response =
            await fetch(
                url,
                {

                    method: "POST",

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

        if (!response.ok) {

            throw new Error(
                `SFMC Transaction Log API failed. HTTP ${response.status}. ${safeErrorText(responseText)}`
            );

        }

        return {

            success: true,

            transactionId,

            statusCode:
                response.status,

            response:
                responseText

        };

    }
    catch (error) {

        console.error(
            "SFMC TRANSACTION LOG FAILED:",
            safeErrorText(error.message)
        );

        return {

            success: false,

            transactionId,

            error:
                safeErrorText(
                    error.message
                )

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
        Buffer.isBuffer(req.body)
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
// GET EVENT DEFINITION
// =========================================================

async function getEventDefinition(
    eventDefinitionKey
) {

    if (!eventDefinitionKey) {

        throw new Error(
            "eventDefinitionKey is required"
        );

    }

    const token =
        await getAccessToken();

    if (!token) {

        throw new Error(
            "SFMC access token is empty"
        );

    }

    const restBase =
        process.env.SFMC_REST_BASE_URI;

    if (!restBase) {

        throw new Error(
            "SFMC_REST_BASE_URI is not configured"
        );

    }

    const cleanBase =
        restBase.replace(
            /\/+$/,
            ""
        );

    const url =
        `${cleanBase}` +
        `/interaction/v1/eventDefinitions/key:` +
        `${encodeURIComponent(
            eventDefinitionKey
        )}`;

    console.log(
        "Getting Event Definition:"
    );

    console.log(
        url
    );

    const response =
        await fetch(
            url,
            {

                method: "GET",

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

    console.log(
        "Event Definition HTTP:",
        response.status
    );

    if (!response.ok) {

        throw new Error(
            `Event Definition API failed. HTTP ${response.status}. ${safeErrorText(text)}`
        );

    }

    let data;

    try {

        data =
            JSON.parse(text);

    }
    catch (error) {

        throw new Error(
            "Event Definition API returned invalid JSON"
        );

    }

    return data;

}


// =========================================================
// XML ESCAPE
// =========================================================

function escapeXml(value) {

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
            "&apos;"
        );

}


// =========================================================
// XML DECODE
// =========================================================

function decodeXml(value) {

    return String(
        value ?? ""
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
            /&#39;/g,
            "'"
        )
        .replace(
            /&amp;/g,
            "&"
        );

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
            `<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
            "i"
        );

    const match =
        xml.match(regex);

    return match
        ? decodeXml(
            match[1]
        )
        : "";

}


// =========================================================
// SOAP FAULT
// =========================================================

function extractSoapFault(
    xml
) {

    const faultString =
        extractXmlValue(
            xml,
            "faultstring"
        );

    const faultCode =
        extractXmlValue(
            xml,
            "faultcode"
        );

    const detail =
        extractXmlValue(
            xml,
            "ErrorDescription"
        ) ||
        extractXmlValue(
            xml,
            "Description"
        );

    return {

        faultCode,

        faultString,

        detail

    };

}


// =========================================================
// SOAP ENDPOINT
// =========================================================

async function getSoapEndpoint() {

    let auth;

    try {

        auth =
            await getAuthDetails();

    }
    catch (error) {

        throw new Error(
            `Unable to get SFMC authentication details: ${error.message}`
        );

    }

    if (
        !auth ||
        !auth.access_token
    ) {

        throw new Error(
            "SFMC authentication did not return access_token"
        );

    }

    let soapBase =
        auth.soap_instance_url ||
        auth.soapInstanceUrl ||
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

    return {

        token:
            auth.access_token,

        endpoint

    };

}


// =========================================================
// SOAP RETRIEVE
// =========================================================

async function soapRetrieve(
    token,
    endpoint,
    objectType,
    properties,
    filterProperty,
    filterValue
) {

    const propertiesXml =
        properties
            .map(
                property =>
                    `<Properties>${escapeXml(property)}</Properties>`
            )
            .join("");

    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

    <soap:Header>

        <fueloauth xmlns="http://exacttarget.com">
            ${escapeXml(token)}
        </fueloauth>

    </soap:Header>

    <soap:Body>

        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">

            <RetrieveRequest>

                <ObjectType>${escapeXml(objectType)}</ObjectType>

                ${propertiesXml}

                <Filter xsi:type="SimpleFilterPart">

                    <Property>${escapeXml(filterProperty)}</Property>

                    <SimpleOperator>equals</SimpleOperator>

                    <Value>${escapeXml(filterValue)}</Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </soap:Body>

</soap:Envelope>`;

    console.log(
        "SOAP RETRIEVE:",
        objectType,
        filterProperty,
        filterValue
    );

    const response =
        await fetch(
            endpoint,
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "text/xml; charset=utf-8",

                    Accept:
                        "text/xml",

                    SOAPAction:
                        `"Retrieve"`

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

    if (!response.ok) {

        console.error(
            "SOAP RESPONSE:",
            safeErrorText(text)
        );

        throw new Error(
            `SFMC SOAP request failed. HTTP ${response.status}. ${safeErrorText(text)}`
        );

    }

    if (
        /<(?:[\w-]+:)?Fault\b/i.test(
            text
        ) ||
        /<faultstring>/i.test(
            text
        )
    ) {

        const fault =
            extractSoapFault(
                text
            );

        throw new Error(
            `SFMC SOAP error: ${fault.faultString || fault.detail || "Unknown SOAP fault"}`
        );

    }

    return text;

}


// =========================================================
// GET DE CUSTOMER KEY FROM DE OBJECT ID
// =========================================================

async function getDataExtensionCustomerKey(
    dataExtensionId
) {

    if (!dataExtensionId) {

        throw new Error(
            "Data Extension ID is missing"
        );

    }

    const {
        token,
        endpoint
    } =
        await getSoapEndpoint();

    const xml =
        await soapRetrieve(

            token,

            endpoint,

            "DataExtension",

            [

                "ObjectID",
                "CustomerKey",
                "Name"

            ],

            "ObjectID",

            dataExtensionId

        );

    console.log(
        "DE SOAP RESPONSE:"
    );

    console.log(
        safeErrorText(xml)
    );

    const customerKey =
        extractXmlValue(
            xml,
            "CustomerKey"
        );

    const name =
        extractXmlValue(
            xml,
            "Name"
        );

    if (!customerKey) {

        throw new Error(
            `Unable to find Data Extension CustomerKey for Data Extension ID ${dataExtensionId}`
        );

    }

    return {

        customerKey,

        name

    };

}


// =========================================================
// GET DE FIELDS
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

    const {
        token,
        endpoint
    } =
        await getSoapEndpoint();

    const xml =
        await soapRetrieve(

            token,

            endpoint,

            "DataExtensionField",

            [

                "Name",
                "FieldType",
                "MaxLength",
                "IsRequired",
                "IsPrimaryKey"

            ],

            "DataExtension.CustomerKey",

            dataExtensionCustomerKey

        );

    const fields = [];

    const resultRegex =
        /<(?:[\w-]+:)?Results\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Results>/gi;

    let resultMatch;

    while (
        (
            resultMatch =
                resultRegex.exec(xml)
        ) !== null
    ) {

        const block =
            resultMatch[1];

        const name =
            extractXmlValue(
                block,
                "Name"
            );

        if (!name) {

            continue;

        }

        fields.push({

            name,

            fieldType:
                extractXmlValue(
                    block,
                    "FieldType"
                ),

            maxLength:
                extractXmlValue(
                    block,
                    "MaxLength"
                ),

            isRequired:
                extractXmlValue(
                    block,
                    "IsRequired"
                ).toLowerCase() ===
                "true",

            isPrimaryKey:
                extractXmlValue(
                    block,
                    "IsPrimaryKey"
                ).toLowerCase() ===
                "true"

        });

    }


    // =====================================================
    // FALLBACK
    // =====================================================

    if (
        fields.length === 0
    ) {

        const names =
            xml.matchAll(
                /<(?:[\w-]+:)?Name\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?Name>/gi
            );

        for (
            const match of names
        ) {

            const name =
                decodeXml(
                    match[1]
                );

            if (
                name &&
                !fields.some(
                    field =>
                        field.name === name
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
        "FIELDS FOUND:",
        fields.length
    );

    console.log(
        JSON.stringify(
            fields,
            null,
            2
        )
    );

    return fields;

}


// =========================================================
// FIND EVENT DATA EXTENSION CUSTOMER KEY
// =========================================================

function findDataExtensionCustomerKey(
    eventDefinition
) {

    const candidates = [

        eventDefinition?.dataExtensionKey,

        eventDefinition?.dataExtensionCustomerKey,

        eventDefinition?.configuration
            ?.dataExtensionKey,

        eventDefinition?.configuration
            ?.dataExtensionCustomerKey,

        eventDefinition?.arguments
            ?.dataExtensionKey,

        eventDefinition?.arguments
            ?.dataExtensionCustomerKey,

        eventDefinition?.eventDefinition
            ?.dataExtensionKey,

        eventDefinition?.eventDefinition
            ?.dataExtensionCustomerKey

    ];

    return candidates.find(
        value =>
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
    );

}


// =========================================================
// EVENT FIELDS
// =========================================================

app.get(
    "/event-fields",
    async (req, res) => {

        const eventDefinitionKey =
            req.query.eventDefinitionKey;

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

        try {

            if (
                !eventDefinitionKey
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "eventDefinitionKey is required"

                });

            }


            // =================================================
            // 1. EVENT DEFINITION
            // =================================================

            const eventDefinition =
                await getEventDefinition(
                    eventDefinitionKey
                );

            console.log(
                "EVENT DEFINITION RESPONSE:"
            );

            console.log(
                JSON.stringify(
                    eventDefinition,
                    null,
                    2
                )
            );


            const dataExtensionId =
                eventDefinition?.dataExtensionId ||
                eventDefinition?.eventDefinition
                    ?.dataExtensionId ||
                eventDefinition?.configuration
                    ?.dataExtensionId;


            const dataExtensionName =
                eventDefinition?.dataExtensionName ||
                eventDefinition?.eventDefinition
                    ?.dataExtensionName ||
                "";


            if (!dataExtensionId) {

                return res.status(500).json({

                    success:
                        false,

                    error:
                        "Event Definition does not contain dataExtensionId",

                    eventDefinitionKey,

                    dataExtensionName

                });

            }


            // =================================================
            // 2. CHECK EVENT SCHEMA
            // =================================================

            let fields = [];

            if (
                eventDefinition?.schema?.fields &&
                Array.isArray(
                    eventDefinition.schema.fields
                )
            ) {

                fields =
                    eventDefinition.schema.fields
                        .map(
                            field => ({

                                name:
                                    field.name ||
                                    field.Name ||
                                    "",

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


            // =================================================
            // 3. GET CUSTOMER KEY
            // =================================================

            let customerKey =
                findDataExtensionCustomerKey(
                    eventDefinition
                );


            if (!customerKey) {

                console.log(
                    "CustomerKey not directly available."
                );

                console.log(
                    "Resolving CustomerKey from DataExtension ObjectID:",
                    dataExtensionId
                );

                const de =
                    await getDataExtensionCustomerKey(
                        dataExtensionId
                    );

                customerKey =
                    de.customerKey;

            }


            console.log(
                "Data Extension CustomerKey:",
                customerKey
            );


            // =================================================
            // 4. GET FIELDS FROM SOAP
            // =================================================
            //
            // Always use SOAP when possible.
            // This gives the real DE schema.
            //
            // =================================================

            fields =
                await getDataExtensionFields(
                    customerKey
                );


            // =================================================
            // 5. RESPONSE
            // =================================================

            if (
                !fields ||
                fields.length === 0
            ) {

                return res.status(500).json({

                    success:
                        false,

                    error:
                        "Unable to retrieve Event fields",

                    eventDefinitionKey,

                    dataExtensionId,

                    dataExtensionName,

                    dataExtensionCustomerKey:
                        customerKey,

                    message:
                        "The Data Extension was found, but no Data Extension fields were returned by SOAP."

                });

            }


            console.log(
                "================================================"
            );

            console.log(
                "EVENT FIELDS SUCCESS"
            );

            console.log(
                "CustomerKey:",
                customerKey
            );

            console.log(
                "Field Count:",
                fields.length
            );

            console.log(
                "================================================"
            );


            return res.status(200).json({

                success:
                    true,

                eventDefinitionKey,

                dataExtensionId,

                dataExtensionName,

                dataExtensionCustomerKey:
                    customerKey,

                fields

            });

        }
        catch (error) {

            console.error(
                "================================================"
            );

            console.error(
                "EVENT FIELD ERROR"
            );

            console.error(
                safeErrorText(
                    error.stack ||
                    error.message
                )
            );

            console.error(
                "================================================"
            );


            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to retrieve Event fields",

                message:
                    safeErrorText(
                        error.message
                    ),

                eventDefinitionKey

            });

        }

    }
);


// =========================================================
// EXECUTE
// =========================================================
//
// IMPORTANT:
//
// express.raw() MUST be attached directly to this route.
//
// =========================================================

app.post(

    "/execute",

    express.raw({
        type: [
            "application/jwt",
            "text/plain"
        ],
        limit: "1mb"
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
                "RESOLVED INARGUMENTS:"
            );

            console.log(
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
                inArgs.contact_key ||
                "";


            // =================================================
            // PHONE
            // =================================================

            const rawPhone =
                inArgs.phoneNumber ||
                inArgs.PhoneNumber ||
                inArgs.mobileNumber ||
                inArgs.MobileNumber ||
                inArgs.mobile ||
                inArgs.Mobile ||
                "";


            phone =
                normalizePhone(
                    rawPhone
                );


            // =================================================
            // MESSAGE
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
            // CONTACT KEY
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


                return res.status(200).json({

                    status:
                        "skipped",

                    reason:
                        "MISSING_CONTACT_KEY",

                    transactionId

                });

            }


            // =================================================
            // PHONE
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


                return res.status(200).json({

                    status:
                        "skipped",

                    reason:
                        "MISSING_PHONE",

                    transactionId

                });

            }


            // =================================================
            // MESSAGE
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


                return res.status(200).json({

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


                return res.status(200).json({

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
                consent.SMSOptIn === true ||
                String(
                    consent.SMSOptIn
                ).toLowerCase() ===
                "true" ||
                String(
                    consent.SMSOptIn
                ) === "1";


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


                return res.status(200).json({

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


            // =================================================
            // RESPONSE
            // =================================================

            return res.status(200).json({

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


            return res.status(200).json({

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

                return res.status(400).json({

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


            const sfmcNumber =
                cleanMobileForSFMC(
                    normalized
                );


            const record =
                await getConsentByMobile(
                    sfmcNumber
                );


            if (!record) {

                return res.status(404).json({

                    found:
                        false,

                    mobileNumber:
                        normalized,

                    sfmcMobileNumber:
                        sfmcNumber

                });

            }


            return res.status(200).json({

                found:
                    true,

                mobileNumber:
                    normalized,

                sfmcMobileNumber:
                    sfmcNumber,

                consent:
                    record

            });

        }
        catch (error) {

            return res.status(500).json({

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

                return res.status(401).json({

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

                return res.status(400).json({

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


            return res.status(200).json({

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


            return res.status(500).json({

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
// OPT-OUT
// =========================================================

app.post(
    "/consent/optout",
    async (req, res) => {

        try {

            if (

                WEBHOOK_API_KEY &&

                req.get(
                    "X-API-Key"
                ) !==
                WEBHOOK_API_KEY

            ) {

                return res.status(401).json({

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

                return res.status(400).json({

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
                await optOut({

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


            return res.status(200).json({

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
                "OPT-OUT ERROR:",
                error
            );


            return res.status(500).json({

                status:
                    "error",

                reason:
                    "OPT_OUT_FAILED",

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

        return res.status(404).json({

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

        return res.status(500).json({

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
            `Consent Debug: ${PUBLIC_BASE_URL}/debug/consent`
        );

        console.log(
            "================================================"
        );

    }
);
