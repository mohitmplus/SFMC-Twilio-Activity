const connection = new Postmonger.Session();
let payload = {};
let eventDefinitionKey = ""; // We will store the dynamic ID here

$(document).ready(function() {
    connection.trigger('ready');
    // Ask Journey Builder for the current Journey's blueprint
    connection.trigger('requestInteraction'); 
});

// 1. Catch the Journey blueprint and extract the Entry Source ID
connection.on('requestedInteraction', function(interaction) {
    console.log("DEBUG: Journey Blueprint received", interaction);
    
    // Safety check to ensure there is actually an entry source configured
    if (interaction.triggers && interaction.triggers.length > 0) {
        eventDefinitionKey = interaction.triggers[0].metaData.eventDefinitionKey;
        console.log("DEBUG: The dynamic Event Key is: " + eventDefinitionKey);
    }
});

// 2. Load existing data if they are editing the activity
connection.on('initActivity', function(data) {
    if (data) {
        payload = data;
    }

    let hasInArgs = false;
    if (payload.arguments && payload.arguments.execute && payload.arguments.execute.inArguments && payload.arguments.execute.inArguments.length > 0) {
        hasInArgs = true;
    }

    if (hasInArgs) {
        const existingMessage = payload.arguments.execute.inArguments[0].message;
        $('#smsMessage').val(existingMessage);
    }
});

// 3. When the user clicks "Done"
connection.on('clickedNext', function() {
    const userMessage = $('#smsMessage').val();
    
    // Construct the dynamic binding string
    // It will look like this: {{Event.ContactEvent-abc123def456.Phone}}
    const dynamicPhoneBinding = "{{Event." + eventDefinitionKey + ".Phone}}";
    
    payload['arguments'] = payload['arguments'] || {};
    payload['arguments'].execute = payload['arguments'].execute || {};
    
    payload['arguments'].execute.inArguments = [{
        "message": userMessage,
        "phoneNumber": dynamicPhoneBinding 
    }];
    
    payload['metaData'] = payload['metaData'] || {};
    payload['metaData'].isConfigured = true;
    
    connection.trigger('updateActivity', payload);
});