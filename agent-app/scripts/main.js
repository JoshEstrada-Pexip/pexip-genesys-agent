import controller from "./notifications-controller.js";
import config from "./config.js";
import { PexRtcWrapper } from "./pexrtc-wrapper.js";

// Obtain a reference to the platformClient object
const platformClient = require("platformClient");
const client = platformClient.ApiClient.instance;

// API instances
const usersApi = new platformClient.UsersApi();
const conversationsApi = new platformClient.ConversationsApi();

// Client App
let ClientApp = window.purecloud.apps.ClientApp;
let clientApp = new ClientApp({
  pcEnvironment: config.genesys.region,
});

let conversationId = "";
let agent = null;

const urlParams = new URLSearchParams(window.location.search);
conversationId = urlParams.get("conversationid");

const redirectUri =
  config.environment === "development" ? config.developmentUri : config.prodUri;

client.setEnvironment(config.genesys.region);
client
  .loginImplicitGrant(config.genesys.oauthClientID, redirectUri, {
    state: conversationId,
  })
  .then((data) => {
    conversationId = data.state;
    return usersApi.getUsersMe();
  })
  .then((currentUser) => {
    agent = currentUser;
    return conversationsApi.getConversation(conversationId);
  })
  .then((conversation) => {
    let videoElement = document.getElementById(config.videoElementId);
    let confNode = config.pexip.conferenceNode;
    let displayName = `Agent: ${agent.name}`;
    let pin = config.pexip.conferencePin;
    let confAlias = conversation.participants?.filter(
      (p) => p.purpose == "customer"
    )[0]?.aniName;

    let conversationAgent = conversation.participants?.filter(
      (p) => p.purpose == "agent"
    )[0];
    console.log("PEXGEN: conversationAgent", conversationAgent);
    let isTransfer =
      conversationAgent.calls?.filter((c) => c.disconnectType === "transfer")
        .length > 0;
    console.log("PEXGEN: isTransfer", isTransfer);

    console.assert(confAlias, "Unable to determine the conference alias.");

    let prefixedConfAlias = `${config.pexip.conferencePrefix}${confAlias}`;

    let pexrtcWrapper = new PexRtcWrapper(
      videoElement,
      confNode,
      prefixedConfAlias,
      displayName,
      pin,
      "1264",
      isTransfer
    );
    pexrtcWrapper.makeCall().muteAudio();

    // if (isTransfer === true) {
    //   console.log("PEXGEN: Yes, this is a transfer!!!");
    //   pexrtcWrapper.muteVideo(true);
    //   videoElement.style["display"] = "none";
    // }

    if (window !== "undefined") {
      window.pexrtcWrapper = pexrtcWrapper;
    }

    controller.createChannel().then((_) => {
      return controller.addSubscription(
        `v2.users.${agent.id}.conversations.calls`,
        (callEvent) => {
          let agentParticipant = callEvent?.eventBody?.participants?.filter(
            (p) => p.purpose == "agent"
          )[0];
          console.log("PEXGEN: agentParticipant", agentParticipant);
          if (agentParticipant?.state === "disconnected") {
            if (agentParticipant.disconnectType === "client") {
              console.log(
                "Agent has ended the call. Disconnecting all conference participants"
              );
              pexrtcWrapper.disconnectAll();
            }
            if (agentParticipant.disconnectType === "transfer") {
              console.log(
                "Agent is transferring the call. Only disconnecting the agent."
              );
              pexrtcWrapper.pexrtc.disconnect();
            }
          }

          let mute_state = agentParticipant?.held || false;
          console.log("PEXGEN: mute_state", mute_state, mute_state === true);
          pexrtcWrapper.muteVideo(mute_state);
          if (mute_state === true) {
            videoElement.style["display"] = "none";
          } else {
            videoElement.style["display"] = null;
          }
        }
      );
    });

    clientApp.lifecycle.addStopListener(() => {
      console.log("Application is closing. Cleaning up resources.");
      pexrtcWrapper.disconnectAll();
    }, true);

    return pexrtcWrapper;
  })
  .then((data) => {
    console.log("Finished Setup");
  })
  .catch((e) => console.log(e));
