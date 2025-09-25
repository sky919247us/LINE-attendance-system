// =================================================================
//                    前端腳本 (V2 - CORS Fetch 版)
// =================================================================
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

    // API 呼叫函式 (改為 Fetch)
    async function callApi(action, params = {}) {
        const url = new URL(GAS_URL);
        url.searchParams.append('action', action);
        
        const token = localStorage.getItem('sessionToken');
        if (token) {
            params.token = token;
        }
        
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`網路回應錯誤: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.ok) {
                return data;
            } else {
                // 將後端回傳的錯誤訊息拋出
                throw new Error(data.message || '後端回報了一個錯誤');
            }
        } catch (error) {
            // 捕捉網路層級或解析層級的錯誤
            console.error('API 呼叫失敗:', error);
            throw error;
        }
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
            document.getElementById('profile-img').src = userState.picture || 'https://placehold.co/40x40';
            document.getElementById('user-role').textContent = userState.role === 'Admin' ? '管理員' : '員工';
            
            if (userState.role === 'Admin') {
                document.getElementById('admin-panel-toggle').style.display = 'block';
            } else {
                document.getElementById('admin-panel-toggle').style.display = 'none';
            }
            
            storeSelector.innerHTML = '<option value="">-- 請選擇店家 --</option>';
            userState.allowedStores.forEach(storeId => {
                const option = document.createElement('option');
                option.value = storeId;
                option.textContent = storeId;
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
            if (error.message.includes('Session expired')) {
                // Session 過期是正常情況，不用特別提示
            } else {
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

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            const response = await callApi('punch', {
                storeId,
                punchType,
                latitude,
                longitude,
                userAgent: navigator.userAgent
            });
            showNotification(response.message, 'success');
        } catch (error) {
            showNotification(`打卡失敗: ${error.message}`, 'error');
        } finally {
            punchInBtn.disabled = false;
            punchOutBtn.disabled = false;
        }
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
    
    adminToggleLink.addEventListener('click', (e) => { e.preventDefault(); dashboardView.style.display = 'none'; adminView.style.display = 'block'; });
    backToDashboard.addEventListener('click', (e) => { e.preventDefault(); dashboardView.style.display = 'block'; adminView.style.display = 'none'; });
    
    // 從 URL 取得 token (LINE 登入回呼後)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
        localStorage.setItem('sessionToken', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 啟動應用
    checkUserSession();
});
