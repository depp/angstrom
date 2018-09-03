(function() {
  'use strict';

  const socket = new WebSocket(`ws://${window.location.host}/debug/build-socket`);
  socket.addEventListener('open', e => {
    socket.send("Hello");
  })
  socket.addEventListener("message", e=> {
    console.log("Message", event.data);
  });
})();
