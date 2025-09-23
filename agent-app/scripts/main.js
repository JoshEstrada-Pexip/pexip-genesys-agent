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
let pexrtcWrapper = null;
let handleMuteCall = null;
let handleHold = null;
let handleEndCall = null;
let muteState = false;
let onHoldState = false;

function getActiveCall(agentParticipant) {
    if (agentParticipant && agentParticipant.calls) {
        const activeCall = agentParticipant.calls.find(call => 
            call.state === "connected"
        );
        return activeCall || null;
    }
    return null;
}

function handleCallEvent(callEvent) {
    const agentParticipant = callEvent?.eventBody?.participants?.find(p => 
        p.purpose === "agent" && 
        p.state !== "terminated" &&
        p.user?.id === agent.id
    );

    const customerParticipant = callEvent?.eventBody?.participants?.find(p =>
        p.purpose === "customer" &&
        p.state !== "terminated"
    );

    if (!agentParticipant || !customerParticipant) {
        console.warn('No agent or customer participant found in call event');
        return;
    }

    if (agentParticipant.state === "disconnected") {
        if (agentParticipant.disconnectType === "client") {
            handleEndCall(true);
        }
        if (agentParticipant.disconnectType === "transfer") {
            handleEndCall(false);
        }
        if (agentParticipant.disconnectType === "peer") {
            handleEndCall(false);
        }
        return;
    }

    if (muteState !== agentParticipant.muted) {
        muteState = agentParticipant.muted ?? false;
        if (!onHoldState) {
            handleMuteCall(muteState);
        }
    }

    if (onHoldState !== agentParticipant.held) {
        onHoldState = agentParticipant.held ?? false;
        handleHold(onHoldState);
    }
}

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

    pexrtcWrapper = new PexRtcWrapper(videoElement, confNode, prefixedConfAlias, displayName, pin);
    pexrtcWrapper.makeCall().muteAudio();

    handleMuteCall = (muted) => {
        console.log(`Mute state changed to: ${muted}`);
        pexrtcWrapper.muteAudio(muted);
    };

    handleHold = (onHold) => {
        console.log(`Hold state changed to: ${onHold}`);
        if (onHold) {
            pexrtcWrapper.muteAllVideo(true);
        } else {
            pexrtcWrapper.muteAllVideo(false);
            if (muteState) {
                pexrtcWrapper.muteAudio(true);
            }
        }
    };

    handleEndCall = (disconnectAll) => {
        console.log(`Ending call. Disconnect all: ${disconnectAll}`);
        if (disconnectAll) {
            pexrtcWrapper.disconnectAll();
        } else {
            pexrtcWrapper.disconnect();
        }
    };

    controller.createChannel()
    .then(_ => {
      return controller.addSubscription(
        `v2.users.${agent.id}.conversations.calls`,
        handleCallEvent);
    });

    clientApp.lifecycle.addStopListener(() => {
      console.log("Application is closing. Cleaning up resources.");
      pexrtcWrapper.disconnectAll();
    }, true);

    return pexrtcWrapper;
}).then(data => {
    console.log('Finished Setup');

}).catch(e => console.log(e));
