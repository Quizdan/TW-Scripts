/*
 * Cancel Snipe Helper (rewritten)
 * Purpose:
 *   Calculate the valid cancel window so the returning command lands
 *   in the same displayed second as the user target time.
 *
 * Notes:
 *   - Tribal Wars can preserve hidden milliseconds on return.
 *   - Only the displayed return second matters for this use case.
 *   - Therefore this script calculates a 500 ms valid cancel window,
 *     not a single exact cancel timestamp.
 */

(function () {
    'use strict';

    const SCRIPT_NAME = 'Cancel Snipe Helper';
    const STORAGE_KEY = 'cancelSnipe_target_return_time';

    if (game_data.screen !== 'info_command') {
        UI.ErrorMessage('Go to Command then run script!');
        return;
    }

    // ---------- Helpers ----------

    function pad(n, len = 2) {
        return String(n).padStart(len, '0');
    }

    function monthMap() {
        return {
            Jan: 0,
            Feb: 1,
            Mar: 2,
            Apr: 3,
            May: 4,
            Jun: 5,
            Jul: 6,
            Aug: 7,
            Sep: 8,
            Oct: 9,
            Nov: 10,
            Dec: 11,
        };
    }

    function formatDateTime(date, includeMs = true) {
        const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
        ];

        let text =
            `${months[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        if (includeMs) {
            text += `:${pad(date.getMilliseconds(), 3)}`;
        }

        return text;
    }

    function formatHms(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function getServerNow() {
        const serverDate = $('#serverDate').text().trim(); // dd/mm/yyyy
        const serverTime = $('#serverTime').text().trim(); // HH:MM:SS

        const [day, month, year] = serverDate.split('/').map(Number);
        const [hour, minute, second] = serverTime.split(':').map(Number);

        return new Date(year, month - 1, day, hour, minute, second, 0);
    }

    function parseDurationToMs(text) {
        const m = text.trim().match(/(\d+):(\d{2}):(\d{2})/);
        if (!m) return null;

        return (
            Number(m[1]) * 3600000 +
            Number(m[2]) * 60000 +
            Number(m[3]) * 1000
        );
    }

    function parseEnglishDateTime(text) {
        const clean = text.replace(/\s+/g, ' ').trim();

        // Accept:
        // Mar 10, 2026 12:34:56
        // Mar 10, 2026 12:34:56:123
        const m = clean.match(
            /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?::(\d{1,3}))?$/
        );

        if (!m) return null;

        const months = monthMap();
        const mon = months[m[1]];
        if (mon === undefined) return null;

        return new Date(
            Number(m[3]),
            mon,
            Number(m[2]),
            Number(m[4]),
            Number(m[5]),
            Number(m[6]),
            Number(m[7] || 0)
        );
    }

    function parseTargetInput(input) {
        const direct = parseEnglishDateTime(input);
        if (direct) return direct;

        // Fallback to native parse for ISO-like input
        const fallback = new Date(input);
        if (!isNaN(fallback.getTime())) return fallback;

        return null;
    }

    function getRowValueText($row) {
        const $cells = $row.find('td');
        if ($cells.length < 2) return '';
        return $($cells[1]).text().replace(/\s+/g, ' ').trim();
    }

    function extractCommandTiming() {
        let durationMs = null;
        let arrivalTime = null;

        $('.vis tr').each(function () {
            const valueText = getRowValueText($(this));
            if (!valueText) return;

            if (durationMs === null) {
                const d = parseDurationToMs(valueText);
                if (d !== null) {
                    durationMs = d;
                }
            }

            if (arrivalTime === null) {
                const a = valueText.match(
                    /([A-Za-z]{3}\s+\d{1,2},\s*\d{4}\s+\d{2}:\d{2}:\d{2}(?::\d{1,3})?)/
                );
                if (a) {
                    const parsed = parseEnglishDateTime(a[1]);
                    if (parsed) {
                        arrivalTime = parsed;
                    }
                }
            }
        });

        if (durationMs === null || arrivalTime === null) {
            return null;
        }

        const sendTime = new Date(arrivalTime.getTime() - durationMs);

        return {
            durationMs,
            arrivalTime,
            sendTime,
        };
    }

    function getValidCancelWindow(sendTimeMs, targetTimeMs) {
        const targetSecondStart = Math.floor(targetTimeMs / 1000) * 1000;

        const start = (sendTimeMs + targetSecondStart) / 2;
        const end = (sendTimeMs + targetSecondStart + 1000) / 2;
        const midpoint = (start + end) / 2;

        return {
            targetSecondStart,
            start,
            end,
            midpoint,
        };
    }

    function getReturnTime(cancelTimeMs, sendTimeMs) {
        return new Date(2 * cancelTimeMs - sendTimeMs);
    }

    function buildWidget() {
        const saved = localStorage.getItem(STORAGE_KEY) || '';

        const html = `
            <div id="raCancelSnipeBox" style="
                position: fixed;
                top: 10vw;
                right: 10vw;
                z-index: 99999;
                width: 390px;
                background: #e3d5b3 url('/graphic/index/main_bg.jpg') repeat;
                border: 2px solid #7d510f;
                border-radius: 10px;
                padding: 12px;
                box-sizing: border-box;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:10px;
                ">
                    <h3 style="margin:0; padding:0;">${SCRIPT_NAME}</h3>
                    <a href="#" id="raCloseBox" style="text-decoration:none; font-weight:bold;">✕</a>
                </div>

                <div style="margin-bottom:12px;">
                    <label for="raTargetTime" style="display:block; margin-bottom:6px; font-weight:600;">
                        Enter target return time:
                    </label>
                    <input
                        id="raTargetTime"
                        type="text"
                        value="${saved}"
                        placeholder="Mar 10, 2026 18:44:31"
                        style="width:100%; padding:8px; box-sizing:border-box;"
                    >
                    <div style="margin-top:6px; font-size:12px; opacity:0.85;">
                        Only the return second matters. Milliseconds in the input are ignored.
                    </div>
                </div>

                <div style="margin-bottom:12px;">
                    <a href="#" id="raCalcBtn" class="btn">Calculate Cancel Window</a>
                </div>

                <div id="raResults" style="display:none; font-size:13px; line-height:1.6;">
                    <div><b>Server Time:</b> <span id="raServerTime"></span></div>
                    <div><b>Original Send Time:</b> <span id="raSendTime"></span></div>
                    <div><b>Current Command Arrival:</b> <span id="raArrivalTime"></span></div>
                    <div><b>Target Return Second:</b> <span id="raTargetSecond"></span></div>
                    <hr>
                    <div><b>Valid Cancel Window Start:</b> <span id="raWindowStart" style="color:#1f4fa3;"></span></div>
                    <div><b>Valid Cancel Window End:</b> <span id="raWindowEnd" style="color:#1f4fa3;"></span></div>
                    <div><b>Recommended Click Time:</b> <span id="raMidpoint" style="color:#0a6b2d;"></span></div>
                    <div><b>Click In:</b> <span id="raCountdown" style="color:#b00000;"></span></div>
                    <hr>
                    <div><b>Return at Window Start:</b> <span id="raReturnStart"></span></div>
                    <div><b>Return at Midpoint:</b> <span id="raReturnMid"></span></div>
                    <div><b>Return at Window End - 1 ms:</b> <span id="raReturnEndMinus1"></span></div>
                </div>
            </div>
        `;

        const $container = mobiledevice ? $('#content_value') : $('#contentContainer');
        $container.prepend(html);

        $('#raCloseBox').on('click', function (e) {
            e.preventDefault();
            $('#raCancelSnipeBox').remove();
        });

        if (!mobiledevice && $('#raCancelSnipeBox').draggable) {
            $('#raCancelSnipeBox').draggable({
                cancel: 'input, button, a',
            });
        }
    }

    function setText(id, text) {
        $(id).text(text);
    }

    function main() {
        buildWidget();

        let activeWindow = null;

        $('#raCalcBtn').on('click', function (e) {
            e.preventDefault();

            const input = $('#raTargetTime').val().trim();
            if (!input) {
                UI.ErrorMessage('This field is required!');
                return;
            }

            const target = parseTargetInput(input);
            if (!target) {
                UI.ErrorMessage(
                    'Invalid time format! Example: Mar 10, 2026 18:44:31'
                );
                return;
            }

            const commandTiming = extractCommandTiming();
            if (!commandTiming) {
                UI.ErrorMessage(
                    'Could not read command duration/arrival from this page!'
                );
                return;
            }

            localStorage.setItem(STORAGE_KEY, input);

            const windowData = getValidCancelWindow(
                commandTiming.sendTime.getTime(),
                target.getTime()
            );

            const returnStart = getReturnTime(
                windowData.start,
                commandTiming.sendTime.getTime()
            );
            const returnMid = getReturnTime(
                windowData.midpoint,
                commandTiming.sendTime.getTime()
            );
            const returnEndMinus1 = getReturnTime(
                windowData.end - 1,
                commandTiming.sendTime.getTime()
            );

            activeWindow = {
                midpoint: new Date(windowData.midpoint),
            };

            $('#raResults').show();

            setText('#raServerTime', formatDateTime(getServerNow(), false));
            setText('#raSendTime', formatDateTime(commandTiming.sendTime, true));
            setText('#raArrivalTime', formatDateTime(commandTiming.arrivalTime, true));
            setText(
                '#raTargetSecond',
                formatDateTime(new Date(windowData.targetSecondStart), false)
            );
            setText('#raWindowStart', formatDateTime(new Date(windowData.start), true));
            setText('#raWindowEnd', formatDateTime(new Date(windowData.end), true));
            setText('#raMidpoint', formatDateTime(new Date(windowData.midpoint), true));

            setText('#raReturnStart', formatDateTime(returnStart, true));
            setText('#raReturnMid', formatDateTime(returnMid, true));
            setText('#raReturnEndMinus1', formatDateTime(returnEndMinus1, true));

            const now = getServerNow();
            const remaining = activeWindow.midpoint.getTime() - now.getTime();
            setText(
                '#raCountdown',
                remaining > 0 ? formatHms(remaining) : '00:00:00'
            );

            if (remaining <= 0) {
                UI.ErrorMessage('The recommended click time has already passed!');
            }
        });

        setInterval(function () {
            if (!activeWindow) return;

            const now = getServerNow();
            setText('#raServerTime', formatDateTime(now, false));

            const remaining = activeWindow.midpoint.getTime() - now.getTime();
            setText(
                '#raCountdown',
                remaining > 0 ? formatHms(remaining) : '00:00:00'
            );
        }, 250);

        setTimeout(function () {
            $('#raTargetTime').focus();
            const saved = $('#raTargetTime').val().trim();
            if (saved) {
                $('#raCalcBtn').trigger('click');
            }
        }, 20);
    }

    try {
        main();
    } catch (error) {
        UI.ErrorMessage('There was an error!');
        console.error(`[${SCRIPT_NAME}]`, error);
    }
})();