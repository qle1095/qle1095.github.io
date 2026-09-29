(function(g){
'use strict';
function positive(x,name){if(!Number.isFinite(x)||x<=0)throw new Error(name+' must be greater than zero.');return x;}
function nonnegative(x,name){if(!Number.isFinite(x)||x<0)throw new Error(name+' must be nonnegative.');return x;}
function integer(x,name){positive(x,name);if(!Number.isInteger(x))throw new Error(name+' must be a whole number.');return x;}
function roofline(v){
 positive(v.compute,'Compute');positive(v.bandwidth,'Bandwidth');positive(v.ops,'Operations');positive(v.bytes,'Bytes');
 var ct=v.ops*1e9/(v.compute*1e12)*1000,mt=v.bytes*1e6/(v.bandwidth*1e9)*1000;
 return{computeMs:ct,memoryMs:mt,lowerBoundMs:Math.max(ct,mt),intensity:v.ops*1e9/(v.bytes*1e6),ridge:v.compute*1e12/(v.bandwidth*1e9),bound:ct>=mt?'compute':'memory bandwidth'};
}
function kv(v){
 ['layers','heads','dim','tokens','batch'].forEach(function(k){integer(v[k],k);});positive(v.precision,'Bytes per value');positive(v.vram,'VRAM');nonnegative(v.weights,'Weights');nonnegative(v.other,'Other allocations');
 var per=2*v.layers*v.heads*v.dim*v.tokens*v.precision,bytes=per*v.batch,spare=(v.vram-v.weights-v.other)*Math.pow(2,30);
 return{perGiB:per/Math.pow(2,30),totalGiB:bytes/Math.pow(2,30),maxSequences:Math.max(0,Math.floor(spare/per)),remainingGiB:spare/Math.pow(2,30)-bytes/Math.pow(2,30)};
}
function latency(v){
 ['preprocess','queue','prefill','network','itl'].forEach(function(k){nonnegative(v[k],k);});integer(v.tokens,'Output tokens');
 var ttft=v.preprocess+v.queue+v.prefill+v.network,end=ttft+(v.tokens-1)*v.itl;
 return{ttft:ttft,end:end,streamTPS:v.itl>0?1000/v.itl:null};
}
function speculation(v){
 positive(v.baseline,'Baseline token time');positive(v.emitted,'Tokens emitted');positive(v.verify,'Verification time');nonnegative(v.draft,'Draft time');nonnegative(v.overhead,'Other overhead');
 var round=v.draft+v.verify+v.overhead;
 return{round:round,baselineEquivalent:v.baseline*v.emitted,speedup:v.baseline*v.emitted/round};
}
var configs=[
 {id:'roofline',name:'1. Identify the bottleneck',intro:'Predict before changing the inputs: will doubling compute or doubling bandwidth lower this bound?',fields:[['compute','Compute ceiling (TFLOP/s)',1000,1],['bandwidth','Memory bandwidth (GB/s)',3000,1],['ops','Work per iteration (GFLOP)',14,.1],['bytes','Bytes moved per iteration (decimal MB)',14000,1]],note:'Teaching model: time ≥ max(FLOPs / FLOP/s, bytes / byte/s). Compute must match precision and sparsity. This ideal lower bound omits launch, scheduling, communication, overlap constraints, and utilization losses; it is not a measured GPU benchmark.'},
 {id:'kv',name:'2. Budget the KV cache',intro:'Predict what doubles when context or concurrent sequences double. Then compare GQA with fewer KV heads.',fields:[['layers','Transformer layers',32,1],['heads','KV heads (not query heads)',8,1],['dim','Values per head',128,1],['tokens','Cached tokens per sequence',8192,1],['batch','Concurrent sequences',16,1],['precision','Bytes per cached scalar',2,.5],['vram','Available VRAM (GiB)',80,1],['weights','Weight allocations (GiB)',14,1],['other','Other allocations + reserve (GiB)',10,1]],note:'For a conventional full K/V cache: bytes = 2 × layers × KV heads × head dimension × cached tokens × concurrent sequences × bytes/value. No compression, sharing, fragmentation, padding or sharding is modeled. Architectures such as MLA need their own formula. The count is a memory-only ceiling, not an SLO-safe concurrency setting.'},
 {id:'latency',name:'3. Separate first-token and decode latency',intro:'A larger output makes the request slower to finish. Does it have to change time to first token?',fields:[['preprocess','Preprocessing (ms)',40,1],['queue','Queueing (ms)',80,1],['prefill','Prefill + first-token generation (ms)',120,1],['network','Network / client time until first token (ms)',30,1],['tokens','Output tokens',128,1],['itl','Constant subsequent inter-token latency (ms)',20,1]],note:'Teaching timeline: TTFT = preprocessing + queue + prefill/first-token work + network/client. End-to-end = TTFT + (output tokens − 1) × ITL. This assumes a constant measured ITL and includes no final stream-close delay. Per-user streaming speed differs from aggregate server throughput and from whole-request tokens/second.'},
 {id:'speculation',name:'4. Decide whether speculation pays',intro:'More draft tokens are useful only if enough are accepted to repay their cost. Use a measured mean emitted-token count per round.',fields:[['baseline','Baseline target time per token (ms)',10,.1],['emitted','Mean tokens emitted per speculative round',3.2,.1],['draft','Draft work per round (ms)',4,.1],['verify','Target verification per round (ms)',10,.1],['overhead','Other round overhead (ms)',1,.1]],note:'Approximate speedup = baseline time/token × mean emitted tokens/round ÷ total speculative round time. Emitted tokens include any correction/bonus token. Use measurements from the same workload and resource allocation. Verification semantics determine distribution preservation; an attractive speedup estimate proves neither correctness nor service-level goodput.'}
];
function fields(c){return c.fields.map(function(f){return'<label for="'+c.id+'-'+f[0]+'">'+f[1]+'<input type="number" id="'+c.id+'-'+f[0]+'" name="'+f[0]+'" value="'+f[2]+'" step="'+f[3]+'" min="0" max="1000000000" required></label>';}).join('');}
function html(){return'<article class="article"><p class="eyebrow">Change an input. Explain the result.</p><h1>Interactive engineering labs</h1><p class="lead">Make a prediction first. These small analytical models expose mechanisms; real deployment decisions still need measured workload data.</p>'+configs.map(function(c){return'<section class="lab" data-lab="'+c.id+'"><h2>'+c.name+'</h2><p>'+c.intro+'</p><form class="lab-inputs">'+fields(c)+'</form><div class="result" id="'+c.id+'-result" aria-live="polite"></div><p class="subtle">'+c.note+'</p><button type="button" data-reset="'+c.id+'">Reset this experiment</button></section>';}).join('')+'<h2>Keep an engineering notebook</h2><p>For each experiment, write your prediction, the observed change, the mechanism, and a condition where this model stops applying. Reproduce the roofline and KV calculations with <code>labs/engineering_lab.py</code>. That script also includes metrics and queue exercises; the latency and speculation calculators run in this page. Then use the job-preparation cases.</p></article>';}
function f(n){return Number(n).toLocaleString(undefined,{maximumFractionDigits:3});}
function chart(a,b,labelA,labelB){
 var max=Math.max(a,b,0.001),wa=Math.max(2,Math.min(480,480*a/max)),wb=Math.max(2,Math.min(480,480*b/max));
 return'<div class="lab-chart" tabindex="0" role="region" aria-label="Scrollable comparison chart"><svg viewBox="0 0 700 120" role="img" aria-label="'+labelA+' '+f(a)+'; '+labelB+' '+f(b)+'"><text x="0" y="24" font-size="15" fill="#152b32">'+labelA+'</text><rect x="180" y="7" width="'+wa+'" height="26" fill="#096a63"></rect><text x="180" y="51" font-size="13" fill="#152b32">'+f(a)+'</text><text x="0" y="85" font-size="15" fill="#152b32">'+labelB+'</text><rect x="180" y="67" width="'+wb+'" height="26" fill="#2563eb"></rect><text x="180" y="114" font-size="13" fill="#152b32">'+f(b)+'</text></svg></div>';
}
function render(id,v){
 if(id==='roofline'){var r=roofline(v);return'<strong>'+f(r.lowerBoundMs)+' ms ideal lower bound</strong><br>Dominant ceiling: '+r.bound+'. Arithmetic intensity: '+f(r.intensity)+' FLOP/byte; ridge point: '+f(r.ridge)+' FLOP/byte.'+chart(r.computeMs,r.memoryMs,'Compute time (ms)','Memory time (ms)');}
 if(id==='kv'){var k=kv(v);return'<strong>'+f(k.totalGiB)+' GiB of KV state</strong><br>'+f(k.perGiB)+' GiB per sequence. Memory-only ceiling: '+k.maxSequences+' sequences.<br>Remaining modeled headroom: '+f(k.remainingGiB)+' GiB'+(k.remainingGiB<0?' — this allocation does not fit.':'.')+chart(k.totalGiB,Math.max(0,v.vram-v.weights-v.other),'KV needed (GiB)','KV budget (GiB)');}
 if(id==='latency'){var l=latency(v);return'<strong>'+f(l.ttft)+' ms until first token</strong><br>'+f(l.end)+' ms until final token. Steady streaming speed: '+(l.streamTPS===null?'undefined for zero ITL':f(l.streamTPS)+' tokens/s')+'.'+chart(l.ttft,l.end,'TTFT (ms)','Complete (ms)');}
 var s=speculation(v);return'<strong>'+f(s.speedup)+'× estimated speedup</strong><br>'+(s.speedup<1?'This configuration loses time.':'Now test acceptance and costs under realistic load.')+chart(s.baselineEquivalent,s.round,'Baseline work (ms)','Speculative round (ms)');
}
function bind(root){
 root.querySelectorAll('[data-lab]').forEach(function(section){
  var id=section.dataset.lab,c=configs.find(function(x){return x.id===id;});
  function update(){var v={};c.fields.forEach(function(fld){v[fld[0]]=Number(section.querySelector('[name="'+fld[0]+'"]').value);});var out=section.querySelector('.result');try{out.innerHTML=render(id,v);}catch(err){out.textContent=err.message;}}
  section.querySelector('form').addEventListener('submit',function(ev){ev.preventDefault();update();});
  section.addEventListener('input',update);
  section.querySelector('[data-reset]').addEventListener('click',function(){c.fields.forEach(function(fld){section.querySelector('[name="'+fld[0]+'"]').value=fld[2];});update();});
  update();
 });
}
g.LABS={html:html,bind:bind,roofline:roofline,kv:kv,latency:latency,speculation:speculation};
})(typeof window==='undefined'?globalThis:window);
