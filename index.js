// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const path = require('path');
const restify = require('restify');
const { BotFrameworkAdapter } = require('botbuilder');
const { BotConfiguration } = require('botframework-config');
const { QnAMakerBot } = require('./bot');
const { MyAppInsightsMiddleware } = require('./middleware');

// Read botFilePath and botFileSecret from .env file.
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, './.env');
require('dotenv').config({ path: ENV_FILE });

// Get the .bot file path.
const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));
let botConfig;
try {    
    console.log(BOT_FILE);
    console.log(process.env.botFileSecret);
    // Read bot configuration from .bot file.
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
    
    //botConfig = BotConfiguration.loadSync(BOT_FILE, '');

} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.\n\n`);
    console.error(err);
    process.exit();
}

// For local development configuration as defined in .bot file.
//const DEV_ENVIRONMENT = 'development';
const DEV_ENVIRONMENT = 'qna-with-insights-QnAMaker';


// Bot name as defined in .bot file or from runtime.
// See https://aka.ms/about-bot-file to learn more about .bot files.
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);

// QnA Maker and Application Insights service names as found in .bot file.
//const QNA_CONFIGURATION = 'qnamakerService';
const QNA_CONFIGURATION = 'qna-with-insights-QnAMaker';

const APP_INSIGHTS_CONFIGURATION = 'appInsights';

// Get bot endpoint configuration by service name.
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);
const qnaConfig = botConfig.findServiceByNameOrId(QNA_CONFIGURATION);
const appInsightsConfig = botConfig.findServiceByNameOrId(APP_INSIGHTS_CONFIGURATION);

// Map the contents of qnaConfig to a consumable format for our MyAppInsightsQnAMaker class.
const qnaEndpointSettings = {
    knowledgeBaseId: qnaConfig.kbId,
    endpointKey: qnaConfig.endpointKey,
    host: qnaConfig.hostname
};

// Create two variables to indicate whether or not the bot should include messages' text and usernames when
// sending information to Application Insights.
// These settings are used in the MyApplicationInsightsMiddleware and also in MyAppInsightsQnAMaker.
const logMessage = true;
const logName = true;

// Map the contents of appInsightsConfig to a consumable format for MyAppInsightsMiddleware.
//const appInsightsSettings = {
///    instrumentationKey: appInsightsConfig.instrumentationKey,
//    logOriginalMessage: logMessage,
//    logUserName: logName
//};

// Create adapter. See https://aka.ms/about-bot-adapter to learn more adapters.
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword
});

// Register a MyAppInsightsMiddleware instance.
// This will send to Application Insights all incoming Message-type activities.
// It also stores in TurnContext.TurnState an `applicationinsights` TelemetryClient instance.
// This cached TelemetryClient is used by the custom class MyAppInsightsQnAMaker.
//adapter.use(new MyAppInsightsMiddleware(appInsightsSettings));

// Create the SuggestedActionsBot.
let bot;
try {
    console.error(`entras en el bot`);
    console.error(logMessage.toString());
    console.error(logName.toString());
    console.error(qnaEndpointSettings.endpointKey.toString());
    console.error(qnaEndpointSettings.host.toString());
    bot = new QnAMakerBot(qnaEndpointSettings, {}, logMessage, logName);
} catch (err) {
    console.error(`[botInitializationError]: ${ err }`);
    process.exit();
}

// Catch-all for errors.
 adapter.onTurnError = async (turnContext, error) => {
    console.error(`\n [onTurnError]: ${ error }`);
    
    await turnContext.sendActivity(`Oops. Something went wrong!`);
};


// Create HTTP server.
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${ server.name } listening to ${ server.url }.`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator.`);
    console.log(`\nTo talk to your bot, open qna-with-appinsights.bot file in the emulator.`);
});


// Listen for incoming requests.
server.post('/api/messages', async (req, res) => {
    await adapter.processActivity(req, res, async (context) => {
        await bot.onTurn(context);
        console.error(req.toString());
        console.error(res.toString());
    });
});
