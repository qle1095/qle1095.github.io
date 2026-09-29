(function(){
'use strict';
var C=window.COURSE;
var root=document.getElementById('content');
if(!C){root.innerHTML='<h1>Course data is missing</h1><p>Keep content.js beside index.html.</p>';return;}
var KEY='levis-inference-learning-v1';
var state={lessons:{},questions:{},lastLesson:null};
var storageOK=true;
try{var old=JSON.parse(localStorage.getItem(KEY)||'null');if(old&&typeof old==='object'){state=Object.assign(state,old);state.lessons=state.lessons||{};state.questions=state.questions||{};}}catch(_){storageOK=false;}
var lessonMap=Object.fromEntries(C.lessons.map(function(l){return[l.id,l];}));
var questionMap=Object.fromEntries(C.assessments.map(function(q){return[q.id,q];}));
var objectiveMap=Object.fromEntries(C.objectives.map(function(o){return[o.id,o];}));
function e(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){storageOK=false;}updateProgress();}
function safeHTML(html){
 var doc=new DOMParser().parseFromString(html,'text/html');
 var allowed=new Set('H1 H2 H3 H4 H5 P STRONG EM CODE PRE UL OL LI BLOCKQUOTE TABLE THEAD TBODY TR TH TD BR HR DETAILS SUMMARY A IMG SUP SUB DIV SPAN'.split(' '));
 Array.from(doc.body.querySelectorAll('*')).forEach(function(n){
  if(!allowed.has(n.tagName)){n.replaceWith(document.createTextNode(n.textContent||''));return;}
  Array.from(n.attributes).forEach(function(a){if(!['href','src','alt','title','colspan','rowspan','open'].includes(a.name))n.removeAttribute(a.name);});
  if(n.tagName==='A'){
   var href=n.getAttribute('href')||'';
   if(!/^(https?:\/\/|#)/.test(href)&&! /^[a-zA-Z0-9_.\/-]+(?:#[a-zA-Z0-9_.-]+)?$/.test(href))n.removeAttribute('href');
   if(/^https?:/.test(href)){n.setAttribute('target','_blank');n.setAttribute('rel','noopener noreferrer');}
  }
  if(n.tagName==='IMG'){
   var src=n.getAttribute('src')||'';
   if(!/^visuals\/[a-zA-Z0-9_.\/-]+\.(svg|png|jpg)$/.test(src)){n.replaceWith(document.createTextNode(n.alt||'Visual unavailable'));return;}
   n.setAttribute('loading','lazy');
  }
 });
 Array.from(doc.body.querySelectorAll('img')).forEach(function(img){
  var figure=doc.createElement('figure'),scroll=doc.createElement('div'),caption=doc.createElement('figcaption'),link=doc.createElement('a');
  figure.className='diagram';scroll.className='diagram-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Scrollable diagram: '+img.alt);
  link.href=img.getAttribute('src');link.target='_blank';link.rel='noopener';link.textContent='Open full-size visual';
  caption.append('Scroll horizontally when needed · ',link);
  var parent=img.parentElement;
  if(parent&&parent.tagName==='P'&&parent.childNodes.length===1)parent.replaceWith(figure);else img.replaceWith(figure);
  scroll.append(img);figure.append(scroll,caption);
 });
 doc.body.querySelectorAll('table').forEach(function(t){t.tabIndex=0;t.setAttribute('aria-label','Scrollable reference table');});
 return doc.body.innerHTML;
}
function htmlDoc(key){return safeHTML((C.documents||{})[key]||'<p>This reference is not available.</p>');}
function moduleNames(){return Array.from(new Set(C.lessons.map(function(l){return l.module;})));}
function updateProgress(){
 var studied=Object.values(state.lessons).filter(function(v){return v.studied;}).length;
 var practiced=Object.values(state.questions).filter(function(v){return (v.response||'').trim()||v.choice!=null;}).length;
 document.getElementById('sidebar-progress').innerHTML='<strong>'+studied+' / '+C.lessons.length+' lessons studied</strong><br>'+practiced+' questions attempted<br><span>Saved '+(storageOK?'in this browser':'for this session only')+'. Self-checks do not certify mastery.</span>';
}
function nav(){
 var items=[['home','Learning path'],['labs','Interactive labs'],['interview','Job preparation'],['review','Review practice'],['glossary','Glossary'],['sources','Sources & coverage']];
 document.getElementById('navigation').innerHTML=items.map(function(x){return'<a class="nav-link" href="#'+x[0]+'" data-route="'+x[0]+'">'+x[1]+'</a>';}).join('');
 filterNav('');
}
function filterNav(query){
 query=query.toLowerCase().trim();
 var groups=moduleNames();var out='';
 groups.forEach(function(m){
  var ls=C.lessons.filter(function(l){return l.module===m&&(!query||(l.title+' '+l.summary+' '+l.id+' '+(l.search_text||'')).toLowerCase().includes(query));});
  if(!ls.length)return;
  out+='<div class="nav-group">'+e(m)+'</div>';
  ls.forEach(function(l){out+='<a class="nav-link lesson-link" href="#lesson/'+e(l.id)+'" data-lesson="'+e(l.id)+'">'+e(l.title)+'</a>';});
 });
 document.getElementById('lesson-navigation').innerHTML='<div class="search-results">'+out+'</div>';
 highlight();
}
function highlight(){
 var hash=location.hash.slice(1)||'home';
 document.querySelectorAll('.nav-link').forEach(function(a){if(a.getAttribute('href')==='#'+hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
function nextLesson(){return C.lessons.find(function(l){return !state.lessons[l.id]||!state.lessons[l.id].studied;})||C.lessons[0];}
function home(){
 var next=lessonMap[state.lastLesson]||nextLesson();
 var totalVisuals=C.lessons.reduce(function(n,l){return n+l.visuals.length;},0);
 var out='<section class="hero"><div><p class="eyebrow">Your next chapter</p><h1>Build an intuition.<br>Then build the system.</h1><p class="lead">Learn inference engineering from model mechanics to production operations. Explain the bottleneck, test the tradeoff, and make a defensible engineering decision.</p><div class="row"><a class="button" href="#lesson/'+e(next.id)+'">'+(state.lastLesson?'Continue learning':'Start the course')+'</a><a href="#doc/overview">How to use this course</a></div></div><div class="cover" aria-label="Inference Engineering, Philip Kiely"><span>ENGINEERING FIELDNOTES</span><strong>INFERENCE<br>ENGINEERING</strong><small>Based on the book by<br>Philip Kiely · 2026</small></div></section>';
 out+='<div class="stats"><div class="stat"><strong>'+C.lessons.length+'</strong><span>Focused lessons</span></div><div class="stat"><strong>'+totalVisuals+'</strong><span>Explanatory visuals</span></div><div class="stat"><strong>'+C.assessments.length+'</strong><span>Practice questions</span></div></div>';
 out+='<div class="note"><strong>Learn the mechanism, then prove it to yourself.</strong> Read each visual, work the example, and answer before revealing feedback. Keep a notebook of predictions and mistakes. Every lesson retains physical PDF page references.</div>';
 out+='<div class="section-title"><h2>Your learning path</h2><span>All chapters, one connected system</span></div><div class="module-grid">';
 moduleNames().forEach(function(m,i){var ls=C.lessons.filter(function(l){return l.module===m;});var q=(C.module_quizzes||[]).find(function(x){return x.module===m;});out+='<section class="module"><span class="number">MODULE '+String(i+1).padStart(2,'0')+' · '+ls.length+' LESSONS</span><h3>'+e(m.replace(/^\d+\s*[·.-]\s*/,''))+'</h3><p>'+e(ls[0].summary)+'</p><div class="row"><a href="#lesson/'+e(ls[0].id)+'">Open module →</a>'+(q?'<a href="#quiz/'+e(q.id)+'">Module quiz</a>':'')+'</div></section>';});
 out+='</div><div class="section-title"><h2>Turn understanding into evidence</h2></div><p class="lead">Use the labs to test your mental models, then prepare a benchmark report and production design you can discuss in an interview.</p><div class="row"><a class="button" href="#labs">Open the labs</a><a href="#interview">Practice the interview cases →</a></div>';
 return out;
}
function questionHTML(q){
 var s=state.questions[q.id]||{},shown=!!s.revealed;
 var choices='';
 if(q.choices&&q.choices.length)choices=q.choices.map(function(ch,i){return'<label class="choice"><input type="radio" name="choice-'+e(q.id)+'" data-choice="'+e(q.id)+'" value="'+i+'" '+(s.choice===i?'checked':'')+'><span>'+e(ch.text)+'</span></label>';}).join('');
 var feedback='<div class="feedback" '+(shown?'':'hidden')+' id="feedback-'+e(q.id)+'"><strong>Reasoning and self-check rubric</strong><p>'+e(q.answer)+'</p><ul>'+q.rubric.map(function(x){return'<li>'+e(x)+'</li>';}).join('')+'</ul>';
 if(q.choices&&s.choice!=null){var selected=q.choices[s.choice];if(selected)feedback+='<p><strong>'+(selected.correct?'Selected answer: correct.':'Selected answer: revisit the reasoning.')+'</strong> '+e(selected.feedback)+'</p>';}
 feedback+='<p class="subtle">Revisit: '+q.remediation_lesson_ids.map(function(id){return'<a href="#lesson/'+e(id)+'">'+e(lessonMap[id]?lessonMap[id].title:id)+'</a>';}).join(' · ')+'</p><div class="row"><button data-rate="again" data-q="'+e(q.id)+'">Needs another attempt</button><button data-rate="solid" data-q="'+e(q.id)+'">I can explain this</button></div><p class="subtle" id="rating-'+e(q.id)+'">'+(s.review==='again'?'Added to review practice.':s.review==='solid'?'Self-checked. Try a changed case later.':'These are your self-ratings, not automatic mastery scores.')+'</p></div>';
 return'<section class="question" aria-labelledby="qtitle-'+e(q.id)+'"><span class="tag">'+e(q.kind)+'</span><h3 id="qtitle-'+e(q.id)+'">'+e(q.prompt)+'</h3>'+choices+'<label class="subtle" for="answer-'+e(q.id)+'">Your reasoning</label><textarea id="answer-'+e(q.id)+'" data-answer="'+e(q.id)+'" placeholder="Make a prediction and explain why…">'+e(s.response||'')+'</textarea><div class="row"><button data-reveal="'+e(q.id)+'">'+(shown?'Hide feedback':'Reveal feedback')+'</button><span class="subtle">Attempt first, or choose to reveal.</span></div>'+feedback+'</section>';
}
function lesson(id){
 var l=lessonMap[id];if(!l)return'<h1>Lesson not found</h1><p><a href="#home">Return to learning path.</a></p>';
 state.lastLesson=id;save();var idx=C.lessons.indexOf(l);
 var out='<article class="article"><p class="eyebrow">'+e(l.module)+'</p><h1 tabindex="-1">'+e(l.title)+'</h1><p class="lesson-meta">Lesson '+(idx+1)+' of '+C.lessons.length+' · About '+e(l.minutes)+' minutes, plus practice · '+e(l.id)+'</p>';
 out+='<section class="objectives"><h2>After this lesson, you should be able to…</h2><ul>'+l.objective_ids.map(function(x){return'<li>'+e(objectiveMap[x].action)+'</li>';}).join('')+'</ul>';
 var prereqs=(l.prerequisite_lesson_ids||[]).filter(function(x){return lessonMap[x];});if(prereqs.length)out+='<p class="subtle">Useful prerequisites: '+prereqs.map(function(x){return'<a href="#lesson/'+e(x)+'">'+e(lessonMap[x].title)+'</a>';}).join(' · ')+'</p>';
 out+='</section>'+safeHTML(l.html||'');
 out+='<div class="divider"></div><p class="eyebrow">Make the idea yours</p><h2>Check your understanding</h2><p class="subtle">Explain your reasoning before revealing the answer. Responses are stored locally in this browser.</p>'+l.assessment_ids.filter(function(x){return questionMap[x]&&!questionMap[x].cumulative;}).map(function(x){return questionHTML(questionMap[x]);}).join('');
 out+='<div class="lesson-footer"><button data-studied="'+e(id)+'">'+(state.lessons[id]&&state.lessons[id].studied?'Studied ✓ — mark unread':'Mark as studied')+'</button><div class="row">'+(idx>0?'<a href="#lesson/'+C.lessons[idx-1].id+'">← Previous</a>':'')+(idx<C.lessons.length-1?'<a class="button" href="#lesson/'+C.lessons[idx+1].id+'">Next lesson →</a>':'<a class="button" href="#interview">Try the capstone →</a>')+'</div></div></article>';
 return out;
}
function glossary(){
 return'<article class="article"><p class="eyebrow">Keep the vocabulary close</p><h1>Inference glossary</h1><p class="lead">Concise definitions, with source locators and qualifications. Use the lessons to learn the mechanisms.</p><label for="glossary-search">Find a term</label><input id="glossary-search" type="search" placeholder="Search term or definition"><div id="glossary-results">'+glossaryItems('')+'</div></article>';
}
function glossaryItems(q){
 var entries=(C.glossary||[]).filter(function(x){return(x.term+' '+x.definition).toLowerCase().includes(q.toLowerCase());});
 return entries.map(function(x){return'<section class="glossary-item"><h3>'+e(x.term)+'</h3><p>'+e(x.definition)+'</p><small>Appendix A · PDF p. '+x.pdf_page+'</small></section>';}).join('')||'<p>No matching terms.</p>';
}
function quiz(id){
 var q=(C.module_quizzes||[]).find(function(x){return x.id===id;});if(!q)return'<h1>Quiz not found</h1>';q.assessment_ids.forEach(function(id){if(state.questions[id])state.questions[id].revealed=false;});save();
 return'<article class="article"><p class="eyebrow">Cumulative check</p><h1>'+e(q.title)+'</h1><p class="lead">Close the lessons and try these first. This quiz combines a representative check from every lesson with new cases that connect ideas. Use the rubric to find what needs another pass; the lesson questions provide the full objective-by-objective practice.</p>'+q.assessment_ids.map(function(x){return questionHTML(questionMap[x]);}).join('')+'</article>';
}
function review(){
 var ids=Object.keys(state.questions).filter(function(id){return questionMap[id]&&state.questions[id].review==='again';});ids.forEach(function(id){state.questions[id].revealed=false;});save();
 return'<article class="article"><p class="eyebrow">Retrieve, explain, revisit</p><h1>Review practice</h1><p class="lead">These are the questions you marked for another attempt. Try them from memory, then change the scenario. Revisit earlier material on a later day.</p>'+(ids.length?ids.map(function(x){return questionHTML(questionMap[x]);}).join(''):'<div class="empty">Your review list is empty. On any question, reveal the rubric and choose “Needs another attempt.”</div>')+'</article>';
}
function sources(){return'<article class="article"><p class="eyebrow">Know what supports the lesson</p><h1>Sources, coverage & corrections</h1><div class="row"><a href="#doc/coverage">Section coverage ledger</a><a href="#doc/corrections">Technical qualifications</a><a href="#doc/further-reading">Further reading</a><a href="#doc/review">Review report</a></div>'+htmlDoc('source-manifest')+'</article>';}
function interview(){return'<article class="article"><p class="eyebrow">From understanding to engineering judgment</p><h1>Prepare for the job</h1>'+htmlDoc('job-preparation')+'</article>';}
function route(){
 var hash=location.hash.slice(1)||'home',parts=hash.split('/'),view=parts[0];if(hash==='content'){root.focus();return;}
 if(view==='lesson')root.innerHTML=lesson(parts[1]);else if(view==='glossary')root.innerHTML=glossary();else if(view==='quiz')root.innerHTML=quiz(parts[1]);else if(view==='review')root.innerHTML=review();else if(view==='sources')root.innerHTML=sources();else if(view==='interview')root.innerHTML=interview();else if(view==='labs'){root.innerHTML=window.LABS?window.LABS.html():'<h1>Labs unavailable</h1>';if(window.LABS)window.LABS.bind(root);}else if(view==='doc')root.innerHTML='<article class="article">'+htmlDoc(parts[1])+'</article>';else root.innerHTML=home();
 highlight();updateProgress();document.body.classList.remove('nav-open');document.getElementById('menu').setAttribute('aria-expanded','false');window.scrollTo(0,0);var h=root.querySelector('h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}document.title=(h?h.textContent:'Inference Engineering')+" — Levi's Bookshelf";
}
root.addEventListener('input',function(ev){
 var el=ev.target;
 if(el.id==='glossary-search'){document.getElementById('glossary-results').innerHTML=glossaryItems(el.value);return;}
 var id=el.getAttribute('data-answer');if(id){state.questions[id]=Object.assign(state.questions[id]||{},{response:el.value});save();}
});
root.addEventListener('change',function(ev){var id=ev.target.getAttribute('data-choice');if(id){state.questions[id]=Object.assign(state.questions[id]||{},{choice:Number(ev.target.value),revealed:false});save();var feedback=document.getElementById('feedback-'+id);if(feedback)feedback.hidden=true;var button=root.querySelector('[data-reveal="'+id+'"]');if(button)button.textContent='Reveal feedback';}});
root.addEventListener('click',function(ev){
 var b=ev.target.closest('button');if(!b)return;
 var id=b.getAttribute('data-reveal');
 if(id){var s=state.questions[id]||(state.questions[id]={});s.revealed=!s.revealed;save();var old=b.closest('.question'),focusId='answer-'+id;old.outerHTML=questionHTML(questionMap[id]);var current=root.querySelector('[data-reveal="'+id+'"]');if(current)current.focus();return;}
 id=b.getAttribute('data-q');if(id){state.questions[id]=Object.assign(state.questions[id]||{},{review:b.getAttribute('data-rate'),reviewedAt:Date.now()});save();document.getElementById('rating-'+id).textContent=state.questions[id].review==='again'?'Added to review practice.':'Self-checked. Try a changed case later.';return;}
 id=b.getAttribute('data-studied');if(id){state.lessons[id]={studied:!(state.lessons[id]&&state.lessons[id].studied)};save();b.textContent=state.lessons[id].studied?'Studied ✓ — mark unread':'Mark as studied';}
});
document.getElementById('lesson-search').addEventListener('input',function(ev){filterNav(ev.target.value);});
function positionMenu(){document.documentElement.style.setProperty('--menu-top',Math.ceil(document.querySelector('.topbar').getBoundingClientRect().bottom)+'px');}
document.getElementById('menu').addEventListener('click',function(){positionMenu();var opened=document.body.classList.toggle('nav-open');this.setAttribute('aria-expanded',String(opened));if(opened){var first=document.querySelector('#navigation a');if(first)first.focus();}});
window.addEventListener('resize',positionMenu);
document.querySelector('.skip').addEventListener('click',function(ev){ev.preventDefault();root.focus();root.scrollIntoView({block:'start'});});
document.getElementById('focus').addEventListener('click',function(){var focus=document.body.classList.toggle('focus-mode');this.setAttribute('aria-pressed',String(focus));this.textContent=focus?'Exit focus mode':'Focus mode';});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&document.body.classList.contains('nav-open')){document.body.classList.remove('nav-open');var menu=document.getElementById('menu');menu.setAttribute('aria-expanded','false');menu.focus();}});
window.addEventListener('hashchange',route);
nav();route();
})();
