(() => {
  "use strict";

  const MOBILE = "(max-width: 768px)";

  let dragState = null;
  let pinchState = null;

  const pointers = new Map();

  function mobile() {
    return window.matchMedia(MOBILE).matches;
  }

  function chartBoxFromEvent(event) {
    if (!mobile()) return null;

    const target =
      event.target instanceof Element
        ? event.target
        : null;

    if (!target) return null;

    const box = target.closest(
      ".pulse-chart-panel.expanded .interactive-chart"
    );

    if (!box) return null;
    if (!box.__psdChartApi) return null;

    return box;
  }

  function timeScale(box) {
    return box.__psdChartApi?.timeScale?.() || null;
  }

  function readRange(box) {
    const scale = timeScale(box);

    if (!scale?.getVisibleLogicalRange) {
      return null;
    }

    const range =
      scale.getVisibleLogicalRange();

    if (!range) return null;

    return {
      from:Number(range.from),
      to:Number(range.to)
    };
  }

  function writeRange(box, range) {
    const scale = timeScale(box);

    if (!scale?.setVisibleLogicalRange) {
      return;
    }

    scale.setVisibleLogicalRange({
      from:range.from,
      to:range.to
    });
  }


  // ==========================================================
  // X-AXIS PAN
  //
  // On the rotated chart:
  // vertical screen movement controls horizontal TIME movement.
  // ==========================================================

  function startDrag(event, box) {
    const range = readRange(box);
    if (!range) return;

    const rect =
      box.getBoundingClientRect();

    if (rect.height <= 0) return;

    dragState = {
      pointerId:event.pointerId,
      box:box,
      startY:event.clientY,
      screenLength:rect.height,
      range:range
    };

    try {
      box.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function moveDrag(event) {
    if (!dragState) return false;

    if (
      dragState.pointerId !==
      event.pointerId
    ) {
      return false;
    }

    const span =
      dragState.range.to -
      dragState.range.from;

    if (span <= 0) return false;

    const deltaScreen =
      event.clientY -
      dragState.startY;

    /*
     * Clockwise 90-degree mapping:
     *
     * screen DOWN corresponds to native X RIGHT.
     *
     * During drag, content follows the finger,
     * so visible logical range moves the opposite way.
     */
    const deltaLogical =
      (deltaScreen /
        dragState.screenLength) *
      span;

    writeRange(
      dragState.box,
      {
        from:
          dragState.range.from -
          deltaLogical,

        to:
          dragState.range.to -
          deltaLogical
      }
    );

    return true;
  }


  // ==========================================================
  // X-AXIS PINCH ZOOM
  //
  // Changes TIME RANGE ONLY.
  // No price/PSI scaling.
  // ==========================================================

  function startPinch(box) {
    const active =
      [...pointers.values()]
        .filter(p => p.box === box);

    if (active.length !== 2) {
      pinchState = null;
      return;
    }

    const range = readRange(box);
    if (!range) return;

    const a = active[0];
    const b = active[1];

    /*
     * Because X/time is vertical after rotation,
     * use the vertical finger separation.
     */
    const distance =
      Math.abs(b.y - a.y);

    if (distance < 10) return;

    pinchState = {
      box:box,
      startDistance:distance,
      range:range
    };

    dragState = null;
  }

  function movePinch(box) {
    if (
      !pinchState ||
      pinchState.box !== box
    ) {
      return false;
    }

    const active =
      [...pointers.values()]
        .filter(p => p.box === box);

    if (active.length !== 2) {
      return false;
    }

    const distance =
      Math.abs(
        active[1].y -
        active[0].y
      );

    if (distance < 10) {
      return false;
    }

    const oldSpan =
      pinchState.range.to -
      pinchState.range.from;

    if (oldSpan <= 0) return false;

    const center =
      (
        pinchState.range.from +
        pinchState.range.to
      ) / 2;

    /*
     * Fingers farther apart:
     * smaller logical range = zoom in.
     *
     * Fingers closer:
     * larger logical range = zoom out.
     */
    let newSpan =
      oldSpan *
      (
        pinchState.startDistance /
        distance
      );

    newSpan =
      Math.max(
        3,
        Math.min(5000, newSpan)
      );

    writeRange(
      box,
      {
        from:center - newSpan / 2,
        to:center + newSpan / 2
      }
    );

    return true;
  }


  // ==========================================================
  // POINTER EVENTS
  // ==========================================================

  document.addEventListener(
    "pointerdown",
    event => {
      const box =
        chartBoxFromEvent(event);

      if (!box) return;

      if (
        event.pointerType === "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      pointers.set(
        event.pointerId,
        {
          box:box,
          x:event.clientX,
          y:event.clientY
        }
      );

      const active =
        [...pointers.values()]
          .filter(p => p.box === box);

      if (active.length === 1) {
        startDrag(event, box);
      }

      if (active.length === 2) {
        startPinch(box);
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );


  document.addEventListener(
    "pointermove",
    event => {
      const point =
        pointers.get(event.pointerId);

      if (!point) return;

      point.x = event.clientX;
      point.y = event.clientY;

      const box = point.box;

      const active =
        [...pointers.values()]
          .filter(p => p.box === box);

      let handled = false;

      if (active.length === 2) {
        handled = movePinch(box);
      }
      else if (active.length === 1) {
        handled = moveDrag(event);
      }

      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );


  function endPointer(event) {
    const point =
      pointers.get(event.pointerId);

    if (!point) return;

    const box = point.box;

    pointers.delete(event.pointerId);

    if (
      dragState?.pointerId ===
      event.pointerId
    ) {
      dragState = null;
    }

    const active =
      [...pointers.values()]
        .filter(p => p.box === box);

    if (active.length < 2) {
      pinchState = null;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener(
    "pointerup",
    endPointer,
    true
  );

  document.addEventListener(
    "pointercancel",
    endPointer,
    true
  );


  // ==========================================================
  // MOUSE WHEEL = X/TIME ZOOM ONLY
  //
  // Useful in desktop mobile emulator too.
  // ==========================================================

  document.addEventListener(
    "wheel",
    event => {
      const box =
        chartBoxFromEvent(event);

      if (!box) return;

      const range = readRange(box);
      if (!range) return;

      const span =
        range.to - range.from;

      const center =
        (range.from + range.to) / 2;

      const factor =
        Math.exp(
          event.deltaY * 0.0015
        );

      let newSpan =
        span * factor;

      newSpan =
        Math.max(
          3,
          Math.min(5000, newSpan)
        );

      writeRange(
        box,
        {
          from:center - newSpan / 2,
          to:center + newSpan / 2
        }
      );

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    {
      capture:true,
      passive:false
    }
  );


  // ==========================================================
  // DOUBLE CLICK = FIT X/TIME RANGE
  // ==========================================================

  document.addEventListener(
    "dblclick",
    event => {
      const box =
        chartBoxFromEvent(event);

      if (!box) return;

      timeScale(box)?.fitContent?.();

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );


  // Disable browser scrolling only over the expanded chart.
  const style =
    document.createElement("style");

  style.textContent = `
    @media (max-width:768px){
      .pulse-chart-panel.expanded .interactive-chart{
        touch-action:none !important;
        overscroll-behavior:contain !important;
      }
    }
  `;

  document.head.appendChild(style);

})();