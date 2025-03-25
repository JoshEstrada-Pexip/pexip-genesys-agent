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
    const maxAttempts = 120; // Try for up to 60 seconds (120 * 500ms)
    
    // Add a mutation observer to detect when new elements are added to the DOM
    const observer = new MutationObserver((mutations) => {
      console.log('DOM mutation detected, checking for interaction elements');
      checkForInteractionButton();
    });
    
    // Start observing the document body for DOM changes
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Function to find and click the interaction button
    function checkForInteractionButton() {
      // Method 1: Try to find by specific class combinations
      let widgetBtn = null;
      
      // Look for interaction buttons with various selectors
      const selectors = [
        '.interaction-url-work-item-button', 
        '[aria-label="Get Interaction URL"]',
        '[data-test-id="interaction-button"]',
        '[data-test-id="interaction-url"]',
        '.interaction-button',
        '.interaction-work-item-button',
        '.interaction-url-button'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          widgetBtn = elements[0];
          console.log(`Found interaction button with selector: ${selector}`);
          break;
        }
      }
      
      // Method 2: Try to find by container class and then button inside
      if (!widgetBtn) {
        const containerSelectors = [
          '.interaction-container', 
          '.interactions-panel-sizer',
          '.interaction-work-item',
          '.interaction-panel',
          '[data-test-id="interaction-container"]'
        ];
        
        for (const containerSelector of containerSelectors) {
          const containers = document.querySelectorAll(containerSelector);
          for (const container of containers) {
            console.log(`Found container with selector: ${containerSelector}`);
            // Look for buttons, links, or clickable divs inside the container
            const clickables = container.querySelectorAll('button, a, [role="button"], .clickable');
            if (clickables.length > 0) {
              widgetBtn = clickables[0];
              console.log('Found clickable element inside interaction container');
              break;
            }
          }
          if (widgetBtn) break;
        }
      }
      
      // Method 3: Look for any element with "interaction" in its attributes
      if (!widgetBtn) {
        // Get all elements in the document
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          // Check various attributes for "interaction" keyword
          if ((el.id && el.id.toLowerCase().includes('interaction')) || 
              (el.className && typeof el.className === 'string' && el.className.toLowerCase().includes('interaction')) ||
              (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('interaction')) ||
              (el.getAttribute('data-test-id') && el.getAttribute('data-test-id').toLowerCase().includes('interaction'))) {
            
            // If it's a clickable element, use it directly
            if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
              widgetBtn = el;
              console.log('Found interaction element by attribute matching');
              break;
            }
            
            // Otherwise, look for clickable children
            const clickables = el.querySelectorAll('button, a, [role="button"]');
            if (clickables.length > 0) {
              widgetBtn = clickables[0];
              console.log('Found clickable child of interaction element');
              break;
            }
          }
        }
      }
      
      // Method 4: Look specifically for the ember component based on the stack trace
      if (!widgetBtn) {
        // Look for ember components that might contain our button
        const emberComponents = document.querySelectorAll('[id^="ember"]');
        for (const component of emberComponents) {
          // Check if this component has interaction-related classes or contains interaction text
          const hasInteractionClass = component.className && 
                                     typeof component.className === 'string' && 
                                     component.className.includes('interaction');
          const hasInteractionText = component.textContent && 
                                    component.textContent.toLowerCase().includes('interaction');
          
          if (hasInteractionClass || hasInteractionText) {
            console.log('Found ember component with interaction characteristics:', component);
            
            // Look for buttons inside this component
            const buttons = component.querySelectorAll('button, a, [role="button"]');
            if (buttons.length > 0) {
              widgetBtn = buttons[0];
              console.log('Found button inside interaction ember component');
              break;
            } else if (component.tagName === 'BUTTON' || component.tagName === 'A' || 
                      component.getAttribute('role') === 'button') {
              // The component itself might be clickable
              widgetBtn = component;
              console.log('The ember component itself is clickable');
              break;
            }
          }
        }
      }
      
      if (widgetBtn) {
        console.log('Found element:', widgetBtn);
        console.log('Element details:', {
          tagName: widgetBtn.tagName,
          id: widgetBtn.id,
          className: widgetBtn.className,
          ariaLabel: widgetBtn.getAttribute('aria-label'),
          ariaDescribedby: widgetBtn.getAttribute('aria-describedby'),
          textContent: widgetBtn.textContent,
          display: window.getComputedStyle(widgetBtn).display,
          visibility: window.getComputedStyle(widgetBtn).visibility,
          hidden: widgetBtn.hidden,
          disabled: widgetBtn.disabled,
          parentDisplay: widgetBtn.parentElement ? window.getComputedStyle(widgetBtn.parentElement).display : 'No parent'
        });
        
        // Try multiple approaches to make the element visible and enabled
        widgetBtn.style.display = "block";
        widgetBtn.hidden = false;
        widgetBtn.style.visibility = "visible";
        widgetBtn.disabled = false;
        
        // Also try to make parent elements visible if needed
        let parent = widgetBtn.parentElement;
        while (parent) {
          parent.style.display = "block";
          parent.hidden = false;
          parent.style.visibility = "visible";
          parent = parent.parentElement;
        }
        
        console.log('After visibility changes:', {
          display: window.getComputedStyle(widgetBtn).display,
          visibility: window.getComputedStyle(widgetBtn).visibility,
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
            
            // If it's an <a> tag, try navigating to its href
            if (widgetBtn.tagName === 'A' && widgetBtn.href) {
              console.log('Element is a link, trying to navigate to:', widgetBtn.href);
              // Open in the same window to avoid popup blockers
              window.location.href = widgetBtn.href;
            }
            
            // Success - stop the interval and disconnect the observer
            clearInterval(interval);
            observer.disconnect();
            console.log('Auto-launch successful - interval and observer cleared');
          } catch (err) {
            console.error('Error clicking element:', err);
          }
        }, 100);
      }
    }
    
    // Set up an interval to periodically check for the button
    const interval = setInterval(() => {
      attempts++;
      console.log(`Checking for interaction button (attempt ${attempts}/${maxAttempts})`);
      
      checkForInteractionButton();
      
      if (attempts >= maxAttempts) {
        console.log('Maximum attempts reached. Could not find interaction button.');
        observer.disconnect();
        clearInterval(interval);
      }
    }, 500);
}).catch(e => console.log('Error during setup:', e));
