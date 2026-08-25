require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");

const {
    getConsent,
    getConsentByMobile,
    optIn,
    optOut
} = require("./services/sfmcConsent");

const {
    sendSMS
} = require("./services/twilioService");


// =========================================================
// EXPRESS APPLICATION
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
    const variable of requiredEnvironmentVariables
) {

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
// JSON REQUESTS
// =========================================================

app.use(
    express.json({
        limit: "1mb"
    })
);


// =========================================================
// URL ENCODED REQUESTS
// Required for Twilio Webhook
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
            "Journey Builder SAVE request received"
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
// JOURNEY BUILDER - PUBLISH
// =========================================================

app.post(
    "/publish",
    (req, res) => {

        console.log(
            "Journey Builder PUBLISH request received"
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
// JOURNEY BUILDER - VALIDATE
// =========================================================

app.post(
    "/validate",
    (req, res) => {

        console.log(
            "Journey Builder VALIDATE request received"
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
// NORMALIZE PHONE NUMBER
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

function normalizePhone(phone) {

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
            "+" + normalized;
    }


    return normalized;
}


// =========================================================
// CLEAN MOBILE NUMBER FOR SFMC
// =========================================================

function cleanMobileForSFMC(phone) {

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
// LOG SMS TRANSACTION TO SFMC
// =========================================================

async function logTransaction({

    transactionId,

    contactKey,

    mobileNumber,

    message,

    status,

    reason = "",

    twilioMessageSid = "",

    errorCode = "",

    errorMessage = "",

    consentStatus = ""

}) {

    try {

        const {
            getAccessToken
        } = require(
            "./services/sfmcAuth"
        );


        const token =
            await getAccessToken();


        const restBase =
            process.env
                .SFMC_REST_BASE_URI
                .replace(
                    /\/$/,
                    ""
                );


        const deKey =
            process.env
                .SFMC_TRANSACTION_DE_KEY;


        if (!deKey) {

            console.error(
                "SFMC_TRANSACTION_DE_KEY is missing"
            );

            return;
        }


        const url =
            `${restBase}` +
            `/hub/v1/dataevents/key/` +
            `${encodeURIComponent(
                deKey
            )}` +
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
                        message || "",

                    Status:
                        status || "",

                    Reason:
                        reason || "",

                    TwilioMessageSid:
                        twilioMessageSid || "",

                    ErrorCode:
                        errorCode || "",

                    ErrorMessage:
                        errorMessage || "",

                    ConsentStatus:
                        consentStatus || "",

                    CreatedDate:
                        new Date()
                            .toISOString()

                }

            }

        ];


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


        if (!response.ok) {

            console.error(
                "Transaction log failed:",
                response.status,
                responseText
            );

            return;
        }


        console.log(
            "Transaction successfully logged:",
            transactionId
        );


    }

    catch (error) {

        console.error(
            "Transaction logging error:",
            error.message
        );
    }
}


// =========================================================
// VERIFY JOURNEY BUILDER JWT
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
// JOURNEY BUILDER EXECUTE
// =========================================================
//
// Flow:
//
// Journey Builder
//       |
//       v
// JWT
//       |
//       v
// ContactKey
//       |
//       v
// Phone Number
//       |
//       v
// Message
//       |
//       v
// SFMC Consent
//       |
//       v
// SMSOptIn?
//       |
//   +---+---+
//   |       |
// TRUE    FALSE
//   |       |
//   v       v
// Twilio   SKIP
//
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


        try {

            // =================================================
            // 1. VERIFY JWT
            // =================================================

            const decoded =
                verifyJourneyJWT(
                    req
                );


            console.log(
                "Journey Builder JWT verified successfully"
            );


            console.log(
                "JWT payload:",
                JSON.stringify(
                    decoded,
                    null,
                    2
                )
            );


            // =================================================
            // 2. GET IN ARGUMENTS
            // =================================================

            if (
                !decoded.inArguments ||
                !Array.isArray(
                    decoded.inArguments
                ) ||
                decoded.inArguments.length === 0
            ) {

                throw new Error(
                    "No inArguments found in Journey request"
                );
            }


            const inArgs =
                Object.assign(
                    {},
                    ...decoded.inArguments
                );


            console.log(
                "Merged inArguments:",
                JSON.stringify(
                    inArgs,
                    null,
                    2
                )
            );


            // =================================================
            // 3. CONTACT KEY
            // =================================================

            contactKey =
                inArgs.contactKey ||
                inArgs.ContactKey ||
                "";


            // =================================================
            // 4. PHONE NUMBER
            // =================================================

            phone =
                normalizePhone(

                    inArgs.phoneNumber ||

                    inArgs.PhoneNumber ||

                    inArgs.mobileNumber ||

                    inArgs.MobileNumber

                );


            // =================================================
            // 5. MESSAGE
            // =================================================

            message =
                inArgs.message ||
                inArgs.Message ||
                "";


            console.log(
                "Journey values:",
                {

                    transactionId,

                    contactKey,

                    phone,

                    messageLength:
                        String(
                            message
                        ).length

                }
            );


            // =================================================
            // 6. CONTACT KEY VALIDATION
            // =================================================

            if (!contactKey) {

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
            // 7. PHONE VALIDATION
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
            // 8. MESSAGE VALIDATION
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
            // 9. LIVE CONSENT LOOKUP
            // =================================================

            console.log(
                "Checking SFMC consent for:",
                contactKey
            );


            const consent =
                await getConsent(
                    contactKey
                );


            // =================================================
            // 10. NO CONSENT RECORD
            // =================================================

            if (!consent) {

                console.log(
                    "No consent record found:",
                    contactKey
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
            // 11. LOG CONSENT RECORD
            // =================================================

            console.log(
                "Consent record:",
                JSON.stringify(
                    consent,
                    null,
                    2
                )
            );


            // =================================================
            // 12. CHECK SMS OPT-IN
            // =================================================

            const smsOptIn =
                consent.SMSOptIn;


            const isOptedIn =

                smsOptIn === true ||

                String(
                    smsOptIn
                )
                    .trim()
                    .toLowerCase() ===
                    "true" ||

                String(
                    smsOptIn
                )
                    .trim() ===
                    "1";


            console.log(
                "SMSOptIn:",
                smsOptIn
            );


            console.log(
                "isOptedIn:",
                isOptedIn
            );


            // =================================================
            // 13. BLOCK OPTED-OUT CUSTOMER
            // =================================================

            if (!isOptedIn) {

                console.log(
                    `SMS BLOCKED - Contact ${contactKey} is opted out`
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
            // 14. SEND SMS
            // =================================================

            console.log(
                "Consent is TRUE."
            );


            console.log(
                "Sending SMS through Twilio:",
                phone
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
            // 15. LOG SUCCESS
            // =================================================

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
                "SMS successfully sent."
            );


            console.log(
                "Twilio SID:",
                twilioMessage.sid
            );


            // =================================================
            // 16. RETURN SUCCESS
            // =================================================

            return res
                .status(200)
                .json({

                    status:
                        "success",

                    transactionId,

                    twilioMessageSid:
                        twilioMessage.sid

                });


        }

        catch (error) {

            console.error(
                "EXECUTE ERROR:",
                error
            );


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

                errorMessage:
                    error.message

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
                        error.message

                });
        }
    }
);


// =========================================================
// DEBUG - FIND CONSENT BY MOBILE
// =========================================================
//
// Test:
//
// /debug/consent?mobileNumber=916377783635
//
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


            console.log(
                "DEBUG consent lookup"
            );


            console.log(
                "Input:",
                mobileNumber
            );


            console.log(
                "Normalized:",
                normalizedPhone
            );


            // =================================================
            // USE CENTRALIZED CONSENT SERVICE
            // =================================================

            const record =
                await getConsentByMobile(
                    normalizedPhone
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
                "DEBUG consent error:",
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
// VERIFY TWILIO WEBHOOK
// =========================================================

function verifyTwilioRequest(req) {

    const authToken =
        process.env.TWILIO_AUTH_TOKEN;


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


    console.log(
        "Twilio signature validation URL:",
        url
    );


    return twilio.validateRequest(

        authToken,

        signature,

        url,

        req.body

    );
}


// =========================================================
// TWILIO INBOUND SMS WEBHOOK
// =========================================================
//
// Customer:
//
// STOP
//
//       ↓
//
// Twilio
//
//       ↓
//
// /twilio/inbound
//
//       ↓
//
// getConsentByMobile()
//
//       ↓
//
// ContactKey
//
//       ↓
//
// optOut()
//
//       ↓
//
// SMSOptIn = false
//
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


            // =================================================
            // 1. VERIFY TWILIO SIGNATURE
            // =================================================

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


            // =================================================
            // 2. GET TWILIO VALUES
            // =================================================

            const from =
                normalizePhone(
                    req.body.From
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
                "From:",
                from
            );


            console.log(
                "Body:",
                body
            );


            console.log(
                "Message SID:",
                messageSid
            );


            // =================================================
            // 3. OPT-OUT KEYWORDS
            // =================================================

            const optOutKeywords = [

                "STOP",

                "UNSUBSCRIBE",

                "CANCEL",

                "END",

                "QUIT"

            ];


            // =================================================
            // 4. CHECK OPT-OUT
            // =================================================

            const isOptOut =
                optOutKeywords.includes(
                    body
                );


            if (!isOptOut) {

                console.log(
                    "Message is not an opt-out keyword"
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
                "OPT-OUT KEYWORD DETECTED"
            );


            // =================================================
            // 5. FIND CONSENT BY MOBILE
            // =================================================
            //
            // +916377783635
            //
            // is converted by sfmcConsent.js to:
            //
            // 916377783635
            //
            // =================================================

            const contact =
                await getConsentByMobile(
                    from
                );


            // =================================================
            // 6. NO RECORD
            // =================================================

            if (!contact) {

                console.warn(
                    "No SFMC consent record found for:",
                    cleanMobileForSFMC(
                        from
                    )
                );


                await logTransaction({

                    transactionId:
                        messageSid ||
                        generateTransactionId(),

                    contactKey:
                        "",

                    mobileNumber:
                        cleanMobileForSFMC(
                            from
                        ),

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


            // =================================================
            // 7. GET CONTACT KEY
            // =================================================

            const contactKey =
                contact.ContactKey ||
                contact.contactKey ||
                "";


            console.log(
                "ContactKey found:",
                contactKey
            );


            // =================================================
            // 8. CONTACT KEY REQUIRED
            // =================================================

            if (!contactKey) {

                console.error(
                    "Consent record found but ContactKey is missing."
                );


                console.error(
                    "Consent record:",
                    JSON.stringify(
                        contact,
                        null,
                        2
                    )
                );


                await logTransaction({

                    transactionId:
                        messageSid ||
                        generateTransactionId(),

                    contactKey:
                        "",

                    mobileNumber:
                        cleanMobileForSFMC(
                            from
                        ),

                    message:
                        body,

                    status:
                        "ERROR",

                    reason:
                        "CONTACT_KEY_MISSING",

                    twilioMessageSid:
                        messageSid,

                    consentStatus:
                        "RECORD_FOUND_CONTACTKEY_MISSING"

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


            // =================================================
            // 9. LOG CURRENT CONSENT
            // =================================================

            console.log(
                "Current consent:",
                JSON.stringify(
                    contact,
                    null,
                    2
                )
            );


            // =================================================
            // 10. UPDATE SFMC CONSENT
            // =================================================

            console.log(
                "Updating SFMC consent to OPTED OUT..."
            );


            await optOut({

                contactKey:

                    contactKey,

                mobileNumber:

                    cleanMobileForSFMC(
                        from
                    ),

                source:

                    "Twilio",

                consentVersion:

                    contact.ConsentVersion ||
                    contact.consentversion ||
                    "v1"

            });


            console.log(
                "SFMC opt-out successfully updated"
            );


            // =================================================
            // 11. LOG TRANSACTION
            // =================================================

            await logTransaction({

                transactionId:
                    messageSid ||
                    generateTransactionId(),

                contactKey:

                    contactKey,

                mobileNumber:

                    cleanMobileForSFMC(
                        from
                    ),

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


            // =================================================
            // 12. TWILIO RESPONSE
            // =================================================

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
//
// POST:
//
// /consent/optin
//
// Header:
//
// X-API-Key: YOUR_WEBHOOK_API_KEY
//
// Body:
//
// {
//   "contactKey": "12345",
//   "mobileNumber": "916377783635",
//   "source": "Preference Center",
//   "consentVersion": "v1"
// }
//
// =========================================================

app.post(
    "/consent/optin",

    async (req, res) => {

        try {

            // =================================================
            // 1. API KEY
            // =================================================

            if (
                WEBHOOK_API_KEY &&

                req.get(
                    "X-API-Key"
                ) !== WEBHOOK_API_KEY

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


            // =================================================
            // 2. CONTACT KEY VALIDATION
            // =================================================

            if (!contactKey) {

                return res
                    .status(400)
                    .json({

                        status:
                            "error",

                        reason:
                            "MISSING_CONTACT_KEY"

                    });
            }


            // =================================================
            // 3. NORMALIZE MOBILE
            // =================================================

            const normalizedPhone =
                normalizePhone(
                    mobileNumber
                );


            // =================================================
            // 4. UPDATE CONSENT
            // =================================================

            const result =
                await optIn({

                    contactKey:

                        contactKey,

                    mobileNumber:

                        cleanMobileForSFMC(
                            normalizedPhone
                        ),

                    source:

                        source ||
                        "Preference Center",

                    consentVersion:

                        consentVersion ||
                        "v1"

                });


            // =================================================
            // 5. RESPONSE
            // =================================================

            return res
                .status(200)
                .json({

                    status:
                        "success",

                    contactKey:
                        contactKey,

                    mobileNumber:
                        cleanMobileForSFMC(
                            normalizedPhone
                        ),

                    result:
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
// DEBUG - PHONE NORMALIZATION
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

                input:

                    input,

                twilioFormat:

                    normalized,

                sfmcFormat:

                    sfmcNumber

            });
    }
);


// =========================================================
// 404 HANDLER
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
            "================================================"
        );
    }
);
