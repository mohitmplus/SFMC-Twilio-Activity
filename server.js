require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const path = require("path");
const app = express();

// Parse raw body for JWT decoding
app.use(express.raw({ type: 'application/jwt' }));
// Serve the frontend files from the "public" folder
app.use(express.static('public'));

// --- YOUR CREDENTIALS ---
const twilioClient = twilio(

    process.env.TWILIO_ACCOUNT_SID,
    
    process.env.TWILIO_AUTH_TOKEN
    
    );

// We will get the JWT Secret from SFMC in the next step. Leave this as a placeholder for now.
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const JWT_SECRET = process.env.JWT_SECRET;
// --- DUMMY ROUTES FOR JOURNEY BUILDER UI SAVING ---
app.post('/save', (req, res) => res.status(200).json({}));
app.post('/publish', (req, res) => res.status(200).json({}));
app.post('/validate', (req, res) => res.status(200).json({}));

// --- THE EXECUTION ENDPOINT ---
app.post('/execute', (req, res) => {
    // 1. Decode the secure JWT sent by SFMC
    jwt.verify(req.body.toString('utf8'), JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error("JWT Verification failed:", err.message);
            // We return 200 even on auth failure so SFMC doesn't pause the journey, 
            // but we don't execute the Twilio code.
            return res.status(200).json({ status: "auth_error" }); 
        }

        // 2. Extract the arguments we saved via customActivity.js
        const inArgs = decoded.inArguments[0];
        let phone = inArgs.phoneNumber; // Changed from const to let so we can modify it
        const message = inArgs.message;

        // --- THE DATA CLEANSING STEP ---
        // 1. Strip out any accidental spaces, dashes, or parentheses 
        phone = phone.replace(/[\s-()]/g, '');
        
        // 2. If the number doesn't start with a '+', add it automatically
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }

        console.log(`Attempting to send SMS to ${phone}...`);
        

        // 3. Send the SMS via Twilio
        twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: phone
        })
        .then(message => {
            console.log("Success! Message SID:", message.sid);
            return res.status(200).json({ status: "success" });
        })
        .catch(err => {
            console.error("Twilio Error:", err.message);
            return res.status(200).json({ status: "error" });
        });
    });
});

app.use(express.json());

// Serve all files from the public folder
app.use(express.static(path.join(__dirname, "public")));

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Twilio Custom Activity Server running on port ${PORT}`);
    
});
