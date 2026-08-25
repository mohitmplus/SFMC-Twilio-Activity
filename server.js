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
//
// Required for Twilio webhook.
//
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
            "Journey Builder SAVE request"
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
            "Journey Builder PUBLISH request"
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
            "Journey Builder VALIDATE request"
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
// +916377783635
//
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
//
// +916377783635
//        ↓
// 916377783635
//
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
//
// Journey
//   ↓
// ContactKey
//   ↓
// Mobile
//   ↓
// Consent
//   ↓
// SMSOptIn?
//   ↓
// YES → Twilio
// NO  → Skip
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
            // VERIFY JWT
            // =================================================

            const decoded =
                verifyJourneyJWT(
                    req
                );


            console.log(
                "Journey Builder JWT verified"
            );


            console.log(
                JSON.stringify(
                    decoded,
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
                    "No inArguments found"
                );
            }


            const inArgs =
                Object.assign(
                    {},
                    ...decoded.inArguments
                );


            // =================================================
            // CONTACT KEY
            // =================================================

            contactKey =
                inArgs.contactKey ||
                inArgs.ContactKey ||
                "";


            // =================================================
            // MOBILE
            // =================================================

            phone =
                normalizePhone(

                    inArgs.phoneNumber ||

                    inArgs.PhoneNumber ||

                    inArgs.mobileNumber ||

                    inArgs.MobileNumber

                );


            // =================================================
            // MESSAGE
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

                    phone

                }
            );


            // =================================================
            // CONTACT KEY VALIDATION
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
            // CONSENT LOOKUP BY CONTACT KEY
            // =================================================

            const consent =
                await getConsent(
                    contactKey
                );


            // =================================================
            // NO CONSENT RECORD
            // =================================================

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
            // CHECK SMS OPT-IN
            // =================================================

            const isOptedIn =
                consent.SMSOptIn === true;


            console.log(
                "Consent:",
                JSON.stringify(
                    consent,
                    null,
                    2
                )
            );


            console.log(
                "SMSOptIn:",
                isOptedIn
            );


            // =================================================
            // BLOCK OPTED OUT
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
            // SEND SMS
            // =================================================

            console.log(
                "Consent is TRUE."
            );


            console.log(
                "Sending SMS:",
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
            // LOG SUCCESS
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
// DEBUG - CONSENT BY MOBILE
// =========================================================
//
// Example:
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
//
// Customer:
//
// STOP
//
// Twilio:
//
// +916377783635
//
// SFMC:
//
// 916377783635
//
// Flow:
//
// Twilio
//    ↓
// MobileNumber
//    ↓
// getConsentByMobile()
//    ↓
// optOut()
//    ↓
// SMSOptIn = false
//
// ContactKey is NOT required.
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
            // VERIFY TWILIO SIGNATURE
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
            // GET MOBILE
            // =================================================

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


            // =================================================
            // OPT-OUT KEYWORDS
            // =================================================

            const optOutKeywords = [

                "STOP",

                "UNSUBSCRIBE",

                "CANCEL",

                "END",

                "QUIT"

            ];


            // =================================================
            // CHECK OPT-OUT
            // =================================================

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


            // =================================================
            // FIND CONSENT BY MOBILE
            // =================================================

            const contact =
                await getConsentByMobile(
                    mobileNumber
                );


            // =================================================
            // NO RECORD
            // =================================================

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

                    mobileNumber:
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


            // =================================================
            // CONTACT KEY IS OPTIONAL
            // =================================================

            const contactKey =
                contact.ContactKey ||
                "";


            console.log(
                "ContactKey:",
                contactKey ||
                "(not available)"
            );


            // =================================================
            // UPDATE CONSENT
            // =================================================
            //
            // IMPORTANT:
            //
            // No ContactKey dependency.
            //
            // MobileNumber controls the operation.
            //
            // =================================================

            const result =
                await optOut({

                    contactKey:
                        contactKey,

                    mobileNumber:
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


            // =================================================
            // LOG TRANSACTION
            // =================================================

            await logTransaction({

                transactionId:
                    messageSid ||
                    generateTransactionId(),

                contactKey:
                    contactKey,

                mobileNumber:
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


            console.log(
                "================================================"
            );

            console.log(
                "TWILIO OPT-OUT COMPLETED"
            );

            console.log(
                "MobileNumber:",
                mobileNumber
            );

            console.log(
                "SMSOptIn: FALSE"
            );

            console.log(
                "OptOutSource: Twilio"
            );

            console.log(
                "TwilioOptOutStatus: OptedOut"
            );

            console.log(
                "================================================"
            );


            // =================================================
            // TWILIO RESPONSE
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
// POST /consent/optin
//
// Body:
//
// {
//   "mobileNumber": "916377783635",
//   "contactKey": "003XXXXXXXXXXXX",
//   "source": "Preference Center",
//   "consentVersion": "v1"
// }
//
// MobileNumber is required.
// ContactKey is optional.
//
// =========================================================

app.post(
    "/consent/optin",

    async (req, res) => {

        try {

            // =================================================
            // API KEY
            // =================================================

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


            // =================================================
            // MOBILE IS REQUIRED
            // =================================================

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


            // =================================================
            // OPT-IN
            // =================================================

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


            // =================================================
            // RESPONSE
            // =================================================

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
// DEBUG PHONE
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
            "================================================"
        );
    }
);
