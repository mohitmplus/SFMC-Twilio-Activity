const https = require("https");

let cachedAuth = null;
let tokenExpiresAt = 0;


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
// REQUEST TOKEN
// =========================================================

function requestToken() {

    return new Promise((resolve, reject) => {

        try {

            const baseUrl =
                normalizeBaseUrl(
                    process.env.SFMC_AUTH_BASE_URI
                );

            const url =
                new URL(
                    "v2/token",
                    baseUrl
                );

            const clientId =
                process.env.SFMC_CLIENT_ID;

            const clientSecret =
                process.env.SFMC_CLIENT_SECRET;


            if (!clientId || !clientSecret) {

                return reject(
                    new Error(
                        "SFMC_CLIENT_ID or SFMC_CLIENT_SECRET is missing"
                    )
                );
            }


            const payload =
                JSON.stringify({

                    grant_type:
                        "client_credentials",

                    client_id:
                        clientId,

                    client_secret:
                        clientSecret

                });


            const request =
                https.request(

                    url,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Content-Length":
                                Buffer.byteLength(
                                    payload
                                )

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

                                if (
                                    response.statusCode < 200 ||
                                    response.statusCode >= 300
                                ) {

                                    return reject(

                                        new Error(

                                            `SFMC OAuth failed (${response.statusCode}): ${body}`

                                        )

                                    );

                                }


                                try {

                                    const data =
                                        JSON.parse(
                                            body
                                        );


                                    if (
                                        !data.access_token
                                    ) {

                                        return reject(

                                            new Error(
                                                "SFMC OAuth response did not contain access_token"
                                            )

                                        );

                                    }


                                    resolve(
                                        data
                                    );

                                }

                                catch (error) {

                                    reject(

                                        new Error(

                                            `Unable to parse SFMC OAuth response: ${error.message}`

                                        )

                                    );

                                }

                            }
                        );

                    }

                );


            request.on(
                "error",
                reject
            );


            request.write(
                payload
            );

            request.end();

        }

        catch (error) {

            reject(error);

        }

    });

}


// =========================================================
// GET AUTH DETAILS
// =========================================================

async function getAuthDetails() {

    const now =
        Date.now();


    if (
        cachedAuth &&
        now < tokenExpiresAt
    ) {

        return cachedAuth;

    }


    const tokenResponse =
        await requestToken();


    cachedAuth = {

        access_token:
            tokenResponse.access_token,

        rest_instance_url:
            tokenResponse.rest_instance_url ||
            process.env.SFMC_REST_BASE_URI,

        soap_instance_url:
            tokenResponse.soap_instance_url ||
            process.env.SFMC_SOAP_BASE_URI,

        expires_in:
            tokenResponse.expires_in

    };


    const expiresIn =
        Number(
            tokenResponse.expires_in
        ) || 1080;


    // Refresh before expiration.
    tokenExpiresAt =
        Date.now() +
        Math.max(
            60,
            expiresIn - 120
        ) *
        1000;


    console.log(
        "SFMC OAuth token generated"
    );

    console.log(
        "REST instance:",
        cachedAuth.rest_instance_url
    );

    console.log(
        "SOAP instance:",
        cachedAuth.soap_instance_url
    );


    return cachedAuth;

}


// =========================================================
// GET ACCESS TOKEN
// =========================================================

async function getAccessToken() {

    const auth =
        await getAuthDetails();

    return auth.access_token;

}


// =========================================================
// EXPORT
// =========================================================

module.exports = {

    getAccessToken,

    getAuthDetails

};
