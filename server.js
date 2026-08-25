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

const {
    getAccessToken
} = require("./services/sfmcAuth");


// =========================================================
// EXPRESS APPLICATION
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
// JSON REQUESTS
// =========================================================

app.use(
    express.json({
        limit: "1mb"
    })
);


// =========================================================
// URL ENCODED REQUESTS
// =========================================================

app.use(
    express.urlencoded({
        extended: false
    })
);


// =========================================================
// HEALTH CHECK
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
// JOURNEY BUILDER - SAVE
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
// JOURNEY BUILDER - PUBLISH
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
// JOURNEY BUILDER - VALIDATE
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
// NORMALIZE PHONE NUMBER
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
// CLEAN MOBILE NUMBER FOR SFMC
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
// GENERATE TRANSACTION ID
// =========================================================

function generateTransactionId() {

    return crypto.randomUUID();
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
// SOAP REQUEST
// =========================================================
//
// IMPORTANT
//
// SOAP authentication uses the SAME OAuth token
// generated by sfmcAuth.js.
//
// No username/password login is used.
//
// =========================================================

function sendSOAPRequest(
    xml,
    soapAction = "Retrieve"
) {

    return new Promise(
        async (resolve, reject) => {

            try {

                const token =
                    await getAccessToken();


                let soapBase =
                    process.env.SFMC_SOAP_BASE_URI;


                /*
                 * If SFMC_SOAP_BASE_URI is not configured,
                 * derive it from REST hostname.
                 */

                if (
                    !soapBase
                ) {

                    const restBase =
                        process.env.SFMC_REST_BASE_URI;


                    if (
                        restBase
                    ) {

                        soapBase =
                            restBase.replace(
                                ".rest.marketingcloudapis.com",
                                ".soap.marketingcloudapis.com"
                            );
                    }
                }


                if (
                    !soapBase
                ) {

                    throw new Error(
                        "SFMC_SOAP_BASE_URI is not configured"
                    );
                }


                const endpoint =
                    soapBase.replace(
                        /\/+$/,
                        ""
                    ) +
                    "/Service.asmx";


                console.log(
                    "================================================"
                );

                console.log(
                    "SFMC SOAP REQUEST"
                );

                console.log(
                    "SOAP Endpoint:",
                    endpoint
                );

                console.log(
                    "SOAP Action:",
                    soapAction
                );

                console.log(
                    "OAuth token obtained successfully"
                );

                console.log(
                    "================================================"
                );


                const url =
                    new URL(
                        endpoint
                    );


                const request =
                    https.request(

                        url,

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "text/xml; charset=utf-8",

                                "Content-Length":
                                    Buffer.byteLength(
                                        xml
                                    ),

                                SOAPAction:
                                    `"${soapAction}"`

                            }

                        },

                        response => {

                            let body = "";


                            response.on(
                                "data",
                                chunk => {

                                    body += chunk;

                                }
                            );


                            response.on(
                                "end",
                                () => {

                                    console.log(
                                        "SOAP HTTP STATUS:",
                                        response.statusCode
                                    );


                                    if (
                                        response.statusCode < 200 ||
                                        response.statusCode >= 300
                                    ) {

                                        return reject(

                                            new Error(

                                                `SFMC SOAP HTTP ${response.statusCode}: ${body}`

                                            )

                                        );

                                    }


                                    resolve(
                                        body
                                    );

                                }
                            );

                        }
                    );


                request.on(
                    "error",
                    reject
                );


                request.write(
                    xml
                );


                request.end();

            }

            catch (error) {

                reject(
                    error
                );

            }

        }
    );
}


// =========================================================
// RETRIEVE DATA EXTENSION CUSTOMER KEY
// =========================================================
//
// Event Definition gives us dataExtensionId.
// We use SOAP DataExtension ObjectID to retrieve
// CustomerKey.
//
// =========================================================

async function getDataExtensionCustomerKey(
    dataExtensionId
) {

    const token =
        await getAccessToken();


    let soapBase =
        process.env.SFMC_SOAP_BASE_URI;


    if (
        !soapBase
    ) {

        const restBase =
            process.env.SFMC_REST_BASE_URI;


        soapBase =
            restBase.replace(
                ".rest.marketingcloudapis.com",
                ".soap.marketingcloudapis.com"
            );
    }


    const endpoint =
        soapBase.replace(
            /\/+$/,
            ""
        ) +
        "/Service.asmx";


    const xml = `<?xml version="1.0" encoding="UTF-8"?>

<s:Envelope
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">

    <s:Header>

        <fueloauth
            xmlns="http://exacttarget.com">

            ${xmlEscape(token)}

        </fueloauth>

    </s:Header>

    <s:Body>

        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">

            <RetrieveRequest>

                <ObjectType>
                    DataExtension
                </ObjectType>

                <Properties>
                    ObjectID
                </Properties>

                <Properties>
                    CustomerKey
                </Properties>

                <Properties>
                    Name
                </Properties>

                <Filter
                    xsi:type="SimpleFilterPart"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

                    <Property>
                        ObjectID
                    </Property>

                    <SimpleOperator>
                        equals
                    </SimpleOperator>

                    <Value>
                        ${xmlEscape(dataExtensionId)}
                    </Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </s:Body>

</s:Envelope>`;


    console.log(
        "Retrieving Data Extension using ObjectID:",
        dataExtensionId
    );


    const response =
        await sendSOAPRequest(
            xml,
            "Retrieve"
        );


    console.log(
        "Data Extension SOAP response received"
    );


    const customerKeyMatch =
        response.match(
            /<CustomerKey>([\s\S]*?)<\/CustomerKey>/i
        );


    const nameMatch =
        response.match(
            /<Name>([\s\S]*?)<\/Name>/i
        );


    if (
        !customerKeyMatch
    ) {

        throw new Error(

            "Unable to retrieve Data Extension CustomerKey. " +
            "SOAP response: " +
            response

        );

    }


    const customerKey =
        customerKeyMatch[1];


    console.log(
        "Data Extension CustomerKey:",
        customerKey
    );


    console.log(
        "Data Extension Name:",
        nameMatch
            ? nameMatch[1]
            : ""
    );


    return {

        customerKey,

        name:
            nameMatch
                ? nameMatch[1]
                : ""

    };

}


// =========================================================
// RETRIEVE DATA EXTENSION FIELDS
// =========================================================

async function getDataExtensionFields(
    customerKey
) {

    const token =
        await getAccessToken();


    let soapBase =
        process.env.SFMC_SOAP_BASE_URI;


    if (
        !soapBase
    ) {

        const restBase =
            process.env.SFMC_REST_BASE_URI;


        soapBase =
            restBase.replace(
                ".rest.marketingcloudapis.com",
                ".soap.marketingcloudapis.com"
            );
    }


    const endpoint =
        soapBase.replace(
            /\/+$/,
            ""
        ) +
        "/Service.asmx";


    const xml = `<?xml version="1.0" encoding="UTF-8"?>

<s:Envelope
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">

    <s:Header>

        <fueloauth
            xmlns="http://exacttarget.com">

            ${xmlEscape(token)}

        </fueloauth>

    </s:Header>

    <s:Body>

        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">

            <RetrieveRequest>

                <ObjectType>
                    DataExtensionField
                </ObjectType>

                <Properties>
                    Name
                </Properties>

                <Properties>
                    FieldType
                </Properties>

                <Properties>
                    MaxLength
                </Properties>

                <Properties>
                    IsRequired
                </Properties>

                <Properties>
                    IsPrimaryKey
                </Properties>

                <Filter
                    xsi:type="SimpleFilterPart"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

                    <Property>
                        DataExtension.CustomerKey
                    </Property>

                    <SimpleOperator>
                        equals
                    </SimpleOperator>

                    <Value>
                        ${xmlEscape(customerKey)}
                    </Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </s:Body>

</s:Envelope>`;


    console.log(
        "Retrieving fields for DE:",
        customerKey
    );


    const response =
        await sendSOAPRequest(
            xml,
            "Retrieve"
        );


    console.log(
        "Data Extension Field SOAP response received"
    );


    const fields = [];


    /*
     * DataExtensionField results are returned
     * inside Results elements.
     */

    const resultRegex =
        /<Results>([\s\S]*?)<\/Results>/gi;


    let match;


    while (
        (match =
            resultRegex.exec(
                response
            ))
    ) {

        const block =
            match[1];


        const nameMatch =
            block.match(
                /<Name>([\s\S]*?)<\/Name>/i
            );


        if (
            !nameMatch
        ) {

            continue;
        }


        const fieldTypeMatch =
            block.match(
                /<FieldType>([\s\S]*?)<\/FieldType>/i
            );


        const maxLengthMatch =
            block.match(
                /<MaxLength>([\s\S]*?)<\/MaxLength>/i
            );


        const requiredMatch =
            block.match(
                /<IsRequired>([\s\S]*?)<\/IsRequired>/i
            );


        const primaryKeyMatch =
            block.match(
                /<IsPrimaryKey>([\s\S]*?)<\/IsPrimaryKey>/i
            );


        fields.push({

            name:
                nameMatch[1],

            fieldType:
                fieldTypeMatch
                    ? fieldTypeMatch[1]
                    : "",

            maxLength:
                maxLengthMatch
                    ? maxLengthMatch[1]
                    : "",

            isRequired:
                requiredMatch
                    ? requiredMatch[1]
                    : "false",

            isPrimaryKey:
                primaryKeyMatch
                    ? primaryKeyMatch[1]
                    : "false"

        });

    }


    console.log(
        "Total fields found:",
        fields.length
    );


    console.log(
        JSON.stringify(
            fields,
            null,
            2
        )
    );


    if (
        fields.length === 0
    ) {

        throw new Error(

            "SFMC returned no Data Extension fields. " +
            "SOAP response: " +
            response

        );

    }


    return fields;

}


// =========================================================
// JOURNEY EVENT FIELD API
// =========================================================
//
// UI calls:
//
// GET /fields?eventDefinitionKey=XXXXX
//
// Flow:
//
// Event Definition
//       ↓
// dataExtensionId
//       ↓
// SOAP DataExtension
//       ↓
// CustomerKey
//       ↓
// SOAP DataExtensionField
//       ↓
// fields
//
// =========================================================

app.get(
    "/fields",
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
                "JOURNEY FIELD REQUEST"
            );

            console.log(
                "Event Definition Key:",
                eventDefinitionKey
            );

            console.log(
                "================================================"
            );


            // =================================================
            // GET OAUTH TOKEN
            // =================================================

            const token =
                await getAccessToken();


            // =================================================
            // REST BASE
            // =================================================

            const restBase =
                process.env.SFMC_REST_BASE_URI;


            if (
                !restBase
            ) {

                throw new Error(
                    "SFMC_REST_BASE_URI is not configured"
                );
            }


            const cleanRestBase =
                restBase.replace(
                    /\/+$/,
                    ""
                );


            // =================================================
            // GET EVENT DEFINITION
            // =================================================
            //
            // Salesforce endpoint:
            //
            // GET /interaction/v1/eventDefinitions/key:{key}
            //
            // =================================================

            const eventUrl =
                `${cleanRestBase}` +
                `/interaction/v1/eventDefinitions/key:` +
                encodeURIComponent(
                    eventDefinitionKey
                );


            console.log(
                "Event Definition URL:",
                eventUrl
            );


            const eventResponse =
                await fetch(
                    eventUrl,
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


            const eventResponseText =
                await eventResponse.text();


            console.log(
                "Event Definition HTTP:",
                eventResponse.status
            );


            console.log(
                "Event Definition Response:",
                eventResponseText
            );


            if (
                !eventResponse.ok
            ) {

                throw new Error(

                    `Event Definition API failed. ` +
                    `HTTP ${eventResponse.status}. ` +
                    `Response: ${eventResponseText}`

                );

            }


            let eventDefinition;


            try {

                eventDefinition =
                    JSON.parse(
                        eventResponseText
                    );

            }

            catch (error) {

                throw new Error(
                    "Unable to parse Event Definition response"
                );

            }


            // =================================================
            // DATA EXTENSION ID
            // =================================================

            const dataExtensionId =
                eventDefinition.dataExtensionId;


            if (
                !dataExtensionId
            ) {

                throw new Error(

                    "Event Definition did not contain dataExtensionId. " +
                    JSON.stringify(
                        eventDefinition
                    )

                );

            }


            console.log(
                "Event Data Extension ID:",
                dataExtensionId
            );


            // =================================================
            // GET DATA EXTENSION CUSTOMER KEY
            // =================================================

            const dataExtension =
                await getDataExtensionCustomerKey(
                    dataExtensionId
                );


            console.log(
                "Data Extension CustomerKey:",
                dataExtension.customerKey
            );


            // =================================================
            // GET FIELDS
            // =================================================

            const fields =
                await getDataExtensionFields(
                    dataExtension.customerKey
                );


            // =================================================
            // RESPONSE
            // =================================================

            return res
                .status(200)
                .json({

                    success:
                        true,

                    eventDefinitionKey,

                    dataExtensionId,

                    dataExtensionKey:
                        dataExtension.customerKey,

                    dataExtensionName:
                        dataExtension.name,

                    fields

                });

        }

        catch (error) {

            console.error(
                "================================================"
            );

            console.error(
                "JOURNEY FIELD RETRIEVAL ERROR"
            );

            console.error(
                "Error:",
                error
            );

            console.error(
                "Error Message:",
                error.message
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
// LOG SMS TRANSACTION TO SFMC
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
        "================================================"
    );


    try {

        const restBase =
            process.env.SFMC_REST_BASE_URI;

        const deKey =
            process.env.SFMC_TRANSACTION_DE_KEY;


        console.log(
            "SFMC_REST_BASE_URI:",
            restBase || "(MISSING)"
        );

        console.log(
            "SFMC_TRANSACTION_DE_KEY:",
            deKey || "(MISSING)"
        );


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


        // =====================================================
        // ACCESS TOKEN
        // =====================================================

        console.log(
            "Getting SFMC access token..."
        );


        const token =
            await getAccessToken();


        if (!token) {

            throw new Error(
                "SFMC access token was empty"
            );
        }


        console.log(
            "SFMC access token received successfully"
        );


        // =====================================================
        // URL
        // =====================================================

        const cleanRestBase =
            restBase.replace(
                /\/+$/,
                ""
            );


        const url =
            `${cleanRestBase}` +
            `/hub/v1/dataevents/key/` +
            `${encodeURIComponent(
                deKey
            )}` +
            `/rowset`;


        console.log(
            "Transaction Log URL:"
        );

        console.log(
            url
        );


        // =====================================================
        // PAYLOAD
        // =====================================================

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
            "================================================"
        );

        console.log(
            "SFMC TRANSACTION PAYLOAD"
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
        // SEND
        // =====================================================

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
            "================================================"
        );

        console.log(
            "SFMC TRANSACTION RESPONSE"
        );

        console.log(
            "HTTP STATUS:",
            response.status
        );

        console.log(
            "HTTP OK:",
            response.ok
        );

        console.log(
            "RESPONSE:",
            responseText
        );

        console.log(
            "================================================"
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
            "================================================"
        );

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

        console.error(
            "================================================"
        );


        /*
         * IMPORTANT
         *
         * Do not throw.
         *
         * SMS delivery must not be affected
         * by transaction logging failure.
         */

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
// VERIFY JOURNEY BUILDER JWT
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
// JOURNEY BUILDER EXECUTE
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

            // =================================================
            // VERIFY JWT
            // =================================================

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


            // =================================================
            // GET IN ARGUMENTS
            // =================================================

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


            // =================================================
            // CONTACT KEY
            // =================================================

            contactKey =
                inArgs.contactKey ||

                inArgs.ContactKey ||

                inArgs.contactkey ||

                "";


            // =================================================
            // MOBILE NUMBER
            // =================================================

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


            // =================================================
            // MESSAGE
            // =================================================

            message =
                inArgs.message ||

                inArgs.Message ||

                inArgs.smsMessage ||

                inArgs.SMSMessage ||

                "";


            console.log(
                "================================================"
            );

            console.log(
                "JOURNEY VALUES"
            );

            console.log(
                "ContactKey:",
                contactKey || "(EMPTY)"
            );

            console.log(
                "Raw Mobile:",
                rawPhone || "(EMPTY)"
            );

            console.log(
                "Normalized Mobile:",
                phone || "(EMPTY)"
            );

            console.log(
                "SFMC Mobile:",
                cleanMobileForSFMC(
                    phone
                ) || "(EMPTY)"
            );

            console.log(
                "Message:",
                message || "(EMPTY)"
            );

            console.log(
                "================================================"
            );


            // =================================================
            // CONTACT KEY VALIDATION
            // =================================================

            if (!contactKey) {

                console.error(
                    "MISSING CONTACT KEY"
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

                console.error(
                    "MISSING MOBILE NUMBER"
                );


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

                console.error(
                    "EMPTY SMS MESSAGE"
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
            // CLEAN MOBILE
            // =================================================

            const sfmcMobileNumber =
                cleanMobileForSFMC(
                    phone
                );


            // =================================================
            // CONSENT CHECK
            // =================================================

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
                "Consent lookup method:",
                "MobileNumber"
            );

            console.log(
                "================================================"
            );


            const consent =
                await getConsentByMobile(
                    sfmcMobileNumber
                );


            console.log(
                "Consent API completed"
            );


            console.log(
                "Consent result:",
                JSON.stringify(
                    consent,
                    null,
                    2
                )
            );


            // =================================================
            // NO CONSENT
            // =================================================

            if (!consent) {

                console.error(
                    "NO CONSENT RECORD FOUND"
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


            console.log(
                "================================================"
            );

            console.log(
                "CONSENT STATUS"
            );

            console.log(
                "MobileNumber:",
                sfmcMobileNumber
            );

            console.log(
                "ContactKey:",
                contactKey
            );

            console.log(
                "SMSOptIn:",
                consent.SMSOptIn
            );

            console.log(
                "isOptedIn:",
                isOptedIn
            );

            console.log(
                "================================================"
            );


            // =================================================
            // BLOCK OPTED OUT
            // =================================================

            if (!isOptedIn) {

                console.warn(
                    "SMS BLOCKED - CUSTOMER IS OPTED OUT"
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
            // SEND SMS
            // =================================================

            console.log(
                "================================================"
            );

            console.log(
                "CONSENT APPROVED"
            );

            console.log(
                "Calling Twilio sendSMS()"
            );

            console.log(
                "To:",
                phone
            );

            console.log(
                "Message:",
                message
            );

            console.log(
                "================================================"
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


            // =================================================
            // VERIFY TWILIO
            // =================================================

            console.log(
                "Twilio response received"
            );


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


            // =================================================
            // SMS SUCCESS
            // =================================================

            console.log(
                "================================================"
            );

            console.log(
                "TWILIO SMS ACCEPTED"
            );

            console.log(
                "Message SID:",
                twilioMessage.sid
            );

            console.log(
                "================================================"
            );


            // =================================================
            // TRANSACTION LOG
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
            // LOG FAILURE DOES NOT AFFECT SMS
            // =================================================

            if (
                !logResult ||
                logResult.success !== true
            ) {

                console.error(
                    "WARNING: SMS was sent but SFMC transaction logging failed."
                );

                console.error(
                    "TransactionId:",
                    transactionId
                );

                console.error(
                    "Twilio SID:",
                    twilioMessage.sid
                );

            }


            // =================================================
            // SUCCESS
            // =================================================

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
                "Error Message:",
                error.message
            );

            console.error(
                "================================================"
            );


            // =================================================
            // ERROR TRANSACTION LOG
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
// DEBUG - CONSENT
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


            if (!record) {

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
// DEBUG - TRANSACTION LOG
// =========================================================

app.get(
    "/debug/transaction-log",

    async (req, res) => {

        const transactionId =
            generateTransactionId();


        console.log(
            "================================================"
        );

        console.log(
            "MANUAL TRANSACTION LOG TEST"
        );

        console.log(
            "TransactionId:",
            transactionId
        );

        console.log(
            "================================================"
        );


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
// DEBUG - PHONE
// =========================================================

app.get(
    "/debug/phone",

    (req, res) => {

        const input =
            req.query.phone;


        if (!input) {

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
// VERIFY TWILIO REQUEST
// =========================================================

function verifyTwilioRequest(
    req
) {

    const authToken =
        process.env
            .TWILIO_AUTH_TOKEN;


    if (!authToken) {

        throw new Error(
            "TWILIO_AUTH_TOKEN is not configured"
        );
    }


    const signature =
        req.get(
            "X-Twilio-Signature"
        );


    if (!signature) {

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

    async (req, res) => {

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


            if (!valid) {

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


            if (!isOptOut) {

                console.log(
                    "Not an opt-out keyword."
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


            console.log(
                "OPT-OUT REQUEST DETECTED"
            );


            const contact =
                await getConsentByMobile(
                    mobileNumber
                );


            if (!contact) {

                console.warn(
                    "No consent record found for:",
                    mobileNumber
                );


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
// OPT-IN API
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
// GLOBAL ERROR HANDLER
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
// START SERVER
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
            `Twilio Webhook: ${PUBLIC_BASE_URL}/twilio/inbound`
        );

        console.log(
            `Transaction Log Test: ${PUBLIC_BASE_URL}/debug/transaction-log`
        );

        console.log(
            `Journey Fields: ${PUBLIC_BASE_URL}/fields`
        );

        console.log(
            "Consent lookup: MOBILE NUMBER"
        );

        console.log(
            "SOAP authentication: OAuth fueloauth"
        );

        console.log(
            "================================================"
        );

    }
);
