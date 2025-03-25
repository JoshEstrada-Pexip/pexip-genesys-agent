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

    // Try to auto launch to the integration tab to open widget on call
    console.log('Starting auto-launch process for integration tab');
    
    // More persistent approach - keep checking for longer
    let attempts = 0;
    const maxAttempts = 60; // Try for up to 30 seconds (60 * 500ms)
    
    const interval = setInterval(() => {
      attempts++;
      
      // Look for the element by class name and attributes instead of ID
      // Based on the screenshot, we're looking for elements related to interactions
      let widgetBtn = null;
      
      // Method 1: Try to find by specific class combinations
      const interactionButtons = document.querySelectorAll('.interaction-url-work-item-button, [aria-label="Get Interaction URL"]');
      if (interactionButtons.length > 0) {
        widgetBtn = interactionButtons[0];
        console.log('Found interaction button by class/aria-label');
      }
      
      // Method 2: Try to find by container class and then button inside
      if (!widgetBtn) {
        const interactionContainers = document.querySelectorAll('.interaction-container, .interactions-panel-sizer');
        for (const container of interactionContainers) {
          const buttons = container.querySelectorAll('button');
          if (buttons.length > 0) {
            widgetBtn = buttons[0];
            console.log('Found interaction button inside container');
            break;
          }
        }
      }
      
      // Method 3: Look for any button with "interaction" in its class or ID
      if (!widgetBtn) {
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
          if (btn.id.includes('interaction') || 
              (btn.className && btn.className.includes('interaction')) ||
              (btn.getAttribute('aria-describedby') && btn.getAttribute('aria-describedby').includes('interaction'))) {
            widgetBtn = btn;
            console.log('Found interaction button by partial match');
            break;
          }
        }
      }
      
      console.log(`Checking for interaction button (attempt ${attempts}/${maxAttempts}):`, widgetBtn ? 'Found' : 'Not found');
      
      if (widgetBtn) {
        console.log('Found element:', widgetBtn);
        console.log('Element details:', {
          tagName: widgetBtn.tagName,
          id: widgetBtn.id,
          className: widgetBtn.className,
          ariaLabel: widgetBtn.getAttribute('aria-label'),
          ariaDescribedby: widgetBtn.getAttribute('aria-describedby'),
          display: widgetBtn.style.display,
          visibility: widgetBtn.style.visibility,
          hidden: widgetBtn.hidden,
          parentDisplay: widgetBtn.parentElement ? widgetBtn.parentElement.style.display : 'No parent'
        });
        
        // Try multiple approaches to make the element visible
        widgetBtn.style.display = "block";
        widgetBtn.hidden = false;
        widgetBtn.style.visibility = "visible";
        
        // Also try to make parent elements visible if needed
        let parent = widgetBtn.parentElement;
        while (parent) {
          parent.style.display = "block";
          parent.hidden = false;
          parent.style.visibility = "visible";
          parent = parent.parentElement;
        }
        
        console.log('After visibility changes:', {
          display: widgetBtn.style.display,
          visibility: widgetBtn.style.visibility,
          hidden: widgetBtn.hidden
        });
        
        // Add a small delay before clicking to ensure the display change takes effect
        setTimeout(() => {
          console.log('Attempting to click interaction button');
          try {
            // Try multiple ways to trigger the click
            widgetBtn.click(); // Standard click
            console.log('Standard click dispatched');
            
            // Also try programmatic event dispatch as backup
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            widgetBtn.dispatchEvent(clickEvent);
            console.log('Event-based click dispatched');
          } catch (err) {
            console.error('Error clicking element:', err);
          }
        }, 100);
        
        clearInterval(interval);
        console.log('Auto-launch interval cleared');
      } else if (attempts >= maxAttempts) {
        console.log('Maximum attempts reached. Could not find interaction button.');
        clearInterval(interval);
      }
    }, 500);
}).catch(e => console.log('Error during setup:', e));
