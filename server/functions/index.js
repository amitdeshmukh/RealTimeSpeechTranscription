const { onRequest } = require("firebase-functions/v2/https");
const axios = require('axios');

exports.getSpeechToken = onRequest(
  { 
    cors: true,
    region: 'asia-south1'
  },
  async (req, res) => {
    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      res.status(400).send('Speech key or region not configured.');
      return;
    }

    const headers = {
      'Ocp-Apim-Subscription-Key': speechKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      const tokenResponse = await axios.post(
        `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
        null,
        { headers }
      );

      if (tokenResponse?.status !== 200) {
        res.status(401).send('There was an error authorizing your speech key.');
        return;
      } else {
        console.log('Token fetched from backend: ', tokenResponse.status, tokenResponse.statusText);
      }

      res.status(200).json({ token: tokenResponse.data, region: speechRegion });
    } catch (err) {
      console.error('Error:', err);
      res.status(401).send('There was an error authorizing your speech key.');
    }
  }
);