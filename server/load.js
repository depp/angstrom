'use strict';

/* global Vue */

(function loader() {
  if (Vue === undefined) {
    console.error('Vue did not load');
  }

  function dataURL(name, stamp) {
    return `data/${encodeURI(name)}?t=${encodeURIComponent(stamp)}`;
  }

  // ===========================================================================
  // Status bar
  // ===========================================================================
  const status = (function status() {
    const cmp = new Vue({
      el: '#status',
      data: {
        status: 'loading',
        message: 'Initializing',
      },
    });

    function set(sclass, message) {
      cmp.status = sclass;
      cmp.message = message;
    }

    return {
      set,
    };
  }());

  // ===========================================================================
  // Diagnostics
  // ===========================================================================
  const diagnostics = (function diagnostics() {
    Vue.component('file-messages', {
      props: ['file'],
      template: '#file-messages',
      mounted() {
        this.renderText();
      },
      updated() {
        this.renderText();
      },
      methods: {
        renderText() {
          const { code } = this.file;
          if (code == null) {
            return;
          }
          const lines = code.split('\n');
          const msgs = this.file.messages;
          let elt = this.$refs.list.firstChild;
          for (let i = 0; i < msgs.length; i++, elt = elt.nextSibling) {
            const last = elt.lastChild;
            if (last.tagName === 'PRE') {
              elt.removeChild(last);
            }
            const msg = msgs[i];
            const line0 = msg.line;
            if (!line0) {
              continue;
            }
            const line1 = msg.endLine || line0;
            const column0 = msg.column || 0;
            const column1 = msg.endColumn || (column0 + 1);
            const preElt = document.createElement('pre');
            const codeElt = document.createElement('code');
            preElt.appendChild(codeElt);
            let curElt = codeElt;
            for (let j = line0; j <= line1; j++) {
              let c0 = 0;
              if (j === line0) {
                c0 = column0;
              } else {
                curElt.appendChild(document.createTextNode('\n'));
              }
              let c1 = 0;
              if (j === line1) {
                c1 = column1;
              }
              const line = lines[j - 1];
              let idx = 0;
              if (c0 > 0) {
                if (c0 > 1) {
                  const text = document.createTextNode(
                    line.substring(0, c0 - 1),
                  );
                  idx = c0 - 1;
                  curElt.appendChild(text);
                }
                curElt = document.createElement('span');
                curElt.className = 'code-error';
                codeElt.appendChild(curElt);
              }
              if (c1 > 0) {
                c1 = Math.min(line.length, c1 - 1);
                let s = line.substring(idx, c1);
                if (idx === c1) {
                  s += '\u00a0';
                }
                const text = document.createTextNode(s);
                idx = c1;
                curElt.appendChild(text);
                curElt = codeElt;
              }
              if (idx < line.length) {
                const text = document.createTextNode(line.substring(idx));
                curElt.appendChild(text);
              }
            }
            elt.appendChild(preElt);
          }
        },
      },
    });

    const cmp = new Vue({
      el: '#diagnostics',
      data: {
        files: {},
      },
    });

    const manifest = {};
    const data = {};

    function update() {
      const files = {};
      for (const set of Object.values(data)) {
        Object.assign(files, set);
      }
      cmp.files = files;
    }

    async function load(name, stamp) {
      const url = dataURL(name, stamp);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Could not load ${url}: ${resp.statusText}`);
        return;
      }
      const file = await resp.json();
      if (manifest[name] !== stamp) {
        return;
      }
      data[name] = file;
      update();
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

  // ===========================================================================
  // Data files
  // ===========================================================================
  const datafiles = (function datafiles() {
    const manifest = {};
    const data = {};

    function update(name) {
      const g = window.Game;
      if (g) {
        g.loadData(name, data[name] || null);
      }
    }

    function loadedScript() {
      const g = window.Game;
      if (g) {
        for (const [k, v] of Object.entries(data)) {
          g.loadData(k, v);
        }
      }
    }

    async function load(name, stamp) {
      const url = dataURL(name, stamp);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Could not load ${url}: ${resp.statusText}`);
        return;
      }
      const file = await resp.text();
      if (manifest[name] !== stamp) {
        return;
      }
      data[name] = file;
      update(name);
    }

    function changed(name, stamp) {
      if (stamp === null) {
        delete manifest[name];
        delete data[name];
        update(name);
        return;
      }
      manifest[name] = stamp;
      load(name, stamp);
    }

    return {
      changed,
      loadedScript,
    };
  }());

  // ===========================================================================
  // WebSocket
  // ===========================================================================
  (function runsocket() {
    let haveScript = false;
    function loadScript(stamp) {
      if (haveScript) {
        return;
      }
      haveScript = true;
      status.set('loading', 'Loading script');
      const canvasElt = document.createElement('canvas');
      canvasElt.width = 800;
      canvasElt.height = 600;
      canvasElt.id = 'g';
      const statusElt = document.getElementById('status');
      statusElt.parentNode.insertBefore(canvasElt, statusElt.nextSibling);
      const scriptElt = document.createElement('script');
      scriptElt.setAttribute('src', dataURL('game.js', stamp));
      scriptElt.addEventListener('load', () => {
        status.set('ok', 'Loaded');
        datafiles.loadedScript();
      });
      document.head.appendChild(scriptElt);
    }
    const ws = new WebSocket(`ws://${window.location.host}/debug/build-socket`);
    ws.addEventListener('error', (e) => {
      status.set('error', `Socket error: ${e.message}`);
    });
    ws.addEventListener('open', () => {
      status.set('loading', 'Socket open, waiting for script');
    });
    ws.addEventListener('close', () => {
      status.set('error', 'Socket closed');
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
            loadScript(stamp);
            break;
          case 'diagnostics':
            diagnostics.changed(file, stamp);
            break;
          case 'shader':
            datafiles.changed(file, stamp);
            break;
          default:
            console.warn(`Unknown file: ${JSON.stringify(file)}`);
            break;
        }
      }
    });
  }());

  // ===========================================================================
}());
