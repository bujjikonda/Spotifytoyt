require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const spotifyService = require('./services/spotify');
const youtubeService = require('./services/youtube');
const sheetsService = require('./services/sheets');
const open = require('open');
const appController = require('./controllers/appController');

const app = express();
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;

// Global tokens for this simple local app
let spotifyTokenSet = false;
let googleAuthClient = null;

// Google OAuth2 Client
const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

app.get('/', (req, res) => {
    if (!spotifyTokenSet) {
        res.send('<h1>Spotify to Sheets</h1><a href="/login/spotify">Login with Spotify</a>');
    } else if (!googleAuthClient) {
        res.send('<h1>Spotify to Sheets</h1><p>Spotify Logged In!</p><a href="/login/google">Login with Google</a>');
    } else {
        res.send(`
      <h1>Spotify to Sheets</h1>
      <p>All Logged In!</p>
      <form action="/process" method="POST">
        <label>Spotify Playlist ID: <input type="text" name="playlistId" required></label>
        <button type="submit">Convert</button>
      </form>
      <p><a href="/retry">Retry Errors from Sheet</a></p>
    `);
    }
});

// Spotify Auth
app.get('/login/spotify', (req, res) => {
    const authUrl = spotifyService.getAuthUrl();
    console.log('--- Spotify Auth Debug ---');
    console.log('Configured Redirect URI:', process.env.SPOTIFY_REDIRECT_URI);
    console.log('Generated Auth URL:', authUrl);
    console.log('--------------------------');
    res.redirect(authUrl);
});

app.get('/callback/spotify', async (req, res) => {
    const code = req.query.code;
    try {
        await spotifyService.setAccessToken(code);
        spotifyTokenSet = true;
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.send('Error logging in to Spotify');
    }
});

// Google Auth
app.get('/login/google', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/spreadsheets'
        ],
    });
    res.redirect(authUrl);
});

app.get('/callback/google', async (req, res) => {
    const code = req.query.code;
    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        googleAuthClient = oAuth2Client;
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.send('Error logging in to Google');
    }
});

// Process
app.post('/process', async (req, res) => {
    const playlistId = req.body.playlistId;
    await appController.processPlaylist(playlistId, googleAuthClient, res);
});

// Retry Feature
app.get('/retry', (req, res) => {
    res.send(`
    <h1>Retry Errors</h1>
    <form action="/retry" method="POST">
      <label>Spreadsheet ID: <input type="text" name="spreadsheetId" required></label>
      <button type="submit">Retry Errors</button>
    </form>
  `);
});

app.post('/retry', async (req, res) => {
    const spreadsheetId = req.body.spreadsheetId;
    await appController.retryErrors(spreadsheetId, googleAuthClient, res);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
