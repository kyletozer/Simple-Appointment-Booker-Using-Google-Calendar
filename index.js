'use strict';


(function() {

  const apiKey = 'AIzaSyBKulkjUUFMeLD2qn89kC2teUoJ1XAzYZQ';
  const clientId = '646937741098-uvq1sdetn67in3pf38deq6qdrqfrq38r.apps.googleusercontent.com';
  const calendarId = '9ja93ni65f22172u6ei93bp0rg@group.calendar.google.com';

  const hostEmail = 'kwtozer@gmail.com';
  const summary = 'Let\'s Talk Web Meeting with Kyle Tozer';


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

  function renderCalendarView(data) {

    let html = '';

    // if data is not an array render the appropriate message for the status of the single event
    if(!Array.isArray(data)) {
      let status = data.attendees[0].responseStatus;
      let message = '';

      if(status === 'needsAction') {
        message = 'Your appointment has not yet been confirmed, keep an eye on your inbox!';

      } else if(status === 'accepted') {
        message = 'Your appointment has been confirmed, I will be seeing you on ' + moment(data.start.dateTime).format() + '.';
      }

      html = `
        <div id="message" class="text-center">
          <span>${message}</span>
        </div>
      `;

      $('#content').html(html);
      return;
    }

    let segment = '';
    let format = 'h : mm a';
    let currentDay;

    for(let i = 0; i < data.length; i++) {

     let item = data[i];
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

    html = `
    <div id="info-box" class="text-center container">
      <p>Book an appointment with me talk about web and whatever!</p>
      <p>Just choose a time below and you will be notified when I accept.</p>
      <strong>Booking an appointment requires a Google account. <a href="https://accounts.google.com/SignUp?hl=en">Sign up for one</a></strong>
    </div>
    ${html}
    `;

    $('#content').html(html);
  }

  function getUsersCalendar() {
    // check if user is authorized
    if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
      return;
    }

    let m = moment();

    return gapi.client.calendar.events.list({
      calendarId: 'primary',
      alwaysIncludeEmail: true,
      timeMin: m.format(),
      timeMax: m.add(7, 'd').format()
    });
  }

  function getAppointment(response) {

    if(!response) {
      return;
    }

    // response contains just a single event
    if(response.result && !response.result.items) {
      return response.result;
    }

    let items = response.result.items;

    for(let i = 0; i < items.length; i++) {
      let item = items[i];
      let end = moment(item.end.dateTime);

      let check = item.summary === summary;

      if(check) {
        for(let j = 0; j < item.attendees.length; j++) {
          let attendee = item.attendees[j];

          if(attendee.email === hostEmail && attendee.responseStatus !== 'declined') {
            return item;
          }
        }
      }
    }
  }

  function renderBookingForm(data) {

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

    $('#form-overlay').show().html(html);
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

  function bookAttempt(response) {
    console.log(response);

    let eventId = $(this).attr('data-event-id');
    console.log(eventId);

    // get the appointment from the response object containing the authenticated users calendar
    let appointment = getAppointment(response);
    console.log(appointment);

    // display booking page
    if(!appointment) {
      return getSingleEvent(eventId, renderBookingForm);
    }

    renderCalendarView(appointment);
  }

  function toggleForm() {

    $('#content').on('click', '.appointment', function(e) {
      // if the user isn't authenticated, allow them to authenticate as they cannot book an appointment without first doing so
      if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        gapi.auth2.getAuthInstance().signIn()
        .then(function() {
          return getUsersCalendar();
        })
        .then(bookAttempt.bind(this));
        return;
      }

      getUsersCalendar()
      .then(bookAttempt.bind(this));
    });

    $('#form-overlay').on('click', '.close', function(e) {
      $(e.delegateTarget).hide();
    });
  }

  function bookAppointment() {

    $('#form-overlay').on('submit', '#booking-form', function(e) {
      e.preventDefault();

      let eventId = $('#event-id').val();

      // get the event
      getSingleEvent(eventId, function(data) {
        // console.log(data);
        let resource = {
          summary: summary,
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
          console.log(response);

          let appointment = getAppointment(response);
          console.log(appointment);

          renderCalendarView(appointment);
          $('.close').trigger('click');
        });
      });
      // console.log('appointment booked');
    });
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
        console.log('gapi initialized');

        // attempt to get the users calendar
        // gapi.auth2.getAuthInstance().signIn();
        return getUsersCalendar();
      })
      .then(function(response) {
        console.log(response);

        // get the appointment from the response object containing the authenticated users calendar
        let appointment = getAppointment(response);
        console.log(appointment);

        if(!appointment || appointment.attendees[0].responseStatus
         === 'declined') {
          return getCalendarData();
        }

        renderCalendarView(appointment);
      });

      toggleForm();
      bookAppointment();
    });
  });

})();
