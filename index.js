'use strict';


(function() {

  let content = $('#content');
  let formContainer = $('#form-overlay');

  let api = {
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

  // re-render the calendar view after an appointment has been booked
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

  function getCalendarData() {

    // automatically hide the form container when re-rendering the calendar
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
      // console.log(data, textStatus, jqXHR);
      renderCalendarView(data.items);
    });
  }

  function showForm(eventId) {

    let settings = {
      key: api.key
    };

    $.get(api.getSingle(eventId), settings, function(data, textStatus, jqXHR) {
      // console.log(data, textStatus, jqXHR);

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
              <span role="button" class="close">Back to calendar</span>
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
                  <label for="email">Email</label>
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

    // error checking
    if(!name) {
      errors.name = 'Name cannot be empty';
    }

    if(name.length <= 2) {
      errors.name = 'Name must be longer than 2 characters.';
    }

    if(!/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
      errors.email = 'Please enter a valid email';
    }

    if(!email) {
      errors.email = 'Email cannot be empty';
    }

    // checks cookie to see if user has previously booked an appointment
    if(document.cookie.indexOf(gapi.auth2.getAuthInstance().currentUser.get().getId()) !== -1) {
      errors.user = 'You have already booked an appointment this week, please try again next week';
    }

    // check if the error object is empty, if so return the values
    if($.isEmptyObject(errors)) {
      return [true, {name: name, email: email}];
    }

    // otherwise return the errors
    return [false, errors];
  }

  function showErrors(errors) {

    let target = $('#form-response');
    let html = '';

    // loop through the errors object and render them in the html
    for(let error in errors) {
      html += `
      <li><strong>${error}</strong> ${errors[error]}</li>
      `;
    }

    target.html('<ul class="alert alert-danger"><h4>Please correct the following before submitting</h4>' + html + '</ul>');
  }

  function setAppointment() {

    formContainer.on('click', '#booking-form button', function(e) {

      e.preventDefault();

      let validationResult = validateForm.call($(this).closest('#booking-form')[0]);
      let eventId = $('#event-id').val();

      let settings = {
        key: api.key
      };

      // validate the data before making the api calls
      if(!validationResult[0]) {
        showErrors(validationResult[1]);
        return;
      }

      // make an api call to the selected appointment to ensure that it is still available
      $.get(api.getSingle(eventId), settings, function(data, textStatus, jqXHR) {
        // console.log(data, textStatus, jqXHR);

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

        // update the appointment and push to the calendar
        gapi.client.calendar.events.patch({
          calendarId: api.calId,
          eventId: data.id,
          resource: data,
          sendNotifications: true
        })
        .then(function(response) {

          document.cookie = 'user=' + gapi.auth2.getAuthInstance().currentUser.get().getId() + '; expires=' + moment().add(7, 'd').format();

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
    gapi.auth2.getAuthInstance().signIn();
  }

  function handleClientLoad() {
    gapi.load('client:auth2', initClient);
  }

  function initClient() {

    // authorize user with oauth
    gapi.client.init({
      apiKey: api.key,
      clientId: api.clientId,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
      ],
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile'
    })
    .then(function() {
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
  }

  function updateSigninStatus(isSignedIn) {
    // console.log('is signed in?:', isSignedIn);
  }

  function initApp() {
    handleClientLoad();
    getCalendarData();
    setAppointmentForm();
    setAppointment();
  }

  initApp();

})();
