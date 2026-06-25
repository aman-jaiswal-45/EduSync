(function() {
  const editor = document.getElementById('editor');
  const toolbar = document.getElementById('editor-toolbar');
  const syncFlashDot = document.getElementById('sync-flash-dot');
  const container = document.getElementById('editor-container');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');

  const urlParams = new URLSearchParams(window.location.search);
  const frameId = urlParams.get('id') || 'UnknownFrame';

  if (frameId === 'FrameA') {
    document.body.classList.add('frame-a');
  } else if (frameId === 'FrameB') {
    document.body.classList.add('frame-b');
  }

  let isApplyingSync = false;
  let syncIndicatorTimeout = null;

  const historyStack = [];
  let historyIndex = -1;
  const MAX_HISTORY = 100;
  let typingDebounceTimer = null;

  window.parent.postMessage({ type: 'READY' }, '*');

  saveHistoryState();
  updateUndoRedoButtons();

  function updateToolbarState() {
    const commands = ['bold', 'italic', 'strikeThrough', 'underline', 'insertUnorderedList', 'insertOrderedList'];
    commands.forEach(command => {
      const button = toolbar.querySelector(`[data-command="${command}"]`);
      if (button) {
        if (document.queryCommandState(command)) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    });
    const fontVal = document.queryCommandValue('fontName');
    const select = document.getElementById('font-select');
    if (select && fontVal) {
      const cleanVal = fontVal.replace(/['"]/g, '').toLowerCase();
      for (let option of select.options) {
        const optionClean = option.value.replace(/['"]/g, '').toLowerCase();
        if (cleanVal.includes(optionClean) || optionClean.includes(cleanVal)) {
          select.value = option.value;
          break;
        }
      }
    }
  }

  document.addEventListener('selectionchange', () => {
    updateToolbarState();
  });

  function executeCommand(command, value = null) {
    editor.focus();
    document.execCommand(command, false, value);
    updateToolbarState();
    saveHistoryState();
    sendSyncMessage('FORMAT_SYNC', command);
  }

  toolbar.addEventListener('click', (event) => {
    const btn = event.target.closest('.capsule-btn');
    if (!btn) return;
    const command = btn.getAttribute('data-command');
    if (command) {
      executeCommand(command);
    }
  });

  const fontSelect = document.getElementById('font-select');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      executeCommand('fontName', fontSelect.value);
    });
  }

  undoBtn.addEventListener('click', () => triggerUndo());
  redoBtn.addEventListener('click', () => triggerRedo());

  const ttsBtn = document.getElementById('tts-btn');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', () => {
      let text = window.getSelection().toString().trim();
      if (!text) {
        text = editor.innerText || editor.textContent;
      }
      if (text && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        const statusBadge = document.getElementById('sync-flash-dot');
        if (statusBadge) statusBadge.classList.add('active');
        utterance.onend = () => {
          if (statusBadge) statusBadge.classList.remove('active');
        };
        utterance.onerror = () => {
          if (statusBadge) statusBadge.classList.remove('active');
        };
        window.speechSynthesis.speak(utterance);
      }
    });
  }

  editor.addEventListener('keydown', (event) => {
    const isMeta = event.ctrlKey || event.metaKey;
    if (isMeta) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          executeCommand('bold');
          break;
        case 'i':
          event.preventDefault();
          executeCommand('italic');
          break;
        case 'u':
          event.preventDefault();
          executeCommand('underline');
          break;
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            triggerRedo();
          } else {
            triggerUndo();
          }
          break;
        case 'y':
          event.preventDefault();
          triggerRedo();
          break;
      }
    }
    if ([' ', 'Enter', 'Backspace', 'Delete'].includes(event.key)) {
      if (typingDebounceTimer) {
        clearTimeout(typingDebounceTimer);
        typingDebounceTimer = null;
      }
      saveHistoryState();
    }
  });

  editor.addEventListener('input', () => {
    if (isApplyingSync) return;
    sendSyncMessage('INPUT_SYNC', 'typing');
    if (typingDebounceTimer) clearTimeout(typingDebounceTimer);
    typingDebounceTimer = setTimeout(() => {
      saveHistoryState();
    }, 500);
  });

  function getCursorPosition(element) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return { start: 0, end: 0 };
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const end = preCaretRange.toString().length;
    return { start, end };
  }

  function setCursorPosition(element, start, end) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    let currentOffset = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;

    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.length;
        if (!startNode && currentOffset + len >= start) {
          startNode = node;
          startOffset = start - currentOffset;
        }
        if (!endNode && currentOffset + len >= end) {
          endNode = node;
          endOffset = end - currentOffset;
          return true;
        }
        currentOffset += len;
      } else {
        for (let child of node.childNodes) {
          if (traverse(child)) return true;
        }
      }
      return false;
    }

    traverse(element);

    if (!startNode) {
      const textNodes = [];
      function gatherTextNodes(n) {
        if (n.nodeType === Node.TEXT_NODE) textNodes.push(n);
        else {
          for (let c of n.childNodes) gatherTextNodes(c);
        }
      }
      gatherTextNodes(element);
      if (textNodes.length > 0) {
        startNode = textNodes[textNodes.length - 1];
        startOffset = startNode.length;
      } else {
        startNode = element;
        startOffset = 0;
      }
    }

    if (!endNode) {
      const textNodes = [];
      function gatherTextNodes(n) {
        if (n.nodeType === Node.TEXT_NODE) textNodes.push(n);
        else {
          for (let c of n.childNodes) gatherTextNodes(c);
        }
      }
      gatherTextNodes(element);
      if (textNodes.length > 0) {
        endNode = textNodes[textNodes.length - 1];
        endOffset = endNode.length;
      } else {
        endNode = element;
        endOffset = 0;
      }
    }

    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (err) {
      console.warn("Unable to restore caret selection range:", err);
    }
  }

  function sendSyncMessage(type, actionName) {
    const html = editor.innerHTML;
    const cursor = getCursorPosition(editor);
    window.parent.postMessage({
      type: type,
      action: actionName,
      html: html,
      cursor: cursor,
      historyIndex: historyIndex,
      historyLength: historyStack.length
    }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'FORMAT_SYNC' || message.type === 'INPUT_SYNC' || message.type === 'UNDO_REDO_SYNC') {
      if (editor.innerHTML === message.html) return;
      isApplyingSync = true;
      editor.innerHTML = message.html;
      if (document.hasFocus() && message.cursor) {
        setCursorPosition(editor, message.cursor.start, message.cursor.end);
      }
      if (message.type === 'UNDO_REDO_SYNC') {
        historyIndex = message.historyIndex;
        if (historyIndex >= 0 && historyIndex < historyStack.length) {
          historyStack[historyIndex] = { html: message.html, cursor: message.cursor };
        }
      } else {
        saveHistoryState(message.cursor);
      }
      flashSyncIndicator();
      updateUndoRedoButtons();
      updateToolbarState();
      isApplyingSync = false;
    }
  });

  function flashSyncIndicator() {
    container.classList.remove('sync-flash');
    void container.offsetWidth;
    container.classList.add('sync-flash');
    syncFlashDot.classList.add('active');
    if (syncIndicatorTimeout) clearTimeout(syncIndicatorTimeout);
    syncIndicatorTimeout = setTimeout(() => {
      syncFlashDot.classList.remove('active');
    }, 600);
  }

  function saveHistoryState(customCursor = null) {
    const currentHTML = editor.innerHTML;
    const currentCursor = customCursor || getCursorPosition(editor);
    if (historyIndex >= 0 && historyStack[historyIndex].html === currentHTML) {
      return;
    }
    if (historyIndex < historyStack.length - 1) {
      historyStack.splice(historyIndex + 1);
    }
    historyStack.push({
      html: currentHTML,
      cursor: currentCursor
    });
    if (historyStack.length > MAX_HISTORY) {
      historyStack.shift();
    } else {
      historyIndex++;
    }
    updateUndoRedoButtons();
  }

  function triggerUndo() {
    if (historyIndex > 0) {
      historyIndex--;
      applyHistoryState();
      sendSyncMessage('UNDO_REDO_SYNC', 'undo');
    }
  }

  function triggerRedo() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      applyHistoryState();
      sendSyncMessage('UNDO_REDO_SYNC', 'redo');
    }
  }

  function applyHistoryState() {
    const state = historyStack[historyIndex];
    if (!state) return;
    isApplyingSync = true;
    editor.innerHTML = state.html;
    if (state.cursor) {
      setCursorPosition(editor, state.cursor.start, state.cursor.end);
    }
    updateUndoRedoButtons();
    updateToolbarState();
    isApplyingSync = false;
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
    if (undoBtn.disabled) undoBtn.style.opacity = '0.3';
    else undoBtn.style.opacity = '1';
    if (redoBtn.disabled) redoBtn.style.opacity = '0.3';
    else redoBtn.style.opacity = '1';
  }
})();