// capture.js — injected into game iframe for screenshot + error capture
(function() {
  const errors = [];

  // Hook console.error
  const origError = console.error;
  console.error = function(...args) {
    errors.push({ type: 'error', message: args.join(' '), ts: Date.now() });
    origError.apply(console, args);
  };

  // Hook uncaught errors
  window.addEventListener('error', function(e) {
    errors.push({ type: 'uncaught', message: e.message, file: e.filename, line: e.lineno, ts: Date.now() });
  });

  // Hook unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    errors.push({ type: 'promise', message: String(e.reason), ts: Date.now() });
  });

  // Listen for screenshot requests from parent
  window.addEventListener('message', function(e) {
    if (e.data === 'take-screenshot') {
      const canvas = document.querySelector('canvas');
      let screenshot = null;
      if (canvas) {
        try {
          screenshot = canvas.toDataURL('image/jpeg', 0.8);
        } catch (err) {
          errors.push({ type: 'screenshot', message: 'Canvas tainted or unavailable: ' + err.message, ts: Date.now() });
        }
      }
      window.parent.postMessage({
        type: 'screenshot-result',
        screenshot: screenshot,
        errors: errors.slice(),
        ts: Date.now()
      }, '*');
    }

    if (e.data === 'get-errors') {
      window.parent.postMessage({
        type: 'error-result',
        errors: errors.slice(),
        ts: Date.now()
      }, '*');
    }
  });
})();
