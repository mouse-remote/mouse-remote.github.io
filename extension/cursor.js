// Injected into the controlled tab to show a virtual cursor.
// chrome.debugger moves the "logical" cursor (page events/hover) but not the OS cursor.

const EL_ID = '__mr_cursor';

function getOrCreate() {
  let el = document.getElementById(EL_ID);
  if (el) return el;

  el = document.createElement('div');
  el.id = EL_ID;
  el.style.cssText = [
    'position:fixed',
    'width:16px',
    'height:16px',
    'border-radius:50%',
    'background:rgba(124,58,237,0.85)',
    'border:2px solid #fff',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'z-index:2147483647',
    'transform:translate(-50%,-50%)',
    'transition:left 0.04s linear,top 0.04s linear',
    'left:-50px',
    'top:-50px',
  ].join(';');

  document.documentElement.appendChild(el);
  return el;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CURSOR_MOVE') {
    const el = getOrCreate();
    el.style.left = msg.x + 'px';
    el.style.top  = msg.y + 'px';
  } else if (msg.type === 'CURSOR_REMOVE') {
    document.getElementById(EL_ID)?.remove();
  }
});
