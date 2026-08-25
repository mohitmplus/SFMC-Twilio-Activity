const twilio = require("twilio");

function getClient() {

    const accountSid =
        process.env.TWILIO_ACCOUNT_SID;

    const authToken =
        process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error(
            "TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing"
        );
    }

    return twilio(
        accountSid,
        authToken
    );
}


async function sendSMS({
    to,
    body
}) {

    const from =
        process.env.TWILIO_PHONE_NUMBER;

    if (!from) {
        throw new Error(
            "TWILIO_PHONE_NUMBER is not configured"
        );
    }

    if (!to) {
        throw new Error(
            "Recipient phone number is required"
        );
    }

    if (!body) {
        throw new Error(
            "SMS message is required"
        );
    }

    const client =
        getClient();

    const result =
        await client.messages.create({
            body,
            from,
            to
        });

    return result;
}


module.exports = {
    sendSMS
};