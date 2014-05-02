/**
 * NBC.com SiteCanvas
 * Protocol for XS communication over postMessage
 * http://www.nbc.com/
 */
(function () {
  var win = window;
  var frames = {};
  var numFrames = 0;
  var allowWidth = false;
  var allowHeight = true;

  /**
   * Initialize the parent
   * 1. Provide the interface globally
   * 2. Listen for events from parent
   */
  function init () {
    win.SiteCanvas = PageInterface;
    on(win, 'message', onMessage);

    on(win, 'load', FrameInterface.calculateViewportDimensions);
    on(win, 'resize', FrameInterface.calculateViewportDimensions);
  }


  /**
   * Received a message from a child frame
   * Messages to te client should look like
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
    var frame = frames[args.shift()];
    args.unshift(frame);
    if (event.origin !== frame.origin) {
      warn('Message origin did match Frame origin');
      return;
    }
    if (!FrameInterface[fn]) {
      warn('FrameInterface::' + fn + ' does not exist');
      return;
    }
    FrameInterface[fn].apply(this, args);
  }

  /**
   * Sends a message to a child frame
   *
   * @param {string} frame_id
   *   The html ID frame to commuincate to
   * @param {string} fn_name
   *   The function to call on other frame
   * @param …
   *   Other arguments to pass client function
   */
  function sendMessage (frame_id, fn_name) {
    var args = Array.prototype.slice.call(arguments, 2);
    frames[frame_id].el.contentWindow.postMessage(
      'SiteCanvas::' + fn_name + '::' + args.join(','),
      frames[frame_id].origin
    );
  }

  /**
   * FrameInterface is a set of methods we expose to child frames
   * The methods are called via onMessage
   * The first param is always the originating frame
   */
  var FrameInterface = {};
  /**
   * Sets the size of the child frame
   * @param {DOMElement} frame
   *   An element of the frame we will manipulate
   * @param {int} width
   *   The desired width to set the frame to
   * @param {int} height
   *   The desired width to set the frame to
   */
  FrameInterface.setSize = function (frame, width, height) {
    width -= 0;
    height -= 0;
    if (allowWidth && width !== frame.width) {
      frame.el.style.width = width + 'px';
      frame.width = width;
    }
    if (allowHeight && height !== frame.height) {
      frame.el.style.height = height + 'px';
      frame.height = height;
    }
  };
  /**
   * Sets or unsets a close confirmation message
   * @param {DOMElement} frame
   *   An element of the frame we will manipulate
   * @param {string} confirmMessage
   *   The desired confirmation to set or the empty string to unset
   */
  FrameInterface.setCloseConfirm = function (frame, confirmMessage) {
    // Just in case we parsed the commas, let's bring those back
    if (arguments.length > 2) {
      confirmMessage = Array.prototype.join.call(arguments, ',');
    }
    if (confirmMessage && !window.onbeforeunload) {
      window.onbeforeunload = onUnloadMessage;
    }
    if (!confirmMessage && window.onbeforeunload) {
      window.onbeforeunload = null;
    }
    FrameInterface.confirmMessage = confirmMessage;
    // http://www.opera.com/support/kb/view/827/
    try {
      window.opera.setOverrideHistoryNavigationMode('compatible');
      history.navigationMode = 'compatible';
    }
    catch(e){}
  };
  function onUnloadMessage (event) {
    if (event.returnVal) {
      event.returnVal = FrameInterface.confirmMessage;
    }
    return FrameInterface.confirmMessage;
  }

  /**
   * PageInterface is a set of methods exposted to the page.
   */
  var PageInterface = {};
  /**
   * Registers frame to our list,
   *  Sets up event listeners
   *
   * @param {DOMElement} el
   */
  PageInterface.registerFrame = function (el) {
    var id = el.id;
    if (!id) {
      el.id = id = 'site-canvas-' + (numFrames + 1);
    }
    frames[id] = {
      el: el,
      id: id,
      width: el.offsetWidth,
      height: el.offsetHeight,
      origin: getOriginURI( parseURI(el.getAttribute('src')) )
    };
    numFrames++;
    sendMessage(id, 'init', id);
    on(el, 'load', function () {
      sendMessage(id, 'init', id);
      sendMessage(id, 'viewportDimensions', calculateViewportDimensions());
    });
  };

  /**
   * Calculates the parent frames dimensions
   * @return {string}
   *   Returns the width and height as an array
   */
  function calculateViewportDimensions () {
    var width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    var height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    return width + ',' + height;
  }

  /**
   * Returns a parsed URI object from a string
   *
   * @param {object} uri
   * @return {string}
   */
  function getOriginURI (uri) {
    return uri.protocol + '//' + uri.host;
  }

  /**
   * Utitily. Returns a parsed URI object from a string
   * Mostly consistent with Location
   *
   * @param {string} uri
   * @return {object}
   */
  function parseURI (uri) {
    var split = uri.match(parseURI.rx);
    return {
      protocol: split[1] ? split[1] + ':' : '',
      user_info: split[2],
      host: split[3],
      port: split[4],
      path: split[5],
      query_data: split[6],
      fragment: split[7]
    };
  }
  parseURI.rx = new RegExp(
    '^' +
    '(?:' +
    // scheme - ignore special characters used by other URL parts such as :, ?, /, #, and .
    '([^:/?#.]+)' +
    ':)?' +
    '(?://' +
    // userInfo
    '(?:([^/?#]*)@)?' +
    // host - restrict to letters, digits, dashes, dots, percent
    // escapes, and unicode characters.
    '([\\w\\d\\-\\u0100-\\uffff.%]*)' +
    // port
    '(?::([0-9]+))?' +
    ')?' +
    // path
    '([^?#]+)?' +
     // query 
    '(?:\\?([^#]*))?' +
    // fragment
    '(?:#(.*))?' +
    '$'
  );

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
