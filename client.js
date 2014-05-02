/**
 * NBC.com SiteCanvas
 * Protocol for XS communication over postMessage
 * http://www.nbc.com/
 */
(function () {
  var win = window;
  var parent = window.parent;
  var doc = document.documentElement;
  var isInit = false;
  var parentID = '';

  /**
   * Initialize the client
   * 1. Provide the interface globally
   * 2. Listen for events from parent
   */
  function init () {
    win.SiteCanvas = CanvasInterface;
    on(win, 'message', onMessage);
  }

  /**
   * Receive a message from parent frame
   * Messages to this client should look like
   * "SiteCanvas::fn_name::arg1,arg2,arg3"
   *
   * @param {Event} event
   */
  function onMessage (event) {
    var message = event.data || '';
    var parts = message.split('::');
    if (parts.length !== 3 || parts[0] !== 'SiteCanvas') {
      return;
    }
    var fn = parts[1];
    var args = parts[2].split(',');
    FrameInterface[fn].apply(this, args);
  }

  /**
   * Sends a message to a child frame
   *
   * @param {string} fn_name
   *   The function to call on other frame
   * @param …
   *   Other arguments to pass client function
   */
  function sendMessage (fn_name) {
    if (!isInit) {
      warn('SiteCanvas not yet initialized');
      return;
    }
    var args = Array.prototype.slice.call(arguments, 1);
    args.unshift(parentID);
    parent.postMessage(
      'SiteCanvas::' + fn_name + '::' + args.join(','),
      '*'
    );
  }

  /**
   * FrameInterface is a set of functions we expose to the parent frame
   * The methods are called via onMessage
   */
  var FrameInterface = {};
  FrameInterface.init = function (id) {
    isInit = true;
    parentID = id;
    if (win.SiteCanvasAsyncInit) {
      win.SiteCanvasAsyncInit();
    }
  };

  /**
   * Save viewport dimensions sent from parent frame. Useful for DOM element positioning
   */
  FrameInterface.setViewportDimensions = function (width, height) {
    CanvasInterface.viewportWidth = width;
    CanvasInterface.viewportHeight = height;
  };

  var CanvasInterface_autoGrowInterval = null;
  /**
   * CanvasInterface is a set of functions we expose to the page
   * @see https://developers.facebook.com/docs/reference/javascript/FB.Canvas.setSize
   * @see https://developers.facebook.com/docs/reference/javascript/FB.Canvas.setAutoGrow/
   */
  var CanvasInterface = {};

  /**
   * Sets the size of the containing frame
   *
   * @param {object} params
   * @param {int} params.width
   *   Desired width. Max is app width. Default frame width
   * @param {int} params.height - New height
   *   Desired height. Default frame height
   */
  CanvasInterface.setSize = function (params) {
    params = params || {};
    var width = parseInt(params.width || doc.offsetWidth || win.innerWidth || doc.clientWidth, 0) || 0;
    var height = parseInt(params.height || doc.offsetHeight || win.innerHeight || doc.clientHeight, 0) || 0;
    sendMessage('setSize', width, height);
  };

  /**
   * On interval, set size of containing frame to size of content
   *
   * @param {int|false} interval
   *   Whether to turn the timer on or off. truthy == on, falsy == off. default is true
   *   How often to resize (in ms). default is 100ms
   */
  CanvasInterface.setAutoGrow = function (interval) {
    if (typeof interval === 'undefined') {
      interval = 100;
    }
    if (CanvasInterface_autoGrowInterval !== null) {
      clearInterval(CanvasInterface_autoGrowInterval);
      CanvasInterface_autoGrowInterval = null;
    }
    if (interval) {
      CanvasInterface_autoGrowInterval = setInterval(CanvasInterface.setSize, interval);
    }
  };

  /**
   * Set a close confirmation message on the parent mesage
   *
   * @param {string} confirmMessage
   *   The message to display when the window is closed,
   *   or the empty string to unset.
   */
  CanvasInterface.setCloseConfirm = function (confirmMessage) {
    sendMessage('confirmMessage', confirmMessage);
  };

  /**
   * Utitily. Deliver Error mesage to console
   * @param {string} message to display
   */
  function warn (message) {
    if (win.console && win.console.warn) {
      win.console.warn('[SiteCanvas] ' + message);
    }
  }
  /**
   * Utitily. Cross-browser addEventListener
   * @param {DOMElement} el - the element to listen to
   * @param {string} ev - event name
   * @param {function} fn - the listener
   */
  function on (el, ev, fn) {
    if (el.addEventListener) {
      el.addEventListener(ev, fn, false);
      return true;
    }
    else if (el.attachEvent) {
      return el.attachEvent('on' + ev, fn);
    }
  }

  init();
}());
