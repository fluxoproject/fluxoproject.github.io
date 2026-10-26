/* Animações discretas: entrada suave ao rolar e barra de leitura. Sem dependências. */
(function(){
  var d=document.documentElement;
  var calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(calm||!('IntersectionObserver' in window))return;
  d.classList.add('js');
  function init(){
    var sel='.section h2,.section .lead,.card,.steps li,.cta,.faq details,.toc,.callout,.pull,.doc table,.related h2';
    var els=[].slice.call(document.querySelectorAll(sel));
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.05});
    els.forEach(function(el){
      var sib=el.parentNode?[].slice.call(el.parentNode.children).indexOf(el):0;
      el.style.setProperty('--d',Math.min(sib,6)*0.06+'s');
      el.classList.add('reveal');io.observe(el);
    });
    var doc=document.querySelector('.doc');
    if(doc){
      var bar=document.createElement('div');bar.className='read-bar';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
      var tick=false;
      var upd=function(){tick=false;var r=doc.getBoundingClientRect(),h=r.height-innerHeight*.6;var p=h>0?Math.min(1,Math.max(0,-r.top/h)):0;bar.style.transform='scaleX('+p+')'};
      addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});upd();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
