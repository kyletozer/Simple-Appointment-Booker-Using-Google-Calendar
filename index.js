'use strict';


(function() {

  document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  console.log(document.cookie);

  let content = $('#content');
  let formContainer = $('#form-overlay');

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
            <p>${start.format(format)} – ${end.format(format)}</p>
          </div>
        </div>
      `;
    }

    content.html(html);
  }

  function getCalendarData() {

    formContainer.css('display', 'none');

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

  function showForm(eventId) {

    let settings = {
      key: api.key
    };

    $.get(api.getSingle(eventId), settings, function(data, textStatus, jqXHR) {
      console.log(data, textStatus, jqXHR);

      // available appointments will be named EMPTY by convention
      if(data.summary !== 'EMPTY') {
        notifyUser('This appointment is no longer available');
        getCalendarData();
        return;
      }

      let t = new Date(data.start.dateTime);

      // hide the appointment form
      formContainer.css('display', 'block');

      formContainer.html(function() {
        return `
        <div class="container">
          <div class="row">
            <div class="col-md-5">
              <div id="form-response"></div>
            </div>
            <div class="book col-md-7">
              <h2 class="heading">Book This Time</h2>
              <span class="close">X</span>
              <div class="appointment-details">
                <p>Your appointment will be @ ${moment(t).format('hh : mm on MMMM D, YYYY')}</p>
              </div>
              <form id="booking-form" action="">
                <input id="event-id" type="hidden" value="${data.id}">
                <fieldset class="form-group">
                  <label for="name">Name</label>
                  <input class="form-control" id="name" type="text" placeholder="Your Name">
                </fieldset>
                <fieldset class="form-group">
                  <label for="name">Email</label>
                  <input class="form-control" id="email" type="email" placeholder="Your Email">
                </fieldset>
                <button class="btn btn-primary" type="submit">Book Appointment</button>
              </form>
            </div>
          </div>
        </div>
        `;
      });
    });
  }

  function validateForm() {

    let form = $(this);
    let name = form.find('#name').val();
    let email = form.find('#email').val();
    let errors = {};

    if(!name) {
      errors.name = 'Please enter a valid name';
    }

    if(!email) {
      errors.email = 'Please enter a valid email';
    }

    // if cookie has not been set (prevents more than one appointment booking)
    if(document.cookie.indexOf(name) !== -1) {
      errors.user = 'You have already booked an appointment this week, please try again next week';
    }

    if($.isEmptyObject(errors)) {
      return [true, {name: name, email: email}];
    }

    return [false, errors];
  }

  function showErrors(errors) {

    let target = $('#form-response');
    let html = '';

    for(let error in errors) {
      html += `
      <li><strong>${error}</strong> ${errors[error]}</li>
      `;
    }

    target.html('<ul class="alert alert-danger">' + html + '</ul>');
  }

  function setAppointment() {

    formContainer.on('click', '#booking-form button', function(e) {

      e.preventDefault();

      let validationResult = validateForm.call($(this).closest('#booking-form')[0]);
      let eventId = $('#event-id').val();

      let settings = {
        key: api.key
      };

      if(!validationResult[0]) {
        showErrors(validationResult[1]);
        return;
      }

      $.get(api.getSingle(eventId), settings, function(data, textStatus, jqXHR) {
        console.log(data, textStatus, jqXHR);

        if(data.summary !== 'EMPTY') {
          notifyUser('This appointment is no longer available');
          return;
        }

        data.summary = 'Meeting with ' + validationResult[1].name;
        data.attendees = [];

        let attendee = {
          email: validationResult[1].email,
          displayName: validationResult[1].name
        };

        data.attendees.push(attendee);

        // update event
        gapi.client.calendar.events.patch({
          calendarId: api.calId,
          eventId: data.id,
          resource: data
        })
        .then(function(response) {

          // set cookie to prevent more than one booking per week
          document.cookie = 'username=' + attendee.displayName + '; expires=' + new Date(app.endTime()).toUTCString() + '; path=/';

          notifyUser('Your appointment was successfully booked!');

          // update calendar view
          getCalendarData();
        });
      });
    });

    formContainer.on('click', '.close', function(e) {
      $(this).closest('#form-overlay').css('display', 'none');
    });
  }

  function notifyUser(message) {
    $('#message').text(message);
  }

  function setAppointmentForm() {

    content.on('click', '.appointment', function(e) {

      $('#message').empty();

      // if not signed in, take them to sign in prompt
      if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
        handleAuth();
        return;
      }

      let eventId = $(this).attr('data-event-id');

      showForm(eventId);
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
    setAppointmentForm();
    setAppointment();
  }

  initApp();

})();
