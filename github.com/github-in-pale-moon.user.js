// ==UserScript==
// @name         GitHub in Pale Moon
// @namespace    https://github.com/SeaHOH
// @version      0.1.2
// @description  Tweaks for GitHub work in Pale Moon (v33.*) browser.
// @author       SeaHOH
// @license      MIT
// @include      /^https://github.com//
// @grant        none
// @run-at       document-start
// @icon         https://raw.githubusercontent.com/SeaHOH/gmscripts/83aa48a40d90e9e9fcc5b8494cd5753b281eaf43/icon/favicon.svg
// @homepageURL  https://github.com/SeaHOH/gmscripts
// @downloadURL  https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-in-pale-moon.user.js
// @updateURL    https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-in-pale-moon.user.js
// @description:zh-CN 调整 Github 以工作于苍月浏览器 (v33.*)。
// ==/UserScript==

(function() {
  'use strict';

  function log() {
    //console.log(...arguments);
  }

  /* The customElements.define hook */
  function setMap(m, k, ...v) {
    let vl = m.get(k);
    if (vl === undefined) vl = [], m.set(k, vl);
    vl.splice(-1, 0, ...v);
  }
  const customElementsDefine = customElements.define;
  const customElementsFilters = new Map;
  customElements.define = function (name, cls, ...args) {
    for (const filter of customElementsFilters.get(name) || []) {
      filter(cls);
    }
    customElementsFilters.delete(name);
    return customElementsDefine.call(customElements, name, cls, ...args);
  };


  /*
   Disable Turbo (now v7.2.9) navigation to prevent memory leaks.
   https://github.com/martok/palefill/issues/50
   Another method is just block the following URL, but will lost some functions.
   https://github.githubassets.com/assets/vendors-node_modules_github_turbo_dist_turbo_es2017-esm_js-e3cbe28f1638.js
   "es2017-esm_js-e3cbe28f1638" is the version.
  */
  function _disableTurbo() {
    log(i, document.readyState, window.Turbo);
    if (turboDisabled) return;
    turboDisabled = true;
    const turboSession = Turbo.session;
    turboSession.drive = false;
    turboSession.enabled = false;
    turboSession.formMode = 'off';
    turboSession.formLinkClickObserver.stop();
    turboSession.linkClickObserver.stop();
    turboSession.formSubmitObserver.stop();
    turboSession.frameRedirector.stop();
    turboSession.history.stop();
    turboSession.elementIsNavigatable = dummyFun;
  }
  function disableTurbo() {
    window.Turbo ? _disableTurbo() : i++ < 100 && setTimeout(disableTurbo, i);
  }
  let i = 0, turboDisabled = false, dummyFun = ()=>false;
  setMap(customElementsFilters, 'turbo-frame', ({delegateConstructor:FrameController}) => {
    const FrameControllerConnect = FrameController.prototype.connect;
    FrameController.prototype.shouldInterceptNavigation = dummyFun;
    FrameController.prototype.connect = function connect() {
      FrameControllerConnect.call(this);
      this.formLinkClickObserver.stop();
      this.linkInterceptor.stop();
      this.formSubmitObserver.stop();
    };
  });
  // Before defer scripts running.
  document.addEventListener('readystatechange', disableTurbo, {once: true});
  // After defer scripts running.
  document.addEventListener('DOMContentLoaded', _disableTurbo, {once: true});
  document.addEventListener('unload', () => {
    Turbo.session.stop();
    Turbo.cache.clear();
  });


  /*
   Mention & Emoji suggesters' filling fails.
   If it works (e.g. commit pages), user avatar shuild be shown.
   Here only fixed the filling , avatar still not be shown.
  */
  if (location.pathname.length > 1) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.querySelector('body').className.includes('logged-in'))
        return;
      const prompts = ['@', ':'];
      new MutationObserver(([{addedNodes:[node]}]) => {
        if (node && node.localName === 'ul' &&
            node.classList.contains('suggester-container')) {
          const comment = node.parentNode.querySelector('textarea, input');
          if (!comment) return;
          log(node);
          node.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            let c, suggest = e.target;
            switch (suggest.localName) {
              case 'span':
              case 'g-emoji':
                break;
              case 'li':
                suggest = suggest.children[0];
                break;
              case 'img':
                suggest = suggest.parentNode;
                break;
              default:
                suggest = suggest.parentNode.children[0];
            }
            log(suggest);
            do {
              c = comment.value.charAt(--comment.selectionStart);
            } while (comment.selectionStart && !prompts.includes(c))
            if (prompts.includes(c)) {
              suggest = suggest.innerText || suggest.getAttribute('alias') + ':';
              if (comment.value.charAt(comment.selectionEnd) !== ' ')
                suggest += ' ';
              comment.focus();
              comment.setRangeText(suggest, comment.selectionStart+1, comment.selectionEnd, 'end');
              setTimeout(()=>{comment.focus()}, 10);
            }
          }, {once: true, capture: true})
        }
      }).observe(document, {childList: true, subtree: true});
    }, {once: true});
  }


  /*
   The context menu of code view has been disabled.
   Restore it by block "mouseup" event on the <textarea> element.
   https://github.com/martok/palefill/issues/90
  */
  if (/^\/[^/]+\/[^/]+\/(tree|blob|blame)\/./.test(location.pathname)) {
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2 && e.target &&
          e.target.id === 'read-only-cursor-text-area') {
        e.stopPropagation();
      }
    }, {capture: true});
  }


  /*
   "Copy the full SHA" buttons do not work, beacuse a <button> covered them.
   Relay "click" event to the buttons.
   https://github.com/JustOff/github-wc-polyfill/issues/49
  */
  if (/^\/[^/]+\/[^/]+\/compare\/./.test(location.pathname)) {
    function addEventListener(type, listener, options) {
      ael.call(this, type, listener, options);
      if (type !== 'click' ||
          this.getAttribute('aria-label') !== 'Copy the full SHA') {
        return;
      }
      let parent = this.parentNode;
      for (let i=0; i<6; i++) {
        if (parent.localName === 'button') break
        parent = parent.parentNode;
      }
      log(parent);
      if (parent.localName !== 'button') return;
      if (!triggerMap.has(this))
        triggerMap.set(this, ()=>{this.dispatchEvent(new Event(type))});
      ael.call(parent, type, triggerMap.get(this), options);
    }
    function removeEventListener(type, listener, options) {
      rel.call(this, type, listener, options);
      if (type !== 'click' || !triggerMap.has(this)) return;
      let parent = this.parentNode;
      for (let i=0; i<6; i++) {
        if (parent.localName === 'button') break
        parent = parent.parentNode;
      }
      rel.call(parent, type, triggerMap.get(this), options);
    }
    const triggerMap = new WeakMap();
    const {addEventListener:ael, removeEventListener:rel} = EventTarget.prototype;
    setMap(customElementsFilters, 'clipboard-copy', (cls) => {
      cls.prototype.addEventListener = addEventListener;
      cls.prototype.removeEventListener = removeEventListener;
    });
  }

})();
