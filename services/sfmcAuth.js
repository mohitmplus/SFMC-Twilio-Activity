const https = require("https");


// =========================================================
// TOKEN CACHE
// =========================================================

let cachedAuth = null;

let tokenExpiresAt = 0;

// Prevent multiple simultaneous OAuth requests
let tokenRequestPromise = null;


// =========================================================
// NORMALIZE URL
// =========================================================

function normalizeBaseUrl(url) {

    if (!url) {

        throw new Error(
            "SFMC_AUTH_BASE_URI is not configured"
        );

    }

    return url.endsWith("/")
        ? url
        : `${url}/`;

}


// =========================================================
// SAFE ERROR
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
            /client_secret["']?\s*[:=]\s*["'][^"']+["']/gi,
            "client_secret: [REDACTED]"
        )
        .replace(
            /access_token["']?\s*[:=]\s*["'][^"']+["']/gi,
            "access_token: [REDACTED]"
        );

}


// =========================================================
// REQUEST TOKEN
// =========================================================

function requestToken() {

    return new Promise(
        (resolve, reject) => {

            try {

                // =================================================
                // AUTH BASE URI
                // =================================================

                const baseUrl =
                    normalizeBaseUrl(
                        process.env.SFMC_AUTH_BASE_URI
                    );


                const url =
                    new URL(
                        "v2/token",
                        baseUrl
                    );


                // =================================================
                // CLIENT CREDENTIALS
                // =================================================

                const clientId =
                    process.env.SFMC_CLIENT_ID;

                const clientSecret =
                    process.env.SFMC_CLIENT_SECRET;


                if (!clientId) {

                    return reject(
                        new Error(
                            "SFMC_CLIENT_ID is missing"
                        )
                    );

                }


                if (!clientSecret) {

                    return reject(
                        new Error(
                            "SFMC_CLIENT_SECRET is missing"
                        )
                    );

                }


                // =================================================
                // OPTIONAL BUSINESS UNIT
                // =================================================
                //
                // If SFMC_TARGET_MID is configured, the token
                // will be generated in that BU context.
                //
                // Salesforce supports account_id for
                // server-to-server integrations.
                //
                // =================================================

                const targetMid =
                    process.env.SFMC_TARGET_MID;


                const payloadObject = {

                    grant_type:
                        "client_credentials",

                    client_id:
                        clientId,

                    client_secret:
                        clientSecret

                };


                if (
                    targetMid &&
                    String(
                        targetMid
                    ).trim()
                ) {

                    payloadObject.account_id =
                        Number(
                            targetMid
                        ) ||
                        String(
                            targetMid
                        ).trim();

                }


                const payload =
                    JSON.stringify(
                        payloadObject
                    );


                console.log(
                    "Requesting new SFMC OAuth token..."
                );


                // =================================================
                // HTTPS REQUEST
                // =================================================

                const request =
                    https.request(

                        url,

                        {

                            method:
                                "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                Accept:
                                    "application/json",

                                "Content-Length":
                                    Buffer.byteLength(
                                        payload
                                    )

                            },

                            timeout:
                                30000

                        },

                        response => {

                            let body = "";


                            // =================================================
                            // RESPONSE DATA
                            // =================================================

                            response.on(
                                "data",
                                chunk => {

                                    body += chunk;

                                }
                            );


                            // =================================================
                            // RESPONSE COMPLETE
                            // =================================================

                            response.on(
                                "end",
                                () => {

                                    if (
                                        response.statusCode < 200 ||
                                        response.statusCode >= 300
                                    ) {

                                        return reject(

                                            new Error(

                                                `SFMC OAuth failed (${response.statusCode}): ${safeErrorText(body)}`

                                            )

                                        );

                                    }


                                    // =================================================
                                    // PARSE JSON
                                    // =================================================

                                    let data;

                                    try {

                                        data =
                                            JSON.parse(
                                                body
                                            );

                                    }
                                    catch (error) {

                                        return reject(

                                            new Error(

                                                `Unable to parse SFMC OAuth response: ${error.message}`

                                            )

                                        );

                                    }


                                    // =================================================
                                    // ACCESS TOKEN
                                    // =================================================

                                    if (
                                        !data.access_token
                                    ) {

                                        return reject(

                                            new Error(
                                                "SFMC OAuth response did not contain access_token"
                                            )

                                        );

                                    }


                                    // =================================================
                                    // INSTANCE URLS
                                    // =================================================

                                    const restInstanceUrl =
                                        data.rest_instance_url ||
                                        process.env.SFMC_REST_BASE_URI;


                                    const soapInstanceUrl =
                                        data.soap_instance_url ||
                                        process.env.SFMC_SOAP_BASE_URI;


                                    if (
                                        !restInstanceUrl
                                    ) {

                                        console.warn(
                                            "WARNING: SFMC REST instance URL was not returned and SFMC_REST_BASE_URI is not configured."
                                        );

                                    }


                                    if (
                                        !soapInstanceUrl
                                    ) {

                                        console.warn(
                                            "WARNING: SFMC SOAP instance URL was not returned and SFMC_SOAP_BASE_URI is not configured."
                                        );

                                    }


                                    // =================================================
                                    // RESOLVE
                                    // =================================================

                                    resolve({

                                        access_token:
                                            data.access_token,

                                        token_type:
                                            data.token_type ||
                                            "Bearer",

                                        expires_in:
                                            Number(
                                                data.expires_in
                                            ) || 1080,

                                        scope:
                                            data.scope ||
                                            "",

                                        rest_instance_url:
                                            restInstanceUrl,

                                        soap_instance_url:
                                            soapInstanceUrl

                                    });

                                });

                            }

                        }
                    );


                // =================================================
                // REQUEST ERROR
                // =================================================

                request.on(
                    "error",
                    error => {

                        reject(

                            new Error(
                                `SFMC OAuth network error: ${error.message}`
                            )

                        );

                    }
                );


                // =================================================
                // REQUEST TIMEOUT
                // =================================================

                request.on(
                    "timeout",
                    () => {

                        request.destroy();

                        reject(

                            new Error(
                                "SFMC OAuth request timed out after 30 seconds"
                            )

                        );

                    }
                );


                // =================================================
                // SEND REQUEST
                // =================================================

                request.write(
                    payload
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
// GET AUTH DETAILS
// =========================================================

async function getAuthDetails() {

    const now =
        Date.now();


    // =========================================================
    // RETURN CACHED TOKEN
    // =========================================================

    if (
        cachedAuth &&
        tokenExpiresAt > now
    ) {

        return cachedAuth;

    }


    // =========================================================
    // PREVENT DUPLICATE TOKEN REQUESTS
    // =========================================================

    if (
        tokenRequestPromise
    ) {

        return tokenRequestPromise;

    }


    // =========================================================
    // REQUEST NEW TOKEN
    // =========================================================

    tokenRequestPromise =
        requestToken()
            .then(
                tokenResponse => {

                    const expiresIn =
                        Number(
                            tokenResponse.expires_in
                        ) || 1080;


                    // =================================================
                    // REFRESH BUFFER
                    // =================================================
                    //
                    // Salesforce documents 1080 seconds as the
                    // expires_in value for the recommended
                    // refresh window.
                    //
                    // We refresh 120 seconds early.
                    //
                    // =================================================

                    const refreshBuffer =
                        Math.min(
                            120,
                            Math.max(
                                30,
                                Math.floor(
                                    expiresIn * 0.1
                                )
                            )
                        );


                    tokenExpiresAt =
                        Date.now() +
                        Math.max(
                            30,
                            expiresIn -
                            refreshBuffer
                        ) *
                        1000;


                    cachedAuth = {

                        access_token:
                            tokenResponse.access_token,

                        token_type:
                            tokenResponse.token_type,

                        expires_in:
                            expiresIn,

                        scope:
                            tokenResponse.scope,

                        rest_instance_url:
                            tokenResponse.rest_instance_url,

                        soap_instance_url:
                            tokenResponse.soap_instance_url

                    };


                    // =================================================
                    // LOG ONLY NON-SENSITIVE INFORMATION
                    // =================================================

                    console.log(
                        "================================================"
                    );

                    console.log(
                        "SFMC OAuth token generated successfully"
                    );

                    console.log(
                        "Token expires in:",
                        expiresIn,
                        "seconds"
                    );

                    console.log(
                        "Token refresh scheduled before expiration"
                    );

                    console.log(
                        "REST instance:",
                        cachedAuth.rest_instance_url || "Not available"
                    );

                    console.log(
                        "SOAP instance:",
                        cachedAuth.soap_instance_url || "Not available"
                    );

                    console.log(
                        "================================================"
                    );


                    return cachedAuth;

                }
            )
            .finally(
                () => {

                    tokenRequestPromise =
                        null;

                }
            );


    return tokenRequestPromise;

}


// =========================================================
// GET ACCESS TOKEN
// =========================================================

async function getAccessToken() {

    const auth =
        await getAuthDetails();


    if (
        !auth ||
        !auth.access_token
    ) {

        throw new Error(
            "SFMC access token is not available"
        );

    }


    return auth.access_token;

}


// =========================================================
// GET REST INSTANCE URL
// =========================================================

async function getRestInstanceUrl() {

    const auth =
        await getAuthDetails();


    if (
        !auth ||
        !auth.rest_instance_url
    ) {

        throw new Error(
            "SFMC REST instance URL is not available"
        );

    }


    return auth.rest_instance_url;

}


// =========================================================
// GET SOAP INSTANCE URL
// =========================================================

async function getSoapInstanceUrl() {

    const auth =
        await getAuthDetails();


    if (
        !auth ||
        !auth.soap_instance_url
    ) {

        throw new Error(
            "SFMC SOAP instance URL is not available"
        );

    }


    return auth.soap_instance_url;

}


// =========================================================
// CLEAR TOKEN CACHE
// =========================================================
//
// Useful if SFMC returns 401 and you want to force
// the next request to obtain a new token.
//
// =========================================================

function clearAuthCache() {

    cachedAuth = null;

    tokenExpiresAt = 0;

    tokenRequestPromise = null;

    console.log(
        "SFMC OAuth cache cleared"
    );

}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getAccessToken,

    getAuthDetails,

    getRestInstanceUrl,

    getSoapInstanceUrl,

    clearAuthCache

};
