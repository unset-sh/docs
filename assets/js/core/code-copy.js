// Adapted from Hextra v0.13.0 (MIT), assets/js/core/code-copy.js.
// https://github.com/imfing/hextra/blob/v0.13.0/assets/js/core/code-copy.js
// Local change: render icons from the verified brand package.
// Copy button for code blocks

document.addEventListener('DOMContentLoaded', function () {
  const getCopyIcon = () => new DOMParser().parseFromString(
    {{ partial "utils/icon.html" (dict "name" "copy" "attributes" `aria-hidden="true" focusable="false"`) | jsonify }},
    'image/svg+xml'
  ).documentElement;

  const getSuccessIcon = () => new DOMParser().parseFromString(
    {{ partial "utils/icon.html" (dict "name" "check" "attributes" `aria-hidden="true" focusable="false"`) | jsonify }},
    'image/svg+xml'
  ).documentElement;

  // Make scrollable code blocks focusable for keyboard users.
  const updateScrollableCodeBlocks = () => {
    document.querySelectorAll('.hextra-code-block pre, .highlight pre').forEach(function (pre) {
      if (pre.scrollWidth > pre.clientWidth) {
        pre.setAttribute('tabindex', '0');
      } else {
        pre.removeAttribute('tabindex');
      }
    });
  };

  updateScrollableCodeBlocks();

  let resizeRaf;
  window.addEventListener('resize', () => {
    if (resizeRaf) {
      cancelAnimationFrame(resizeRaf);
    }
    resizeRaf = requestAnimationFrame(updateScrollableCodeBlocks);
  });

  document.querySelectorAll('.hextra-code-copy-btn').forEach(function (button) {
    // Add copy and success icons
    button.querySelector('.hextra-copy-icon')?.appendChild(getCopyIcon());
    button.querySelector('.hextra-success-icon')?.appendChild(getSuccessIcon());

    // Add click event listener for copy button
    button.addEventListener('click', function (e) {
      e.preventDefault();
      // Get the code target
      const target = button.parentElement.previousElementSibling;
      let codeElement;
      if (target.tagName === 'CODE') {
        codeElement = target;
      } else {
        // Select the last code element in case line numbers are present
        const codeElements = target.querySelectorAll('code');
        codeElement = codeElements[codeElements.length - 1];
      }
      if (codeElement) {
        let code = codeElement.innerText;
        // Replace double newlines with single newlines in the innerText
        // as each line inside <span> has trailing newline '\n'
        if ("lang" in codeElement.dataset) {
          code = code.replace(/\n\n/g, '\n');
        }
        navigator.clipboard.writeText(code).then(function () {
          button.classList.add('copied');
          var originalLabel = button.getAttribute('aria-label');
          var copiedLabel = button.dataset.copiedLabel || 'Copied!';
          button.setAttribute('aria-label', copiedLabel);
          setTimeout(function () {
            button.classList.remove('copied');
            button.setAttribute('aria-label', originalLabel);
          }, 1000);
        }).catch(function (err) {
          console.error('Failed to copy text: ', err);
        });
      } else {
        console.error('Target element not found');
      }
    });
  });
});
