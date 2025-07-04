export default {
    // 'development' or 'production'
    environment: 'production',

    // Using local test servers
    developmentUri: 'https://joshestrada-pexip.github.io/pexip-genesys-agent/agent-app',

    // Publicly accessible location where the admin-app files are hosted.
    // This is different than the Pexip conference node value below.
    prodUri:  'https://joshestrada-pexip.github.io/pexip-genesys-agent/agent-app',

    // Id for the video DOM element. Only change this if you customize index.html.
    videoElementId: "pexip-video-container",

    genesys: {
        // Genesys Cloud region
        // 'mypurecloud.com', 'usw2.pure.cloud', 'mypurecloud.ie', 'euw2.pure.cloud', 'mypurecloud.com.au'
        // See https://help.mypurecloud.com/articles/aws-regions-for-genesys-cloud-deployment/ for all options
        region: 'usw2.pure.cloud',

        // OAuth Client ID
        // Created in "Create a Token Implicit OAuth Grant for Genesys Cloud deployment" step
        oauthClientID: '9708dcf4-5e6b-4b2e-9639-0b91c63b8089'
    },

    pexip: {
        // Used to identify the conference attendee for proper handling by Pexip Infinity local policy.
        conferencePrefix: "app_",

        // External domain for Pexip Infinity Edge/Transcoding nodes.
        conferenceNode: "pex-edge2.gcp.pexsupport.com",

        // Conference PIN. Must match the PIN number set by Pexip Infinity local policy for ad-hoc conference creation.
        conferencePin: "2021"
    }
}
