const https = require("https");

const {
    getAccessToken
} = require("./sfmcAuth");


/**
 * ------------------------------------------------------------
 * XML ESCAPE
 * ------------------------------------------------------------
 */

function xmlEscape(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}


/**
 * ------------------------------------------------------------
 * SOAP REQUEST
 * ------------------------------------------------------------
 */

function soapRequest(xml) {

    return new Promise(async (resolve, reject) => {

        try {

            const token =
                await getAccessToken();


            const soapBase =
                process.env.SFMC_SOAP_BASE_URI;


            if (!soapBase) {

                throw new Error(
                    "SFMC_SOAP_BASE_URI is not configured"
                );
            }


            const endpoint =
                soapBase.replace(/\/+$/, "") +
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
                "OAuth token obtained successfully"
            );

            console.log(
                "================================================"
            );


            const url =
                new URL(endpoint);


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
                                Buffer.byteLength(xml),

                            SOAPAction:
                                "Retrieve"

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


                                resolve(body);

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

            reject(error);

        }

    });

}


/**
 * ------------------------------------------------------------
 * GET DATA EXTENSION OBJECT ID
 * ------------------------------------------------------------
 */

async function getDataExtensionObjectId(
    customerKey
) {

    const token =
        await getAccessToken();


    const soapBase =
        process.env.SFMC_SOAP_BASE_URI;


    if (!soapBase) {

        throw new Error(
            "SFMC_SOAP_BASE_URI is not configured"
        );
    }


    const endpoint =
        soapBase.replace(/\/+$/, "") +
        "/Service.asmx";


    const escapedKey =
        xmlEscape(
            customerKey
        );


    const xml = `<?xml version="1.0" encoding="UTF-8"?>

<s:Envelope
    xmlns:s="http://www.w3.org/2003/05/soap-envelope"
    xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">

    <s:Header>

        <a:Action s:mustUnderstand="1">
            Retrieve
        </a:Action>

        <a:To s:mustUnderstand="1">
            ${xmlEscape(endpoint)}
        </a:To>

        <fueloauth
            xmlns="http://exacttarget.com">
            ${xmlEscape(token)}
        </fueloauth>

    </s:Header>

    <s:Body>

        <RetrieveRequestMsg
            xmlns="http://exacttarget.com/wsdl/partnerAPI">

            <RetrieveRequest>

                <ObjectType>DataExtension</ObjectType>

                <Properties>
                    ObjectID
                </Properties>

                <Properties>
                    CustomerKey
                </Properties>

                <Filter xsi:type="SimpleFilterPart"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

                    <Property>CustomerKey</Property>

                    <SimpleOperator>equals</SimpleOperator>

                    <Value>
                        ${escapedKey}
                    </Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </s:Body>

</s:Envelope>`;


    console.log(
        "Retrieving Data Extension:",
        customerKey
    );


    const response =
        await soapRequest(
            xml
        );


    const objectIdMatch =
        response.match(
            /<ObjectID>([^<]+)<\/ObjectID>/i
        );


    if (
        !objectIdMatch
    ) {

        throw new Error(

            "Unable to find Data Extension ObjectID. SOAP response: " +
            response

        );

    }


    return objectIdMatch[1];

}


/**
 * ------------------------------------------------------------
 * GET DATA EXTENSION FIELDS
 * ------------------------------------------------------------
 */

async function getDataExtensionFields(
    customerKey
) {

    console.log(
        "================================================"
    );

    console.log(
        "GET DATA EXTENSION FIELDS"
    );

    console.log(
        "CustomerKey:",
        customerKey
    );

    console.log(
        "================================================"
    );


    const objectId =
        await getDataExtensionObjectId(
            customerKey
        );


    console.log(
        "Data Extension ObjectID:",
        objectId
    );


    const token =
        await getAccessToken();


    const soapBase =
        process.env.SFMC_SOAP_BASE_URI;


    const endpoint =
        soapBase.replace(/\/+$/, "") +
        "/Service.asmx";


    const escapedObjectId =
        xmlEscape(
            objectId
        );


    const xml = `<?xml version="1.0" encoding="UTF-8"?>

<s:Envelope
    xmlns:s="http://www.w3.org/2003/05/soap-envelope"
    xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">

    <s:Header>

        <a:Action s:mustUnderstand="1">
            Retrieve
        </a:Action>

        <a:To s:mustUnderstand="1">
            ${xmlEscape(endpoint)}
        </a:To>

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

                <Filter xsi:type="SimpleFilterPart"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

                    <Property>DataExtension.ObjectID</Property>

                    <SimpleOperator>equals</SimpleOperator>

                    <Value>
                        ${escapedObjectId}
                    </Value>

                </Filter>

            </RetrieveRequest>

        </RetrieveRequestMsg>

    </s:Body>

</s:Envelope>`;


    const response =
        await soapRequest(
            xml
        );


    console.log(
        "SOAP FIELD RESPONSE RECEIVED"
    );


    console.log(
        "SOAP Response Length:",
        response.length
    );


    const fields = [];


    const regex =
        /<Results>([\s\S]*?)<\/Results>/gi;


    let match;


    while (
        (match = regex.exec(response))
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
        "Fields found:",
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

            "SFMC returned no Data Extension fields. SOAP response: " +
            response

        );

    }


    return fields;

}


module.exports = {

    getDataExtensionFields

};
