// ==UserScript==
// @name         GitHub Raw File Icon
// @namespace    https://github.com/SeaHOH
// @version      0.3.1
// @description  Add raw link to file icons in GitHub files view.
// @author       SeaHOH
// @license      MIT
// @include      /^https://github.com/[^/]+/./
// @grant        none
// @run-at       document-start
// @icon         https://raw.githubusercontent.com/SeaHOH/gmscripts/040919085894c4477eb982d8adf5922c90e46108/icon/favicon.svg
// @homepageURL  https://github.com/SeaHOH/gmscripts
// @downloadURL  https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-raw-file-icon.user.js
// @updateURL    https://raw.githubusercontent.com/SeaHOH/gmscripts/main/github.com/github-raw-file-icon.user.js
// @description:zh-CN 为文件列表视图中的图标列添加 raw 链接。
// ==/UserScript==

(function() {
  'use strict';

  let viewInfo, observer, tableNode, i = 0;
  init();

  function init() {
    getViewInfo();
    if (!viewInfo.isList) return;
    document.addEventListener('readystatechange', createLinks, {once: true});
    createObserver();
  }
  function log() {
    //console.log(...arguments);
  }
  function getViewInfo() {
    const match = /^\/[^/]+\/[^/]+(\/?|\/(tree|blob)\/.+)$/.exec(location.pathname);
    const isList = Boolean(match);
    viewInfo = {
      isList: isList,
      isTree: isList && (/^\/(tree|blob)\/[^/]+\/./.test(match[1])),
      isBlob: isList && /^\/blob\/[^/]+\/./.test(match[1])
    };
    log(viewInfo);
  }
  function createObserver() {
    observer = new MutationObserver((mutations) => {
      const {target, addedNodes, removedNodes} = mutations[0];
      log(target, addedNodes, removedNodes);
      if (i<1 && addedNodes.length) return;  // start at first remove nodes
      if (++i>1) {
        if (!viewInfo.isTree) observer.disconnect();
        _createListLinks(tableNode);
        i = -3;
      }
    });
  }
  function createLinks() {
    log(document.readyState);
    const container = document.querySelector('#repo-content-pjax-container');
    if (!container) return;
    const node = container.querySelector(viewInfo.isTree ?
                   'REACT-APP[app-name="react-code-view"]' :
                   'REACT-PARTIAL[partial-name="repos-overview"]');
    if (node) {
      tableNode = node.querySelector('#folders-and-files + table');
      //if (!viewInfo.isBlob) _createListLinks(tableNode);
      observer.observe(node, {childList: true, subtree: true});
    }
  }
  function _createListLinks(node) {
    log('_createListLinks',node);
    if (viewInfo.isTree && /^\/[^/]+\/[^/]+\/blob\//.test(location.pathname))
      return tableNode = null;
    if (!node)
      node = tableNode = document.querySelector('#folders-and-files + table');
    const options = {
      ltype: 'list',
      opencn: 'a.Link--primary'
    };
    _createLinks(node, {...options,
      type: 'raw',
      iconcn: 'svg.color-fg-muted'
    });
    _createLinks(node, {...options,
      type: 'directory',
      iconcn: 'svg.icon-directory'
    });
  }
  function _createLinks(node, {type, iconcn, opencn}) {
    for (const icon of node.querySelectorAll(iconcn)) {
      const open = icon.nextElementSibling.querySelector(opencn);
      if (!open) continue
      const link = document.createElement('a');
      link.className = `my-file-${type}-link`;
      if (type == 'raw') {
        link.href = open.href.replace('/blob/', '/raw/');
        link.title = open.title;
      }
      else {
        link.href = open.href;
        link.title = `${open.title} ⚠️No Turbo❗`;
      }
      icon.replaceWith(link);
      link.appendChild(icon);
      log('_createLinks', link);
    };
  }
})();