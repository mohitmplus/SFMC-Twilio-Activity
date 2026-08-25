require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const crypto = require("crypto");
const path = require("path");

const {
    getConsent,
    optIn,
    optOut
} = require("./services/sfmcConsent");

const {
    sendSMS
} = require("./services/twilioService");


const app = express();


// ---------------------------------------------------------
// BASIC CONFIGURATION
// ---------------------------------------------------------

app.set("trust proxy", true);

const PORT =
    process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET;

const PUBLIC_BASE_URL =
    process.env.WEBHOOK_BASE_URL ||
    `http://localhost:${PORT}`;

const WEBHOOK_API_KEY =
    process.env.WEBHOOK_API_KEY;


// ---------------------------------------------------------
// VALIDATE REQUIRED ENVIRONMENT VARIABLES
// ---------------------------------------------------------

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
            `WARNING: Environment variable ${variable} is not configured`
        );
    }
}


// ---------------------------------------------------------
// STATIC FILES
// ---------------------------------------------------------

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ---------------------------------------------------------
// NORMAL JSON REQUESTS
// ---------------------------------------------------------

app.use(
    express.json({
        limit: "1mb"
    })
);


// ---------------------------------------------------------
// URL ENCODED REQUESTS
// Required by Twilio inbound webhook
// ---------------------------------------------------------

app.use(
    express.urlencoded({
        extended: false
    })
);


// ---------------------------------------------------------
// HEALTH CHECK
// ---------------------------------------------------------

app.get("/health", (req, res) => {

    res.status(200).json({
        status: "ok",
        service: "SFMC Twilio Custom Activity",
        timestamp: new Date().toISOString()
    });
});


// ---------------------------------------------------------
// HOME
// ---------------------------------------------------------

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});


// ---------------------------------------------------------
// JOURNEY BUILDER SAVE
// ---------------------------------------------------------

app.post("/save", (req, res) => {

    console.log(
        "Journey Builder save request received"
    );

    return res.status(200).json({});
});


// ---------------------------------------------------------
// JOURNEY BUILDER PUBLISH
// ---------------------------------------------------------

app.post("/publish", (req, res) => {

    console.log(
        "Journey Builder publish request received"
    );

    return res.status(200).json({});
});


// ---------------------------------------------------------
// JOURNEY BUILDER VALIDATE
// ---------------------------------------------------------

app.post("/validate", (req, res) => {

    console.log(
        "Journey Builder validate request received"
    );

    return res.status(200).json({});
});


// ---------------------------------------------------------
// NORMALIZE PHONE NUMBER
// ---------------------------------------------------------

function normalizePhone(phone) {

    if (
        phone === undefined ||
        phone === null
    ) {
        return null;
    }

    let normalized =
        String(phone).trim();

    if (!normalized) {
        return null;
    }

    normalized =
        normalized.replace(
            /[\s\-().]/g,
            ""
        );

    if (!normalized.startsWith("+")) {

        normalized =
            "+" + normalized;
    }

    return normalized;
}


// ---------------------------------------------------------
// GENERATE TRANSACTION ID
// ---------------------------------------------------------

function generateTransactionId() {

    return crypto
        .randomUUID();
}


// ---------------------------------------------------------
// SFMC TRANSACTION LOG
// ---------------------------------------------------------

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
        } = require("./services/sfmcAuth");

        const token =
            await getAccessToken();

        const restBase =
            process.env.SFMC_REST_BASE_URI
                .replace(/\/$/, "");

        const deKey =
            process.env.SFMC_TRANSACTION_DE_KEY;

        const url =
            `${restBase}/hub/v1/dataevents/key/` +
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
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );

        if (!response.ok) {

            const body =
                await response.text();

            console.error(
                "Transaction log failed:",
                response.status,
                body
            );
        }

    } catch (error) {

        console.error(
            "Transaction logging error:",
            error.message
        );
    }
}


// ---------------------------------------------------------
// VERIFY JOURNEY BUILDER JWT
// ---------------------------------------------------------

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
            req.body.toString("utf8");

    } else if (
        typeof req.body === "string"
    ) {

        token =
            req.body;

    } else {

        throw new Error(
            "JWT request body is not valid"
        );
    }

    return jwt.verify(
        token,
        JWT_SECRET
    );
}


// ---------------------------------------------------------
// EXECUTE JOURNEY ACTIVITY
// ---------------------------------------------------------

app.post(
    "/execute",

    // Journey Builder sends application/jwt.
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

            // ---------------------------------------------
            // 1. VERIFY JWT
            // ---------------------------------------------

            const decoded =
                verifyJourneyJWT(req);

            console.log(
                "Journey JWT successfully verified"
            );


            // ---------------------------------------------
            // 2. READ IN ARGUMENTS
            // ---------------------------------------------

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
                decoded.inArguments[0];


            contactKey =
                inArgs.contactKey ||
                "";

            phone =
                normalizePhone(
                    inArgs.phoneNumber
                );

            message =
                inArgs.message ||
                "";


            console.log(
                "Journey request:",
                {
                    transactionId,
                    contactKey,
                    phone,
                    messageLength:
                        message.length
                }
            );


            // ---------------------------------------------
            // 3. VALIDATE CONTACT KEY
            // ---------------------------------------------

            if (!contactKey) {

                await logTransaction({

                    transactionId,
                    contactKey,
                    mobileNumber: phone,
                    message,
                    status: "SKIPPED",
                    reason: "MISSING_CONTACT_KEY"
                });

                return res.status(200).json({

                    status: "skipped",

                    reason:
                        "MISSING_CONTACT_KEY"
                });
            }


            // ---------------------------------------------
            // 4. VALIDATE PHONE
            // ---------------------------------------------

            if (!phone) {

                await logTransaction({

                    transactionId,
                    contactKey,
                    mobileNumber: "",
                    message,
                    status: "SKIPPED",
                    reason: "MISSING_PHONE"
                });

                return res.status(200).json({

                    status: "skipped",

                    reason:
                        "MISSING_PHONE"
                });
            }


            // ---------------------------------------------
            // 5. VALIDATE MESSAGE
            // ---------------------------------------------

            if (!message.trim()) {

                await logTransaction({

                    transactionId,
                    contactKey,
                    mobileNumber: phone,
                    message,
                    status: "SKIPPED",
                    reason: "EMPTY_MESSAGE"
                });

                return res.status(200).json({

                    status: "skipped",

                    reason:
                        "EMPTY_MESSAGE"
                });
            }


            // ---------------------------------------------
            // 6. LIVE SFMC CONSENT CHECK
            // ---------------------------------------------

            const consent =
                await getConsent(
                    contactKey
                );


            // ---------------------------------------------
            // NO CONSENT RECORD
            // ---------------------------------------------

            if (!consent) {

                console.log(
                    `No consent record for ${contactKey}`
                );

                await logTransaction({

                    transactionId,
                    contactKey,
                    mobileNumber: phone,
                    message,
                    status: "SKIPPED",
                    reason: "NO_CONSENT_RECORD",
                    consentStatus:
                        "NO_RECORD"
                });

                return res.status(200).json({

                    status: "skipped",

                    reason:
                        "NO_CONSENT_RECORD"
                });
            }


            // ---------------------------------------------
            // OPTED OUT
            // ---------------------------------------------

            if (
                consent.SMSOptIn !== true
            ) {

                console.log(
                    `SMS blocked for ${contactKey}`
                );

                await logTransaction({

                    transactionId,
                    contactKey,
                    mobileNumber: phone,
                    message,
                    status: "SKIPPED",
                    reason: "SMS_OPT_OUT",
                    consentStatus:
                        "OPTED_OUT"
                });

                return res.status(200).json({

                    status: "skipped",

                    reason:
                        "SMS_OPT_OUT"
                });
            }


            // ---------------------------------------------
            // 7. SEND SMS
            // ---------------------------------------------

            console.log(
                `Sending SMS to ${phone}`
            );

            const twilioMessage =
                await sendSMS({

                    to: phone,

                    body: message
                });


            // ---------------------------------------------
            // 8. LOG SUCCESS
            // ---------------------------------------------

            await logTransaction({

                transactionId,
                contactKey,
                mobileNumber: phone,
                message,
                status: "SENT",
                reason: "",
                twilioMessageSid:
                    twilioMessage.sid,
                consentStatus:
                    "OPTED_IN"
            });


            console.log(
                "SMS successfully sent:",
                twilioMessage.sid
            );


            return res.status(200).json({

                status: "success",

                transactionId,

                twilioMessageSid:
                    twilioMessage.sid
            });


        } catch (error) {

            console.error(
                "Execute error:",
                error
            );


            await logTransaction({

                transactionId,
                contactKey,
                mobileNumber: phone,
                message,
                status: "ERROR",
                reason: "EXECUTE_ERROR",
                errorMessage:
                    error.message
            });


            return res.status(200).json({

                status: "error",

                transactionId,

                reason:
                    "EXECUTE_ERROR"
            });
        }
    }
);


// ---------------------------------------------------------
// TWILIO WEBHOOK AUTHENTICATION
// ---------------------------------------------------------

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

        return false;
    }


    const url =
        `${PUBLIC_BASE_URL}${req.originalUrl}`;


    return twilio.validateRequest(
        authToken,
        signature,
        url,
        req.body
    );
}


// ---------------------------------------------------------
// TWILIO INBOUND SMS WEBHOOK
// ---------------------------------------------------------

app.post(
    "/twilio/inbound",

    async (req, res) => {

        try {

            console.log(
                "Twilio inbound message received"
            );


            // ---------------------------------------------
            // SECURITY CHECK
            // ---------------------------------------------

            const valid =
                verifyTwilioRequest(req);

            if (!valid) {

                console.error(
                    "Invalid Twilio signature"
                );

                return res
                    .status(403)
                    .send("Forbidden");
            }


            // ---------------------------------------------
            // READ TWILIO MESSAGE
            // ---------------------------------------------

            const from =
                normalizePhone(
                    req.body.From
                );

            const body =
                String(
                    req.body.Body || ""
                )
                .trim()
                .toUpperCase();

            const messageSid =
                req.body.MessageSid ||
                "";


            console.log(
                "Inbound SMS:",
                {
                    from,
                    body,
                    messageSid
                }
            );


            // ---------------------------------------------
            // OPT-OUT KEYWORDS
            // ---------------------------------------------

            const optOutKeywords = [
                "STOP",
                "UNSUBSCRIBE",
                "CANCEL",
                "END",
                "QUIT"
            ];


            if (
                optOutKeywords.includes(body)
            ) {

                /*
                 * IMPORTANT:
                 *
                 * We need ContactKey to update SFMC.
                 *
                 * Since the inbound SMS only contains
                 * the phone number, we look up the
                 * consent DE by mobile number.
                 */

                const contact =
                    await findConsentByMobile(
                        from
                    );


                if (contact) {

                    await optOut({

                        contactKey:
                            contact.ContactKey,

                        mobileNumber:
                            from,

                        source:
                            "Twilio",

                        consentVersion:
                            contact.ConsentVersion ||
                            "v1"
                    });


                    console.log(
                        `Opt-out recorded for ${contact.ContactKey}`
                    );

                } else {

                    console.warn(
                        `No SFMC consent record found for ${from}`
                    );
                }
            }


            // ---------------------------------------------
            // RETURN TWIML
            // ---------------------------------------------

            res.type("text/xml");

            return res
                .status(200)
                .send(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                    "<Response></Response>"
                );


        } catch (error) {

            console.error(
                "Twilio inbound error:",
                error
            );

            res.type("text/xml");

            return res
                .status(200)
                .send(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                    "<Response></Response>"
                );
        }
    }
);


// ---------------------------------------------------------
// FIND CONSENT BY MOBILE NUMBER
// ---------------------------------------------------------

async function findConsentByMobile(
    mobileNumber
) {

    const {
        getAccessToken
    } = require("./services/sfmcAuth");

    const token =
        await getAccessToken();

    const restBase =
        process.env.SFMC_REST_BASE_URI
            .replace(/\/$/, "");

    const deKey =
        process.env.SFMC_CONSENT_DE_KEY;

    const escapedNumber =
        String(mobileNumber)
            .replace(/'/g, "''");

    const filter =
        `MobileNumber eq '${escapedNumber}'`;

    const url =
        `${restBase}/data/v1/customobjectdata/key/` +
        `${encodeURIComponent(deKey)}/rowset` +
        `?$filter=${encodeURIComponent(filter)}`;


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


    if (!response.ok) {

        const body =
            await response.text();

        throw new Error(
            `SFMC consent mobile lookup failed: ${response.status} ${body}`
        );
    }


    const data =
        await response.json();


    if (
        !data.items ||
        !data.items.length
    ) {

        return null;
    }


    return (
        data.items[0].values ||
        data.items[0]
    );
}


// ---------------------------------------------------------
// OPTIONAL OPT-IN API
// ---------------------------------------------------------
//
// This can be called from your CloudPage/backend.
//
// Do NOT expose this endpoint publicly without
// authentication.
// ---------------------------------------------------------

app.post(
    "/consent/optin",

    async (req, res) => {

        try {

            if (
                WEBHOOK_API_KEY &&
                req.get("X-API-Key") !==
                WEBHOOK_API_KEY
            ) {

                return res
                    .status(401)
                    .json({
                        status: "error",
                        reason: "UNAUTHORIZED"
                    });
            }


            const {
                contactKey,
                mobileNumber,
                source,
                consentVersion
            } = req.body;


            if (!contactKey) {

                return res
                    .status(400)
                    .json({
                        status: "error",
                        reason:
                            "MISSING_CONTACT_KEY"
                    });
            }


            const normalizedPhone =
                normalizePhone(
                    mobileNumber
                );


            const result =
                await optIn({

                    contactKey,

                    mobileNumber:
                        normalizedPhone,

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

                    status: "success",

                    contactKey,

                    result
                });


        } catch (error) {

            console.error(
                "Opt-in error:",
                error
            );

            return res
                .status(500)
                .json({

                    status: "error",

                    reason:
                        "OPT_IN_FAILED",

                    message:
                        error.message
                });
        }
    }
);


// ---------------------------------------------------------
// 404
// ---------------------------------------------------------

app.use(
    (req, res) => {

        res.status(404).json({
            status: "not_found"
        });
    }
);


// ---------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------

app.use(
    (error, req, res, next) => {

        console.error(
            "Unhandled error:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(error);
        }

        res.status(500).json({
            status: "error"
        });
    }
);


// ---------------------------------------------------------
// START SERVER
// ---------------------------------------------------------

app.listen(
    PORT,
    () => {

        console.log(
            `Twilio Custom Activity Server running on port ${PORT}`
        );

        console.log(
            `Webhook URL: ${PUBLIC_BASE_URL}/twilio/inbound`
        );
    }
);