'use strict';

(function loader() {
  function dataURL(name, stamp) {
    return `data/${encodeURI(name)}?t=${encodeURIComponent(stamp)}`;
  }

  // ===========================================================================
  // Diagnostics
  // ===========================================================================
  const diagnostics = (function diagnostics() {
    const manifest = {};
    const data = {};
    let flat = {};

    function update() {
      const nflat = {};
      for (const v of Object.values(data)) {
        Object.assign(nflat, v);
      }
      flat = nflat;
      console.log(flat);
    }

    async function load(name, stamp) {
      const url = dataURL(name, stamp);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Could not load ${url}: ${resp.statusText}`);
        return;
      }
      const d = await resp.json();
      if (manifest[name] === stamp) {
        data[name] = d;
        update();
      }
    }

    function changed(name, stamp) {
      if (stamp === null) {
        delete manifest[name];
        delete data[name];
        update();
        return;
      }
      manifest[name] = stamp;
      load(name, stamp);
    }

    return {
      changed,
    };
  }());

  const ws = new WebSocket(`ws://${window.location.host}/debug/build-socket`);
  ws.addEventListener('error', (e) => {
    console.error('SOCKET ERROR', e);
  });
  ws.addEventListener('open', (e) => {
    console.log('SOCKET OPEN', e);
  });
  ws.addEventListener('close', (e) => {
    console.log('SOCKET CLOSED', e);
  });
  ws.addEventListener('message', (e) => {
    const delta = JSON.parse(e.data);
    for (const file of Object.keys(delta)) {
      const stamp = delta[file];
      const i = file.indexOf('/');
      let root = file;
      if (i !== -1) {
        root = file.substring(0, i);
      }
      switch (root) {
        case 'game.js':
          break;
        case 'diagnostics':
          diagnostics.changed(file, stamp);
          break;
        default:
          console.warn(`Unknown file: ${JSON.stringify(file)}`);
          break;
      }
    }
  });
}());
