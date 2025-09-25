document.addEventListener('DOMContentLoaded', () => {
    // !! 重要 !! 請將此處替換為您在 Part 1 步驟 4 部署後取得的網址
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbwUZ5YYJU4Xv6qSEYyLZLM6RdDBVp0f_XO7gFnneIEQjs3cVh_Ntc4iOi0STM4-5HmQkw/exec';

    // UI 元素
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const adminView = document.getElementById('admin-view');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const appHeader = document.getElementById('app-header');
    const storeSelector = document.getElementById('store-selector');
    const punchInBtn = document.getElementById('punch-in-btn');
    const punchOutBtn = document.getElementById('punch-out-btn');
    const adminToggleLink = document.getElementById('admin-toggle-link');
    const backToDashboard = document.getElementById('back-to-dashboard');
    
    let userState = null;

    // API 呼叫函式
    function callApi(action, params = {}) {
        return new Promise((resolve, reject) => {
            const token = localStorage.getItem('sessionToken');
            if (token) {
                params.token = token;
            }
            
            const url = new URL(GAS_URL);
            url.searchParams.append('action', action);
            for (const key in params) {
                url.searchParams.append(key, params[key]);
            }
            url.searchParams.append('callback', 'jsonpCallback');

            const script = document.createElement('script');
            
            window.jsonpCallback = (response) => {
                document.body.removeChild(script);
                delete window.jsonpCallback;
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(response);
                }
            };

            script.src = url.toString();
            script.onerror = () => {
                document.body.removeChild(script);
                delete window.jsonpCallback;
                reject({ code: 'NETWORK_ERROR', message: '網路連線失敗' });
            };

            document.body.appendChild(script);
        });
    }

    // 顯示通知
    function showNotification(message, type = 'success', duration = 3000) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), duration);
    }

    // 更新 UI 狀態
    function updateUI() {
        if (userState) {
            loginView.style.display = 'none';
            dashboardView.style.display = 'block';
            adminView.style.display = 'none';
            appHeader.style.display = 'flex';
            
            document.getElementById('user-name').textContent = userState.userName;
            document.getElementById('profile-img').src = userState.picture || 'https://placehold.co/40x40'; // Fallback
            document.getElementById('user-role').textContent = userState.role === 'Admin' ? '管理員' : '員工';
            
            if (userState.role === 'Admin') {
                document.getElementById('admin-panel-toggle').style.display = 'block';
            }
            
            // 填充店家選單
            storeSelector.innerHTML = '<option value="">-- 請選擇店家 --</option>';
            userState.allowedStores.forEach(storeId => {
                const option = document.createElement('option');
                option.value = storeId;
                option.textContent = storeId; // 這裡可以擴充為顯示店家全名
                storeSelector.appendChild(option);
            });

        } else {
            loginView.style.display = 'block';
            dashboardView.style.display = 'none';
            adminView.style.display = 'none';
            appHeader.style.display = 'none';
        }
    }
    
    // 檢查 Session
    async function checkUserSession() {
        const token = localStorage.getItem('sessionToken');
        if (!token) {
            updateUI();
            return;
        }
        
        try {
            const response = await callApi('checkSession');
            userState = response.user;
        } catch (error) {
            localStorage.removeItem('sessionToken');
            userState = null;
            if (error.code !== 'SESSION_EXPIRED') {
                showNotification(`登入驗證失敗: ${error.message}`, 'error');
            }
        }
        updateUI();
    }

    // 打卡
    async function handlePunch(punchType) {
        const storeId = storeSelector.value;
        if (!storeId) {
            showNotification('請先選擇店家', 'error');
            return;
        }
        
        showNotification('正在取得 GPS 位置...', 'success');
        punchInBtn.disabled = true;
        punchOutBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
                const response = await callApi('punch', {
                    storeId,
                    punchType,
                    latitude,
                    longitude,
                    ip: 'N/A', // IP 獲取較複雜，暫不實作
                    userAgent: navigator.userAgent
                });
                showNotification(response.message, 'success');
            } catch (error) {
                showNotification(`打卡失敗: ${error.message}`, 'error');
            } finally {
                punchInBtn.disabled = false;
                punchOutBtn.disabled = false;
            }

        }, (error) => {
            showNotification(`無法取得GPS位置: ${error.message}`, 'error');
            punchInBtn.disabled = false;
            punchOutBtn.disabled = false;
        });
    }

    // 事件監聽
    loginBtn.addEventListener('click', async () => {
        try {
            const response = await callApi('getLoginUrl');
            window.location.href = response.url;
        } catch (error) {
            showNotification('無法取得登入網址，請稍後再試', 'error');
        }
    });
    
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('sessionToken');
        userState = null;
        updateUI();
        showNotification('您已成功登出', 'success');
    });

    storeSelector.addEventListener('change', () => {
        document.getElementById('punch-buttons').style.display = storeSelector.value ? 'grid' : 'none';
    });

    punchInBtn.addEventListener('click', () => handlePunch('上班'));
    punchOutBtn.addEventListener('click', () => handlePunch('下班'));

    adminToggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        dashboardView.style.display = 'none';
        adminView.style.display = 'block';
    });
    
    backToDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        dashboardView.style.display = 'block';
        adminView.style.display = 'none';
    });
    
    // LINE 登入回呼處理
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token')) {
        localStorage.setItem('sessionToken', urlParams.get('token'));
        // 清理 URL，避免 token 殘留
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 啟動應用
    checkUserSession();

});
