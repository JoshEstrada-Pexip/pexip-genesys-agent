import controller from './notifications-controller.js';
import config from './config.js';
import {PexRtcWrapper} from './pexrtc-wrapper.js';

// Obtain a reference to the platformClient object
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

// API instances
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();

// Client App
let ClientApp = window.purecloud.apps.ClientApp;
let clientApp = new ClientApp({
    pcEnvironment: config.genesys.region
});

let conversationId = '';
let agent = null;

const urlParams = new URLSearchParams(window.location.search);
conversationId = urlParams.get('conversationid');

const redirectUri = config.environment === 'development' ? 
                      config.developmentUri : config.prodUri;

client.setEnvironment(config.genesys.region);
client.loginImplicitGrant(
    config.genesys.oauthClientID,
    redirectUri,
    { state: conversationId }
)
.then(data => {
    conversationId = data.state;
    return usersApi.getUsersMe();
}).then(currentUser => {
    agent = currentUser;
    return conversationsApi.getConversation(conversationId);
}).then((conversation) => {
    let videoElement = document.getElementById(config.videoElementId);
    let confNode = config.pexip.conferenceNode;
    let displayName = `Agent: ${agent.name}`;
    let pin = config.pexip.conferencePin;
    let confAlias = conversation.participants?.filter((p) => p.purpose == "customer")[0]?.aniName;

    console.assert(confAlias, "Unable to determine the conference alias.");

    let prefixedConfAlias = `${config.pexip.conferencePrefix}${confAlias}`;

    let pexrtcWrapper = new PexRtcWrapper(videoElement, confNode, prefixedConfAlias, displayName, pin);
    pexrtcWrapper.makeCall().muteAudio();


    controller.createChannel()
    .then(_ => {
      return controller.addSubscription(
        `v2.users.${agent.id}.conversations.calls`,
        (callEvent) => {
          let agentParticipant = callEvent?.eventBody?.participants?.filter((p) => p.purpose == "agent")[0];
          if (agentParticipant?.state === "disconnected") {
            console.log("Agent has ended the call. Disconnecting all conference participants");
            pexrtcWrapper.disconnectAll();
          }
        });
    });

    clientApp.lifecycle.addStopListener(() => {
      console.log("Application is closing. Cleaning up resources.");
      pexrtcWrapper.disconnectAll();
    }, true);

    return pexrtcWrapper;
}).then(data => {
    console.log('Finished Setup');

    //Try to auto launch to the integration tab to open widget on call
    console.log('Starting auto-launch process for integration tab');
    const interval = setInterval(() => {
      const widgetBtn = document.getElementById("ember2049");
      console.log('Checking for ember2049 element:', widgetBtn ? 'Found' : 'Not found');
      
      if (widgetBtn) {
        console.log('Initial state of ember2049:', {
          display: widgetBtn.style.display,
          visibility: widgetBtn.style.visibility,
          hidden: widgetBtn.hidden,
          classList: Array.from(widgetBtn.classList),
          parentDisplay: widgetBtn.parentElement ? widgetBtn.parentElement.style.display : 'No parent'
        });
        
        // Make the element visible first
        widgetBtn.style.display = "block";
        widgetBtn.hidden = false; // Also remove the hidden attribute if present
        
        console.log('After visibility changes:', {
          display: widgetBtn.style.display,
          visibility: widgetBtn.style.visibility,
          hidden: widgetBtn.hidden
        });
        
        // Add a small delay before clicking to ensure the display change takes effect
        setTimeout(() => {
          console.log('Attempting to click ember2049');
          widgetBtn.click();
          console.log('Click event dispatched');
        }, 100);
        
        clearInterval(interval);
        console.log('Auto-launch interval cleared');
      }
    }, 500);
}).catch(e => console.log('Error during setup:', e));
