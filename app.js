(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = window.UtilityModel;
  const initial = {model:'cobb', alpha:0.5, rho:-0.5, scale:1, income:10, px:1, py:1, level:5, lock:true, surface:true, plane:true, ic:true, budget:true, path:true, optimal:true, feasible:true, opacity:0.85, autoRange:false, xmax:11.2, ymax:11.2};
  let s = {...initial}, camera = null, pending = false, drawing = false, initialized = false;
  const colors = {ic:'#087f8c', budget:'#be7215', opt:'#b13f59', ink:'#263746', muted:'#687b8d'};
  const fmt = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('en-US', {maximumFractionDigits:digits}) : '—';
  const linspace = (max, n) => Array.from({length:n}, (_, i) => max * i / (n - 1));
  const defaultCamera = () => ({eye:{x:-1.6,y:-1.85,z:1.35},center:{x:0,y:0,z:-0.04},up:{x:0,y:0,z:1},projection:{type:'perspective'}});
  const forms = {
    cobb:'U = A x<sup>α</sup> y<sup>1−α</sup>',
    ces:'U = A [αx<sup>ρ</sup> + (1−α)y<sup>ρ</sup>]<sup>1/ρ</sup>',
    linear:'U = A [αx + (1−α)y]',
    leontief:'U = A min(x/α, y/(1−α))',
    quasi:'U = A [α ln(1+x) + (1−α)y]'
  };
  function syncControls() {
    for (const key of ['model','alpha','rho','scale','income','px','py','level','opacity','xmax','ymax']) $(key).value = s[key];
    for (const key of ['alpha','rho','scale','income','level']) $(key+'-value').value = Number(s[key].toFixed(4));
    for (const key of ['lock','surface','plane','ic','budget','path','optimal','feasible']) $(key).checked = s[key];
    $('auto-range').checked = s.autoRange;
    $('xmax').disabled = $('ymax').disabled = s.autoRange;
    $('rho-control').hidden = s.model !== 'ces';
    $('formula').innerHTML = forms[s.model];
    $('opacity-value').textContent = Math.round(s.opacity * 100) + '%';
  }
  function updateResults(o, zmax) {
    $('level').max = Math.max(zmax, s.level, o.u * 1.5).toFixed(4);
    $('level').step = 'any';
    $('level').value = s.level;
    $('level').setAttribute('aria-valuetext',fmt(s.level,4));
    $('level-value').value = Number(s.level.toFixed(4));
    $('equation').textContent = `x ≥ 0, y ≥ 0  ·  ${fmt(s.px)}x + ${fmt(s.py)}y ≤ ${fmt(s.income)}`;
    $('opt-x').textContent = fmt(o.x,3); $('opt-y').textContent = fmt(o.y,3); $('opt-u').textContent = fmt(o.u,3);
    $('expenditure').textContent = `${fmt(o.cost)} / ${fmt(s.income)}`;
    $('price-ratio').textContent = fmt(s.px/s.py,4);
    $('mrs').textContent = o.kind === 'kink' ? 'Undefined at kink' : fmt(M.mrs(o.x,o.y,s),4);
    $('solution-type').textContent = {interior:'Interior',corner:'Corner',kink:'Kink',multiple:'Multiple optima'}[o.kind];
    $('solution-note').textContent = {
      interior:'At the optimum, the indifference curve is tangent to the budget line.',
      corner:'The optimum lies on an axis. An interior tangency is not required.',
      kink:'The optimum is at the kink, where goods are consumed in the required proportions.',
      multiple:'Every bundle on the budget line is optimal. The dot shows one example.'
    }[o.kind];
    $('selected-level').textContent = `ū = ${fmt(s.level,3)}`;
    const difference = s.level - o.u, tolerance = 1e-6 * Math.max(1,o.u);
    $('level-status').textContent = Math.abs(difference) < tolerance ? 'Highest attainable utility. The plane passes through the optimum.' : difference > 0 ? `Unattainable at this budget: ${fmt(difference,3)} utility units above the maximum.` : `Attainable. Utility can rise by ${fmt(-difference,3)} before reaching the optimum.`;
    const clipped = o.x > s.xmax || o.y > s.ymax;
    $('range-warning').hidden = !clipped;
    $('range-warning').textContent = 'The optimum is outside the displayed range. Enable “Fit axes to budget intercepts” to see it.';
    $('plot3d').setAttribute('aria-label',`3D ${$('model').selectedOptions[0].text} utility surface. Optimal bundle: x ${fmt(o.x,3)}, y ${fmt(o.y,3)}, utility ${fmt(o.u,3)}. Selected utility ${fmt(s.level,3)}.`);
  }
  function line3(points, z, color, name, width=6, extra={}) {
    return {type:'scatter3d',mode:'lines',name, x:points.map(p=>p[0]),y:points.map(p=>p[1]),z:points.map(p=>typeof z==='function'?z(p):z),line:{color,width},hovertemplate:`${name}<br>x = %{x:.3f}<br>y = %{y:.3f}<br>U = %{z:.3f}<extra></extra>`,showlegend:false,...extra};
  }
  function line2(points, color, name, extra={}) {
    return {type:'scatter',mode:'lines',name,x:points.map(p=>p[0]),y:points.map(p=>p[1]),line:{color,width:2.5},hovertemplate:`${name}<br>x = %{x:.3f}<br>y = %{y:.3f}<extra></extra>`,showlegend:false,...extra};
  }
  function makePlots(o, zmax) {
    const x = linspace(s.xmax,66), y = linspace(s.ymax,66);
    const curve = M.contour(s.level,s,s.xmax,s.ymax);
    const optimalCurve = M.contour(o.u,s,s.xmax,s.ymax);
    const budgetPoints = linspace(s.income/s.px,240).map(x=>[x,Math.max(0,(s.income-s.px*x)/s.py)]);
    // Include the exact optimum, so a kink or a sharp maximum is never missed by sampling.
    budgetPoints.push([o.x,o.y]); budgetPoints.sort((a,b)=>a[0]-b[0]);
    const intercepts = [[s.income/s.px,0],[0,s.income/s.py]];
    const data = [];
    if (s.feasible) data.push({type:'mesh3d',x:[0,s.income/s.px,0],y:[0,0,s.income/s.py],z:[0,0,0],i:[0],j:[1],k:[2],color:'#d5e4de',opacity:0.35,hoverinfo:'skip',showscale:false});
    if (s.surface) data.push({type:'surface',name:'Utility surface',x,y,z:y.map(yi=>x.map(xi=>M.utility(xi,yi,s))),colorscale:[[0,'#e4dbea'],[0.25,'#b5a4d0'],[0.6,'#8184bd'],[1,'#36577e']],opacity:s.opacity,showscale:false,lighting:{ambient:0.85,diffuse:0.55,roughness:0.9,specular:0.08},contours:{x:{show:false},y:{show:false},z:{show:false}},hovertemplate:'Utility surface<br>x = %{x:.3f}<br>y = %{y:.3f}<br>U = %{z:.3f}<extra></extra>'});
    if (s.plane) {
      data.push({type:'surface',name:'Fixed utility plane',x:[0,s.xmax],y:[0,s.ymax],z:[[s.level,s.level],[s.level,s.level]],colorscale:[[0,colors.ic],[1,colors.ic]],opacity:0.14,showscale:false,hovertemplate:`Utility plane: ū = ${fmt(s.level,3)}<extra></extra>`,lighting:{ambient:1,diffuse:0,specular:0}});
      data.push(line3([[0,0],[s.xmax,0],[s.xmax,s.ymax],[0,s.ymax],[0,0]],s.level,colors.ic,'Utility plane',2,{hoverinfo:'skip'}));
    }
    if (s.budget) data.push({type:'mesh3d',name:'Budget plane',x:[s.income/s.px,0,0,s.income/s.px],y:[0,s.income/s.py,s.income/s.py,0],z:[0,0,zmax,zmax],i:[0,0],j:[1,2],k:[2,3],color:colors.budget,opacity:0.13,flatshading:true,hovertemplate:`Budget plane<br>${fmt(s.px)}x + ${fmt(s.py)}y = ${fmt(s.income)}<extra></extra>`});
    if (s.budget || s.path) data.push(line3(intercepts,0,colors.budget,'Budget line',6));
    if (s.path) data.push(line3(budgetPoints,p=>M.utility(p[0],p[1],s),colors.budget,'Utility along budget line',7));
    if (s.ic) {
      data.push(line3(curve,s.level,colors.ic,'Indifference curve on surface',7));
      data.push(line3(curve,0,colors.ic,'IC projected onto goods plane',5,{line:{color:colors.ic,width:4,dash:'dash'}}));
    }
    if (s.optimal) {
      if (o.kind === 'multiple') data.push(line3(intercepts,o.u,colors.opt,'Every point is optimal',8));
      data.push({type:'scatter3d',mode:'lines',x:[o.x,o.x,0,null,o.x],y:[o.y,o.y,o.y,null,0],z:[o.u,0,0,null,0],line:{color:colors.opt,width:3,dash:'dash'},hoverinfo:'skip',showlegend:false});
      data.push(line3([[o.x,o.y],[o.x,0]],0,colors.opt,'Optimal bundle projection',3,{line:{color:colors.opt,width:3,dash:'dash'},hoverinfo:'skip'}));
      data.push({type:'scatter3d',name:'Optimum',mode:'markers+text',x:[o.x],y:[o.y],z:[o.u],text:['Optimum'],textposition:'top center',textfont:{size:12,color:colors.opt},marker:{size:6,color:colors.opt,line:{width:2,color:'#ffffff'}},hovertemplate:`Optimum<br>x* = ${fmt(o.x,4)}<br>y* = ${fmt(o.y,4)}<br>U* = ${fmt(o.u,4)}<extra></extra>`,showlegend:false});
      data.push({type:'scatter3d',mode:'markers',x:[o.x],y:[o.y],z:[0],marker:{size:4,color:colors.opt},hoverinfo:'skip',showlegend:false});
    }
    const axis = (title,max) => ({title:{text:title,font:{size:12,color:colors.ink}},range:[0,max],showbackground:false,showgrid:true,gridcolor:'#e3e8ed',zerolinecolor:'#bac7d1',showline:true,linecolor:'#c8d1da',tickfont:{size:10,color:colors.muted},nticks:5,tickformat:'.3~g',ticks:'',showspikes:false});
    const layout = {margin:{l:0,r:0,t:5,b:0},paper_bgcolor:'#ffffff',font:{family:'Segoe UI, Arial, sans-serif',color:colors.ink},showlegend:false,uirevision:'keep-view',scene:{xaxis:axis('Good x',s.xmax),yaxis:axis('Good y',s.ymax),zaxis:axis('Utility U(x, y)',zmax),aspectmode:'manual',aspectratio:{x:1,y:1,z:0.85},camera:camera||defaultCamera(),dragmode:$('pan').getAttribute('aria-pressed')==='true'?'pan':'orbit',uirevision:'keep-view'}};
    const data2 = [];
    if (s.feasible) data2.push(line2([[0,0],...intercepts,[0,0]],'#bccfc5','Affordable bundles',{fill:'toself',fillcolor:'rgba(176,204,191,0.2)',line:{width:0},hoverinfo:'skip'}));
    if (s.ic && Math.abs(s.level-o.u)>1e-6*Math.max(1,o.u) && s.optimal) data2.push(line2(optimalCurve,'#afbbc5','Optimal IC',{line:{color:'#afbbc5',width:1.5,dash:'dot'}}));
    if (s.budget || s.path) data2.push(line2(intercepts,colors.budget,'Budget line'));
    if (s.ic) data2.push(line2(curve,colors.ic,'Selected indifference curve'));
    if (s.optimal) {
      if (o.kind === 'multiple') data2.push(line2(intercepts,colors.opt,'All bundles on BC are optimal',{line:{color:colors.opt,width:4}}));
      data2.push(line2([[o.x,0],[o.x,o.y],[0,o.y]],colors.opt,'Optimal quantities',{line:{color:colors.opt,width:1,dash:'dot'},hoverinfo:'skip'}));
      data2.push({type:'scatter',mode:'markers',x:[o.x],y:[o.y],marker:{color:colors.opt,size:9,line:{color:'#fff',width:1.5}},showlegend:false,hovertemplate:`Optimal bundle<br>x* = ${fmt(o.x,3)}<br>y* = ${fmt(o.y,3)}<extra></extra>`});
    }
    const flatAxis = (title,max) => ({title:{text:title,font:{size:11},standoff:3},range:[0,max],gridcolor:'#edf0f3',zeroline:false,showline:true,linecolor:'#cbd5dd',nticks:5,tickfont:{size:10,color:colors.muted},fixedrange:true,tickformat:'.3~g'});
    const layout2 = {margin:{l:44,r:14,t:10,b:40},paper_bgcolor:'#ffffff',plot_bgcolor:'#ffffff',font:{family:'Segoe UI, Arial, sans-serif',color:colors.ink},showlegend:false,xaxis:flatAxis('Good x',s.xmax),yaxis:flatAxis('Good y',s.ymax),hovermode:'closest'};
    return {data,layout,data2,layout2};
  }
  async function draw() {
    pending = true;
    if (drawing) return;
    drawing = true;
    while (pending) {
      pending = false;
      try {
        const o = M.optimum(s);
        if (s.autoRange) {s.xmax = 1.12 * s.income/s.px;s.ymax = 1.12 * s.income/s.py;$('xmax').value=Number(s.xmax.toFixed(3));$('ymax').value=Number(s.ymax.toFixed(3));}
        if (s.lock) s.level = o.u;
        const zmax = Math.max(1e-3,M.utility(s.xmax,s.ymax,s)*1.04,s.level*1.08,o.u*1.15);
        updateResults(o,zmax);
        const {data,layout,data2,layout2} = makePlots(o,zmax);
        await Promise.all([Plotly.react($('plot3d'),data,layout,{responsive:true,displayModeBar:false,scrollZoom:true,displaylogo:false}),Plotly.react($('plot2d'),data2,layout2,{responsive:true,displayModeBar:false,displaylogo:false})]);
        if (!initialized) {
          initialized = true;
          $('plot3d').on('plotly_relayout', ev => {
            if (ev['scene.camera']) camera = structuredClone(ev['scene.camera']);
          });
        }
        $('plot-error').hidden = true;
      } catch (error) {
        $('plot-error').textContent = 'The 3D plot could not be drawn. Open this file in a browser with WebGL enabled. ' + error.message;
        $('plot-error').hidden = false;
        console.error(error);
      }
    }
    drawing = false;
  }
  let queued = false;
  function schedule() {if (!queued) {queued=true;requestAnimationFrame(()=>{queued=false;draw();});}}
  function bindNumber(key,min,max) {
    for (const id of [key,key+'-value'].filter(id=>$(id))) {
      $(id).addEventListener('input', () => {
        const v = $(id).valueAsNumber;
        if (!Number.isFinite(v) || v < min || v > max) {$(id).setAttribute('aria-invalid','true');return;}
        $(id).removeAttribute('aria-invalid');
        s[key] = v;
        if (key === 'level') {s.lock=false;$('lock').checked=false;}
        if (id !== key) $(key).value=v;
        if (id !== key+'-value' && $(key+'-value')) $(key+'-value').value=v;
        if (key === 'opacity') $('opacity-value').textContent=Math.round(v*100)+'%';
        schedule();
      });
      $(id).addEventListener('change', () => {
        if ($(id).getAttribute('aria-invalid') === 'true') {$(id).value = s[key];$(id).removeAttribute('aria-invalid');}
      });
    }
  }
  bindNumber('alpha',0.05,0.95);bindNumber('rho',-3,0.95);bindNumber('scale',0.1,5);bindNumber('income',1,100);
  bindNumber('px',0.1,20);bindNumber('py',0.1,20);bindNumber('level',0,1e6);bindNumber('opacity',0.15,1);
  bindNumber('xmax',0.1,2000);bindNumber('ymax',0.1,2000);
  $('model').addEventListener('change',()=>{s.model=$('model').value;syncControls();schedule();});
  for (const key of ['lock','surface','plane','ic','budget','path','optimal','feasible']) $(key).addEventListener('change',()=>{s[key]=$(key).checked;schedule();});
  $('auto-range').addEventListener('change',()=>{s.autoRange=$('auto-range').checked;$('xmax').disabled=$('ymax').disabled=s.autoRange;schedule();});
  $('optimize').addEventListener('click',()=>{s.lock=true;$('lock').checked=true;schedule();});
  function setCamera(next) {
    camera=next;
    if (initialized) Plotly.relayout($('plot3d'),{'scene.camera':next});
  }
  function selectView(view) {
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
    const view=button.dataset.view;selectView(view);
    const views={perspective:defaultCamera(),top:{eye:{x:0.001,y:0,z:2.5},up:{x:0,y:1,z:0}},front:{eye:{x:0,y:-2.5,z:0.04},up:{x:0,y:0,z:1}},side:{eye:{x:2.5,y:0,z:0.04},up:{x:0,y:0,z:1}}};
    setCamera({center:{x:0,y:0,z:0},projection:{type:'perspective'},...views[view]});
  }));
  function dragMode(mode) {
    for (const key of ['rotate','pan']) {$(key).classList.toggle('selected',key===mode);$(key).setAttribute('aria-pressed',String(key===mode));}
    if (initialized) Plotly.relayout($('plot3d'),{'scene.dragmode':mode==='pan'?'pan':'orbit'});
  }
  $('rotate').onclick=()=>dragMode('rotate');$('pan').onclick=()=>dragMode('pan');
  function zoom(factor) {
    const c=structuredClone(camera||defaultCamera());
    const length=Math.hypot(c.eye.x,c.eye.y,c.eye.z);
    const effective=Math.max(0.25,Math.min(12,length*factor))/length;
    for (const k of ['x','y','z']) c.eye[k]*=effective;
    setCamera(c);
  }
  $('zoom-in').onclick=()=>zoom(0.8);$('zoom-out').onclick=()=>zoom(1.25);
  $('home').onclick=()=>{setCamera(defaultCamera());selectView('perspective');dragMode('rotate');};
  $('reset').onclick=()=>{s={...initial};syncControls();setCamera(defaultCamera());selectView('perspective');dragMode('rotate');schedule();};
  $('export').onclick=async()=>{
    if (!initialized) return;
    $('export').disabled=true;$('export').textContent='Saving…';
    try {await Plotly.downloadImage($('plot3d'),{format:'png',width:1600,height:1200,filename:'utility-surface'});}
    catch(error){$('plot-error').textContent='The image could not be saved: '+error.message;$('plot-error').hidden=false;}
    finally{$('export').disabled=false;$('export').textContent='Save image';}
  };
  $('fullscreen').onclick=async()=>{
    try {if(document.fullscreenElement) await document.exitFullscreen();else await document.querySelector('.scene-panel').requestFullscreen();}
    catch (error) {$('plot-error').textContent='Full screen is unavailable in this browser. You can open the HTML file in Edge or Chrome.';$('plot-error').hidden=false;}
  };
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';setTimeout(()=>Plotly.Plots.resize($('plot3d')),60);});
  function controlsOpen(open){document.querySelector('.controls').classList.toggle('controls-open',open);$('controls-toggle').setAttribute('aria-expanded',String(open));}
  $('controls-toggle').onclick=()=>controlsOpen($('controls-toggle').getAttribute('aria-expanded')!=='true');
  $('controls-close').onclick=()=>controlsOpen(false);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape')controlsOpen(false);});
  if (window.ResizeObserver) new ResizeObserver(()=>{if(initialized){Plotly.Plots.resize($('plot3d'));Plotly.Plots.resize($('plot2d'));}}).observe(document.querySelector('.scene-panel'));
  syncControls();draw();
})();
