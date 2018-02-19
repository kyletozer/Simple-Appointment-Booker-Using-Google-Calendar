'use strict';


(function() {

  // document.cookie = "user=; event=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

  const content = $('#content');
  const formOverlay = $('#form-overlay');

  const calendarId = '9ja93ni65f22172u6ei93bp0rg@group.calendar.google.com';
  const apiKey = 'AIzaSyBKulkjUUFMeLD2qn89kC2teUoJ1XAzYZQ';
  const clientId = '646937741098-uvq1sdetn67in3pf38deq6qdrqfrq38r.apps.googleusercontent.com';
  const hostEmail = 'kwtozer@gmail.com';

  let user;

  function getCalendarData() {

    let url = 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events';

    let m = moment();

    let options = {
      key: apiKey,
      timeMin: m.format(),
      timeMax: m.add(7, 'd').format(),
      singleEvents: true,
      orderBy: 'startTime'
    };

    $.get(url, options, function(data, textStatus, jqXHR) {
      // console.log(data, textStatus, jqXHR);

      if(jqXHR.status !== 200) {
        // unable to fetch calendar
      }

      renderCalendarView(data.items);
    });
  }

  function renderCalendarView(items) {

    let html = '';
    let segment = '';
    let format = 'h : mm a';
    let currentDay;

    for(let i = 0; i < items.length; i++) {

     let item = items[i];
     let start = moment(item.start.dateTime);
     let end = moment(item.end.dateTime);
     let day = start.format('dddd');

     // skip over booked appointments
     if(item.summary !== 'EMPTY') {
       continue;
     }

     // initially set the current day
     if(!currentDay) {
       currentDay = day;
     }

     // if the event in the current loop does not belong to the current day, push the segment to the final html output and reset the segment
     if(currentDay !== day) {

       html += `
       <div class="row day">
         <div class="col-sm-3">
           <h4>${currentDay}</h4>
           <p>${start.format('MMMM D')}</p>
         </div>
         <div class="col-sm-9">
           <div class="row">${segment}</div>
         </div>
       </div>
       `;

       segment = '';
     }

     // update the the current day
     currentDay = day;

     // build the segment
     segment += `
       <div class="col-sm-4">
         <div role="button" class="appointment text-center" data-event-id="${item.id}">
           <p>${start.format(format)}<br>–<br>${end.format(format)}</p>
         </div>
       </div>
     `;
    }

    content.html(html);
  }

  function getSingleEvent(eventId, callback) {

    let url = 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/' + eventId;

    let options = {
      key: apiKey
    };

    // get available appointment times, using EMPTY as the event's summary value is a naming convention used to identify open appointment block times
    $.get(url, options, function(data, textStatus, jqXHR) {
      // console.log(data, textStatus, jqXHR);
      if(data.summary === 'EMPTY') {
        callback(data);
      }
    });
  }

  function toggleForm() {

    content.on('click', '.appointment', function(e) {

      // if the user isn't authenticated, allow them to authenticate as they cannot book an appointment without first doing so
      if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        gapi.auth2.getAuthInstance().signIn();
        return;
      }

      let eventId = $(this).attr('data-event-id');

      getSingleEvent(eventId, renderForm);
    });

    formOverlay.on('click', '.close', function(e) {
      $(e.delegateTarget).empty().hide();
    });
  }

  function renderForm(data) {

    let t = moment(data.start.dateTime);

    let html = `
    <div class="container">
      <div class="row">
        <div class="col-md-5">
          <div id="form-response"></div>
        </div>
        <div class="book col-md-7">
          <h2 class="heading">Book This Time</h2>
          <span role="button" class="close">Back to calendar</span>
          <div class="appointment-details">
            <p>Your appointment will be @ ${t.format('hh : mm on MMMM D, YYYY')}</p>
          </div>
          <form id="booking-form" action="">
            <input id="event-id" type="hidden" value="${data.id}">
            <button class="btn btn-primary" type="submit">Book Appointment</button>
          </form>
        </div>
      </div>
    </div>
    `;

    formOverlay.show().html(html);
  }

  function bookAppointment() {

    formOverlay.on('submit', '#booking-form', function(e) {

      e.preventDefault();

      let eventId = $('#event-id').val();

      // get the event
      getSingleEvent(eventId, function(data) {
        // console.log(data);

        let resource = {
          summary: 'Meeting with Kyle Tozer',
          start: data.start,
          end: data.end,
          attendees: [ { email: data.creator.email } ]
        };

        // add appointment event time to current user's calendar and notify host of this action
        gapi.client.calendar.events.insert({
          calendarId: 'primary',
          sendNotifications: true,
          resource: resource
        })
        .then(function(response) {
          // console.log(response);

          content.empty();
          $('.close').trigger('click');

          return getUserEvents();
        })
        .then(handleGetUserEventsResponse);
      });

      // console.log('appointment booked');
    });
  }

  function getBookedAppointment(items) {

    for(let i = 0; i < items.length; i++) {
      let item = items[i];

      for(let j = 0; j < item.attendees.length; j++) {
        let attendee = item.attendees[j];

        if(attendee.email === hostEmail && attendee.responseStatus !== 'declined') {
          return item;
        }
      }
    }
  }

  function statusMessage(appointment) {
    // console.log(appointment);

    let status = appointment.attendees[0].responseStatus;
    let message;

    if(status === 'needsAction') {
      message = 'Your appointment has not yet been confirmed, keep an eye on your inbox!';

    } else if(status === 'accepted') {
      message = 'Your appointment has been confirmed, I will be seeing you on ' + moment(appointment.start.dateTime).format() + '.';
    }

    $('#message').html('<span>' + message + '</span>');
  }

  function getUserEvents() {
    let m = moment();

    return gapi.client.calendar.events.list({
      calendarId: 'primary',
      alwaysIncludeEmail: true,
      timeMin: m.format(),
      timeMax: m.add(7, 'd').format()
    });
  }

  function handleGetUserEventsResponse(response) {
    let appointment = getBookedAppointment(response.result.items);

    // check if the user has previously tried to book an appointment and what the status of that booking is
    if(appointment) {
      statusMessage(appointment);
      return appointment;
    }
  }

  $(function() {

    gapi.load('client:auth2', function() {

      gapi.client.init({
        apiKey: apiKey,
        clientId: clientId,
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
        ],
        scope: 'https://www.googleapis.com/auth/calendar'
      })
      .then(function() {
        // console.log('gapi initialized');

        // check if user is authenticated
        if(gapi.auth2.getAuthInstance().isSignedIn.get()) {
          return getUserEvents();
        }
      })
      .then(function(response) {
        // console.log(response);

        // if the user is authenticated a response object will be available
        if(response && response.result && response.result.items) {

          let appointment = handleGetUserEventsResponse(response);

           if(!appointment) {
            toggleForm();
            bookAppointment();
            getCalendarData();
          }
        }
      });
    });
  });

})();
