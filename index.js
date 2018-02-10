'use strict';


(function() {

  // document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  // console.log(document.cookie);

  let content = $('#content');

  let api = {
    // calId: '94g0a5d8bjgdm0ei1hf3ts34fs@group.calendar.google.com', // marios
    calId: '9ja93ni65f22172u6ei93bp0rg@group.calendar.google.com',
    clientId: '646937741098-uvq1sdetn67in3pf38deq6qdrqfrq38r.apps.googleusercontent.com',
    key: 'AIzaSyBKulkjUUFMeLD2qn89kC2teUoJ1XAzYZQ',
    endpoint: 'https://www.googleapis.com/calendar/v3/calendars',
    getAll: function() {
      return this.endpoint + '/' + this.calId + '/events';
    },
    getSingle: function(eventId) {
      return this.endpoint + '/' + this.calId + '/events/' + eventId;
    }
  };

  let app = {
    now: new Date(),
    startTime: function() {
      return this.now.toISOString();
    },
    endTime: function() {
      return new Date(this.now.getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString();
    }
  }


  function renderCalendarView(items) {

    let html = '';
    let segment = '';
    let currentDay;

    // console.log(items);

    for(let i = 0; i < items.length; i++) {

      let item = items[i];
      let day = new Date(item.start.dateTime).getDay();
      let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // skip over booked appointments
      if(item.summary !== 'EMPTY') {
        continue;
      }

      // initially set the current day
      if(!currentDay) {
        currentDay = days[day];
      }

      // if the event in the current loop does not belong to the current day, push the segment to the final html output and reset the segment
      if(currentDay !== days[day]) {

        html += `
        <div class="row">
          <div class="col-sm-3">
            <h3>${currentDay}</h3>
          </div>
          <div class="col-sm-9">
            <div class="row">${segment}</div>
          </div>
        </div>
        `;

        segment = '';
      }

      // update the the current day
      currentDay = days[day];

      // build the segment
      segment += `
        <div class="col-sm-4">
          <div class="appointment" data-event-id="${item.id}">
            <h4>${item.summary}</h4>
            <p>${new Date(item.start.dateTime).toTimeString()}</p>
            <p>${new Date(item.end.dateTime).toTimeString()}</p>
          </div>
        </div>
      `;
    }

    content.html(html);
  }

  function getCalendarData() {

    let startTime = app.startTime();
    let endTime = app.endTime();

    let settings = {
      timeMin: startTime,
      timeMax: endTime,
      singleEvents: true,
      orderBy: 'startTime',
      key: api.key
    };

    $.get(api.getAll(), settings, function(data, textStatus, jqXHR) {
      console.log(data, textStatus, jqXHR);
      renderCalendarView(data.items);
    });
  }

  function setAppointment() {

    content.on('click', '.appointment', function(e) {

      // if cookie has not been set (prevents more than one appointment booking)
      if(document.cookie.indexOf('Kyle Tozer') !== -1) {
        return;
      }

      // if not signed in, take them to sign in prompt
      if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        handleAuth();
        return;
      }

      let eventId = $(this).attr('data-event-id');

      let settings = {
        key: api.key
      };

      $.get(api.getSingle(eventId), settings, function(data, textStatus, jqXHR) {
        console.log(data, textStatus, jqXHR);

        if(data.summary !== 'EMPTY') {
          return;
        }

        data.summary = 'Meeting with X';
        data.attendees = [];

        let attendee = {
          email: 'kyle.tozer@hotmail.com',
          displayName: 'Kyle Tozer'
        };

        data.attendees.push(attendee);

        // update event
        gapi.client.calendar.events.patch({
          calendarId: api.calId,
          eventId: data.id,
          resource: data
        })
        .then(function(response) {
          document.cookie = 'username=' + attendee.displayName + '; expires=' + new Date(app.endTime()).toUTCString() + '; path=/';
          getCalendarData();
        });
      });
    });
  }

  function handleAuth() {
    console.log('you must sign in');
    gapi.auth2.getAuthInstance().signIn();
  }

  function handleClientLoad() {
    gapi.load('client:auth2', initClient);
  }

  function initClient() {

    gapi.client.init({
      apiKey: api.key,
      clientId: api.clientId,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
      ],
      scope: 'https://www.googleapis.com/auth/calendar'
    })
    .then(function() {
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
  }

  function updateSigninStatus(isSignedIn) {
    console.log('is signed in?:', isSignedIn);
  }

  function initApp() {
    handleClientLoad();
    getCalendarData();
    setAppointment();
  }

  initApp();

})();
