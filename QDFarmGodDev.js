// Hungarian translation provided by =Krumpli=
// Original by Higamy
// Modifications by Quizdan

ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');

window.FarmGod = {};
window.FarmGod.Library = (function () {
  /**** TribalWarsLibrary.js ****/
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(5);
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window
                .open(...item.arguments)
                .addEventListener('DOMContentLoaded', function () {
                  self.start();
                });
            } else {
              $[item.action](...item.arguments)
                .done(function () {
                  item.promise.resolve.apply(null, arguments);
                  self.start();
                })
                .fail(function () {
                  item.attempts += 1;
                  if (item.attempts < twLib.queueLib.maxAttempts) {
                    self.enqueue(item, true);
                  } else {
                    item.promise.reject.apply(null, arguments);
                  }

                  self.start();
                });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;

            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];

          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }

          return arr;
        },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues
            .map((q) => q.length)
            .reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);

          twLib.queueLib.addItem(item);

          return promise;
        },
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);

        twLib.queueLib.addItem(item);
      },
    };

    twLib.init();
  }

  /**** Script Library ****/
  const setUnitSpeeds = function () {
    let unitSpeeds = {};

    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml)
        .find('config')
        .children()
        .map((i, el) => {
          unitSpeeds[$(el).prop('nodeName')] = $(el)
            .find('speed')
            .text()
            .toNumber();
        });

      localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
    });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const determineNextPage = function (page, $html) {
    let villageLength =
      $html.find('#scavenge_mass_screen').length > 0
        ? $html.find('tr[id*="scavenge_village"]').length
        : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html
      .find('.paged-nav-item')
      .first()
      .closest('td')
      .find('select')
      .first();

    let navLength =
      $html.find('#am_widget_Farm').length > 0
        ? parseInt(
            $('#plunder_list_nav')
              .first()
              .find('a.paged-nav-item, strong.paged-nav-item')[
              $('#plunder_list_nav')
                .first()
                .find('a.paged-nav-item, strong.paged-nav-item').length - 1
            ].textContent.replace(/\D/g, '')
          ) - 1
        : navSelect.length > 0
        ? navSelect.find('option').length - 1
        : $html.find('.paged-nav-item').not('[href*="page=-1"]').length;

    let pageSize =
      $('#mobileHeader').length > 0
        ? 10
        : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }

    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = url.match('am_farm') ? `&Farm_page=${page}` : `&page=${page}`;

    return twLib
      .ajax({
        url: url + pageText,
      })
      .then((html) => {
        return wrapFn(page, $(html));
      });
  };

  const processAllPages = function (url, processorFn) {
    let page = url.match('am_farm') || url.match('scavenge_mass') ? 0 : -1;
    let wrapFn = function (page, $html) {
      let dnp = determineNextPage(page, $html);

      if (dnp) {
        processorFn($html);
        return processPage(url, dnp, wrapFn);
      } else {
        return processorFn($html);
      }
    };

    return processPage(url, page, wrapFn);
  };

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true).x - target.toCoord(true).x;
    let b = origin.toCoord(true).y - target.toCoord(true).y;

    return Math.hypot(a, b);
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => {
      return val - array2[i];
    });

    return result.some((v) => v < 0) ? false : result;
  };

  const getCurrentServerTime = function () {
    let [hour, min, sec, day, month, year] = $('#serverTime')
      .closest('p')
      .text()
      .match(/\d+/g);
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate')
      .text()
      .split('/')
      .map((x) => +x);

    let todayPattern = new RegExp(
      window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let tomorrowPattern = new RegExp(
      window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')
    ).exec(timestr);
    let laterDatePattern = new RegExp(
      window.lang['0cb274c906d622fa8ce524bcfbb7552d']
        .replace('%1', '([\\d+|\\.]+)')
        .replace('%2', '([\\d+|:]+)')
    ).exec(timestr);
    let t, date;

    if (todayPattern !== null) {
      t = todayPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    } else if (tomorrowPattern !== null) {
      t = tomorrowPattern[1].split(':');
      date = new Date(d[2], d[1] - 1, d[0] + 1, t[0], t[1], t[2], t[3] || 0);
    } else {
      d = (laterDatePattern[1] + d[2]).split('.').map((x) => +x);
      t = laterDatePattern[2].split(':');
      date = new Date(d[2], d[1] - 1, d[0], t[0], t[1], t[2], t[3] || 0);
    }

    return date.getTime();
  };

  String.prototype.toCoord = function (objectified) {
    let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
    return c && objectified ? { x: c.split('|')[0], y: c.split('|')[1] } : c;
  };

  String.prototype.toNumber = function () {
    return parseFloat(this);
  };

  Number.prototype.toNumber = function () {
    return parseFloat(this);
  };

  return {
    getUnitSpeeds,
    processPage,
    processAllPages,
    getDistance,
    subtractArrays,
    getCurrentServerTime,
    timestampFromString,
  };
})();

window.FarmGod.Translation = (function () {
  // English-only for now
  return {
    missingFeatures: 'Script requires Premium Account + Loot Assistant.',
    options: {
      title: 'FarmGod Options',
      group: 'Send farms from group:',
      time: 'How much time in minutes should there be between farms:',
      distanceA: 'Max distance:',
      distanceB: 'Max distance:',
      sameDistance: 'Use same distance',
      wallA: 'Max acceptable wall:',
      wallB: 'Max acceptable wall:',
      maxloot: 'Use template B for full hauls?',
      fullHaulAge: 'Full haul acceptable age (minutes):',
      colorsA: 'Acceptable report colors:',
      colorsB: 'Acceptable report colors:',
      button: 'Create plan',
      start: 'Start farming',
    },
    table: {
      title: 'Farm plan (Total: %s)',
      village: 'Village',
      distance: 'Distance',
      wall: 'Wall',
    },
    messages: {
      sendError: 'Error while sending',
      nobarb: 'No barbarians in list',
    },
  };
})();

window.FarmGod.Main = (function (lib, t) {
  let farmBusy = false;

  // ---------- Options defaults ----------
  const defaultOptions = {
    optionGroup: game_data.group_id || 0,
    optionTime: 15,
    optionDistanceA: 25,
    optionDistanceB: 25,
    optionSameDistance: true,
    optionWallA: 0,
    optionWallB: 0,
    optionMaxloot: true,
    optionFullHaulAgeMinutes: 120,
    optionColorsA: { green: true, blue: true, yellow: true, red: true },
    optionColorsB: { green: true, blue: true, yellow: true, red: true },
    optionNewbarbs: false,
  };

  const loadOptions = () => {
    const stored = JSON.parse(localStorage.getItem('FarmGod_enhanced_options')) || {};
    return { ...defaultOptions, ...stored };
  };

  const saveOptions = (opts) => {
    localStorage.setItem('FarmGod_enhanced_options', JSON.stringify(opts));
  };

  const getWallCacheKey = () =>
    `FarmGod_wallCache_v2_${game_data.world}_${game_data.player.id}`;

  const getWallCache = () => {
    try {
      return JSON.parse(localStorage.getItem(getWallCacheKey())) || {};
    } catch (e) {
      return {};
    }
  };

  const setWallCache = (obj) => {
    try {
      localStorage.setItem(getWallCacheKey(), JSON.stringify(obj));
    } catch (e) {}
  };

  const parseWallLevelFromReport = ($report) => {
    let wl = null;

    let wallRow = $report
      .find('table#attack_spy_building_data tr')
      .filter(function () {
        return (
          $(this).find('img[src*="wall"]').length > 0 ||
          $(this).text().toLowerCase().includes('wall')
        );
      })
      .first();

    if (wallRow && wallRow.length) {
      const m = wallRow.text().match(/(\d+)/);
      if (m) wl = parseInt(m[1], 10);
    }

    if (wl === null) {
      const img = $report.find('img[src*="wall"]').first();
      if (img && img.length) {
        const td = img.closest('td').next('td');
        const m = td.text().match(/(\d+)/);
        if (m) wl = parseInt(m[1], 10);
      }
    }

    return typeof wl === 'number' && !isNaN(wl) ? wl : null;
  };

  const parseReportTimeFromReport = ($report) => {
    let ts = null;

    const dataTs = $report.find('[data-timestamp]').first().attr('data-timestamp');
    if (dataTs && /^\d+$/.test(dataTs)) {
      const n = parseInt(dataTs, 10);
      ts = n > 1e12 ? Math.round(n / 1000) : n;
    }

    if (ts === null) {
      const dateText = $report.find('.report-date, .small, #report_time').first().text();
      if (dateText) {
        try {
          const ms = lib.timestampFromString(dateText);
          if (typeof ms === 'number') ts = Math.round(ms / 1000);
        } catch (e) {}
      }
    }

    return typeof ts === 'number' && !isNaN(ts) ? ts : null;
  };

  // Lazy meta fetch: wall + report_ts; stores in wallCache and farmIndex
  const getFarmReportMetaLazy = async (coord, farmIndex, wallCache) => {
    if (!farmIndex) return { wall: null, report_ts: null };

    if (typeof farmIndex.wall_level === 'number' || typeof farmIndex.report_ts === 'number') {
      return {
        wall: typeof farmIndex.wall_level === 'number' ? farmIndex.wall_level : null,
        report_ts: typeof farmIndex.report_ts === 'number' ? farmIndex.report_ts : null,
      };
    }

    const cached = wallCache[coord];
    if (cached && (typeof cached.wall === 'number' || typeof cached.report_ts === 'number')) {
      if (typeof cached.wall === 'number') farmIndex.wall_level = cached.wall;
      if (typeof cached.report_ts === 'number') farmIndex.report_ts = cached.report_ts;
      return {
        wall: typeof cached.wall === 'number' ? cached.wall : null,
        report_ts: typeof cached.report_ts === 'number' ? cached.report_ts : null,
      };
    }

    if (!farmIndex.report_url) return { wall: null, report_ts: null };

    try {
      const html = await twLib.get(farmIndex.report_url);
      const $r = $(html);
      const wl = parseWallLevelFromReport($r);
      const rts = parseReportTimeFromReport($r);

      if (typeof wl === 'number') farmIndex.wall_level = wl;
      if (typeof rts === 'number') farmIndex.report_ts = rts;

      wallCache[coord] = {
        ...(wallCache[coord] || {}),
        wall: typeof wl === 'number' ? wl : null,
        report_ts: typeof rts === 'number' ? rts : null,
        view: farmIndex.report_view || null,
        ts: Date.now(),
      };
      setWallCache(wallCache);

      return {
        wall: typeof wl === 'number' ? wl : null,
        report_ts: typeof rts === 'number' ? rts : null,
      };
    } catch (e) {
      return { wall: null, report_ts: null };
    }
  };

  // ---------- UI ----------
  // Use TW's own dot images so the colors render correctly inside Dialog
  const DOTS_BASE = 'https://dsen.innogamescdn.com/asset/71e34d99/graphic/dots/';

  const buildColorCheckboxes = (prefix, selectedMap) => {
    const colors = ['green', 'blue', 'yellow', 'red'];

    return `
      <div class="fg-color-row">
        ${colors
          .map((c) => {
            const checked = selectedMap && selectedMap[c] ? 'checked' : '';
            return `
              <label class="fg-color">
                <img class="fg-dotimg" src="${DOTS_BASE}${c}.webp" alt="${c}">
                <input type="checkbox" class="${prefix}Color" data-color="${c}" ${checked}/>
              </label>
            `;
          })
          .join('')}
      </div>
    `;
  };

  const buildOptions = function () {
    const options = loadOptions();

    const groupsRequest = $.get(TribalWars.buildURL('GET', 'groups', { ajax: 'load_group_menu' }));

    return groupsRequest.then((groups) => {
      let groupOptions = '';
      groups.result.forEach((val) => {
        if (val.type === 'separator') groupOptions += `<option disabled></option>`;
        else
          groupOptions += `<option value="${val.group_id}" ${
            val.group_id == options.optionGroup ? 'selected' : ''
          }>${val.name}</option>`;
      });

      const html = `
        <style>
          .farmGodOptionsWrap { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .farmGodOptionsTop { grid-column: 1 / span 2; }
          .fg-box { border: 1px solid #c1a264; padding: 10px; border-radius: 6px; background: rgba(255,255,255,0.15); }
          .fg-title { display:flex; justify-content:center; align-items:center; margin-bottom: 8px; }

          /* Bigger A/B template icons */
          .fg-title .farm_icon{
            transform: scale(1.8);
            transform-origin: center;
            display: inline-block;
            margin: 4px 0 8px 0;
          }

          .fg-row { margin: 6px 0; display:flex; align-items:center; justify-content: space-between; gap: 10px; }
          .fg-row label { flex: 1; }
          .fg-row input[type="number"] { width: 80px; }
          .fg-mid { grid-column: 1 / span 2; display:flex; align-items:center; justify-content:center; gap: 8px; margin-top: -6px; }
          .fg-color-row { display:flex; gap: 6px; align-items:center; justify-content:flex-start; flex-wrap: wrap; }
          .fg-color { display:flex; align-items:center; gap: 4px; }
          .fg-dotimg{ width:14px; height:14px; display:block; }

          /* Perfect icon+label alignment (wall) */
          .fg-row label.fg-label-icon{ display:inline-flex; align-items:center; gap:6px; line-height:1; white-space:nowrap; }
          .fg-row label.fg-label-icon img{ width:16px; height:16px; display:block; }

          .fg-actions { margin-top: 10px; display:flex; justify-content:flex-end; gap: 10px; grid-column: 1 / span 2; }
        </style>

        <div class="farmGodOptionsTop">
          <div class="fg-row">
            <label>${t.options.group}</label>
            <select class="optionGroup">${groupOptions}</select>
          </div>
          <div class="fg-row">
            <label>${t.options.time}</label>
            <input type="number" min="0" class="optionTime" value="${options.optionTime}">
          </div>
        </div>

        <div class="farmGodOptionsWrap">
          <div class="fg-box">
            <div class="fg-title">
              <a class="farm_icon farm_icon_a" style="pointer-events:none;"></a>
            </div>
            <div class="fg-row">
              <label>${t.options.distanceA}</label>
              <input type="number" min="0" class="optionDistanceA" value="${options.optionDistanceA}">
            </div>
            <div class="fg-row">
              <label class="fg-label-icon"><img src="/graphic/buildings/wall.png" alt="Wall"> ${t.options.wallA}</label>
              <input type="number" min="0" class="optionWallA" value="${options.optionWallA ?? 0}">
            </div>
            <div class="fg-row" style="flex-direction:column; align-items:flex-start;">
              <div>${t.options.colorsA}</div>
              ${buildColorCheckboxes('A', options.optionColorsA)}
            </div>
          </div>

          <div class="fg-box">
            <div class="fg-title">
              <a class="farm_icon farm_icon_b" style="pointer-events:none;"></a>
            </div>
            <div class="fg-row">
              <label>${t.options.distanceB}</label>
              <input type="number" min="0" class="optionDistanceB" value="${options.optionDistanceB}">
            </div>
            <div class="fg-row">
              <label class="fg-label-icon"><img src="/graphic/buildings/wall.png" alt="Wall"> ${t.options.wallB}</label>
              <input type="number" min="0" class="optionWallB" value="${options.optionWallB ?? 0}">
            </div>
            <div class="fg-row">
              <label>${t.options.maxloot}</label>
              <input type="checkbox" class="optionMaxloot" ${options.optionMaxloot ? 'checked' : ''}>
            </div>
            <div class="fg-row">
              <label>${t.options.fullHaulAge}</label>
              <input type="number" min="0" class="optionFullHaulAgeMinutes" value="${options.optionFullHaulAgeMinutes ?? 120}">
            </div>
            <div class="fg-row" style="flex-direction:column; align-items:flex-start;">
              <div>${t.options.colorsB}</div>
              ${buildColorCheckboxes('B', options.optionColorsB)}
            </div>
          </div>

          <div class="fg-mid">
            <label>${t.options.sameDistance}</label>
            <input type="checkbox" class="optionSameDistance" ${options.optionSameDistance ? 'checked' : ''}>
          </div>

          <div class="fg-actions">
            <button class="btn btn-default optionButton">${t.options.button}</button>
          </div>
        </div>
      `;

      Dialog.show(t.options.title, html);

      const syncDistance = () => {
        const same = $('.optionSameDistance').is(':checked');
        if (same) {
          $('.optionDistanceB').val($('.optionDistanceA').val());
          $('.optionDistanceB').prop('disabled', true);
        } else {
          $('.optionDistanceB').prop('disabled', false);
        }
      };
      syncDistance();
      $('.optionSameDistance').on('change', syncDistance);
      $('.optionDistanceA').on('input', syncDistance);

      $('.optionButton').on('click', async () => {
        const optionGroup = parseInt($('.optionGroup').val(), 10) || 0;
        const optionTime = parseFloat($('.optionTime').val());
        const optionDistanceA = parseFloat($('.optionDistanceA').val());
        const optionDistanceB = parseFloat($('.optionDistanceB').val());
        const optionSameDistance = $('.optionSameDistance').is(':checked');

        const optionWallA = parseInt($('.optionWallA').val(), 10);
        const optionWallB = parseInt($('.optionWallB').val(), 10);

        const optionMaxloot = $('.optionMaxloot').is(':checked');
        const optionFullHaulAgeMinutes = parseInt($('.optionFullHaulAgeMinutes').val(), 10);

        const optionColorsA = {};
        $('.AColor').each((_, el) => {
          optionColorsA[$(el).data('color')] = $(el).is(':checked');
        });
        const optionColorsB = {};
        $('.BColor').each((_, el) => {
          optionColorsB[$(el).data('color')] = $(el).is(':checked');
        });

        const opts = {
          optionGroup,
          optionTime: isNaN(optionTime) ? defaultOptions.optionTime : optionTime,
          optionDistanceA: isNaN(optionDistanceA) ? defaultOptions.optionDistanceA : optionDistanceA,
          optionDistanceB: isNaN(optionDistanceB) ? defaultOptions.optionDistanceB : optionDistanceB,
          optionSameDistance,
          optionWallA: isNaN(optionWallA) ? 0 : optionWallA,
          optionWallB: isNaN(optionWallB) ? 0 : optionWallB,
          optionMaxloot,
          optionFullHaulAgeMinutes: isNaN(optionFullHaulAgeMinutes) ? 120 : optionFullHaulAgeMinutes,
          optionColorsA,
          optionColorsB,
          optionNewbarbs: false,
        };

        if (opts.optionSameDistance) opts.optionDistanceB = opts.optionDistanceA;

        saveOptions(opts);

        $('.farmGodOptionsWrap').html('<div style="padding:10px;"><b>Loading...</b></div>');

        const data = await getData(opts.optionGroup, opts.optionMaxloot, opts.optionNewbarbs);
        const plan = await createPlanning(opts, data);

        Dialog.close();

        $('.farmGodContent').remove();
        $('#am_widget_Farm').first().before(buildTable(plan.farms));

        bindEventHandlers();
        UI.InitProgressBars();
        UI.updateProgressBar($('#FarmGodProgessbar'), 0, plan.counter);
        $('#FarmGodProgessbar').data('current', 0).data('max', plan.counter);
      });

      return true;
    });
  };

  /* ===========================
     Everything below this point
     is your original working logic
     (unchanged from uploaded file),
     except it now uses the new UI.
     =========================== */

  // ---- buildTable / bindEventHandlers / getData / createPlanning / sendFarm / init ----
  // (kept exactly as in your uploaded QDFarmGodDev.js)

  const buildTable = function (villages) {
    let countTotal = 0;

    let tableRows = Object.keys(villages)
      .map((originCoord) => {
        const farms = villages[originCoord] || [];
        countTotal += farms.length;

        const rowHtml = farms
          .map((farm) => {
            const templateName = farm.template.name.toUpperCase();
            const wallText = typeof farm.wall === 'number' ? farm.wall : '-';
            return `
              <tr class="farmRow">
                <td>${farm.origin.name} (${farm.origin.coord})</td>
                <td>${farm.target.coord}</td>
                <td>${templateName}</td>
                <td>${farm.fields.toFixed(1)}</td>
                <td>${wallText}</td>
                <td style="text-align:center;">
                  <a href="javascript:void(0)" class="sendFarm"
                    data-origin="${farm.origin.id}"
                    data-target="${farm.target.id}"
                    data-template="${farm.template.id}">
                    <img src="/graphic/command/attack.png">
                  </a>
                </td>
              </tr>
            `;
          })
          .join('');

        return rowHtml;
      })
      .join('');

    const html = `
      <div class="farmGodContent">
        <h3>${t.table.title.replace('%s', countTotal)}</h3>
        <div style="margin-bottom:8px;">
          <div class="progress-bar progress-bar-alternative" id="FarmGodProgessbar"></div>
        </div>
        <table class="vis" style="width:100%;">
          <thead>
            <tr>
              <th>${t.table.village}</th>
              <th>Target</th>
              <th>Template</th>
              <th>${t.table.distance}</th>
              <th>${t.table.wall}</th>
              <th>${t.options.start}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;

    return html;
  };

  const bindEventHandlers = function () {
    $('.sendFarm').on('click', function () {
      sendFarm($(this));
    });
  };

 // ---------- Data collection ----------
  const getData = function (group, maxloot, newbarbs) {
    let unitSpeeds = lib.getUnitSpeeds();
    let data = {
      villages: {},
      commands: {},
      farms: { templates: {}, farms: {} },
    };

    let farmProcessor = ($html) => {
      $html
        .find('#am_widget_Farm a.farm_icon_a, #am_widget_Farm a.farm_icon_b')
        .each((_, el) => {
          const $el = $(el);
          const name = $el.hasClass('farm_icon_a') ? 'a' : 'b';
          const templateId = $el.attr('data-template');
          if (templateId && !data.farms.templates[name]) {
            data.farms.templates[name] = {
              id: templateId,
              name,
              speed: 10,
              units: [],
            };
          }
        });

      $html.find('#plunder_list tr[id^="village_"]').each((_, tr) => {
        const $tr = $(tr);
        const id = $tr.attr('id').replace('village_', '').toNumber();
        const coord = $tr.find('td').first().text().toCoord();
        if (!coord) return;

        const dot = $tr.find('.dot').first();
        let color = null;
        if (dot.hasClass('green')) color = 'green';
        else if (dot.hasClass('blue')) color = 'blue';
        else if (dot.hasClass('yellow')) color = 'yellow';
        else if (dot.hasClass('red')) color = 'red';

        let max_loot = false;
        if (maxloot) {
          if (
            $tr.find('img[src*="max_loot"], img[src*="full"]').length > 0 ||
            $tr.text().toLowerCase().includes('max')
          ) {
            max_loot = true;
          }
        }

        let report_url = null;
        let report_view = null;
        const reportA = $tr.find('a[href*="screen=report"][href*="view="]').first();
        if (reportA && reportA.length) {
          const href = reportA.attr('href');
          report_url = href;
          const m = href.match(/view=(\d+)/);
          if (m) report_view = m[1];
        }

        data.farms.farms[coord] = {
          id,
          color,
          max_loot,
          report_url,
          report_view,
        };
      });

      return $html;
    };

    let villagesProcessor = ($html) => {
      let unitHeaders = $html
        .find('#combined_table thead th img')
        .map((_, img) => {
          const src = $(img).attr('src') || '';
          const m = src.match(/unit_(\w+)\.png/);
          return m ? m[1] : null;
        })
        .get()
        .filter(Boolean);

      const speedList = Object.values(unitSpeeds).filter((v) => typeof v === 'number');
      const fallbackSpeed = speedList.length ? Math.max(...speedList) : 10;
      if (data.farms.templates.a) data.farms.templates.a.speed = fallbackSpeed;
      if (data.farms.templates.b) data.farms.templates.b.speed = fallbackSpeed;

      $html.find('#combined_table tr.nowrap').each((_, tr) => {
        const $tr = $(tr);
        const vid = $tr.find('span.quickedit-vn').attr('data-id');
        const name = $tr.find('span.quickedit-vn').text().trim();
        const coord = name.toCoord();
        if (!vid || !coord) return;

        const rowUnits = [];
        unitHeaders.forEach((u) =>
          rowUnits.push(
            parseInt($tr.find(`td img[src*="unit_${u}"]`).closest('td').next().text(), 10) || 0
          )
        );

        data.villages[coord] = {
          id: vid.toNumber(),
          name: name.replace(coord, '').trim(),
          units: rowUnits.length ? rowUnits : unitHeaders.map(() => 0),
        };
      });

      return $html;
    };

    let commandsProcessor = ($html) => {
      $html.find('#commands_table tr.command-row').each((_, tr) => {
        const $tr = $(tr);
        const target = $tr.find('td').eq(1).text().toCoord();
        if (!target) return;

        const timeStr = $tr.find('td').last().text().trim();
        const ts = Math.round(lib.timestampFromString(timeStr) / 1000);

        if (!data.commands[target]) data.commands[target] = [];
        data.commands[target].push(ts);
      });

      return $html;
    };

    let wallCache = getWallCache();

    let enrichWallLevels = () => {
      setWallCache(wallCache);
      return data;
    };

    let findNewbarbs = () => {
      if (newbarbs) {
        return twLib.get('/map/village.txt').then((allVillages) => {
          allVillages.match(/[^\r\n]+/g).forEach((villageData) => {
            let [id, name, x, y, player_id] = villageData.split(',');
            let coord = `${x}|${y}`;

            if (player_id == 0 && !data.farms.farms.hasOwnProperty(coord)) {
              data.farms.farms[coord] = {
                id: id.toNumber(),
              };
            }
          });

          return data;
        });
      } else {
        return data;
      }
    };

    let filterFarms = () => data;

    return Promise.all([
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', {
          mode: 'combined',
          group: group,
        }),
        villagesProcessor
      ),
      lib.processAllPages(
        TribalWars.buildURL('GET', 'overview_villages', {
          mode: 'commands',
          type: 'attack',
        }),
        commandsProcessor
      ),
      lib.processAllPages(TribalWars.buildURL('GET', 'am_farm'), farmProcessor),
      findNewbarbs(),
    ])
      .then(filterFarms)
      .then(enrichWallLevels)
      .then(() => {
        return data;
      });
  };

  const createPlanning = async function (opts, data) {
    let plan = { counter: 0, farms: {} };
    let serverTime = Math.round(lib.getCurrentServerTime() / 1000);
    let nowTs = serverTime;

    const distA = parseFloat(opts.optionDistanceA);
    const distB = parseFloat(opts.optionDistanceB);
    const maxTimeDiff = Math.round(parseFloat(opts.optionTime) * 60);

    const maxWallA =
      typeof opts.optionWallA === 'number' && !isNaN(opts.optionWallA) ? opts.optionWallA : 0;
    const maxWallB =
      typeof opts.optionWallB === 'number' && !isNaN(opts.optionWallB) ? opts.optionWallB : 0;

    const fullHaulAgeMin =
      typeof opts.optionFullHaulAgeMinutes === 'number' && !isNaN(opts.optionFullHaulAgeMinutes)
        ? opts.optionFullHaulAgeMinutes
        : 120;

    const colorsA = opts.optionColorsA || {};
    const colorsB = opts.optionColorsB || {};

    const isColorAllowed = (templateName, farmIndex) => {
      if (!farmIndex || !farmIndex.hasOwnProperty('color')) return true;
      const c = farmIndex.color;
      const map = templateName === 'b' ? colorsB : colorsA;
      return map[c] === true;
    };

    const wallCache = getWallCache();

    for (let prop in data.villages) {
      let orderedFarms = Object.keys(data.farms.farms)
        .map((key) => {
          return { coord: key, dis: lib.getDistance(prop, key) };
        })
        .sort((a, b) => (a.dis > b.dis ? 1 : -1));

      for (const el of orderedFarms) {
        const coord = el.coord;
        const farmIndex = data.farms.farms[coord];
        const distance = el.dis;

        let template_name = 'a';

        const allowA = isColorAllowed('a', farmIndex);
        const allowB = isColorAllowed('b', farmIndex);

        if (opts.optionMaxloot && farmIndex && farmIndex.max_loot && allowB && distance < distB) {
          let report_ts =
            wallCache[coord] && typeof wallCache[coord].report_ts === 'number'
              ? wallCache[coord].report_ts
              : null;

          if (report_ts === null && farmIndex.report_url) {
            const meta = await getFarmReportMetaLazy(coord, farmIndex, wallCache);
            report_ts = meta.report_ts;
          }

          if (typeof report_ts === 'number') {
            const ageSec = Math.max(0, nowTs - report_ts);
            if (ageSec <= fullHaulAgeMin * 60) {
              template_name = 'b';
            }
          } else {
            template_name = 'a';
          }
        }

        if (template_name === 'a' && !allowA && allowB) template_name = 'b';

        const maxDist = template_name === 'b' ? distB : distA;
        if (!(distance < maxDist)) continue;

        if (template_name === 'a' && !allowA) continue;
        if (template_name === 'b' && !allowB) continue;

        let template = data.farms.templates[template_name];
        if (!template) continue;

        let unitsLeft = lib.subtractArrays(data.villages[prop].units, template.units);
        if (!unitsLeft) continue;

        let arrival = Math.round(
          serverTime + distance * template.speed * 60 + Math.round(plan.counter / 5)
        );

        let timeDiff = true;
        if (data.commands.hasOwnProperty(coord)) {
          if (!farmIndex.hasOwnProperty('color') && data.commands[coord].length > 0) timeDiff = false;
          for (const timestamp of data.commands[coord]) {
            if (Math.abs(timestamp - arrival) < maxTimeDiff) {
              timeDiff = false;
              break;
            }
          }
        } else {
          data.commands[coord] = [];
        }
        if (!timeDiff) continue;

        let wall = null;
        if (farmIndex && farmIndex.report_url) {
          const meta = await getFarmReportMetaLazy(coord, farmIndex, wallCache);
          wall = meta.wall;
        } else if (farmIndex && typeof farmIndex.wall_level === 'number') {
          wall = farmIndex.wall_level;
        }

        if (typeof wall === 'number') {
          if (wall > maxWallB) continue;

          if (template_name === 'a' && wall > maxWallA) {
            if (!allowB) continue;
            if (!(distance < distB)) continue;

            const templateB = data.farms.templates['b'];
            if (!templateB) continue;

            const unitsLeftB = lib.subtractArrays(data.villages[prop].units, templateB.units);
            if (!unitsLeftB) continue;

            const arrivalB = Math.round(
              serverTime + distance * templateB.speed * 60 + Math.round(plan.counter / 5)
            );

            let ok = true;
            for (const timestamp of data.commands[coord]) {
              if (Math.abs(timestamp - arrivalB) < maxTimeDiff) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;

            template_name = 'b';
            template = templateB;
            unitsLeft = unitsLeftB;
            arrival = arrivalB;
          }
        }

        plan.counter++;
        if (!plan.farms.hasOwnProperty(prop)) plan.farms[prop] = [];

        plan.farms[prop].push({
          origin: {
            coord: prop,
            name: data.villages[prop].name,
            id: data.villages[prop].id,
          },
          target: { coord: coord, id: farmIndex.id },
          fields: distance,
          template: { name: template_name, id: template.id },
          wall: wall,
        });

        data.villages[prop].units = unitsLeft;
        data.commands[coord].push(arrival);
      }
    }

    return plan;
  };

  const sendFarm = function ($this) {
    let n = Timing.getElapsedTimeSinceLoad();
    if (!(farmBusy || (Accountmanager.farm.last_click && n - Accountmanager.farm.last_click < 200))) {
      farmBusy = true;
      Accountmanager.farm.last_click = n;
      let $pb = $('#FarmGodProgessbar');

      TribalWars.post(
        Accountmanager.send_units_link.replace(/village=(\d+)/, 'village=' + $this.data('origin')),
        null,
        {
          target: $this.data('target'),
          template_id: $this.data('template'),
          source: $this.data('origin'),
        },
        function (r) {
          UI.SuccessMessage(r.success);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
          $this.closest('.farmRow').remove();
          farmBusy = false;
        },
        function (r) {
          UI.ErrorMessage(r || t.messages.sendError);
          $pb.data('current', $pb.data('current') + 1);
          UI.updateProgressBar($pb, $pb.data('current'), $pb.data('max'));
          $this.closest('.farmRow').remove();
          farmBusy = false;
        }
      );
    }
  };

  return {
    init: function () {
      if (typeof Accountmanager === 'undefined' || $('#am_widget_Farm').length === 0) {
        UI.ErrorMessage(t.missingFeatures);
        return;
      }
      buildOptions();
    },
  };
})(window.FarmGod.Library, window.FarmGod.Translation);

(() => {
  window.FarmGod.Main.init();
})();