// Contact YouTube only when a visitor opens a demonstration. Closing it stops playback.
for(const panel of document.querySelectorAll('[data-sound-video]')){
  const button=panel.querySelector('button'),host=panel.querySelector('[data-player-host]');
  button.hidden=false;
  button.addEventListener('click',()=>{
    const open=button.getAttribute('aria-expanded')==='true';
    host.replaceChildren();
    button.setAttribute('aria-expanded',String(!open));
    button.textContent=open?button.dataset.open:'Close video';
    if(open)return;
    const frame=document.createElement('iframe');
    frame.src='https://www.youtube-nocookie.com/embed/'+panel.dataset.soundVideo+'?playsinline=1';
    frame.title=button.dataset.title;
    frame.allow='encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.style.cssText='display:block;width:100%;max-width:48rem;min-height:200px;aspect-ratio:16/9;border:0;margin-top:12px';
    host.appendChild(frame);
  });
}
