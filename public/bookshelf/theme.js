/* Runs before the stylesheet so the saved theme is applied before first paint. */
(function(){
 'use strict';
 var key='levis-bookshelf-theme',theme='dark';
 try{var saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')theme=saved;}catch(_){}
 document.documentElement.dataset.theme=theme;
 function sync(){
  var dark=document.documentElement.dataset.theme==='dark',button=document.getElementById('theme');
  document.getElementById('theme-label').textContent=dark?'Light mode':'Dark mode';
  button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
  button.title=button.getAttribute('aria-label');
 }
 document.addEventListener('DOMContentLoaded',function(){
  sync();
  document.getElementById('theme').addEventListener('click',function(){
   theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
   document.documentElement.dataset.theme=theme;
   try{localStorage.setItem(key,theme);}catch(_){}
   sync();
  });
 });
 window.addEventListener('storage',function(event){
  if(event.key===key){document.documentElement.dataset.theme=event.newValue==='light'?'light':'dark';sync();}
 });
})();
