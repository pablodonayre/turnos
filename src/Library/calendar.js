const {authenticate} = require('@google-cloud/local-auth');
const { OAuth2Client } = require('google-auth-library');
const {google} = require('googleapis');
const { DateTime } = require('luxon');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const auth2 = new OAuth2Client({
    clientId: process.env.OAUTH_CLIENTID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
})

auth2.setCredentials({ refresh_token: process.env.OAUTH_REFRESH_TOKEN });

async function listEvents() {
  // Create a new Calendar API client.
  const calendar = google.calendar({version: 'v3', auth: auth2});
  // Get the list of events.
  const result = await calendar.events.list({
    calendarId: '64832c19a87c0abf39041ea6293f0a785b788d097427483e958de90b916a719c@group.calendar.google.com',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = result.data.items;
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');
    return;
  }
  console.log('Upcoming 10 events:');

  for (const event of events) {
    const start = event.start?.dateTime ?? event.start?.date;
    console.log(`${start} - ${event.summary}`);
  }
}

async function crearEvents(calendario_id, titulo, descripcion, inicioMs, finMs) {
  
  const inicio = DateTime.fromMillis(inicioMs, { zone: 'America/Lima' }).toISO();
  const fin = DateTime.fromMillis(finMs, { zone: 'America/Lima' }).toISO();

  const calendar = google.calendar({version: 'v3', auth: auth2});
  
  const evento = {
      summary: titulo,
      description: descripcion,
      start: {
        dateTime: inicio,
        timeZone: 'America/Lima',
      },
      end: {
        dateTime: fin,
        timeZone: 'America/Lima',
      }
    }
  const res = await calendar.events.insert({
    calendarId: calendario_id,
    requestBody: evento,
  });
  
  console.log('Evento creado:', res.data.htmlLink);
  return res.data;

}

module.exports = { crearEvents };