/**
 * 核心配置变量 (需要在 Cloudflare 后台配置):
 * AZURE_TENANT_ID: 租户 ID
 * AZURE_CLIENT_ID: 客户端 ID
 * AZURE_CLIENT_SECRET: 客户端密钥
 * CF_TURNSTILE_SECRET: Turnstile Secret Key
 * TURNSTILE_SITE_KEY: Turnstile Site Key
 * DEFAULT_DOMAIN: 你的邮箱后缀 (不带@)
 * SKU_MAP: JSON字符串，映射前台名称到SKU ID。例: {"E5开发版":"你的SKU_ID_1", "A1教育版":"你的SKU_ID_2"}
 * ADMIN_TOKEN: 管理员访问密码
 * HIDDEN_USER: (可选) 隐藏的特权账户完整邮箱
 * ENABLE_DEBUG: (可选) 设置为 'true' 开启调试日志
 */

const debugLog = (env, ...args) => {
    if (env.ENABLE_DEBUG === 'true') console.log('[DEBUG]', ...args);
};

// --- 辅助函数：密码强度校验 (四选三) ---
function checkPasswordComplexity(pwd) {
    if (!pwd || pwd.length < 8) return false;
    let score = 0;
    if (/[a-z]/.test(pwd)) score++; // 小写
    if (/[A-Z]/.test(pwd)) score++; // 大写
    if (/\d/.test(pwd)) score++;    // 数字
    if (/[^a-zA-Z0-9]/.test(pwd)) score++; // 符号
    return score >= 3;
}

// --- 1. 前台注册页面 HTML ---
const HTML_REGISTER_PAGE = (siteKey, skuOptions) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Office 365 账号自助开通</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f3f2f1; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); width: 100%; max-width: 400px; text-align: center; }
        h2 { color: #323130; margin-bottom: 20px; font-weight: 600; }
        input, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #8a8886; border-radius: 4px; box-sizing: border-box; font-size: 14px; transition: border-color 0.2s; }
        input:focus, select:focus { border-color: #0078d4; outline: none; }
        button { width: 100%; padding: 12px; background-color: #0078d4; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 15px; transition: background-color 0.2s; }
        button:hover { background-color: #106ebe; }
        button:disabled { background-color: #c8c6c4; cursor: not-allowed; }
        .tips { font-size: 12px; color: #605e5c; text-align: left; margin-bottom: 5px; }
        .message { margin-top: 15px; font-size: 14px; padding: 10px; border-radius: 4px; display: none; word-break: break-all;}
        .error { background-color: #fde7e9; color: #a80000; }
        .success { background-color: #dff6dd; color: #107c10; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Office 365 自助开通</h2>
        <form id="regForm">
            <div class="tips">订阅类型</div>
            <select id="skuName">
                ${skuOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>

            <div class="tips">用户名 (仅允许字母和数字)</div>
            <input type="text" id="username" placeholder="输入用户名" required pattern="[a-zA-Z0-9]+">
            
            <div class="tips">密码 (8位以上，大写/小写/数字/符号 4选3，不可含用户名)</div>
            <input type="password" id="password" placeholder="设置密码" required>
            
            <div style="margin-top: 15px; display: flex; justify-content: center;">
                <div class="cf-turnstile" data-sitekey="${siteKey}"></div>
            </div>
            
            <button type="submit" id="btn">立即创建</button>
        </form>
        <div id="msg" class="message"></div>
    </div>
    <script>
        function checkComplexity(pwd) {
            let score = 0;
            if (/[a-z]/.test(pwd)) score++;
            if (/[A-Z]/.test(pwd)) score++;
            if (/\\d/.test(pwd)) score++;
            if (/[^a-zA-Z0-9]/.test(pwd)) score++;
            return score >= 3;
        }

        document.getElementById('regForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn');
            const msg = document.getElementById('msg');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (password.toLowerCase().includes(username.toLowerCase())) {
                msg.style.display = 'block'; msg.className = 'message error';
                msg.innerText = '❌ 密码不能包含用户名（或用户名的部分），请重新设置';
                return;
            }

            if (password.length < 8 || !checkComplexity(password)) {
                msg.style.display = 'block'; msg.className = 'message error';
                msg.innerText = '❌ 密码太简单：需8位以上，且包含大写、小写、数字、符号中的至少3种';
                return;
            }

            btn.disabled = true; btn.innerText = '正在创建中...'; msg.style.display = 'none';

            const formData = new FormData();
            formData.append('skuName', document.getElementById('skuName').value);
            formData.append('username', username);
            formData.append('password', password);
            formData.append('cf-turnstile-response', document.querySelector('[name="cf-turnstile-response"]').value);
            
            try {
                const res = await fetch('/', { method: 'POST', body: formData });
                const data = await res.json();
                msg.style.display = 'block';
                if (data.success) {
                    msg.className = 'message success';
                    msg.innerHTML = '✅ 成功！账号: ' + data.email + '<br>请前往 office.com 登录';
                    document.getElementById('regForm').reset();
                    if(typeof turnstile !== 'undefined') turnstile.reset();
                } else {
                    msg.className = 'message error';
                    msg.innerText = '❌ ' + data.message;
                    if(typeof turnstile !== 'undefined') turnstile.reset();
                }
            } catch (err) {
                msg.style.display = 'block'; msg.className = 'message error';
                msg.innerText = '网络错误，请稍后重试';
            } finally {
                btn.disabled = false; btn.innerText = '立即创建';
            }
        });
    </script>
</body>
</html>
`;

// --- 2. 后台管理页面 HTML ---
const HTML_ADMIN_PAGE = (skuMapJson) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Office 365 用户管理</title>
    <style>
        body { font-family: "Segoe UI", sans-serif; padding: 20px; background: #f0f2f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { margin-top: 0; color: #333; }
        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;}
        .btn-refresh { background: #0078d4; color: white; }
        .btn-del { background: #d93025; color: white; }
        .btn-pwd { background: #f0ad4e; color: white; }
        .btn-lic { background: #00897b; color: white; } /* 新增按钮样式 */
        .btn-lic:hover { background: #00695c; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; cursor: pointer; user-select: none; white-space: nowrap;}
        th:hover { background: #e9ecef; }
        
        .modal { display: none; position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000;}
        .modal-content { background: white; padding: 25px; border-radius: 8px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto;}
        .close { float: right; cursor: pointer; font-size: 24px; color: #666;}
        .close:hover { color: #000; }
        
        .loading { text-align: center; padding: 20px; color: #666; }
        input[type="checkbox"] { transform: scale(1.2); }
        .tag { padding: 2px 6px; border-radius: 4px; font-size: 12px; background: #eee; color: #555; display:inline-block; margin:2px;}
        .tag-blue { background: #e0f7fa; color: #006064; }
        .arrow { display: inline-block; width: 15px; text-align: center; }

        /* 许可证表格样式 */
        #licTable { width: 100%; margin-top: 15px; }
        #licTable th { background: #eee; }
        .progress-bar { background: #e0e0e0; border-radius: 4px; height: 8px; width: 100px; display: inline-block; overflow: hidden; vertical-align: middle; margin-left: 10px;}
        .progress-fill { height: 100%; background: #0078d4; }
        .lic-id { font-size: 12px; color: #888; display: block; margin-top: 2px;}
    </style>
</head>
<body>
    <div class="container">
        <h1>用户管理控制台</h1>
        <div class="toolbar">
            <button class="btn-refresh" onclick="loadUsers()">刷新列表</button>
            <button class="btn-lic" onclick="openLicModal()">查询订阅用量</button> <button class="btn-pwd" onclick="openPwdModal()">修改/重置密码</button>
            <button class="btn-del" onclick="bulkDelete()">批量删除</button>
        </div>
        <div id="status" style="margin-bottom:10px; height:20px; color:green;"></div>
        <table id="mainTable">
            <thead>
                <tr>
                    <th width="40"><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
                    <th onclick="sortTable('displayName')">用户名 <span id="sort-displayName" class="arrow"></span></th>
                    <th onclick="sortTable('userPrincipalName')">账号(邮箱) <span id="sort-userPrincipalName" class="arrow"></span></th>
                    <th>当前订阅</th>
                    <th onclick="sortTable('createdDateTime')">创建时间 <span id="sort-createdDateTime" class="arrow"></span></th>
                    <th>ID</th>
                </tr>
            </thead>
            <tbody id="userTableBody"></tbody>
        </table>
        <div class="loading" id="loading">加载中...</div>
    </div>

    <div id="pwdModal" class="modal">
        <div class="modal-content" style="width: 400px;">
            <span class="close" onclick="closeModal('pwdModal')">&times;</span>
            <h3>重置密码</h3>
            <div>
                <label><input type="radio" name="pwdType" value="auto" checked onclick="togglePwdInput(false)"> 自动生成密码</label>
                <br><br>
                <label><input type="radio" name="pwdType" value="custom" onclick="togglePwdInput(true)"> 自定义密码</label>
            </div>
            <input type="text" id="customPwd" placeholder="输入新密码" style="width:100%; margin-top:10px; padding:8px; display:none;">
            <div style="margin-top:20px; text-align:right;">
                <button class="btn-pwd" onclick="submitPwdReset()">确认重置</button>
            </div>
            <div id="pwdResult" style="margin-top:10px; font-size:12px; color:blue; word-break:break-all;"></div>
        </div>
    </div>

    <div id="licModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeModal('licModal')">&times;</span>
            <h3>订阅许可证概览</h3>
            <div id="licLoading" style="display:none; text-align:center;">正在查询 Microsoft Graph...</div>
            <table id="licTable">
                <thead>
                    <tr>
                        <th>订阅名称 / SKU ID</th>
                        <th>总数</th>
                        <th>已用</th>
                        <th>剩余</th>
                    </tr>
                </thead>
                <tbody id="licBody"></tbody>
            </table>
        </div>
    </div>

    <script>
        const RAW_MAP = ${skuMapJson || '{}'};
        const ID_TO_NAME = {};
        for(let key in RAW_MAP) ID_TO_NAME[RAW_MAP[key]] = key;

        let allUsers = [];
        const API_BASE = '/admin/api';

        // --- 用户列表逻辑 ---
        async function loadUsers() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('userTableBody').innerHTML = '';
            resetSortIcons();
            try {
                const res = await fetch(API_BASE + '/users?token=' + getToken());
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error ? data.error.message : 'API Error');
                if (!Array.isArray(data.value)) throw new Error('API 响应格式错误');
                allUsers = data.value;
                renderTable(allUsers);
            } catch (e) { alert('加载失败: ' + e.message); } 
            finally { document.getElementById('loading').style.display = 'none'; }
        }

        function renderTable(users) {
            const tbody = document.getElementById('userTableBody');
            tbody.innerHTML = users.map(u => {
                let licenses = '无订阅';
                if (u.assignedLicenses && u.assignedLicenses.length > 0) {
                    licenses = u.assignedLicenses.map(l => {
                        const name = ID_TO_NAME[l.skuId] || l.skuId;
                        return \`<span class="tag tag-blue">\${name}</span>\`;
                    }).join('');
                }
                return \`
                <tr>
                    <td><input type="checkbox" class="u-check" value="\${u.id}" data-name="\${u.userPrincipalName}"></td>
                    <td>\${u.displayName}</td>
                    <td>\${u.userPrincipalName}</td>
                    <td>\${licenses}</td>
                    <td>\${new Date(u.createdDateTime).toLocaleString()}</td>
                    <td style="font-size:10px; color:#999;">\${u.id}</td>
                </tr>\`;
            }).join('');
        }

        let sortConfig = { key: null, dir: 1 };
        function sortTable(key) {
            if (sortConfig.key === key) sortConfig.dir *= -1;
            else sortConfig = { key: key, dir: 1 };

            resetSortIcons();
            document.getElementById('sort-' + key).innerText = sortConfig.dir === 1 ? '↑' : '↓';

            allUsers.sort((a, b) => {
                let valA = a[key] || '';
                let valB = b[key] || '';
                if (typeof valA === 'string') return sortConfig.dir * valA.localeCompare(valB, 'zh-CN'); 
                return valA > valB ? sortConfig.dir : -sortConfig.dir;
            });
            renderTable(allUsers);
        }

        function resetSortIcons() {
            ['displayName', 'userPrincipalName', 'createdDateTime'].forEach(k => {
                const el = document.getElementById('sort-' + k);
                if(el) el.innerText = ''; 
            });
        }

        function getToken() { return new URLSearchParams(window.location.search).get('token') || prompt('请输入管理员 Token:'); }
        function toggleAll(source) { document.querySelectorAll('.u-check').forEach(c => c.checked = source.checked); }
        function getSelected() { return Array.from(document.querySelectorAll('.u-check:checked')).map(c => ({id: c.value, name: c.getAttribute('data-name')})); }

        async function bulkDelete() {
            const selected = getSelected();
            if (selected.length === 0) return alert('请先选择用户');
            if (!confirm(\`确定要删除选中的 \${selected.length} 个用户吗？\n此操作不可恢复！\`)) return;
            document.getElementById('status').innerText = '正在删除...';
            for (const u of selected) {
                try {
                    const res = await fetch(API_BASE + '/users/' + u.id + '?token=' + getToken(), { method: 'DELETE' });
                    if(res.status === 403) console.error(u.name + ' 删除失败: 受保护的账户');
                } catch(e) {}
            }
            document.getElementById('status').innerText = '操作结束';
            loadUsers();
        }

        // --- 模态框通用逻辑 ---
        function closeModal(id) { document.getElementById(id).style.display = 'none'; }
        
        // --- 密码相关 ---
        function openPwdModal() { 
            if (getSelected().length === 0) return alert('请先选择用户'); 
            document.getElementById('pwdModal').style.display = 'flex'; 
            document.getElementById('pwdResult').innerText = ''; 
        }
        function togglePwdInput(show) { document.getElementById('customPwd').style.display = show ? 'block' : 'none'; }
        
        function generatePass() {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
            let pass = ""; 
            for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
            return pass + "Aa1!"; 
        }

        async function submitPwdReset() {
            const selected = getSelected();
            const type = document.querySelector('input[name="pwdType"]:checked').value;
            let password = (type === 'custom') ? document.getElementById('customPwd').value : '';
            if (type === 'custom' && !password) return alert('请输入密码');
            
            document.getElementById('pwdResult').innerText = '正在处理...';
            let successList = [];
            for (const u of selected) {
                const finalPwd = (type === 'auto') ? generatePass() : password;
                try {
                    await fetch(API_BASE + '/users/' + u.id + '/password?token=' + getToken(), {
                        method: 'PATCH',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ password: finalPwd })
                    });
                    successList.push(\`\${u.name} -> \${finalPwd}\`);
                } catch(e) {}
            }
            document.getElementById('pwdResult').innerHTML = '操作完成。<br><b>新密码列表:</b><br>' + successList.join('<br>');
        }

        // --- 许可证查询相关 (新增) ---
        async function openLicModal() {
            document.getElementById('licModal').style.display = 'flex';
            document.getElementById('licBody').innerHTML = '';
            document.getElementById('licLoading').style.display = 'block';

            try {
                const res = await fetch(API_BASE + '/licenses?token=' + getToken());
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.error || 'Fetch Error');
                
                // 渲染许可证表格
                document.getElementById('licBody').innerHTML = data.map(lic => {
                    const friendlyName = ID_TO_NAME[lic.skuId] ? 
                        \`<span style="font-weight:bold; color:#0078d4">\${ID_TO_NAME[lic.skuId]}</span>\` : 
                        lic.skuPartNumber;
                        
                    const usagePercent = lic.total > 0 ? Math.round((lic.used / lic.total) * 100) : 0;
                    const remaining = lic.total - lic.used;
                    
                    return \`
                    <tr>
                        <td>
                            \${friendlyName}
                            <span class="lic-id">\${lic.skuId}</span>
                        </td>
                        <td>\${lic.total}</td>
                        <td>
                            \${lic.used}
                            <div class="progress-bar" title="\${usagePercent}%">
                                <div class="progress-fill" style="width: \${usagePercent}%"></div>
                            </div>
                        </td>
                        <td style="color: \${remaining < 5 ? 'red' : 'green'}; font-weight:bold;">
                            \${remaining}
                        </td>
                    </tr>
                    \`;
                }).join('');

            } catch(e) {
                document.getElementById('licBody').innerHTML = \`<tr><td colspan="4" style="color:red; text-align:center;">查询失败: \${e.message}</td></tr>\`;
            } finally {
                document.getElementById('licLoading').style.display = 'none';
            }
        }

        if(window.location.search.includes('token=')) loadUsers();
    </script>
</body>
</html>
`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // --- A. 后台管理路由 (/admin) ---
        if (url.pathname.startsWith('/admin')) {
            const token = url.searchParams.get('token');
            if (token !== env.ADMIN_TOKEN) {
                return new Response('401 Unauthorized', { status: 401 });
            }

            if (url.pathname === '/admin' || url.pathname === '/admin/') {
                return new Response(HTML_ADMIN_PAGE(env.SKU_MAP), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
            }

            // API: 获取许可证列表 (新增)
            if (url.pathname === '/admin/api/licenses' && request.method === 'GET') {
                const accessToken = await getAccessToken(env);
                const resp = await fetch('https://graph.microsoft.com/v1.0/subscribedSkus', {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                const data = await resp.json();
                
                // 格式化数据返回给前端
                const result = data.value ? data.value.map(s => ({
                    skuPartNumber: s.skuPartNumber, 
                    skuId: s.skuId,                 
                    total: s.prepaidUnits.enabled,  
                    used: s.consumedUnits           
                })) : [];
                
                return new Response(JSON.stringify(result), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
            }

            // API: 获取用户列表
            if (url.pathname === '/admin/api/users' && request.method === 'GET') {
                const accessToken = await getAccessToken(env);
                const graphUrl = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,createdDateTime,assignedLicenses&$top=100&$orderby=createdDateTime desc&$count=true';
                debugLog(env, 'Fetching users from:', graphUrl);

                const resp = await fetch(graphUrl, { 
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'ConsistencyLevel': 'eventual' } 
                });
                
                const data = await resp.json();
                
                // 隐藏账户过滤
                if (data.value && env.HIDDEN_USER) {
                    data.value = data.value.filter(u => u.userPrincipalName.toLowerCase() !== env.HIDDEN_USER.toLowerCase());
                }
                
                return new Response(JSON.stringify(data), { status: resp.status, headers: { 'Content-Type': 'application/json' } });
            }

            // API: 删除用户
            if (url.pathname.match(/\/admin\/api\/users\/[^/]+$/) && request.method === 'DELETE') {
                const userId = url.pathname.split('/').pop();
                const accessToken = await getAccessToken(env);

                if (env.HIDDEN_USER) {
                    const checkResp = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}?$select=userPrincipalName`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    if (checkResp.ok) {
                        const checkUser = await checkResp.json();
                        if (checkUser.userPrincipalName.toLowerCase() === env.HIDDEN_USER.toLowerCase()) {
                            return new Response(JSON.stringify({error: 'Forbidden'}), { status: 403 });
                        }
                    }
                }
                const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                return new Response(null, { status: resp.status });
            }

            // API: 重置密码
            if (url.pathname.endsWith('/password') && request.method === 'PATCH') {
                const userId = url.pathname.split('/')[4]; 
                const body = await request.json();
                const accessToken = await getAccessToken(env);
                
                if (env.HIDDEN_USER) {
                     const checkResp = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}?$select=userPrincipalName`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    if (checkResp.ok && (await checkResp.json()).userPrincipalName.toLowerCase() === env.HIDDEN_USER.toLowerCase()) {
                        return new Response(JSON.stringify({error: 'Forbidden'}), { status: 403 });
                    }
                }

                const payload = { passwordProfile: { forceChangePasswordNextSignIn: false, password: body.password } };
                const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                return new Response(null, { status: resp.status });
            }
        }

        // --- B. 前台注册路由 ---
        if (request.method === 'GET') {
            let skuOptions = [];
            try {
                const map = JSON.parse(env.SKU_MAP || '{}');
                skuOptions = Object.keys(map);
            } catch (e) { return new Response('Config Error: SKU_MAP is invalid', {status:500}); }
            
            return new Response(HTML_REGISTER_PAGE(env.TURNSTILE_SITE_KEY, skuOptions), {
                headers: { 'Content-Type': 'text/html;charset=UTF-8' },
            });
        }

        if (request.method === 'POST') {
            try {
                const formData = await request.formData();
                const username = formData.get('username');
                const password = formData.get('password');
                const skuName = formData.get('skuName'); 
                const turnstileToken = formData.get('cf-turnstile-response');
                const ip = request.headers.get('CF-Connecting-IP');

                debugLog(env, 'Register attempt:', username, ip);

                const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret: env.CF_TURNSTILE_SECRET, response: turnstileToken, remoteip: ip })
                });
                if (!(await verifyRes.json()).success) return Response.json({ success: false, message: '人机验证失败' });

                let skuId = null;
                try { skuId = JSON.parse(env.SKU_MAP || '{}')[skuName]; } catch(e){}
                if (!skuId) return Response.json({ success: false, message: '无效的订阅类型' });

                if (!/^[a-zA-Z0-9]+$/.test(username)) return Response.json({ success: false, message: '用户名格式错误' });
                
                // 后端二次校验
                if (password.toLowerCase().includes(username.toLowerCase())) {
                    return Response.json({ success: false, message: '密码不能包含用户名（或用户名的部分）' });
                }
                if (!checkPasswordComplexity(password)) {
                    return Response.json({ success: false, message: '密码需包含大小写/数字/符号中的至少3种' });
                }

                const accessToken = await getAccessToken(env);
                const userEmail = `${username}@${env.DEFAULT_DOMAIN}`;

                if (env.HIDDEN_USER && userEmail.toLowerCase() === env.HIDDEN_USER.toLowerCase()) {
                     return Response.json({ success: false, message: '该用户名已被占用' });
                }

                const userPayload = {
                    accountEnabled: true,
                    displayName: username,
                    mailNickname: username,
                    userPrincipalName: userEmail,
                    passwordProfile: { forceChangePasswordNextSignIn: false, password: password },
                    usageLocation: "CN" 
                };
                
                const createReq = await fetch('https://graph.microsoft.com/v1.0/users', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(userPayload)
                });

                if (!createReq.ok) {
                    const err = await createReq.json();
                    debugLog(env, 'Create User Error:', err);
                    
                    const errMsg = err.error?.message || '';
                    if (errMsg.includes('another object')) return Response.json({ success: false, message: '该用户名已被占用' });
                    if (errMsg.includes('Password cannot contain username')) return Response.json({ success: false, message: '创建失败：密码不能包含用户名' });
                    if (errMsg.includes('PasswordProfile') || errMsg.includes('weak')) return Response.json({ success: false, message: '创建失败：密码过于简单或不符合策略' });

                    throw new Error(errMsg);
                }

                const newUser = await createReq.json();

                const licenseReq = await fetch(`https://graph.microsoft.com/v1.0/users/${newUser.id}/assignLicense`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        addLicenses: [{ disabledPlans: [], skuId: skuId }],
                        removeLicenses: []
                    })
                });

                if (!licenseReq.ok) {
                    const licErr = await licenseReq.json();
                    return Response.json({ success: false, message: '账号创建成功但订阅分配失败: ' + licErr.error.message });
                }

                return Response.json({ success: true, email: userEmail });
            } catch (e) {
                return Response.json({ success: false, message: '系统错误: ' + e.message });
            }
        }

        return new Response('Method Not Allowed', { status: 405 });
    }
};

async function getAccessToken(env) {
    const params = new URLSearchParams();
    params.append('client_id', env.AZURE_CLIENT_ID);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('client_secret', env.AZURE_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');

    const res = await fetch(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        body: params
    });
    const data = await res.json();
    return data.access_token;
}
