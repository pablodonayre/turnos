const { google } = require('googleapis');
const express = require('express');

require('dotenv').config({ path: __dirname + '/../.env' });



const CLIENT_ID = process.env.OAUTH_CLIENTID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
console.log('CLIENT_ID:', CLIENT_ID);
console.log('REDIRECT_URI:', REDIRECT_URI);

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

console.log(oauth2Client)
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

    try {

        console.log('========== OAUTH CALLBACK ==========');

        console.log('Query:', req.query);

        const { code, error, error_description } = req.query;

        if (error) {
            console.error('Google devolvió un error:');
            console.error(error);
            console.error(error_description);

            return res.status(400).send(
                `Google devolvió: ${error}`
            );
        }

        if (!code) {
            return res.status(400).send(
                'No se recibió el authorization code'
            );
        }

        console.log('Authorization code recibido:');
        console.log(code);

        console.log('Client ID:');
        console.log(CLIENT_ID);

        console.log('Redirect URI:');
        console.log(REDIRECT_URI);

        const { tokens } = await oauth2Client.getToken(code);

        console.log('========== TOKENS ==========');
        console.log(tokens);

        console.log('========== REFRESH TOKEN ==========');
        console.log(tokens.refresh_token);

        res.send(`
            <h1>Autorización correcta</h1>
            <p>Revisa la terminal de Node.js.</p>
        `);

    } catch (error) {

        console.error('========== ERROR ==========');

        console.error(
            error.response?.data || error
        );

        res.status(500).send(
            'Error obteniendo los tokens. Revisa la terminal.'
        );
    }
});

app.listen(3000, () => console.log('Abre en tu navegador: http://localhost:3000/auth'));

