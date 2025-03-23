export default {
    // 'development' or 'production'
    environment: 'development',

    // Using local test servers
    developmentUri: 'http://localhost:8080',

    // Publicly accessible location where the admin-app files are hosted.
    // This is different than the Pexip conference node value below.
    prodUri:  'https://pexip-agent-app.example.com/path/to/app',

    // Id for the video DOM element. Only change this if you customize index.html.
    videoElementId: "pexip-video-container",

    genesys: {
        // Genesys Cloud region
        // 'mypurecloud.com', 'usw2.pure.cloud', 'mypurecloud.ie', 'euw2.pure.cloud', 'mypurecloud.com.au'
        // See https://help.mypurecloud.com/articles/aws-regions-for-genesys-cloud-deployment/ for all options
        region: 'mypurecloud.com',

        // OAuth Client ID
        // Created in "Create a Token Implicit OAuth Grant for Genesys Cloud deployment" step
        oauthClientID: '1111111a-1bc1-11bb-a1bb-1b1bb111ca11'
    },

    pexip: {
        // Used to identify the conference attendee for proper handling by Pexip Infinity local policy.
        conferencePrefix: "xyz",

        // External domain for Pexip Infinity Edge/Transcoding nodes.
        conferenceNode: "pexip.example.com",

        // Conference PIN. Must match the PIN number set by Pexip Infinity local policy for ad-hoc conference creation.
        conferencePin: "1234"
    }
}
