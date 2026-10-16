/* Shared player for instruction demos: play / pause / replay, manual
   stepping, and prefers-reduced-motion handling. The consumer supplies a
   steps array and drawing callbacks; the player owns the clock and the
   state machine (idle | playing | paused | done). */
(function () {
  "use strict";

  window.simdPlayer = function (options) {
    var armMs = options.armMs != null ? options.armMs : 180;
    var gapMs = options.gapMs != null ? options.gapMs : 260;
    var onArm = options.onArm || function () {};
    var onCommit = options.onCommit || function () {};
    var onSeek = options.onSeek || null; /* redraw with the first `count` steps applied */
    var onApplyAll = options.onApplyAll || null; /* jump straight to the final state */
    var onReset = options.onReset || function () {};
    var onFinish = options.onFinish || function () {};
    var onState = options.onState || function () {};
    var onMotionChange = options.onMotionChange || null;

    var steps = options.steps;
    var timer = null;
    var state = "idle";
    var committed = 0; /* steps fully applied */
    var armed = -1; /* step armed but not yet committed */
    var motionQuery = window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    function reduced() {
      return motionQuery ? motionQuery.matches : false;
    }

    function stopTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function emit() {
      onState(state, committed, steps.length);
    }

    function run(i) {
      if (state !== "playing") return;
      if (i >= steps.length) {
        armed = -1;
        state = "done";
        onFinish();
        emit();
        return;
      }
      armed = i;
      onArm(steps[i], i);
      timer = setTimeout(function () {
        timer = null;
        onCommit(steps[i], i);
        armed = -1;
        committed = i + 1;
        emit();
        timer = setTimeout(function () {
          timer = null;
          run(i + 1);
        }, gapMs);
      }, armMs);
    }

    /* Commit one step that was armed when playback paused. */
    function resumeArmed(i) {
      timer = setTimeout(function () {
        timer = null;
        onCommit(steps[i], i);
        armed = -1;
        committed = i + 1;
        emit();
        timer = setTimeout(function () {
          timer = null;
          run(i + 1);
        }, gapMs);
      }, armMs);
    }

    function play() {
      if (state === "playing") return;
      if (reduced() && onApplyAll) {
        stopTimer();
        committed = steps.length;
        armed = -1;
        onApplyAll();
        state = "done";
        emit();
        return;
      }
      if (state === "idle" || state === "done") {
        stopTimer();
        onReset();
        committed = 0;
        armed = -1;
        state = "playing";
        emit();
        timer = setTimeout(function () {
          timer = null;
          run(0);
        }, 120);
        return;
      }
      /* paused */
      state = "playing";
      emit();
      if (armed >= 0) {
        resumeArmed(armed);
      } else {
        timer = setTimeout(function () {
          timer = null;
          run(committed);
        }, gapMs);
      }
    }

    function pause() {
      if (state !== "playing") return;
      stopTimer();
      state = "paused";
      emit();
    }

    function stepForward() {
      if (committed >= steps.length) return;
      pause();
      state = "paused";
      armed = -1;
      var i = committed;
      onArm(steps[i], i);
      onCommit(steps[i], i);
      committed = i + 1;
      if (committed === steps.length) {
        state = "done";
        onFinish();
      }
      emit();
    }

    function stepBack() {
      if (committed <= 0) return;
      pause();
      armed = -1;
      committed -= 1;
      if (onSeek) onSeek(committed);
      state = "paused";
      emit();
    }

    function jumpEnd() {
      stopTimer();
      armed = -1;
      committed = steps.length;
      if (onApplyAll) onApplyAll();
      state = "done";
      emit();
    }

    function reset() {
      stopTimer();
      state = "idle";
      committed = 0;
      armed = -1;
      onReset();
      emit();
    }

    /* The consumer rebuilt the steps array after a configuration change. */
    function setSteps(next) {
      stopTimer();
      steps = next;
      state = "idle";
      committed = 0;
      armed = -1;
      onReset();
      emit();
    }

    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function () {
        if (onMotionChange) onMotionChange(reduced());
      });
    }

    onReset();
    emit();

    return {
      play: play,
      pause: pause,
      reset: reset,
      setSteps: setSteps,
      stepForward: stepForward,
      stepBack: stepBack,
      jumpEnd: jumpEnd,
      reduced: reduced,
      getState: function () {
        return state;
      },
      getCommitted: function () {
        return committed;
      }
    };
  };
})();
