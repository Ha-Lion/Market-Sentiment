(() => {
  "use strict";

  const MOBILE = "(max-width: 768px)";

  let active = null;

  function isMobile() {
    return window.matchMedia(MOBILE).matches;
  }

  function getBox(event) {
    if (!isMobile()) return null;

    const target =
      event.target instanceof Element
        ? event.target
        : null;

    if (!target) return null;

    const box = target.closest(
      ".pulse-chart-panel.expanded .interactive-chart"
    );

    if (!box || !box.__psdChartApi) return null;

    return box;
  }

  function getPriceScale(box) {
    try {
      return box.__psdChartApi.priceScale("right");
    } catch (_) {
      return null;
    }
  }

  function getRange(scale) {
    try {
      const range = scale.getVisibleRange();

      if (!range) return null;

      return {
        from:Number(range.from),
        to:Number(range.to)
      };
    } catch (_) {
      return null;
    }
  }

  function setRange(scale, range) {
    try {
      scale.setAutoScale(false);

      scale.setVisibleRange({
        from:range.from,
        to:range.to
      });
    } catch (_) {}
  }


  // ==========================================================
  // Y-AXIS START
  //
  // Rotated clockwise:
  //
  // original vertical/value axis
  // becomes horizontal on phone
  //
  // Therefore LEFT/RIGHT movement controls Y/value scale.
  // ==========================================================

  window.addEventListener(
    "pointerdown",
    event => {
      const box = getBox(event);
      if (!box) return;

      if (
        event.pointerType === "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      const scale = getPriceScale(box);
      if (!scale) return;

      const range = getRange(scale);
      if (!range) return;

      const rect = box.getBoundingClientRect();

      active = {
        pointerId:event.pointerId,
        box,
        scale,
        startX:event.clientX,
        startY:event.clientY,
        startRange:range,
        width:Math.max(1, rect.width),
        decided:false,
        mode:null
      };
    },
    true
  );


  // ==========================================================
  // Y-AXIS DRAG
  //
  // Horizontal drag only.
  //
  // Vertical-dominant drag is ignored completely so your
  // existing X/time helper continues handling it.
  // ==========================================================

  window.addEventListener(
    "pointermove",
    event => {
      if (
        !active ||
        active.pointerId !== event.pointerId
      ) {
        return;
      }

      const dx =
        event.clientX - active.startX;

      const dy =
        event.clientY - active.startY;

      if (!active.decided) {

        if (
          Math.abs(dx) < 8 &&
          Math.abs(dy) < 8
        ) {
          return;
        }

        active.decided = true;

        /*
         * Horizontal dominant = Y/value scaling.
         * Vertical dominant = leave event for X helper.
         */
        if (Math.abs(dx) > Math.abs(dy)) {
          active.mode = "y";
        } else {
          active.mode = "x";
          return;
        }
      }

      if (active.mode !== "y") {
        return;
      }

      const startSpan =
        active.startRange.to -
        active.startRange.from;

      if (
        !Number.isFinite(startSpan) ||
        startSpan <= 0
      ) {
        return;
      }

      const center =
        (
          active.startRange.from +
          active.startRange.to
        ) / 2;

      /*
       * Drag RIGHT:
       * compress range = zoom in vertically
       *
       * Drag LEFT:
       * expand range = zoom out vertically
       *
       * Sensitivity intentionally moderate.
       */
      const factor =
        Math.exp(
          -dx / active.width * 1.6
        );

      const newSpan =
        Math.max(
          startSpan * 0.05,
          Math.min(
            startSpan * 20,
            startSpan * factor
          )
        );

      setRange(
        active.scale,
        {
          from:center - newSpan / 2,
          to:center + newSpan / 2
        }
      );

      /*
       * Y helper runs on WINDOW capture.
       * Stop only horizontal Y gestures before
       * the X helper on DOCUMENT receives them.
       */
      event.preventDefault();
      event.stopPropagation();
    },
    {
      capture:true,
      passive:false
    }
  );


  function finish(event) {
    if (
      !active ||
      active.pointerId !== event.pointerId
    ) {
      return;
    }

    active = null;
  }

  window.addEventListener(
    "pointerup",
    finish,
    true
  );

  window.addEventListener(
    "pointercancel",
    finish,
    true
  );


  // ==========================================================
  // DOUBLE CLICK ON ROTATED VALUE SIDE
  // RESET Y SCALE BACK TO AUTO
  // ==========================================================

  window.addEventListener(
    "dblclick",
    event => {
      const box = getBox(event);
      if (!box) return;

      const scale = getPriceScale(box);
      if (!scale) return;

      try {
        scale.setAutoScale(true);
      } catch (_) {}

      /*
       * Do not stop the X helper's double click.
       * It may also fit the time range.
       */
    },
    true
  );

})();