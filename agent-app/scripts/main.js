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
    // ADD THIS FUNCTION: Show RBFCU Agent Widget in iframe
    function showRBFCUAgentWidgetInIframe() {
        console.log("Attempting to show RBFCU Agent Widget...");
        
        // First try to find the button in the parent document
        const widgetButton = document.querySelector('button[aria-label="RBFCU Agent Widget"]');
        if (widgetButton) {
            console.log("Found RBFCU button in parent document, clicking it...");
            widgetButton.click();
            return true;
        }
        
        // Look for the panel in the parent document
        const hiddenPanel = document.querySelector('.sub-panel-wrapper.hidden.no-width');
        if (hiddenPanel) {
            console.log("Found hidden panel in parent document, showing it...");
            hiddenPanel.classList.remove('hidden', 'no-width');
            
            const contextualDiv = hiddenPanel.querySelector('[aria-hidden="true"][style*="display: none"]');
            if (contextualDiv) {
                contextualDiv.setAttribute('aria-hidden', 'false');
                contextualDiv.style.display = '';
            }
            return true;
        }
        
        // Find all iframes and try to access each one
        const iframes = document.querySelectorAll('iframe');
        console.log(`Found ${iframes.length} iframes on the page`);
        
        for (let i = 0; i < iframes.length; i++) {
            try {
                const iframe = iframes[i];
                console.log(`Checking iframe #${i}:`, iframe.src || iframe.title);
                
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const iframeButton = iframeDoc.querySelector('button[aria-label="RBFCU Agent Widget"]');
                
                if (iframeButton) {
                    console.log("Found RBFCU button in iframe, clicking it...");
                    iframeButton.click();
                    return true;
                }
            } catch (e) {
                console.log(`Cannot access iframe #${i} due to cross-origin policy`);
            }
        }
        
        console.log("Could not find RBFCU Widget elements to interact with");
        return false;
    }
    
    // Add a delay to ensure the UI is loaded before trying to show the widget
    setTimeout(() => {
        const result = showRBFCUAgentWidgetInIframe();
        console.log("Widget show attempt result:", result);
    }, 3000);  // 3 second delay
    
    // Continue with the rest of your existing code
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
}).catch(e => console.log(e));
