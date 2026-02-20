import type { FastifyInstance } from "fastify";

export function registerUiRoutes(server: FastifyInstance) {
  server.get("/", async (_request, reply) => {
    reply.type("text/html").send(dashboardHtml());
  });
}

function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>fruitctl Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f5f7;color:#1d1d1f;padding:16px}
h1{font-size:1.5rem;font-weight:600;margin-bottom:12px}
h2{font-size:1.1rem;font-weight:600;margin-bottom:8px;color:#86868b}
.container{max-width:640px;margin:0 auto}
.token-bar{background:#fff;border-radius:12px;padding:12px 16px;margin-bottom:20px;display:flex;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.token-bar input{flex:1;border:1px solid #d2d2d7;border-radius:8px;padding:8px 12px;font-size:14px;outline:none}
.token-bar input:focus{border-color:#0071e3}
.token-bar button{background:#0071e3;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;white-space:nowrap}
.token-bar button:hover{background:#0077ed}
.card{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.title{font-weight:600;font-size:15px;margin-bottom:4px}
.meta{font-size:13px;color:#86868b;margin-bottom:8px}
.params{font-size:13px;color:#6e6e73;background:#f5f5f7;border-radius:8px;padding:8px 12px;margin-bottom:12px;word-break:break-all}
.actions{display:flex;gap:8px}
.actions button{flex:1;border:none;border-radius:8px;padding:10px;font-size:14px;font-weight:500;cursor:pointer;color:#fff}
.btn-approve{background:#34c759}
.btn-approve:hover{background:#2db84e}
.btn-reject{background:#ff3b30}
.btn-reject:hover{background:#e6342b}
.status{display:inline-block;font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px;text-transform:uppercase}
.status-approved{background:#e8f8ed;color:#34c759}
.status-rejected{background:#fce8e6;color:#ff3b30}
.status-expired{background:#f0f0f0;color:#86868b}
.empty{text-align:center;color:#86868b;padding:24px;font-size:14px}
#error{color:#ff3b30;font-size:14px;margin-bottom:12px;display:none}
</style>
</head>
<body>
<div class="container">
<h1>fruitctl Dashboard</h1>
<div class="token-bar">
<input type="password" id="token-input" placeholder="Paste JWT token">
<button onclick="saveToken()">Save</button>
</div>
<div id="error"></div>
<h2>Pending Proposals</h2>
<div id="pending"><div class="empty">No pending proposals</div></div>
<h2 style="margin-top:20px">History</h2>
<div id="history"><div class="empty">No resolved proposals</div></div>
</div>
<script>
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function saveToken(){var v=document.getElementById('token-input').value;if(v){localStorage.setItem('fruitctl_token',v);document.getElementById('token-input').value='';fetchProposals()}}
function getToken(){return localStorage.getItem('fruitctl_token')||''}
function renderCard(p,isPending){var h='<div class="card"><div class="title">'+esc(p.adapter)+':'+esc(p.action)+'</div>';var d=p.createdAt?new Date(p.createdAt).toLocaleString():'';h+='<div class="meta">'+esc(d)+'</div>';h+='<div class="params">'+esc(JSON.stringify(p.params))+'</div>';if(isPending){h+='<div class="actions"><button class="btn-approve" onclick="decide(\\''+esc(p.id)+'\\',\\'approve\\')">Approve</button><button class="btn-reject" onclick="decide(\\''+esc(p.id)+'\\',\\'reject\\')">Reject</button></div>'}else{h+='<div><span class="status status-'+esc(p.status)+'">'+esc(p.status)+'</span></div>'}h+='</div>';return h}
function fetchProposals(){var t=getToken();if(!t){return}fetch('/proposals',{headers:{Authorization:'Bearer '+t}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(data){var items=data.items||[];var pe='';var hi='';for(var i=0;i<items.length;i++){if(items[i].status==='pending'){pe+=renderCard(items[i],true)}else{hi+=renderCard(items[i],false)}}document.getElementById('pending').innerHTML=pe||'<div class="empty">No pending proposals</div>';document.getElementById('history').innerHTML=hi||'<div class="empty">No resolved proposals</div>';document.getElementById('error').style.display='none'}).catch(function(e){document.getElementById('error').textContent=e.message;document.getElementById('error').style.display='block'})}
function decide(id,action){var t=getToken();fetch('/proposals/'+id+'/'+action,{method:'POST',headers:{Authorization:'Bearer '+t}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);fetchProposals()}).catch(function(e){document.getElementById('error').textContent=e.message;document.getElementById('error').style.display='block'})}
if(getToken())fetchProposals();
setInterval(function(){if(getToken())fetchProposals()},5000);
</script>
</body>
</html>`;
}
