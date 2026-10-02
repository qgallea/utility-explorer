// Bundle local assets into a portable, offline HTML file. No package installation needed.
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname,name),'utf8');
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>');
html=html.replace('<head>',()=>'<head>\n<!-- Bundled Plotly.js license:\n'+read('vendor/LICENSE-plotly.txt')+'\n-->');
for(const file of ['vendor/plotly-3.1.0.min.js','model.js','app.js']) {
  html=html.replace(`<script src="${file}"></script>`,()=>'<script>'+read(file).replace(/<\/script/gi,'<\\/script')+'</script>');
}
fs.writeFileSync(path.join(__dirname,'Utility Explorer.html'),html);
console.log('Built Utility Explorer.html ('+(Buffer.byteLength(html)/1e6).toFixed(2)+' MB).');
