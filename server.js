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
//
// Input:
//
// +91 6377783635
// 916377783635
//
// Output:
//
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
//
// IMPORTANT:
//
// This function does NOT silently hide SFMC errors.
//
// It prints:
//
// 1. DE key
// 2. REST URL
// 3. Transaction ID
// 4. Payload
// 5. HTTP status
// 6. SFMC response
//
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

        // =====================================================
        // CHECK CONFIGURATION
        // =====================================================

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
        // GET SFMC ACCESS TOKEN
        // =====================================================

        console.log(
            "Getting SFMC access token..."
        );


        const {
            getAccessToken
        } = require(
            "./services/sfmcAuth"
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
        // BUILD REST URL
        // =====================================================

        const cleanRestBase =
            restBase.replace(
                /\/+$/,
                ""
            );


        const url =
    `${cleanRestBase}` +
    `/hub/v1/dataevents/key:` +
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
        // CREATE PAYLOAD
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
        // SEND TO SFMC
        // =====================================================

        console.log(
            "Sending transaction to SFMC..."
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


        // =====================================================
        // HANDLE SFMC ERROR
        // =====================================================

        if (!response.ok) {

            throw new Error(

                `SFMC Transaction Log API failed. ` +
                `HTTP ${response.status}. ` +
                `Response: ${responseText}`

            );
        }


        // =====================================================
        // SUCCESS
        // =====================================================

        console.log(
            "SFMC TRANSACTION LOG SUCCESS"
        );

        console.log(
            "TransactionId:",
            transactionId
        );

        console.log(
            "================================================"
        );


        return {

            success:
                true,

            transactionId:

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


        // IMPORTANT:
        //
        // Do NOT throw the error to Journey Builder.
        //
        // SMS can already be successfully delivered.
        //
        // Therefore logging failure should not change
        // the SMS delivery result.
        //

        return {

            success:
                false,

            transactionId:

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
            // CLEAN MOBILE FOR SFMC
            // =================================================

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
                "Consent lookup method:",
                "MobileNumber"
            );

            console.log(
                "================================================"
            );


            // =================================================
            // CONSENT LOOKUP BY MOBILE
            // =================================================

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
            // NO CONSENT RECORD
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
            // CHECK SMS OPT-IN
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
            // CONSENT APPROVED
            // =================================================

            console.log(
                "================================================"
            );

            console.log(
                "CONSENT APPROVED"
            );

            console.log(
                "SMSOptIn = TRUE"
            );

            console.log(
                "Proceeding to Twilio..."
            );

            console.log(
                "================================================"
            );


            // =================================================
            // SEND SMS
            // =================================================

            console.log(
                "Calling Twilio sendSMS()..."
            );

            console.log(
                "To:",
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
            // VERIFY TWILIO RESPONSE
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
            // LOG SUCCESS TO SFMC
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
            // IMPORTANT:
            // SMS SENT EVEN IF LOG FAILED
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
            // RETURN SUCCESS
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
            // LOG ERROR TO SFMC
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
// DEBUG - CONSENT BY MOBILE
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
//
// This endpoint is VERY IMPORTANT for troubleshooting.
//
// Call:
//
// GET /debug/transaction-log
//
// It will try to write one test record into:
//
// SMS_Transaction_Log
//
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
            // MOBILE
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
            // FIND CONSENT
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
            // CONTACT KEY OPTIONAL
            // =================================================

            const contactKey =
                contact.ContactKey ||
                "";


            // =================================================
            // UPDATE CONSENT
            // =================================================

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


            // =================================================
            // LOG TRANSACTION
            // =================================================

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
            // MOBILE REQUIRED
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
            "Consent lookup: MOBILE NUMBER"
        );

        console.log(
            "================================================"
        );
    }
);
