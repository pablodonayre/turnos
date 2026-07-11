const { google } = require('googleapis');
const express = require('express');

const CLIENT_ID = 'AIzaSyArC698YxhnqsIaIb8zThq9I-Oax6x2T2c';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();

app.get('/auth', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/calendar'],
    });
    res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    const { token } = await oauth2Client.getToken(code);
    console.log('Refresh token');
    console.log(tokens.refresh_token);
    res.send('Listo! Revisa la terminal.');
});

app.listen(3000, () => console.log('Abre en tu navegador: http://localhost:3000/auth'));

