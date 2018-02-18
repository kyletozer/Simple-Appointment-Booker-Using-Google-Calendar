'use strict';


(function() {

  // document.cookie = "user=; event=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

  const content = $('#content');
  const formOverlay = $('#form-overlay');
  const calendarId = '9ja93ni65f22172u6ei93bp0rg@group.calendar.google.com';
  const apiKey = 'AIzaSyBKulkjUUFMeLD2qn89kC2teUoJ1XAzYZQ';
  const clientId = '646937741098-uvq1sdetn67in3pf38deq6qdrqfrq38r.apps.googleusercontent.com';

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

    // check cookie, if a user value exists on that cookie, the user cannot book another appointment until that cookie expires a week from when the appointment was requested
    if(user && document.cookie.indexOf(user.getId()) !== -1) {

      $('#message').text('Your appointment has been booked; I will be seeing you shortly!');

      content.hide();
    }
  }

  function getSingleEvent(eventId, callback) {

    let url = 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/' + eventId;

    let options = {
      key: apiKey
    };

    // if auth token does not already exist
    if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {

      // sign the user in and allow them to book appointments by setting up the appointment for click handler
      gapi.auth2.getAuthInstance().signIn();
      bookAppointment();

      return;
    }

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

    // if the global user has not been set, do not set up the appointment form handler
    if(!user) return;

    formOverlay.on('submit', '#booking-form', function(e) {
      e.preventDefault();

      let eventId = $('#event-id').val();

      // add event to users calendar
      getSingleEvent(eventId, function(data) {
        // console.log(data);
        let resource = {
          summary: 'Meeting with Kyle Tozer',
          start: data.start,
          end: data.end,
          attendees: [
            { email: data.creator.email }
          ]
        };

        // add appointment event time to current user's calendar and notify host of this action
        gapi.client.calendar.events.insert({
          calendarId: 'primary',
          sendNotifications: true,
          resource: resource
        })
        .then(function(response) {

          // set cookie
          document.cookie = `user=${user.getId()}`;
          document.cookie = `event=${response.result.id}`;
          document.cookie = `expires=${moment().add(7, 'd').format()}`;
          document.cookie = `path=/`;

          // close form window
          $('.close').trigger('click');

          // re-render calendar view
          getCalendarData();
        });
      });
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
      .then(function(response) {

        // if the user is already signed in, retrieve their calendar and determine whether they have attempted to book an appointment prior
        if(gapi.auth2.getAuthInstance().isSignedIn.get()) {
          user = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();

          let m = moment();

          return gapi.client.calendar.events.list({
            calendarId: 'primary',
            alwaysIncludeEmail: true,
            timeMin: m.format(),
            timeMax: m.add(7, 'd').format()
          });
        }

        return new Promise(function(resolve, reject) {
          resolve(response);
        });
      })
      .then(function (response) {
        // console.log(response);

        let event;

        // if the response parameter contains calendar data, parse it for an event that would have been previously added to their calendar
        if(response && response.result) {
          event = response.result.items.find(function(item) {
            return item.attendees[0].email === 'kwtozer@gmail.com';
          });
        }

        // if no event exists in the current users main calendar or the requested event was declined, reset the cookie
        if(!event || event.attendees[0].responseStatus === 'declined') {
          document.cookie = "user=; event=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }

        getCalendarData();
        toggleForm();
        bookAppointment();
      });
    });
  });

})();
