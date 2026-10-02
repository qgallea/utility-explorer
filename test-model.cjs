const assert = require('node:assert/strict');
const M = require('./model.js');
const base = {model:'cobb',alpha:0.5,rho:-0.5,scale:1,income:10,px:1,py:1};
const close = (actual,expected,tolerance=1e-8) => assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
let cases=0, contourPoints=0;
close(M.optimum(base).x,5);close(M.optimum(base).y,5);close(M.optimum(base).u,5);
close(M.optimum({...base,alpha:0.3,px:2,py:4,income:40}).x,6);
close(M.optimum({...base,alpha:0.3,px:2,py:4,income:40}).y,7);
assert.equal(M.optimum({...base,model:'linear'}).kind,'multiple');
assert.equal(M.optimum({...base,model:'linear',px:2}).x,0);
assert.equal(M.optimum({...base,model:'linear',py:2}).y,0);
close(M.optimum({...base,model:'quasi',alpha:0.8}).x,3);
close(M.optimum({...base,model:'quasi',alpha:0.8}).y,7);
for(const model of ['cobb','ces','linear','leontief','quasi']) {
  for(const alpha of [0.05,0.3,0.5,0.8,0.95]) {
    for(const [px,py,income] of [[1,1,10],[0.5,3,18],[4,0.2,1],[20,0.1,100],[0.1,20,100]]) {
      for(const rho of model==='ces'?[-3,-0.5,0,0.5,0.95]:[-0.5]) {
        const s={...base,model,alpha,px,py,income,rho};
        const o=M.optimum(s);
        assert.ok(Number.isFinite(o.u) && o.x>=0 && o.y>=0);
        close(o.cost,income);
        if (['cobb','ces'].includes(model)) close(M.mrs(o.x,o.y,s),px/py,1e-7);
        // Independent exhaustive numerical search on the binding budget line.
        for(let i=0;i<=3000;i++) {
          const x=income/px*i/3000, y=Math.max(0,(income-px*x)/py);
          const candidate=M.utility(x,y,s);
          assert.ok(candidate<=o.u+1e-8*Math.max(1,o.u),JSON.stringify({s,o,x,y,candidate}));
        }
        const scaled=M.optimum({...s,scale:3.7});
        close(scaled.x,o.x);close(scaled.y,o.y);close(scaled.u,o.u*3.7);
        const xmax=1.12*income/px,ymax=1.12*income/py;
        for(const multiplier of [0,0.4,1,1.3]) {
          const level=o.u*multiplier, points=M.contour(level,s,xmax,ymax);
          if(multiplier===1) assert.ok(points.length>0,JSON.stringify(s));
          for(const [x,y] of points) {
            assert.ok(x>=0 && x<=xmax+1e-7 && y>=0 && y<=ymax+1e-7);
            close(M.utility(x,y,s),level,1e-6);contourPoints++;
          }
        }
        cases++;
      }
    }
  }
}
console.log(`Passed ${cases} parameter cases: budget feasibility, global optimum vs grid search, scale invariance, and ${contourPoints} IC point checks.`);
