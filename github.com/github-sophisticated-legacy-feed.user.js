// ==UserScript==
// @name         GitHub Sophisticated Legacy Feed
// @namespace    https://github.com/SeaHOH
// @version      0.1.5
// @description  Brings back the legacy feed (but more sophisticated) of GitHub dashboard.
// @author       SeaHOH
// @license      MIT
// @match        https://github.com/
// @match        https://github.com/dashboard
// @grant        none
// @run-at       document-start
// @icon         https://raw.githubusercontent.com/SeaHOH/gmscripts/57e76be23ec99ab0354daf3c5ec5da9540b5c5c7/icon/favicon.svg
// @homepageURL  https://github.com/SeaHOH/gmscripts
// @downloadURL  https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-sophisticated-legacy-feed.user.js
// @updateURL    https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-sophisticated-legacy-feed.user.js
// @description:zh-CN 使 GitHub 的旧式消息订阅 (但更先进) 重返个人面板页面。
// ==/UserScript==

(function () {
  'use strict';

  function setDashboardStyle() {
    const content = document.querySelector('.feed-content');
    const main = document.querySelector('.feed-main');
    const sidebar = document.querySelector('.feed-right-sidebar');
    if (content) content.style.maxWidth = 'unset';
    if (main) main.style.maxWidth = '100%';
    if (sidebar) {
      sidebar.style.maxWidth = 'unset';
      sidebar.style.width = '800px';
    }
  }

  async function fetchFeed(signal) {
      const response = await fetch('https://github.com/dashboard-feed', {
            signal: signal,
            headers: {'X-Requested-With': 'XMLHttpRequest'}
      });
      if (!response.ok) {
        throw(`HTTP ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      const feed = new DOMParser().parseFromString(text, 'text/html')
                                  .querySelector('div[data-hpc]');
      if (!feed) {
        throw('no "<div data-hpc>" element was found');
      }
      return feed;
  }

  function replaceFeed({fragment, feed, container}) {
    if (fragment) {
      // stop feed fragment
      const newFragment = document.createElement('div');
      newFragment.append(...fragment.children);
      fragment.replaceWith(newFragment);
      container = newFragment.parentElement.parentElement;
    }
    else if (feed) {
      if (!container)
        container = document.querySelector('#dashboard feed-container');
      const content = container && container.querySelector(
          'div[data-target="feed-container.content"]');
      const msg = 'No <div data-target="feed-container.content"> element was found'
      if (!content) {
        if (container.id == 'my-dashboard-feed') throw(msg);
        console.log(msg);
        return;
      }
      content.replaceChildren(feed);
      if (container.id == 'my-dashboard-feed') return;
    } else {
      return;
    }
    // stop functions of <feed-container>
    const newContainer = document.createElement('div');
    newContainer.id = 'my-dashboard-feed';
    newContainer.append(...container.children);
    if (/Android|Mobile|Phone|Tablet/i.test(navigator.userAgent)) {
      container.replaceWith(newContainer);
    } else {
      // remove useless fragments for desktop
      container.parentElement.replaceChildren(newContainer);
    }
    newContainer.querySelector('#feed-filter-menu').remove();
    return newContainer;
  }

  function waitFeedContainer(controller) {
    let i = 0;
    let logged_out = null;
    let missed = document.readyState != 'loading';
    return new Promise((resolve, reject) => {
      new MutationObserver((mutations, observer) => {
        const resolved = (fragment) => {
          observer.disconnect();
          resolve(replaceFeed({fragment: fragment}));
          setDashboardStyle();
        };
        const rejected = (reason) => {
          controller.abort(reason);
          observer.disconnect();
          reject(reason);
        };
        if (i == 0 && !missed) {
          missed = !['head', 'html', 'body'].includes(mutations[0].target.localName);
          if (missed) {
            const fragment = document.querySelector(
                '#dashboard feed-container >' +
                'div[data-target="feed-container.content"] > *:first-child'
            );
            if (fragment) return resolved(fragment);
          }
        }
        if (logged_out === null && (200 < i && i < 300 || missed)) {
          let body = document.querySelector('html > body');
          if (logged_out = body && body.className.includes('logged-out')) {
            return rejected('logged-out');
          }
        }
        if (!missed && i + mutations.length < 1600) return i += mutations.length;
        if (2*i + mutations.length < 3500) mutations = mutations.reverse();
        for (const {target} of mutations) {
          i++;
          if (target.localName != 'include-fragment' ||
              target.getAttribute('src') != '/conduit/for_you_feed') continue
          return resolved(target);
        }
        if (i >= 1600 && document.querySelector('#ajax-error-message')) {
          rejected('No "for you" feed was found');
        }
      }).observe(document, {childList: true, subtree: true});
    })
  }

  if (document.readyState != 'loading' &&
      document.querySelector('body').className.includes('logged-out')) {
    return;
  }
  const controller = new AbortController();
  const signal = controller.signal;
  const task = [fetchFeed(signal).catch((error) => error)];
  if (document.readyState != 'complete') task.push(waitFeedContainer(controller));
  Promise.all(task)
    .then(([feed, container]) => {
      if (!(feed instanceof Element)) throw(feed);
      if (container !== false) {
        replaceFeed({feed: feed, container: container});
        if (!container) setDashboardStyle();
      }
    })
    .catch((error) => {
      if (error.toString().includes('logged-out')) return;
      console.error('Could not fetch dashboard feed:', error);
      const fragment = document.querySelector(
          'div[data-target="feed-container.content"] > *:first-child'
      );
      if (fragment) {
        fragment.children[0].hidden = true;
        fragment.children[1].hidden = false;
        fragment.children[1].querySelector('a').className = '';
      }
    });

})();