const https = require("https");

let cachedToken = null;
let tokenExpiresAt = 0;

function normalizeBaseUrl(url) {
    if (!url) {
        throw new Error("SFMC_AUTH_BASE_URI is not configured");
    }

    return url.endsWith("/") ? url : `${url}/`;
}

function requestToken() {
    return new Promise((resolve, reject) => {

        const baseUrl = normalizeBaseUrl(process.env.SFMC_AUTH_BASE_URI);

        const url = new URL("v2/token", baseUrl);

        const clientId = process.env.SFMC_CLIENT_ID;
        const clientSecret = process.env.SFMC_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return reject(
                new Error("SFMC_CLIENT_ID or SFMC_CLIENT_SECRET is missing")
            );
        }

        const payload = JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret
        });

        const request = https.request(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload)
                }
            },
            response => {

                let body = "";

                response.on("data", chunk => {
                    body += chunk;
                });

                response.on("end", () => {

                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        return reject(
                            new Error(
                                `SFMC OAuth failed (${response.statusCode}): ${body}`
                            )
                        );
                    }

                    try {
                        const data = JSON.parse(body);

                        if (!data.access_token) {
                            return reject(
                                new Error("SFMC OAuth response did not contain access_token")
                            );
                        }

                        resolve(data);

                    } catch (error) {
                        reject(
                            new Error(`Unable to parse SFMC OAuth response: ${error.message}`)
                        );
                    }
                });
            }
        );

        request.on("error", reject);

        request.write(payload);
        request.end();
    });
}

async function getAccessToken() {

    const now = Date.now();

    if (
        cachedToken &&
        now < tokenExpiresAt
    ) {
        return cachedToken;
    }

    const tokenResponse = await requestToken();

    cachedToken = tokenResponse.access_token;

    const expiresIn =
        Number(tokenResponse.expires_in) || 1080;

    // Refresh a little before actual expiration.
    tokenExpiresAt =
        Date.now() + ((expiresIn - 60) * 1000);

    return cachedToken;
}

module.exports = {
    getAccessToken
};