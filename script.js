// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Convex Configuration Check ---
    if (window.CONVEX_CONFIG_ERROR || typeof CONVEX_URL === 'undefined' || !CONVEX_URL) {
        console.error("Convex configuration missing. Ensure config.js is loaded and CONVEX_URL is set.");
        const errorScreen = document.getElementById('setup-error-screen');
        if (errorScreen) {
            errorScreen.classList.remove('hidden');
        }
        return; // Prevent initialization
    }

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered successfully:', reg.scope))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // Initialize Convex Client
    let convexClient;
    try {
        if (typeof convex === 'undefined' || !convex.ConvexClient) {
            throw new Error("Convex SDK not loaded.");
        }
        convexClient = new convex.ConvexClient(CONVEX_URL);
    } catch (e) {
        console.error("Error initializing Convex Client:", e);
        const notificationArea = document.getElementById('notification-area');
        if (notificationArea) {
            notificationArea.innerHTML = `<div class="notification error show" style="transform: translateX(0); opacity: 1;"><i class="fas fa-exclamation-circle"></i> Error initializing Convex. Please try again later.</div>`;
        }
        return;
    }
    
    let currentUser = null; 
    let sessionToken = localStorage.getItem('snipvault_session_token');
    let snippetsUnsubscribe = null; 
    let categoriesUnsubscribe = null; 

    // --- IndexedDB Configuration for Offline Snippets ---
    const DB_NAME = 'SnipVaultOfflineDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'offline_snippets';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveOfflineSnippet(snippet) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.add(snippet);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.error('Failed to open IndexedDB:', err);
        }
    }

    async function getOfflineSnippets() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.error('Failed to get snippets from IndexedDB:', err);
            return [];
        }
    }

    async function deleteOfflineSnippet(id) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.error('Failed to delete from IndexedDB:', err);
        }
    }

    // --- Offline UX Banner Animation Controls ---
    function showOfflineBanner(text = "Sync Paused - Offline Mode", isSyncing = false) {
        const banner = document.getElementById('offline-sync-banner');
        const bannerText = document.getElementById('offline-sync-text');
        if (!banner || !bannerText) return;
        
        bannerText.textContent = text;
        
        const indicatorDot = banner.querySelector('.relative.inline-flex.rounded-full');
        const pingDot = banner.querySelector('.animate-ping');
        const icon = banner.querySelector('i');
        
        if (isSyncing) {
            banner.className = banner.className.replace('text-yellow-800', 'text-indigo-800').replace('border-yellow-200', 'border-indigo-200');
            if (indicatorDot) {
                indicatorDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500";
            }
            if (pingDot) {
                pingDot.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75";
            }
            if (icon) {
                icon.className = "fas fa-spinner animate-spin text-indigo-600";
            }
        } else {
            banner.className = banner.className.replace('text-indigo-800', 'text-yellow-800').replace('border-indigo-200', 'border-yellow-200');
            if (indicatorDot) {
                indicatorDot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500";
            }
            if (pingDot) {
                pingDot.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75";
            }
            if (icon) {
                icon.className = "fas fa-wifi-slash text-yellow-600";
            }
        }

        banner.classList.remove('hidden');
        setTimeout(() => {
            banner.classList.remove('-translate-y-10', 'opacity-0');
            banner.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    }

    function hideOfflineBanner() {
        const banner = document.getElementById('offline-sync-banner');
        if (!banner) return;
        banner.classList.remove('translate-y-0', 'opacity-100');
        banner.classList.add('-translate-y-10', 'opacity-0');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 300);
    }

    let isSyncingOfflineData = false;

    async function syncOfflineSnippets() {
        if (isSyncingOfflineData) return;
        if (!navigator.onLine) {
            showOfflineBanner();
            return;
        }

        // Must have valid sessionToken and NOT be in guest mode to sync to cloud
        if (!sessionToken || sessionToken === "guest") {
            hideOfflineBanner();
            return;
        }

        const offlineSnippets = await getOfflineSnippets();
        const userOfflineSnippets = offlineSnippets.filter(s => s.token === sessionToken);

        if (userOfflineSnippets.length === 0) {
            hideOfflineBanner();
            return;
        }

        isSyncingOfflineData = true;
        showOfflineBanner(`Syncing ${userOfflineSnippets.length} offline snippet(s)...`, true);

        try {
            for (const snip of userOfflineSnippets) {
                await convexClient.mutation("snippets:create", {
                    token: snip.token,
                    text: snip.text,
                    url: snip.url || undefined,
                    category: snip.category || "General",
                    note: snip.note || undefined
                });
                await deleteOfflineSnippet(snip.id);
            }
            showNotification(`Synced ${userOfflineSnippets.length} snippet(s) to cloud successfully!`, 'success');
            loadUserSnippets();
        } catch (err) {
            console.error("Sync failed:", err);
            showNotification("Sync failed. Snippets are securely saved locally.", "error");
        } finally {
            isSyncingOfflineData = false;
            hideOfflineBanner();
        }
    }

    window.addEventListener('online', () => {
        showNotification("Connection restored! Syncing data...", "info");
        syncOfflineSnippets();
    });

    window.addEventListener('offline', () => {
        showNotification("You are offline. Snippets will be saved locally.", "warning");
        showOfflineBanner();
    });

    // Initial check
    if (!navigator.onLine) {
        setTimeout(showOfflineBanner, 1000);
    } else {
        setTimeout(syncOfflineSnippets, 2000);
    } 


    let introBypassed = false;

    // --- DOM Elements ---
    const snippetTextEl = document.getElementById('snippet-text');
    const snippetUrlEl = document.getElementById('snippet-url');
    const snippetCategoryEl = document.getElementById('snippet-category');
    const snippetNoteEl = document.getElementById('snippet-note');
    const newCategoryNameEl = document.getElementById('new-category-name');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const saveSnippetBtn = document.getElementById('save-snippet-btn');
    const snippetsListEl = document.getElementById('snippets-list');
    const currentYearEl = document.getElementById('current-year');
    const notificationAreaEl = document.getElementById('notification-area');
    const searchInputEl = document.getElementById('search-input');
    const filterCategoryEl = document.getElementById('filter-category');
    const mainViewEl = document.getElementById('main-view');
    const detailViewEl = document.getElementById('detail-view');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const detailTitleEl = document.getElementById('detail-title');
    const detailCategoryViewEl = document.getElementById('detail-category-view');
    const detailTextViewEl = document.getElementById('detail-text-view');
    const detailUrlViewContainerEl = document.getElementById('detail-url-view-container');
    const detailUrlViewEl = document.getElementById('detail-url-view');
    const detailNoteViewContainerEl = document.getElementById('detail-note-view-container');
    const detailNoteViewEl = document.getElementById('detail-note-view');
    const detailDateViewEl = document.getElementById('detail-date-view');
    const editSnippetFromViewBtn = document.getElementById('edit-snippet-from-view-btn');
    const detailContentViewEl = document.getElementById('detail-content-view');
    const detailContentEditEl = document.getElementById('detail-content-edit');
    const editSnippetIdEl = document.getElementById('edit-snippet-id');
    const editSnippetTextEl = document.getElementById('edit-snippet-text');
    const editSnippetUrlEl = document.getElementById('edit-snippet-url');
    const editSnippetCategoryEl = document.getElementById('edit-snippet-category');
    const editSnippetNoteEl = document.getElementById('edit-snippet-note');
    const saveEditedSnippetBtn = document.getElementById('save-edited-snippet-btn');
    const cancelEditSnippetBtn = document.getElementById('cancel-edit-snippet-btn');
    const introOverlay = document.getElementById('intro-overlay');
    const dynamicLogo = document.getElementById('dynamic-logo');
    const introSubtitle = document.getElementById('intro-subtitle');
    const appContainer = document.getElementById('app-container'); 
    const headerLogoSVG = document.getElementById('header-logo-svg');

    const authViewEl = document.getElementById('auth-view');
    const loginFormContainerEl = document.getElementById('login-form-container'); 
    const signupFormContainerEl = document.getElementById('signup-form-container'); 
    const loginFormEl = document.getElementById('login-form');
    const signupFormEl = document.getElementById('signup-form');
    
    const loginEmailEl = document.getElementById('login-email');
    const loginPasswordEl = document.getElementById('login-password');
    const signupNameEl = document.getElementById('signup-name');
    const signupDobEl = document.getElementById('signup-dob');
    const signupEmailEl = document.getElementById('signup-email');
    const signupPasswordEl = document.getElementById('signup-password');
    const signupPasswordConfirmEl = document.getElementById('signup-password-confirm');
    
    const showSignupBtn = document.getElementById('show-signup-btn');
    const showLoginBtn = document.getElementById('show-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // --- New DOM Elements for Header & Account Section ---
    const userNameDisplayEl = document.getElementById('user-name-display');
    const userEmailDisplayEl = document.getElementById('user-email-display');
    const headerAvatarEl = document.getElementById('header-avatar');
    const headerAvatarPlaceholderEl = document.getElementById('header-avatar-placeholder');
    const toggleAccountBtn = document.getElementById('toggle-account-btn');
    const guestSyncBtn = document.getElementById('guest-sync-btn');
    
    const accountViewEl = document.getElementById('account-view');
    const backFromAccountBtn = document.getElementById('back-from-account-btn');
    
    const profileAvatarImgEl = document.getElementById('profile-avatar-img');
    const profileAvatarPlaceholderEl = document.getElementById('profile-avatar-placeholder');
    const avatarInputEl = document.getElementById('avatar-input');
    const deleteAvatarBtn = document.getElementById('delete-avatar-btn');
    
    const cropControlsEl = document.getElementById('crop-controls');
    const cropZoomEl = document.getElementById('crop-zoom');
    const saveCropBtn = document.getElementById('save-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const cropCanvasEl = document.getElementById('crop-canvas');
    
    const profileNameViewEl = document.getElementById('profile-name-view');
    const editNameBtn = document.getElementById('edit-name-btn');
    const profileNameEditContainer = document.getElementById('profile-name-edit-container');
    const profileNameInput = document.getElementById('profile-name-input');
    const saveNameBtn = document.getElementById('save-name-btn');
    const cancelNameBtn = document.getElementById('cancel-name-btn');
    
    const profileEmailViewEl = document.getElementById('profile-email-view');
    const profileDobViewEl = document.getElementById('profile-dob-view');
    const profileJoinedViewEl = document.getElementById('profile-joined-view');
    
    const verificationBadgeVerifiedEl = document.getElementById('verification-badge-verified');
    const verifyEmailBtn = document.getElementById('verify-email-btn');
    
    const changePasswordFormEl = document.getElementById('change-password-form');
    const changeOldPasswordEl = document.getElementById('change-old-password');
    const changeNewPasswordEl = document.getElementById('change-new-password');
    const changeNewConfirmEl = document.getElementById('change-new-confirm');
    
    const activeSessionsTableEl = document.getElementById('active-sessions-table');
    const revokeAllOthersBtn = document.getElementById('revoke-all-others-btn');
    
    const downloadDataBtn = document.getElementById('download-data-btn');
    const deleteAccountTriggerBtn = document.getElementById('delete-account-trigger-btn');
    
    const deleteWarningModal = document.getElementById('delete-warning-modal');
    const deleteWarningModalContent = document.getElementById('delete-warning-modal-content');
    const confirmDeleteAccountBtn = document.getElementById('confirm-delete-account-btn');
    const cancelDeleteAccountBtn = document.getElementById('cancel-delete-account-btn');

    // --- Guest Mode & Forgot Password Modals ---
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const guestWarningModal = document.getElementById('guest-warning-modal');
    const guestWarningModalContent = document.getElementById('guest-warning-modal-content');
    const confirmGuestBtn = document.getElementById('confirm-guest-btn');
    const cancelGuestBtn = document.getElementById('cancel-guest-btn');

    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const forgotPasswordModalContent = document.getElementById('forgot-password-modal-content');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotEmailEl = document.getElementById('forgot-email');
    const closeForgotBtn = document.getElementById('close-forgot-btn');

    const migrationModal = document.getElementById('migration-modal');
    const migrationModalContent = document.getElementById('migration-modal-content');
    const migrationForm = document.getElementById('migration-form');
    const migrateEmailEl = document.getElementById('migrate-email');
    const migrateConflictPanel = document.getElementById('migration-conflict-panel');
    const migrateConflictDetails = document.getElementById('migration-conflict-details');
    const migrateNewFields = document.getElementById('migrate-new-fields');
const migrateNameEl = document.getElementById('migrate-name');
    const migrateDobEl = document.getElementById('migrate-dob');
    const migratePasswordEl = document.getElementById('migrate-password');
    const migratePasswordLabel = document.getElementById('migrate-password-label');
    const migrateSubmitBtn = document.getElementById('migrate-submit-btn');
    const closeMigrateBtn = document.getElementById('close-migrate-btn');
    
    // Real Password Reset Elements
    const realResetPasswordModal = document.getElementById('real-reset-password-modal');
    const realResetPasswordModalContent = document.getElementById('real-reset-password-modal-content');
    const realResetPasswordForm = document.getElementById('real-reset-password-form');
    const realResetTokenEl = document.getElementById('real-reset-token');
    const realResetNewPasswordEl = document.getElementById('real-reset-new-password');
    const realResetConfirmPasswordEl = document.getElementById('real-reset-confirm-password');
    const closeRealResetBtn = document.getElementById('close-real-reset-btn');

    let currentEditingSnippetId = null;
    let localSnippetsCache = []; 
    let localCategoriesCache = []; 
    const defaultCategoryNames = ["General", "Code Snippets", "Recipes", "Bookmarks", "Ideas", "Learning"];
    
    // Canvas Crop Variables
    let rawUploadImage = null;
    let cropScale = 1.0;

    // --- Browser OS/Location Device Helpers ---
    function getDeviceMetadata() {
        const ua = navigator.userAgent;
        let browser = "Web Client";
        let os = "OS";
        if (ua.indexOf("Chrome") > -1) browser = "Google Chrome";
        else if (ua.indexOf("Firefox") > -1) browser = "Mozilla Firefox";
        else if (ua.indexOf("Safari") > -1) browser = "Apple Safari";
        else if (ua.indexOf("Edge") > -1) browser = "Microsoft Edge";
        
        if (ua.indexOf("Windows") > -1) os = "Windows";
        else if (ua.indexOf("Macintosh") > -1) os = "macOS";
        else if (ua.indexOf("Linux") > -1) os = "Linux";
        else if (ua.indexOf("Android") > -1) os = "Android";
        else if (ua.indexOf("iPhone") > -1) os = "iOS";
        
        return `${browser} on ${os}`;
    }

    function getLocationMetadata() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz) return tz.split('/')[1]?.replace('_', ' ') || "India";
        } catch(e) {}
        return "New Delhi, India";
    }

    function calculateAge(dobString) {
        const dobVal = new Date(dobString);
        const ageDifMs = Date.now() - dobVal.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    // --- Navigation / View Management ---
    function showAuthView() {
        if(authViewEl) authViewEl.classList.remove('hidden');
        if(appContainer) {
            appContainer.classList.add('hidden'); 
            appContainer.classList.add('hidden-for-auth'); 
        }
        if(mainViewEl) mainViewEl.classList.add('hidden'); 
        if(detailViewEl) detailViewEl.classList.add('hidden'); 
        if(accountViewEl) accountViewEl.classList.add('hidden');
        
        if (introOverlay && introOverlay.style.display !== 'none') { 
            introOverlay.style.display = 'none'; 
        }
        if (loginFormContainerEl && signupFormContainerEl) {
            loginFormContainerEl.classList.remove('hidden');
            signupFormContainerEl.classList.add('hidden');
        }
    }

    function showAppView() {
        if(authViewEl) authViewEl.classList.add('hidden');
        if(appContainer) {
            appContainer.classList.remove('hidden');
            appContainer.classList.remove('hidden-for-auth');
            appContainer.classList.add('loaded'); 
        }
        
        // Hide/Show Sync buttons based on Guest mode
        if (sessionToken === "guest") {
            if(guestSyncBtn) guestSyncBtn.classList.remove('hidden');
            if(toggleAccountBtn) toggleAccountBtn.classList.add('hidden');
        } else {
            if(guestSyncBtn) guestSyncBtn.classList.add('hidden');
            if(toggleAccountBtn) toggleAccountBtn.classList.remove('hidden');
        }

        // Populate User header info
        if (currentUser) {
            if(userNameDisplayEl) userNameDisplayEl.textContent = currentUser.name || "Guest User";
            if(userEmailDisplayEl) userEmailDisplayEl.textContent = currentUser.email || "Local Cache Only";
            
            // Set Avatars
            if (currentUser.profilePic) {
                if(headerAvatarEl) { headerAvatarEl.src = currentUser.profilePic; headerAvatarEl.classList.remove('hidden'); }
                if(headerAvatarPlaceholderEl) headerAvatarPlaceholderEl.classList.add('hidden');
            } else {
                if(headerAvatarEl) headerAvatarEl.classList.add('hidden');
                if(headerAvatarPlaceholderEl) headerAvatarPlaceholderEl.classList.remove('hidden');
            }
        }
        
        showMainView(); 
    }
    
    function showMainView() {
        if(mainViewEl) mainViewEl.classList.remove('hidden');
        if(detailViewEl) detailViewEl.classList.add('hidden');
        if(accountViewEl) accountViewEl.classList.add('hidden');
        const snippetsViewEl = document.getElementById('snippets-view');
        if(snippetsViewEl) snippetsViewEl.classList.add('hidden');
        currentEditingSnippetId = null; 
        renderSnippets(); 
    }

    function showDetailView(snippetId, mode = 'view') {
        const snippet = localSnippetsCache.find(s => s.id === snippetId);
        if (!snippet) {
            showNotification('Error: Snippet not found.', 'error');
            showMainView();
            return;
        }
        currentEditingSnippetId = snippet.id;
        if(mainViewEl) mainViewEl.classList.add('hidden');
        if(accountViewEl) accountViewEl.classList.add('hidden');
        const snippetsViewEl = document.getElementById('snippets-view');
        if(snippetsViewEl) snippetsViewEl.classList.add('hidden');
        if(detailViewEl) detailViewEl.classList.remove('hidden');

        if (mode === 'view') {
            if(detailContentViewEl) detailContentViewEl.classList.remove('hidden');
            if(detailContentEditEl) detailContentEditEl.classList.add('hidden');
            if(detailTitleEl) detailTitleEl.textContent = "Snippet Details";
            if(detailCategoryViewEl) detailCategoryViewEl.textContent = snippet.category;
            if(detailTextViewEl) detailTextViewEl.innerHTML = snippet.text;
            
            if (snippet.url) {
                if(detailUrlViewEl) {
                    detailUrlViewEl.href = snippet.url;
                    detailUrlViewEl.textContent = snippet.url;
                }
                if(detailUrlViewContainerEl) detailUrlViewContainerEl.classList.remove('hidden');
            } else {
                if(detailUrlViewContainerEl) detailUrlViewContainerEl.classList.add('hidden');
            }
            if (snippet.note) {
                if(detailNoteViewEl) detailNoteViewEl.textContent = snippet.note;
                if(detailNoteViewContainerEl) detailNoteViewContainerEl.classList.remove('hidden');
            } else {
                if(detailNoteViewContainerEl) detailNoteViewContainerEl.classList.add('hidden');
            }
            const createdAtDate = new Date(snippet.createdAt); 
            if(detailDateViewEl) detailDateViewEl.textContent = `${createdAtDate.toLocaleDateString()} ${createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (mode === 'edit') {
            if(detailContentViewEl) detailContentViewEl.classList.add('hidden');
            if(detailContentEditEl) detailContentEditEl.classList.remove('hidden');
            if(detailTitleEl) detailTitleEl.textContent = "Edit Snippet";
            if(editSnippetIdEl) editSnippetIdEl.value = snippet.id;
            if(editSnippetTextEl) {
                editSnippetTextEl.value = snippet.text;
                const editWysiwyg = document.getElementById('edit-snippet-wysiwyg');
                if (editWysiwyg) editWysiwyg.innerHTML = snippet.text;
            }
            if(editSnippetUrlEl) editSnippetUrlEl.value = snippet.url || '';
            populateCategoryDropdown(editSnippetCategoryEl, localCategoriesCache); 
            if(editSnippetCategoryEl) editSnippetCategoryEl.value = snippet.category; 
            if(editSnippetNoteEl) editSnippetNoteEl.value = snippet.note || '';
        }
        window.scrollTo(0, 0);
    }
    
    // --- Notifications ---
    function showNotification(message, type = 'info', duration = 3500) { 
        if (!notificationAreaEl) return; 
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
        notificationAreaEl.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10); 
        setTimeout(() => {
            if (notification.parentNode) { 
                notification.remove();
            }
        }, duration + 500);
    }

    // --- Intro Animation ---
    function playIntroAnimation(onCompleteCallback) {
        if (sessionStorage.getItem("snipvault_startup_done") === "true" || introBypassed || localStorage.getItem("snipvault_skip_intro") === "true") {
            introBypassed = true;
            sessionStorage.setItem("snipvault_startup_done", "true");
            setTimeout(() => {
                localStorage.removeItem("snipvault_skip_intro");
            }, 1000);
            if (introOverlay) {
                introOverlay.style.display = 'none';
                introOverlay.style.opacity = '0';
                introOverlay.style.pointerEvents = 'none';
            }
            if (onCompleteCallback) onCompleteCallback();
            return;
        }

        sessionStorage.setItem("snipvault_startup_done", "true");

        if (!introOverlay) { 
            if(onCompleteCallback) onCompleteCallback();
            return; 
        }
        
        if (introOverlay.style.display === 'none') {
            introOverlay.style.display = 'flex';
        }
        introOverlay.style.opacity = '1'; 
        introOverlay.style.pointerEvents = 'auto';

        const introCard = document.getElementById('intro-card');
        if(introCard) introCard.classList.add('animate-pop');
        if(dynamicLogo) dynamicLogo.classList.add('animate-pulse');
        if(introSubtitle) setTimeout(() => introSubtitle.classList.add('animate-fade-in-up'), 300);
        
        setTimeout(() => { 
            if(introOverlay) {
                introOverlay.style.opacity = '0';
                introOverlay.style.pointerEvents = 'none'; 
            }
            if(onCompleteCallback) onCompleteCallback(); 
        }, 2000); 

        setTimeout(() => { 
            if (introOverlay && introOverlay.parentNode) {
                introOverlay.parentNode.removeChild(introOverlay);
            }
        }, 3000); 
    }

    // --- Show Account Settings screen ---
    function showAccountView() {
        if (!sessionToken || sessionToken === "guest") return;
        if(mainViewEl) mainViewEl.classList.add('hidden');
        if(detailViewEl) detailViewEl.classList.add('hidden');
        const snippetsViewEl = document.getElementById('snippets-view');
        if(snippetsViewEl) snippetsViewEl.classList.add('hidden');
        if(accountViewEl) accountViewEl.classList.remove('hidden');
        
        // Populate profile views
        if (currentUser) {
            if(profileNameViewEl) profileNameViewEl.textContent = currentUser.name;
            if(profileEmailViewEl) profileEmailViewEl.textContent = currentUser.email;
            if(profileDobViewEl) profileDobViewEl.textContent = `${currentUser.dob} (Age ${currentUser.age})`;
            if(profileJoinedViewEl) {
                if (currentUser.created_at) {
                    const joinedDate = new Date(currentUser.created_at);
                    profileJoinedViewEl.textContent = joinedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                } else {
                    profileJoinedViewEl.textContent = "N/A";
                }
            }
            if(profileNameEditContainer) profileNameEditContainer.classList.add('hidden');
            if(profileNameViewEl) profileNameViewEl.parentElement.classList.remove('hidden');
            
            // Verification badge
            if (currentUser.isVerified) {
                if(verificationBadgeVerifiedEl) verificationBadgeVerifiedEl.classList.remove('hidden');
                if(verifyEmailBtn) verifyEmailBtn.classList.add('hidden');
            } else {
                if(verificationBadgeVerifiedEl) verificationBadgeVerifiedEl.classList.add('hidden');
                if(verifyEmailBtn) verifyEmailBtn.classList.remove('hidden');
            }

            // User Profile Pic
            if (currentUser.profilePic) {
                if(profileAvatarImgEl) { profileAvatarImgEl.src = currentUser.profilePic; profileAvatarImgEl.classList.remove('hidden'); }
                if(profileAvatarPlaceholderEl) profileAvatarPlaceholderEl.classList.add('hidden');
                if(deleteAvatarBtn) deleteAvatarBtn.classList.remove('hidden');
            } else {
                if(profileAvatarImgEl) profileAvatarImgEl.classList.add('hidden');
                if(profileAvatarPlaceholderEl) profileAvatarPlaceholderEl.classList.remove('hidden');
                if(deleteAvatarBtn) deleteAvatarBtn.classList.add('hidden');
            }
        }

        loadSessionsLog();
    }

    // --- Query Parameter Router for Reset/Verify Links ---
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('resetToken');
    const verifyToken = urlParams.get('verifyToken');

    if (verifyToken) {
        showNotification("Verifying email address...", "info");
        convexClient.mutation("auth:verifyEmailWithToken", { token: verifyToken })
            .then(() => {
                showNotification("Email successfully verified! Active badge enabled.", "success", 5000);
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                showNotification(`Verification failed: ${err.message}`, "error", 5000);
            });
    }

    if (resetToken) {
        showNotification("Verifying modification link...", "info");
        convexClient.query("auth:checkResetToken", { token: resetToken })
            .then(res => {
                if (res) {
                    const masterTargetEmailEl = document.getElementById("master-target-email");
                    if (masterTargetEmailEl) masterTargetEmailEl.textContent = res.email;
                    
                    if (realResetPasswordModal && realResetPasswordModalContent && realResetTokenEl) {
                        realResetTokenEl.value = resetToken;
                        realResetPasswordModal.classList.remove("hidden");
                        setTimeout(() => {
                            realResetPasswordModalContent.classList.remove("scale-95", "opacity-0");
                            realResetPasswordModalContent.classList.add("scale-100", "opacity-100");
                        }, 100);
                    }
                } else {
                    showNotification("Invalid, expired, or spent modification link.", "error", 6000);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            })
            .catch(err => {
                console.error("Token verify error:", err);
                showNotification("Could not verify reset token link.", "error");
                window.history.replaceState({}, document.title, window.location.pathname);
            });
    }

    // --- Session Setup / Initialization ---
    if (localStorage.getItem("snipvault_guest_mode") === "true") {
        sessionToken = "guest";
        currentUser = { name: "Guest User", email: "Local Cache Only" };
        loadUserCategories(); 
        loadUserSnippets();   
        playIntroAnimation(() => { 
            showAppView(); 
        });
    } else if (sessionToken) {
        if (!navigator.onLine) {
            console.log("Offline mode detected, bypassing authentication query.");
            const cachedUser = localStorage.getItem('snipvault_cached_user');
            if (cachedUser) {
                try {
                    currentUser = JSON.parse(cachedUser);
                } catch (e) {
                    currentUser = { name: "Offline User", email: "Cached Session" };
                }
            } else {
                currentUser = { name: "Offline User", email: "Cached Session" };
            }
            loadUserCategories(); 
            loadUserSnippets();   
            playIntroAnimation(() => { 
                showAppView(); 
            });
        } else {
            convexClient.query("auth:getUser", { token: sessionToken })
                .then(user => {
                    if (user) {
                        currentUser = user;
                        localStorage.setItem('snipvault_cached_user', JSON.stringify(user));
                        loadUserCategories(); 
                        loadUserSnippets();   
                        playIntroAnimation(() => { 
                            showAppView(); 
                        });
                    } else {
                        localStorage.removeItem('snipvault_session_token');
                        sessionToken = null;
                        currentUser = null;
                        showAuthView();
                    }
                })
                .catch(error => {
                    console.error("Authentication check failed:", error);
                    localStorage.removeItem('snipvault_session_token');
                    sessionToken = null;
                    currentUser = null;
                    showAuthView();
                });
        }
    } else {
        showAuthView();
    }

    // --- Sign In & Sign Up Form Events ---
    if(loginFormEl) loginFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmailEl.value;
        const password = loginPasswordEl.value;
        
        convexClient.mutation("auth:login", {
            email,
            password,
            device: getDeviceMetadata(),
            location: getLocationMetadata()
        })
        .then(res => {
            showNotification('Logged in successfully!', 'success');
            sessionToken = res.token;
            localStorage.setItem('snipvault_session_token', res.token);
            
            convexClient.query("auth:getUser", { token: res.token })
                .then(user => {
                    currentUser = user;
                    loadUserCategories();
                    loadUserSnippets();
                    playIntroAnimation(() => {
                        showAppView();
                    });
                });
        })
        .catch(error => {
            console.error("Login error:", error);
            showNotification(`Login failed: ${error.message}`, 'error', 5000);
        });
    });

    if(signupFormEl) signupFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = signupNameEl.value;
        const dob = signupDobEl.value;
        const email = signupEmailEl.value;
        const password = signupPasswordEl.value;
        const confirm = signupPasswordConfirmEl.value;
        
        if (password !== confirm) {
            showNotification('Passwords do not match.', 'error');
            return;
        }
        if (password.length < 6) {
            showNotification('Password should be at least 6 characters.', 'error');
            return;
        }

        const age = calculateAge(dob);

        convexClient.mutation("auth:signUp", {
            email,
            password,
            name,
            dob,
            age,
            device: getDeviceMetadata(),
            location: getLocationMetadata()
        })
        .then(res => {
            showNotification('Account created successfully!', 'success');
            sessionToken = res.token;
            localStorage.setItem('snipvault_session_token', res.token);
            
            convexClient.query("auth:getUser", { token: res.token })
                .then(user => {
                    currentUser = user;
                    loadUserCategories();
                    loadUserSnippets();
                    playIntroAnimation(() => {
                        showAppView();
                    });
                });
        })
        .catch(error => {
            console.error("Signup error:", error);
            showNotification(`Signup failed: ${error.message}`, 'error', 5000);
        });
    });

    // --- Forgot Password Action ---
    if (forgotPasswordBtn && forgotPasswordModal && forgotPasswordModalContent) {
        forgotPasswordBtn.addEventListener("click", () => {
            forgotPasswordModal.classList.remove("hidden");
            setTimeout(() => {
                forgotPasswordModalContent.classList.remove("scale-95", "opacity-0");
                forgotPasswordModalContent.classList.add("scale-100", "opacity-100");
            }, 10);
        });
    }

    if (closeForgotBtn && forgotPasswordModal && forgotPasswordModalContent) {
        closeForgotBtn.addEventListener("click", () => {
            forgotPasswordModalContent.classList.remove("scale-100", "opacity-100");
            forgotPasswordModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                forgotPasswordModal.classList.add("hidden");
            }, 300);
        });
    }
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = forgotEmailEl.value.trim();
            const baseUrl = window.location.origin + window.location.pathname;
            
            showNotification("Sending secure password reset email...", "info");
            
            convexClient.mutation("auth:requestPasswordReset", {
                email,
                baseUrl
            })
            .then(() => {
                showNotification(`Password reset link successfully sent to ${email}! (Please check your Spam or Junk folder if not found in your Inbox)`, "success", 7500);
                
                forgotPasswordModalContent.classList.remove("scale-100", "opacity-100");
                forgotPasswordModalContent.classList.add("scale-95", "opacity-0");
                setTimeout(() => {
                    forgotPasswordModal.classList.add("hidden");
                    forgotEmailEl.value = '';
                }, 300);
            })
            .catch(error => {
                console.error("Password reset error:", error);
                showNotification(`Failed to request password reset: ${error.message}`, "error", 5000);
            });
        });
    }

    // --- Logged-In "Don't remember password" Helper Trigger ---
    const sendChangePasswordLinkBtn = document.getElementById("send-change-password-link-btn");
    if (sendChangePasswordLinkBtn) {
        sendChangePasswordLinkBtn.addEventListener("click", () => {
            if (!currentUser || !currentUser.email) {
                showNotification("Error: User email not found.", "error");
                return;
            }
            const baseUrl = window.location.origin + window.location.pathname;
            showNotification("Sending secure password reset email...", "info");
            convexClient.mutation("auth:requestPasswordReset", {
                email: currentUser.email,
                baseUrl
            })
            .then(() => {
                showNotification(`A secure reset link has been successfully sent to: ${currentUser.email}! (Please check your Spam or Junk folder if it does not arrive in your Inbox)`, "success", 7500);
            })
            .catch(err => {
                console.error("Failed to request reset link:", err);
                showNotification(`Request failed: ${err.message}`, "error", 5000);
            });
        });
    }

    // --- Master Account Modification Panel (Admin Panel) Logic ---
    const tabMasterPasswordBtn = document.getElementById("tab-master-password-btn");
    const tabMasterEmailBtn = document.getElementById("tab-master-email-btn");
    const masterPasswordForm = document.getElementById("real-reset-password-form");
    const masterEmailForm = document.getElementById("real-reset-email-form");
    const masterEmailNewInput = document.getElementById("real-reset-new-email");
    const masterCollisionPanel = document.getElementById("master-email-collision-panel");
    const confirmMasterMergeBtn = document.getElementById("confirm-master-email-merge-btn");
    const masterEmailActionButtons = document.getElementById("master-email-action-buttons");

    // Cancel / Close buttons listener
    document.querySelectorAll(".close-master-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (realResetPasswordModal && realResetPasswordModalContent) {
                realResetPasswordModalContent.classList.remove("scale-100", "opacity-100");
                realResetPasswordModalContent.classList.add("scale-95", "opacity-0");
                setTimeout(() => {
                    realResetPasswordModal.classList.add("hidden");
                    // Clear forms
                    if (masterPasswordForm) masterPasswordForm.reset();
                    if (masterEmailForm) masterEmailForm.reset();
                    if (masterCollisionPanel) masterCollisionPanel.classList.add("hidden");
                    if (masterEmailActionButtons) masterEmailActionButtons.classList.remove("hidden");
                    // Clear URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                }, 300);
            }
        });
    });

    // Tab switches
    if (tabMasterPasswordBtn && tabMasterEmailBtn && masterPasswordForm && masterEmailForm) {
        tabMasterPasswordBtn.addEventListener("click", () => {
            tabMasterPasswordBtn.className = "flex-1 pb-2 border-b-2 border-indigo-600 text-indigo-600";
            tabMasterEmailBtn.className = "flex-1 pb-2 border-b-2 border-transparent text-gray-400 hover:text-gray-600";
            masterPasswordForm.classList.remove("hidden");
            masterEmailForm.classList.add("hidden");
        });

        tabMasterEmailBtn.addEventListener("click", () => {
            tabMasterEmailBtn.className = "flex-1 pb-2 border-b-2 border-indigo-600 text-indigo-600";
            tabMasterPasswordBtn.className = "flex-1 pb-2 border-b-2 border-transparent text-gray-400 hover:text-gray-600";
            masterEmailForm.classList.remove("hidden");
            masterPasswordForm.classList.add("hidden");
        });
    }

    // Submit: Master Update Password Form
    if (masterPasswordForm && realResetPasswordModal && realResetPasswordModalContent) {
        masterPasswordForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const token = realResetTokenEl.value;
            const newPassword = realResetNewPasswordEl.value;
            const confirmPass = realResetConfirmPasswordEl.value;

            if (newPassword.length < 6) {
                showNotification("Password must be at least 6 characters.", "error");
                return;
            }

            if (newPassword !== confirmPass) {
                showNotification("Passwords do not match.", "error");
                return;
            }

            showNotification("Saving new password...", "info");

            convexClient.mutation("auth:resetPasswordWithToken", {
                token,
                newPassword
            })
            .then(() => {
                showNotification("Password updated successfully! You can now log in.", "success", 5000);
                realResetPasswordModalContent.classList.remove("scale-100", "opacity-100");
                realResetPasswordModalContent.classList.add("scale-95", "opacity-0");
                setTimeout(() => {
                    realResetPasswordModal.classList.add("hidden");
                    masterPasswordForm.reset();
                    window.history.replaceState({}, document.title, window.location.pathname);
                }, 300);
            })
            .catch(error => {
                console.error("Password reset error:", error);
                showNotification(`Reset failed: ${error.message}`, "error", 5000);
            });
        });
    }

    // Submit: Master Update Email Form (Handles collision checking)
    if (masterEmailForm) {
        masterEmailForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const token = realResetTokenEl.value;
            const newEmail = masterEmailNewInput.value.trim();

            executeEmailChange(token, newEmail, false);
        });
    }

    // Submit: Collision Merge Confirmation Click
    if (confirmMasterMergeBtn) {
        confirmMasterMergeBtn.addEventListener("click", () => {
            const token = realResetTokenEl.value;
            const newEmail = masterEmailNewInput.value.trim();
            
            showNotification("Initiating cloud merge migration...", "info");
            executeEmailChange(token, newEmail, true);
        });
    }

    function executeEmailChange(token, newEmail, mergeAction) {
        showNotification("Processing email update...", "info");
        convexClient.mutation("auth:changeEmailWithToken", {
            token,
            newEmail,
            mergeAction
        })
        .then(res => {
            if (res.collision) {
                showNotification(res.message, "warning", 6000);
                if (masterCollisionPanel) masterCollisionPanel.classList.remove("hidden");
                if (masterEmailActionButtons) masterEmailActionButtons.classList.add("hidden"); // Hide default submit/cancel to prevent error clicks
            } else {
                showNotification("Email successfully updated!", "success", 5000);
                
                // If they merged accounts, log them out since their old profile is deleted
                if (res.merged) {
                    showNotification(`Vault merged into target account! Please log into ${res.newEmail}.`, "success", 8000);
                    localStorage.removeItem('snipvault_session_token');
                    sessionToken = null;
                    currentUser = null;
                    showAuthView();
                }

                if (realResetPasswordModal && realResetPasswordModalContent) {
                    realResetPasswordModalContent.classList.remove("scale-100", "opacity-100");
                    realResetPasswordModalContent.classList.add("scale-95", "opacity-0");
                    setTimeout(() => {
                        realResetPasswordModal.classList.add("hidden");
                        if (masterEmailForm) masterEmailForm.reset();
                        if (masterCollisionPanel) masterCollisionPanel.classList.add("hidden");
                        if (masterEmailActionButtons) masterEmailActionButtons.classList.remove("hidden");
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }, 300);
                }
            }
        })
        .catch(err => {
            console.error("Email modification failed:", err);
            showNotification(`Email change failed: ${err.message}`, "error", 5000);
        });
    }

    // --- Guest Warning Interactions ---
    if (guestLoginBtn && guestWarningModal && guestWarningModalContent) {
        guestLoginBtn.addEventListener("click", () => {
            guestWarningModal.classList.remove("hidden");
            setTimeout(() => {
                guestWarningModalContent.classList.remove("scale-95", "opacity-0");
                guestWarningModalContent.classList.add("scale-100", "opacity-100");
            }, 10);
        });
    }

    if (cancelGuestBtn && guestWarningModal && guestWarningModalContent) {
        cancelGuestBtn.addEventListener("click", () => {
            guestWarningModalContent.classList.remove("scale-100", "opacity-100");
            guestWarningModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                guestWarningModal.classList.add("hidden");
            }, 300);
        });
    }

    if (confirmGuestBtn && guestWarningModal && guestWarningModalContent) {
        confirmGuestBtn.addEventListener("click", () => {
            guestWarningModalContent.classList.remove("scale-100", "opacity-100");
            guestWarningModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                guestWarningModal.classList.add("hidden");
            }, 300);

            showNotification("Entering Guest Mode...", "success");
            
            sessionToken = "guest";
            localStorage.setItem("snipvault_guest_mode", "true");
            currentUser = { name: "Guest User", email: "Local Cache Only" };
            
            loadUserCategories();
            loadUserSnippets();
            
            playIntroAnimation(() => {
                showAppView();
            });
        });
    }

    // --- Profile Avatar Cropper & Resizing Logic ---
    if (avatarInputEl) {
        avatarInputEl.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                rawUploadImage = new Image();
                rawUploadImage.onload = () => {
                    cropScale = 1.0;
                    cropZoomEl.value = "1.0";
                    cropControlsEl.classList.remove("hidden");
                    drawCropCanvas();
                };
                rawUploadImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (cropZoomEl) {
        cropZoomEl.addEventListener("input", (e) => {
            cropScale = parseFloat(e.target.value);
            drawCropCanvas();
        });
    }

    function drawCropCanvas() {
        if (!rawUploadImage || !cropCanvasEl) return;
        const ctx = cropCanvasEl.getContext("2d");
        
        cropCanvasEl.width = 300;
        cropCanvasEl.height = 300;
        
        ctx.clearRect(0, 0, 300, 300);
        
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 300, 300);
        
        const size = Math.min(rawUploadImage.width, rawUploadImage.height);
        const w = (rawUploadImage.width / size) * 300 * cropScale;
        const h = (rawUploadImage.height / size) * 300 * cropScale;
        
        const x = (300 - w) / 2;
        const y = (300 - h) / 2;
        
        ctx.drawImage(rawUploadImage, x, y, w, h);
    }

    if (saveCropBtn) {
        saveCropBtn.addEventListener("click", () => {
            if (!cropCanvasEl) return;
            const dataUrl = cropCanvasEl.toDataURL("image/jpeg", 0.75);
            
            showNotification("Saving cropped profile picture...", "info");
            convexClient.mutation("auth:updateProfilePic", {
                token: sessionToken,
                profilePic: dataUrl
            })
            .then(() => {
                showNotification("Profile picture updated successfully!", "success");
                cropControlsEl.classList.add("hidden");
                rawUploadImage = null;
                
                // Refresh Profile
                convexClient.query("auth:getUser", { token: sessionToken })
                    .then(user => {
                        currentUser = user;
                        showAppView();
                        showAccountView();
                    });
            })
            .catch(err => {
                console.error(err);
                showNotification("Failed to update profile picture.", "error");
            });
        });
    }

    if (cancelCropBtn) {
        cancelCropBtn.addEventListener("click", () => {
            cropControlsEl.classList.add("hidden");
            rawUploadImage = null;
            avatarInputEl.value = "";
        });
    }

    if (deleteAvatarBtn) {
        deleteAvatarBtn.addEventListener("click", () => {
            customConfirm("Are you sure you want to permanently delete your profile picture?", "Delete Photo?", "fa-trash-alt").then(confirmed => {
                if (confirmed) {
                    convexClient.mutation("auth:updateProfilePic", { token: sessionToken, profilePic: undefined })
                        .then(() => {
                            showNotification("Profile photo deleted.", "info");
                            convexClient.query("auth:getUser", { token: sessionToken })
                                .then(user => {
                                    currentUser = user;
                                    showAppView();
                                    showAccountView();
                                });
                        });
                }
            });
        });
    }

    // --- Profile Name Editing Event Listeners ---
    if (editNameBtn) {
        editNameBtn.addEventListener("click", () => {
            if (profileNameEditContainer && profileNameInput && currentUser) {
                profileNameInput.value = currentUser.name || "";
                profileNameEditContainer.classList.remove("hidden");
                if (profileNameViewEl) profileNameViewEl.parentElement.classList.add("hidden");
            }
        });
    }

    if (cancelNameBtn) {
        cancelNameBtn.addEventListener("click", () => {
            if (profileNameEditContainer) profileNameEditContainer.classList.add("hidden");
            if (profileNameViewEl) profileNameViewEl.parentElement.classList.remove("hidden");
        });
    }

    if (saveNameBtn) {
        saveNameBtn.addEventListener("click", () => {
            if (!profileNameInput) return;
            const newName = profileNameInput.value.trim();
            if (!newName) {
                showNotification("Name cannot be empty.", "error");
                return;
            }

            showNotification("Updating account name...", "info");
            convexClient.mutation("auth:updateName", {
                token: sessionToken,
                name: newName
            })
            .then(() => {
                showNotification("Name updated successfully!", "success");
                if (profileNameEditContainer) profileNameEditContainer.classList.add("hidden");
                if (profileNameViewEl) profileNameViewEl.parentElement.classList.remove("hidden");
                
                // Refresh Profile and cache
                convexClient.query("auth:getUser", { token: sessionToken })
                    .then(user => {
                        currentUser = user;
                        localStorage.setItem('snipvault_cached_user', JSON.stringify(user));
                        showAppView();
                        showAccountView();
                    });
            })
            .catch(err => {
                console.error(err);
                showNotification(`Failed to update name: ${err.message}`, "error");
            });
        });
    }

    // --- Real Email Verification Button ---
    if (verifyEmailBtn) {
        verifyEmailBtn.addEventListener("click", () => {
            const baseUrl = window.location.origin + window.location.pathname;
            showNotification("Sending verification email...", "info");
            convexClient.mutation("auth:sendVerificationEmail", { token: sessionToken, baseUrl })
                .then(() => {
                    showNotification("Verification email successfully sent! Please check your Spam or Junk folder if it does not arrive in your Inbox.", "success", 7500);
                })
                .catch(err => {
                    console.error("Verification email error:", err);
                    showNotification(`Failed to send verification email: ${err.message}`, "error", 5000);
                });
        });
    }

    // --- Reset Password Form ---
    if (changePasswordFormEl) {
        changePasswordFormEl.addEventListener("submit", (e) => {
            e.preventDefault();
            const current = changeOldPasswordEl.value;
            const newPass = changeNewPasswordEl.value;
            const confirmNew = changeNewConfirmEl.value;
            
            if (newPass !== confirmNew) {
                showNotification("New passwords do not match.", "error");
                return;
            }
            if (newPass.length < 6) {
                showNotification("Password should be at least 6 characters.", "error");
                return;
            }

            convexClient.mutation("auth:updatePassword", {
                token: sessionToken,
                currentPassword: current,
                newPassword: newPass
            })
            .then(() => {
                showNotification("Password changed successfully!", "success");
                changeOldPasswordEl.value = '';
                changeNewPasswordEl.value = '';
                changeNewConfirmEl.value = '';
            })
            .catch(err => {
                showNotification(`Reset failed: ${err.message}`, "error");
            });
        });
    }

    // --- Sessions Logger ---
    function loadSessionsLog() {
        if (!sessionToken || sessionToken === "guest" || !activeSessionsTableEl) return;
        
        convexClient.query("auth:listSessions", { token: sessionToken })
            .then(sessions => {
                activeSessionsTableEl.innerHTML = '';
                sessions.forEach(s => {
                    const row = document.createElement("tr");
                    row.className = "hover:bg-gray-50 transition-colors";
                    
                    const cellDevice = document.createElement("td");
                    cellDevice.className = "p-3 font-semibold text-gray-800 flex items-center";
                    cellDevice.innerHTML = `<i class="fas ${s.device.indexOf("Chrome") > -1 ? 'fa-laptop' : 'fa-mobile-alt'} text-indigo-500 mr-2"></i> ${s.device} ${s.isCurrent ? '<span class="ml-2 text-[10px] text-green-700 bg-green-50 px-1 rounded border border-green-150">Current</span>' : ''}`;
                    
                    const cellLoc = document.createElement("td");
                    cellLoc.className = "p-3";
                    cellLoc.textContent = s.location;
                    
                    const cellTime = document.createElement("td");
                    cellTime.className = "p-3";
                    cellTime.textContent = new Date(s.createdAt).toLocaleString();
                    
                    const cellAction = document.createElement("td");
                    cellAction.className = "p-3 text-right";
                    
                    if (s.isCurrent) {
                        cellAction.innerHTML = `<span class="text-xs font-semibold text-indigo-650">Current Device</span>`;
                    } else {
                        const btn = document.createElement("button");
                        btn.className = "bg-red-50 hover:bg-red-150 text-red-655 font-bold px-2 py-1 rounded text-xs transition-colors border border-red-100";
                        btn.textContent = "Revoke";
                        btn.addEventListener("click", () => {
                            customConfirm("Are you sure you want to revoke this login session?", "Revoke Session?", "fa-user-times").then(confirmed => {
                                if (confirmed) {
                                    convexClient.mutation("auth:revokeSession", { token: sessionToken, sessionId: s.id })
                                        .then(() => {
                                            showNotification("Session revoked.", "info");
                                            loadSessionsLog();
                                        });
                                }
                            });
                        });
                        cellAction.appendChild(btn);
                    }
                    
                    row.appendChild(cellDevice);
                    row.appendChild(cellLoc);
                    row.appendChild(cellTime);
                    row.appendChild(cellAction);
                    activeSessionsTableEl.appendChild(row);
                });
            });
    }

    if (revokeAllOthersBtn) {
        revokeAllOthersBtn.addEventListener("click", () => {
            customConfirm("Are you sure you want to logout from all other devices?", "Logout Other Devices?", "fa-history").then(confirmed => {
                if (confirmed) {
                    convexClient.mutation("auth:revokeAllOtherSessions", { token: sessionToken })
                        .then(res => {
                            showNotification(`Logged out from ${res.count} other devices successfully.`, "success");
                            loadSessionsLog();
                        });
                }
            });
        });
    }

    // --- GDPR Download Data ---
    if (downloadDataBtn) {
        downloadDataBtn.addEventListener("click", () => {
            showNotification("Compiling GDPR profile backup...", "info");
            convexClient.query("auth:getUserExportData", { token: sessionToken })
                .then(exportData => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `snipvault_data_export_${Date.now()}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    showNotification("GDPR User Data Exported successfully!", "success");
                })
                .catch(e => {
                    showNotification("Data export failed.", "error");
                });
        });
    }

    // --- Account Deletion safety countdown ---
    let deleteTimer = null;
    let deleteCount = 5;

    if (deleteAccountTriggerBtn && deleteWarningModal && deleteWarningModalContent) {
        deleteAccountTriggerBtn.addEventListener("click", () => {
            deleteWarningModal.classList.remove("hidden");
            setTimeout(() => {
                deleteWarningModalContent.classList.remove("scale-95", "opacity-0");
                deleteWarningModalContent.classList.add("scale-100", "opacity-100");
            }, 10);

            // Trigger countdown
            deleteCount = 5;
            confirmDeleteAccountBtn.disabled = true;
            confirmDeleteAccountBtn.className = "w-full bg-red-400 text-white font-bold py-3 px-4 rounded-lg shadow text-sm cursor-not-allowed";
            confirmDeleteAccountBtn.textContent = `Hold on... (5s)`;
            
            if(deleteTimer) clearInterval(deleteTimer);
            deleteTimer = setInterval(() => {
                deleteCount--;
                if (deleteCount > 0) {
                    confirmDeleteAccountBtn.textContent = `Hold on... (${deleteCount}s)`;
                } else {
                    clearInterval(deleteTimer);
                    confirmDeleteAccountBtn.disabled = false;
                    confirmDeleteAccountBtn.className = "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg shadow text-sm transition-all duration-150 transform hover:scale-[1.01]";
                    confirmDeleteAccountBtn.textContent = `Permanently Delete Account`;
                }
            }, 1000);
        });
    }

    if (cancelDeleteAccountBtn && deleteWarningModal && deleteWarningModalContent) {
        cancelDeleteAccountBtn.addEventListener("click", () => {
            if(deleteTimer) clearInterval(deleteTimer);
            deleteWarningModalContent.classList.remove("scale-100", "opacity-100");
            deleteWarningModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                deleteWarningModal.classList.add("hidden");
            }, 300);
        });
    }

    if (confirmDeleteAccountBtn) {
        confirmDeleteAccountBtn.addEventListener("click", () => {
            showNotification("Irreversibly purging user vault...", "error");
            convexClient.mutation("auth:deleteAccount", { token: sessionToken })
                .then(() => {
                    if(deleteTimer) clearInterval(deleteTimer);
                    deleteWarningModalContent.classList.remove("scale-100", "opacity-100");
                    deleteWarningModalContent.classList.add("scale-95", "opacity-0");
                    setTimeout(() => {
                        deleteWarningModal.classList.add("hidden");
                    }, 300);

                    showNotification("Profile permanently purged. Sorry to see you go!", "info", 5000);
                    
                    // Clear state
                    localStorage.removeItem("snipvault_session_token");
                    sessionToken = null;
                    currentUser = null;
                    showAuthView();
                });
        });
    }

    // --- Guest Data Migration & Merge Conflict checking ---
    if (guestSyncBtn && migrationModal && migrationModalContent) {
        guestSyncBtn.addEventListener("click", () => {
            migrationModal.classList.remove("hidden");
            setTimeout(() => {
                migrationModalContent.classList.remove("scale-95", "opacity-0");
                migrationModalContent.classList.add("scale-100", "opacity-100");
            }, 10);
            
            // Check default state
            migrateConflictPanel.classList.add("hidden");
            migrateNewFields.classList.remove("hidden");
            migratePasswordLabel.textContent = "Choose password (min. 6 characters)";
            migrateSubmitBtn.textContent = "Create Account & Sync";
        });
    }

    if (closeMigrateBtn && migrationModal && migrationModalContent) {
        closeMigrateBtn.addEventListener("click", () => {
            migrationModalContent.classList.remove("scale-100", "opacity-100");
            migrationModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                migrationModal.classList.add("hidden");
            }, 300);
        });
    }

    if (migrateEmailEl) {
        migrateEmailEl.addEventListener("input", (e) => {
            const email = e.target.value.trim();
            if (email.indexOf("@") === -1 || email.indexOf(".") === -1) return;
            
            // Load local categories/snippets to compare
            const categoriesStored = localStorage.getItem("snipvault_guest_categories");
            const localCats = categoriesStored ? JSON.parse(categoriesStored) : [];
            const snippetsStored = localStorage.getItem("snipvault_guest_snippets");
            const localSnips = snippetsStored ? JSON.parse(snippetsStored) : [];
            
            convexClient.query("auth:checkMigrationConflicts", {
                email,
                localCategories: localCats.map(c => ({ name: c.name })),
                localSnippets: localSnips.map(s => ({ text: s.text, category: s.category }))
            })
            .then(res => {
                if (res.exists) {
                    migrateConflictPanel.classList.remove("hidden");
                    migrateNewFields.classList.add("hidden");
                    migratePasswordLabel.textContent = "Enter existing account password to confirm merge";
                    migrateSubmitBtn.textContent = "Confirm Password & Merge Data";
                    migrateSubmitBtn.className = "flex-1 bg-yellow-500 hover:bg-yellow-650 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors text-sm";
                    
                    // Render details
                    migrateConflictDetails.innerHTML = '';
                    if (res.categoryConflicts.length === 0 && res.snippetConflicts.length === 0) {
                        migrateConflictDetails.innerHTML = `<p class="text-green-700 font-bold"><i class="fas fa-check-circle mr-1"></i> No content overlaps! Data will merge cleanly.</p>`;
                    } else {
                        if (res.categoryConflicts.length > 0) {
                            migrateConflictDetails.innerHTML += `<p class="font-bold text-gray-700">Categories Overlap (${res.categoryConflicts.length}):</p>`;
                            res.categoryConflicts.forEach(c => {
                                migrateConflictDetails.innerHTML += `<p class="pl-2 text-indigo-500">• Snippets of category "${c}" will merge directly into existing "${c}" folder.</p>`;
                            });
                        }
                        if (res.snippetConflicts.length > 0) {
                            migrateConflictDetails.innerHTML += `<p class="font-bold text-gray-700 mt-2">Duplicate Snippets Overlap (${res.snippetConflicts.length}):</p>`;
                            res.snippetConflicts.forEach(s => {
                                const preview = s.length > 30 ? s.substring(0,27)+'...' : s;
                                migrateConflictDetails.innerHTML += `<p class="pl-2 text-red-500">• Duplicate snippet "${preview}" will be prefixed as "[Guest] ${preview}" to avoid collision.</p>`;
                            });
                        }
                    }
                } else {
                    migrateConflictPanel.classList.add("hidden");
                    migrateNewFields.classList.remove("hidden");
                    migratePasswordLabel.textContent = "Choose password (min. 6 characters)";
                    migrateSubmitBtn.textContent = "Create Account & Sync";
                    migrateSubmitBtn.className = "flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors text-sm";
                }
            });
        });
    }

    if (migrationForm) {
        migrationForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = migrateEmailEl.value;
            const password = migratePasswordEl.value;
            
            const categoriesStored = localStorage.getItem("snipvault_guest_categories");
            const localCats = categoriesStored ? JSON.parse(categoriesStored) : [];
            const snippetsStored = localStorage.getItem("snipvault_guest_snippets");
            const localSnips = snippetsStored ? JSON.parse(snippetsStored) : [];
            
            const isMerge = !migrateConflictPanel.classList.contains("hidden");
            
            let name = undefined;
            let dob = undefined;
            let age = undefined;
            
            if (!isMerge) {
                name = migrateNameEl.value;
                dob = migrateDobEl.value;
                if (!name || !dob) {
                    showNotification("Please fill in registration details.", "error");
                    return;
                }
                age = calculateAge(dob);
            }

            showNotification(isMerge ? "Authenticating & merging vaults..." : "Creating sync account...", "info");
            
            convexClient.mutation("auth:migrateGuestData", {
                email,
                password,
                name,
                dob,
                age,
                localSnippets: localSnips.map(s => ({
                    text: s.text,
                    url: s.url,
                    category: s.category,
                    note: s.note,
                    createdAt: s.createdAt
                })),
                localCategories: localCats.map(c => ({
                    name: c.name,
                    createdAt: c.createdAt
                })),
                mergeAction: isMerge,
                device: getDeviceMetadata(),
                location: getLocationMetadata()
            })
            .then(res => {
                showNotification(isMerge ? "Guest vaults merged successfully!" : "Account created & synced!", "success");
                
                // Clear local guest cache
                localStorage.removeItem("snipvault_guest_mode");
                localStorage.removeItem("snipvault_guest_categories");
                localStorage.removeItem("snipvault_guest_snippets");
                
                // Log in user
                sessionToken = res.token;
                localStorage.setItem("snipvault_session_token", res.token);
                
                // Close modal
                migrationModalContent.classList.remove("scale-100", "opacity-100");
                migrationModalContent.classList.add("scale-95", "opacity-0");
                setTimeout(() => {
                    migrationModal.classList.add("hidden");
                }, 300);
                
                // Re-query user
                convexClient.query("auth:getUser", { token: res.token })
                    .then(user => {
                        currentUser = user;
                        loadUserCategories();
                        loadUserSnippets();
                        playIntroAnimation(() => {
                            showAppView();
                        });
                    });
            })
            .catch(err => {
                console.error(err);
                showNotification(`Migration failed: ${err.message}`, "error", 5000);
            });
        });
    }

    // --- Header & Back Navigation Toggles ---
    if (toggleAccountBtn) {
        toggleAccountBtn.addEventListener("click", showAccountView);
    }

    if (backFromAccountBtn) {
        backFromAccountBtn.addEventListener("click", showMainView);
    }

    // --- Logout Toggles ---
    if(logoutBtn) logoutBtn.addEventListener('click', () => {
        if (!sessionToken) return;
        
        if (sessionToken === "guest") {
            showNotification('Logged out from Guest Mode.', 'info');
            localStorage.removeItem('snipvault_guest_mode');
            sessionToken = null;
            currentUser = null;
            localSnippetsCache = []; 
            localCategoriesCache = [];
            renderSnippets(); 
            populateCategoryDropdown(snippetCategoryEl, []); 
            populateCategoryDropdown(filterCategoryEl, []);
            populateCategoryDropdown(editSnippetCategoryEl, []);
            showAuthView();
            return;
        }
        
        convexClient.mutation("auth:signOut", { token: sessionToken })
            .then(() => {
                showNotification('Logged out successfully.', 'info');
                localStorage.removeItem('snipvault_session_token');
                sessionToken = null;
                currentUser = null;
                localSnippetsCache = []; 
                localCategoriesCache = [];
                renderSnippets(); 
                populateCategoryDropdown(snippetCategoryEl, []); 
                populateCategoryDropdown(filterCategoryEl, []);
                populateCategoryDropdown(editSnippetCategoryEl, []);
                
                if (snippetsUnsubscribe) { snippetsUnsubscribe(); snippetsUnsubscribe = null; }
                if (categoriesUnsubscribe) { categoriesUnsubscribe(); categoriesUnsubscribe = null; }
                
                showAuthView();
            })
            .catch(error => {
                console.error("Logout error:", error);
                showNotification(`Logout failed: ${error.message}`, 'error');
            });
    });

    if(showSignupBtn) showSignupBtn.addEventListener('click', () => {
        if(loginFormContainerEl) loginFormContainerEl.classList.add('hidden');
        if(signupFormContainerEl) signupFormContainerEl.classList.remove('hidden');
    });
    if(showLoginBtn) showLoginBtn.addEventListener('click', () => {
        if(signupFormContainerEl) signupFormContainerEl.classList.add('hidden');
        if(loginFormContainerEl) loginFormContainerEl.classList.remove('hidden');
    });

    // --- Category Management (Convex + LocalStorage) ---
    function populateCategoryDropdown(selectElement, categoriesData) {
        if (!selectElement) return; 
        const currentVal = selectElement.value;
        selectElement.innerHTML = ''; 
        if (selectElement.id === 'filter-category') {
            const allOption = document.createElement('option');
            allOption.value = ""; allOption.textContent = "All Categories";
            selectElement.appendChild(allOption);
        }
        
        const userCategoryNames = categoriesData.map(c => c.name);
        const uniqueCategories = [...new Set([...defaultCategoryNames, ...userCategoryNames])].sort();

        uniqueCategories.forEach(categoryName => {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            selectElement.appendChild(option);
        });

        if (uniqueCategories.includes(currentVal)) {
            selectElement.value = currentVal;
        } else if (selectElement.id !== 'filter-category' && uniqueCategories.includes("General")) {
             selectElement.value = "General"; 
        } else if (selectElement.id !== 'filter-category' && uniqueCategories.length > 0) {
             selectElement.value = uniqueCategories[0]; 
        } else if (selectElement.id === 'filter-category') {
            selectElement.value = ""; 
        }

        initCustomDropdown(selectElement);
    }

    function initCustomDropdown(selectElement) {
        if (!selectElement) return;
        
        // Hide the native select
        selectElement.classList.add("hidden");

        // Check if custom dropdown container already exists next to it
        let customDropdown = selectElement.nextElementSibling;
        if (!customDropdown || !customDropdown.classList.contains("custom-dropdown-container")) {
            customDropdown = document.createElement("div");
            customDropdown.className = "custom-dropdown-container relative w-full sm:w-auto mt-1 flex-grow";
            selectElement.parentNode.insertBefore(customDropdown, selectElement.nextSibling);
        }

        const selectedText = selectElement.options[selectElement.selectedIndex]?.textContent || "Select Option";
        customDropdown.innerHTML = `
            <button type="button" class="dropdown-trigger-btn flex justify-between items-center w-full p-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                <span class="truncate pr-2 font-medium text-gray-800">${selectedText}</span>
                <i class="fas fa-chevron-down text-gray-400 text-xs transition-transform duration-200"></i>
            </button>
            <div class="dropdown-options-card hidden absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-[5000] max-h-60 overflow-y-auto transition-all duration-150 transform scale-95 opacity-0 origin-top">
                <div class="py-1.5 divide-y divide-gray-50 text-xs font-semibold text-gray-700"></div>
            </div>
        `;

        const triggerBtn = customDropdown.querySelector(".dropdown-trigger-btn");
        const optionsCard = customDropdown.querySelector(".dropdown-options-card");
        const optionsList = optionsCard.querySelector("div");
        const chevron = triggerBtn.querySelector(".fa-chevron-down");

        Array.from(selectElement.options).forEach((opt, idx) => {
            const optBtn = document.createElement("button");
            optBtn.type = "button";
            optBtn.className = "w-full text-left px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex justify-between items-center";
            if (idx === selectElement.selectedIndex) {
                optBtn.className += " bg-indigo-50 text-indigo-700 font-bold";
            }
            optBtn.innerHTML = `<span>${opt.textContent}</span>`;
            if (idx === selectElement.selectedIndex) {
                optBtn.innerHTML += `<i class="fas fa-check text-xs"></i>`;
            }

            optBtn.addEventListener("click", () => {
                selectElement.selectedIndex = idx;
                selectElement.dispatchEvent(new Event("change"));
                closeDropdown();
            });

            optionsList.appendChild(optBtn);
        });

        function openDropdown() {
            document.querySelectorAll(".dropdown-options-card").forEach(el => {
                if (el !== optionsCard) {
                    el.classList.add("hidden");
                    const ch = el.previousElementSibling?.querySelector(".fa-chevron-down");
                    if (ch) ch.classList.remove("rotate-180");
                }
            });

            optionsCard.classList.remove("hidden");
            optionsCard.offsetHeight;
            optionsCard.classList.remove("scale-95", "opacity-0");
            optionsCard.classList.add("scale-100", "opacity-100");
            chevron.classList.add("rotate-180");
        }

        function closeDropdown() {
            optionsCard.classList.remove("scale-100", "opacity-100");
            optionsCard.classList.add("scale-95", "opacity-0");
            chevron.classList.remove("rotate-180");
            setTimeout(() => {
                optionsCard.classList.add("hidden");
            }, 150);
        }

        triggerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (optionsCard.classList.contains("hidden")) {
                openDropdown();
            } else {
                closeDropdown();
            }
        });

        document.addEventListener("click", (e) => {
            if (!customDropdown.contains(e.target)) {
                closeDropdown();
            }
        });
    }

    const defaultGuestCategories = ["General", "Code Snippets", "Recipes", "Bookmarks", "Ideas", "Learning"].map((name, i) => ({
        _id: `guest_cat_${name.replace(/\s+/g, "_")}`,
        name: name,
        createdAt: Date.now() + i
    }));

    function loadUserCategories() {
        if (!sessionToken) return;

        // Guest Mode Categories
        if (sessionToken === "guest") {
            let stored = localStorage.getItem("snipvault_guest_categories");
            if (!stored) {
                localStorage.setItem("snipvault_guest_categories", JSON.stringify(defaultGuestCategories));
                localCategoriesCache = defaultGuestCategories;
            } else {
                try {
                    localCategoriesCache = JSON.parse(stored);
                } catch(e) {
                    localCategoriesCache = defaultGuestCategories;
                }
            }
            populateCategoryDropdown(snippetCategoryEl, localCategoriesCache);
            populateCategoryDropdown(filterCategoryEl, localCategoriesCache);
            return;
        }

        // Load from local storage cache immediately for offline / instant load support
        const cached = localStorage.getItem(`snipvault_cached_categories_${sessionToken}`);
        if (cached) {
            try {
                localCategoriesCache = JSON.parse(cached);
                populateCategoryDropdown(snippetCategoryEl, localCategoriesCache);
                populateCategoryDropdown(filterCategoryEl, localCategoriesCache);
            } catch(e) {}
        }

        if (!navigator.onLine) {
            return; // Don't try to connect to Convex if offline
        }

        // Standard Convex Categories
        if (categoriesUnsubscribe) categoriesUnsubscribe(); 

        categoriesUnsubscribe = convexClient.onUpdate("categories:list", { token: sessionToken }, (categoriesList) => {
            localCategoriesCache = categoriesList;
            localStorage.setItem(`snipvault_cached_categories_${sessionToken}`, JSON.stringify(categoriesList));
            populateCategoryDropdown(snippetCategoryEl, localCategoriesCache);
            populateCategoryDropdown(filterCategoryEl, localCategoriesCache);
            
            if (editSnippetCategoryEl && !detailViewEl.classList.contains('hidden') && !detailContentEditEl.classList.contains('hidden')) {
                const currentEditCategory = editSnippetCategoryEl.value;
                populateCategoryDropdown(editSnippetCategoryEl, localCategoriesCache);
                const allPossibleCategories = [...new Set([...defaultCategoryNames, ...localCategoriesCache.map(c => c.name)])];
                if (allPossibleCategories.includes(currentEditCategory)) {
                     editSnippetCategoryEl.value = currentEditCategory;
                }
            }
        }, error => {
            console.error("Error loading categories: ", error);
            showNotification("Failed to load categories.", "error");
        });
    }

    async function handleAddCategory() {
        if (!sessionToken) {
            showNotification('You must be logged in to add categories.', 'error');
            return;
        }
        const newCategoryName = newCategoryNameEl.value.trim();
        if (newCategoryName === '') {
            showNotification('Category name cannot be empty.', 'error');
            return;
        }
        const allExistingCategoryNames = [...new Set([...localCategoriesCache.map(c => c.name.toLowerCase()), ...defaultCategoryNames.map(c => c.toLowerCase())])];
        if (allExistingCategoryNames.includes(newCategoryName.toLowerCase())) {
            showNotification('This category name already exists or is a default option.', 'info');
            newCategoryNameEl.value = '';
            return;
        }

        // Guest Mode Insertion
        if (sessionToken === "guest") {
            const newCat = {
                _id: `guest_cat_${newCategoryName.replace(/\s+/g, "_")}_${Date.now()}`,
                name: newCategoryName,
                createdAt: Date.now()
            };
            localCategoriesCache.push(newCat);
            localStorage.setItem("snipvault_guest_categories", JSON.stringify(localCategoriesCache));
            newCategoryNameEl.value = '';
            showNotification(`Category "${newCategoryName}" added locally.`, 'success');
            loadUserCategories();
            return;
        }

        // Standard Convex Insertion
        try {
            await convexClient.mutation("categories:create", { 
                token: sessionToken,
                name: newCategoryName
            });
            newCategoryNameEl.value = '';
            showNotification(`Category "${newCategoryName}" added.`, 'success');
        } catch (error) {
            console.error("Error adding category: ", error);
            showNotification('Failed to add category.', 'error');
        }
    }

    // --- Snippet Management (Convex + LocalStorage) ---
    function loadUserSnippets() {
        if (!sessionToken) return;

        // Guest Mode Snippets
        if (sessionToken === "guest") {
            let stored = localStorage.getItem("snipvault_guest_snippets");
            let snippetsList = [];
            if (stored) {
                try {
                    snippetsList = JSON.parse(stored);
                } catch(e) {
                    snippetsList = [];
                }
            }
            localSnippetsCache = snippetsList.map(doc => ({ id: doc._id, ...doc }));
            renderSnippets();
            return;
        }

        // Load from local storage cache immediately for offline support
        const cached = localStorage.getItem(`snipvault_cached_snippets_${sessionToken}`);
        if (cached) {
            try {
                localSnippetsCache = JSON.parse(cached).map(doc => ({ id: doc._id, ...doc }));
                renderSnippets();
            } catch(e) {}
        }

        if (!navigator.onLine) {
            // Include offline snippets that are pending sync so they show up in the list!
            getOfflineSnippets().then(offlineSnippets => {
                const userOffline = offlineSnippets.filter(s => s.token === sessionToken);
                if (userOffline.length > 0) {
                    const merged = [...userOffline.map(s => ({ ...s, _id: s.id, id: s.id, isOfflinePending: true })), ...localSnippetsCache];
                    // De-duplicate in case they are already there
                    const seen = new Set();
                    localSnippetsCache = merged.filter(item => {
                        const duplicate = seen.has(item.id);
                        seen.add(item.id);
                        return !duplicate;
                    });
                    renderSnippets();
                }
            });
            return;
        }

        // Standard Convex Snippets
        if (snippetsUnsubscribe) snippetsUnsubscribe(); 

        snippetsUnsubscribe = convexClient.onUpdate("snippets:list", { token: sessionToken }, async (snippetsList) => {
            // Save to local cache
            localStorage.setItem(`snipvault_cached_snippets_${sessionToken}`, JSON.stringify(snippetsList));
            
            // Get any pending offline snippets so we can display them together with the cloud snippets!
            const offlineSnippets = await getOfflineSnippets();
            const userOffline = offlineSnippets.filter(s => s.token === sessionToken);
            
            const mergedList = [...userOffline.map(s => ({ ...s, _id: s.id, id: s.id, isOfflinePending: true })), ...snippetsList];
            
            const seen = new Set();
            localSnippetsCache = mergedList.map(doc => ({ id: doc._id || doc.id, ...doc })).filter(item => {
                const duplicate = seen.has(item.id);
                seen.add(item.id);
                return !duplicate;
            });
            renderSnippets(); 
        }, error => {
            console.error("Error loading snippets: ", error);
            showNotification("Failed to load snippets.", "error");
        });
    }
    
    function renderSnippets(isNewSnippetAdded = false) {
        if (!snippetsListEl) return; 
        let snippetsToRender = [...localSnippetsCache]; 
        const searchTerm = searchInputEl ? searchInputEl.value.toLowerCase() : "";
        const selectedCategoryFilter = filterCategoryEl ? filterCategoryEl.value : "";

        if (searchTerm) {
            snippetsToRender = snippetsToRender.filter(s => 
                s.text.toLowerCase().includes(searchTerm) ||
                (s.note && s.note.toLowerCase().includes(searchTerm)) ||
                (s.url && s.url.toLowerCase().includes(searchTerm)) ||
                s.category.toLowerCase().includes(searchTerm)
            );
        }
        if (selectedCategoryFilter) {
            snippetsToRender = snippetsToRender.filter(s => s.category === selectedCategoryFilter);
        }

        snippetsListEl.innerHTML = '';
        if (snippetsToRender.length === 0) {
            const message = (searchTerm || selectedCategoryFilter) 
                ? "No snippets match your current filter." 
                : "Your vault is empty! Add your first snippet.";
            snippetsListEl.innerHTML = `<p class="no-snippets-message"><i class="fas fa-folder-open fa-2x mb-3 text-gray-400"></i><br>${message}</p>`;
            return;
        }

        snippetsToRender.forEach((snippet) => {
            const snippetItem = document.createElement('div');
            snippetItem.className = 'snippet-item';
            if (isNewSnippetAdded && localSnippetsCache.length > 0 && snippet.id === localSnippetsCache[0].id) { 
                snippetItem.classList.add('new-snippet-animation');
            }
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'snippet-header';
            const titleCategoryDiv = document.createElement('div');
            titleCategoryDiv.className = 'snippet-title-category flex items-center';
            const categoryTag = document.createElement('span');
            categoryTag.className = 'snippet-category-tag';
            categoryTag.textContent = snippet.category || 'General';
            titleCategoryDiv.appendChild(categoryTag);
            if (snippet.isOfflinePending) {
                const pendingBadge = document.createElement('span');
                pendingBadge.className = 'bg-yellow-100 text-yellow-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1.5 flex items-center gap-1';
                pendingBadge.innerHTML = `<i class="fas fa-clock text-[8px] animate-pulse"></i> Offline Pending`;
                titleCategoryDiv.appendChild(pendingBadge);
            }
            headerDiv.appendChild(titleCategoryDiv);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'snippet-actions';
            const editBtn = document.createElement('button');
            editBtn.innerHTML = `<i class="fas fa-edit"></i> Edit`;
            editBtn.className = 'action-btn edit-btn';
            editBtn.title = "Edit snippet";
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); showDetailView(snippet.id, 'edit'); });
            actionsDiv.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Delete`;
            deleteBtn.className = 'action-btn delete-btn';
            deleteBtn.title = "Delete snippet";
            deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteSnippet(snippet.id); });
            actionsDiv.appendChild(deleteBtn);
            headerDiv.appendChild(actionsDiv);
            snippetItem.appendChild(headerDiv);
            const textPreviewP = document.createElement('div');
            textPreviewP.className = 'snippet-text-preview max-h-[120px] overflow-hidden whitespace-normal break-words prose max-w-none';
            textPreviewP.innerHTML = snippet.text;
            snippetItem.appendChild(textPreviewP);
            const readMoreBtn = document.createElement('button');
            readMoreBtn.className = 'read-more-btn';
            readMoreBtn.innerHTML = 'Read More <i class="fas fa-arrow-right ml-1"></i>';
            readMoreBtn.addEventListener('click', () => showDetailView(snippet.id, 'view'));
            snippetItem.appendChild(readMoreBtn);
            const metaListDiv = document.createElement('div');
            metaListDiv.className = 'snippet-meta-list-view';
            if (snippet.url) {
                metaListDiv.innerHTML += `<p><i class="fas fa-link"></i> <a href="${snippet.url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${snippet.url.length > 30 ? snippet.url.substring(0,27)+'...' : snippet.url}</a></p>`;
            }
            if (snippet.note) {
                 metaListDiv.innerHTML += `<p><i class="fas fa-sticky-note"></i> ${snippet.note.length > 30 ? snippet.note.substring(0,27)+'...' : snippet.note}</p>`;
            }
            const createdAtDate = new Date(snippet.createdAt);
            metaListDiv.innerHTML += `<p><i class="fas fa-calendar-alt"></i> ${createdAtDate.toLocaleDateString()}</p>`;
            snippetItem.appendChild(metaListDiv);
            snippetsListEl.appendChild(snippetItem);
        });
        if (isNewSnippetAdded && snippetsListEl.firstChild) {
            snippetsListEl.firstChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async function handleSaveSnippet() {
        if (!sessionToken) {
            showNotification('You must be logged in to save snippets.', 'error');
            return;
        }
        const text = snippetTextEl.value.trim();
        const urlInput = snippetUrlEl.value.trim();
        const category = snippetCategoryEl.value || "General"; 
        const note = snippetNoteEl.value.trim();

        if (text === '') {
            showNotification('Snippet content cannot be empty.', 'error');
            return;
        }
        const url = (urlInput && !(urlInput.startsWith('http://') || urlInput.startsWith('https://'))) ? `http://${urlInput}` : urlInput;

        // Guest Mode Insertion
        if (sessionToken === "guest") {
            let stored = localStorage.getItem("snipvault_guest_snippets");
            let list = stored ? JSON.parse(stored) : [];
            const newSnippet = {
                _id: `guest_snip_${Date.now()}`,
                text,
                url: url || undefined,
                category,
                note: note || undefined,
                createdAt: Date.now()
            };
            list.unshift(newSnippet);
            localStorage.setItem("snipvault_guest_snippets", JSON.stringify(list));
            
            if(snippetTextEl) snippetTextEl.value = ''; 
            if(snippetUrlEl) snippetUrlEl.value = ''; 
            if(snippetNoteEl) snippetNoteEl.value = ''; 
            if(snippetCategoryEl) snippetCategoryEl.value = "General"; 
            if(snippetTextEl) snippetTextEl.focus();
            showNotification('Snippet saved locally successfully!', 'success');
            loadUserSnippets();
            return;
        }

        // Standard Convex Insertion with Offline Fallback
        if (!navigator.onLine) {
            try {
                const tempId = Date.now();
                const newSnippet = {
                    id: tempId,
                    text,
                    url: url || undefined,
                    category,
                    note: note || undefined,
                    createdAt: Date.now(),
                    token: sessionToken
                };
                await saveOfflineSnippet(newSnippet);

                // Add to local UI cache so it renders immediately
                const uiSnippet = {
                    id: tempId,
                    text,
                    url: url || undefined,
                    category,
                    note: note || undefined,
                    createdAt: newSnippet.createdAt,
                    _id: tempId
                };
                localSnippetsCache.unshift(uiSnippet);
                renderSnippets(true);

                if(snippetTextEl) snippetTextEl.value = ''; 
                if(snippetUrlEl) snippetUrlEl.value = ''; 
                if(snippetNoteEl) snippetNoteEl.value = ''; 
                if(snippetCategoryEl) snippetCategoryEl.value = "General"; 
                if(snippetTextEl) snippetTextEl.focus();

                showOfflineBanner();
                showNotification('Snippet saved locally (Offline mode). Will sync when online.', 'success');
            } catch (err) {
                console.error("IndexedDB error:", err);
                showNotification('Failed to save snippet locally.', 'error');
            }
            return;
        }

        try {
            await convexClient.mutation("snippets:create", {
                token: sessionToken,
                text,
                url: url || undefined,
                category,
                note: note || undefined
            });
            if(snippetTextEl) snippetTextEl.value = ''; 
            if(snippetUrlEl) snippetUrlEl.value = ''; 
            if(snippetNoteEl) snippetNoteEl.value = ''; 
            if(snippetCategoryEl) snippetCategoryEl.value = "General"; 
            if(snippetTextEl) snippetTextEl.focus();
            showNotification('Snippet saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving snippet (falling back to local DB): ", error);
            try {
                const tempId = Date.now();
                const newSnippet = {
                    id: tempId,
                    text,
                    url: url || undefined,
                    category,
                    note: note || undefined,
                    createdAt: Date.now(),
                    token: sessionToken
                };
                await saveOfflineSnippet(newSnippet);

                const uiSnippet = {
                    id: tempId,
                    text,
                    url: url || undefined,
                    category,
                    note: note || undefined,
                    createdAt: newSnippet.createdAt,
                    _id: tempId
                };
                localSnippetsCache.unshift(uiSnippet);
                renderSnippets(true);

                if(snippetTextEl) snippetTextEl.value = ''; 
                if(snippetUrlEl) snippetUrlEl.value = ''; 
                if(snippetNoteEl) snippetNoteEl.value = ''; 
                if(snippetCategoryEl) snippetCategoryEl.value = "General"; 
                if(snippetTextEl) snippetTextEl.focus();

                showOfflineBanner();
                showNotification('Snippet saved locally (Offline sync pending).', 'success');
            } catch (err) {
                console.error("IndexedDB fallback error:", err);
                showNotification('Failed to save snippet.', 'error');
            }
        }
    }
    
    async function handleSaveEditedSnippet() {
        if (!sessionToken) {
            showNotification('You must be logged in to edit snippets.', 'error');
            return;
        }
        const id = editSnippetIdEl.value;
        const text = editSnippetTextEl.value.trim();
        const urlInput = editSnippetUrlEl.value.trim();
        const category = editSnippetCategoryEl.value || "General";
        const note = editSnippetNoteEl.value.trim();

        if (text === '') {
            showNotification('Snippet content cannot be empty.', 'error');
            return;
        }
        const url = (urlInput && !(urlInput.startsWith('http://') || urlInput.startsWith('https://'))) ? `http://${urlInput}` : urlInput;
        
        // Guest Mode Edit
        if (sessionToken === "guest") {
            let stored = localStorage.getItem("snipvault_guest_snippets");
            let list = stored ? JSON.parse(stored) : [];
            const index = list.findIndex(s => s._id === id);
            if (index !== -1) {
                list[index].text = text;
                list[index].url = url || undefined;
                list[index].category = category;
                list[index].note = note || undefined;
                localStorage.setItem("snipvault_guest_snippets", JSON.stringify(list));
                showNotification('Snippet updated locally!', 'success');
                loadUserSnippets();
                showDetailView(id, 'view');
            } else {
                showNotification('Snippet not found.', 'error');
            }
            return;
        }

        // Standard Convex Edit
        try {
            await convexClient.mutation("snippets:update", {
                token: sessionToken,
                id,
                text,
                url: url || undefined,
                category,
                note: note || undefined
            });
            showNotification('Snippet updated successfully!', 'success');
            showDetailView(id, 'view'); 
        } catch (error) {
            console.error("Error updating snippet: ", error);
            showNotification('Failed to update snippet.', 'error');
        }
    }

    async function handleDeleteSnippet(snippetId) {
        if (!sessionToken) {
            showNotification('You must be logged in to delete snippets.', 'error');
            return;
        }
        customConfirm('Are you sure you want to permanently delete this snippet?', 'Delete Snippet?', 'fa-trash-alt').then(async (confirmed) => {
            if (confirmed) {
                // Check if it is an offline-pending snippet (which has a numeric/Date.now() ID)
                const isOfflineSnippet = typeof snippetId === 'number' || !isNaN(snippetId);
                if (isOfflineSnippet) {
                    try {
                        await deleteOfflineSnippet(Number(snippetId));
                        showNotification('Offline pending snippet removed.', 'info');
                        localSnippetsCache = localSnippetsCache.filter(s => s.id !== snippetId);
                        renderSnippets();
                        if (currentEditingSnippetId === snippetId && detailViewEl && !detailViewEl.classList.contains('hidden')) { 
                            showMainView(); 
                        }
                        return;
                    } catch(err) {
                        console.error("Error deleting offline snippet:", err);
                        showNotification('Failed to remove offline snippet.', 'error');
                        return;
                    }
                }

                // Guest Mode Delete
                if (sessionToken === "guest") {
                    let stored = localStorage.getItem("snipvault_guest_snippets");
                    let list = stored ? JSON.parse(stored) : [];
                    list = list.filter(s => s._id !== snippetId);
                    localStorage.setItem("snipvault_guest_snippets", JSON.stringify(list));
                    showNotification('Snippet deleted.', 'info');
                    loadUserSnippets();
                    if (currentEditingSnippetId === snippetId && detailViewEl && !detailViewEl.classList.contains('hidden')) { 
                        showMainView(); 
                    }
                    return;
                }

                // Standard Convex Delete
                try {
                    await convexClient.mutation("snippets:deleteSnippet", {
                        token: sessionToken,
                        id: snippetId
                    });
                    showNotification('Snippet deleted.', 'info');
                    if (currentEditingSnippetId === snippetId && detailViewEl && !detailViewEl.classList.contains('hidden')) { 
                        showMainView(); 
                    }
                } catch (error) {
                    console.error("Error deleting snippet: ", error);
                    showNotification('Failed to delete snippet.', 'error');
                }
            }
        });
    }
    
    function setFooterYear() {
        if(currentYearEl) currentYearEl.textContent = new Date().getFullYear();
    }

    // --- Event Listeners ---
    if(addCategoryBtn) addCategoryBtn.addEventListener('click', handleAddCategory);
    if(saveSnippetBtn) saveSnippetBtn.addEventListener('click', async () => {
        await handleSaveSnippet();
        const snippetWysiwyg = document.getElementById('snippet-wysiwyg');
        if(snippetWysiwyg) snippetWysiwyg.innerHTML = '';
    });
    if(searchInputEl) searchInputEl.addEventListener('input', () => renderSnippets()); 
    if(filterCategoryEl) filterCategoryEl.addEventListener('change', () => renderSnippets()); 

    if(backToListBtn) backToListBtn.addEventListener('click', showMainView);
    if(editSnippetFromViewBtn) editSnippetFromViewBtn.addEventListener('click', () => {
        if (currentEditingSnippetId) showDetailView(currentEditingSnippetId, 'edit');
    });
    if(saveEditedSnippetBtn) saveEditedSnippetBtn.addEventListener('click', handleSaveEditedSnippet);
    if(cancelEditSnippetBtn) cancelEditSnippetBtn.addEventListener('click', () => {
        if (currentEditingSnippetId) showDetailView(currentEditingSnippetId, 'view');
    });

    // --- Mandatory Terms & Compliance Onboarding Flow ---
    let tcAgreedState = {
        signup: { terms: false, privacy: false },
        guest: { terms: false, privacy: false },
        migrate: { terms: false, privacy: false }
    };

    function checkAgreementStatus(type) {
        const checkbox = document.getElementById(`${type}-agree-checkbox`);
        const submitBtn = type === 'signup' ? document.getElementById("signup-submit-btn")
                        : type === 'guest' ? document.getElementById("confirm-guest-btn")
                        : document.getElementById("migrate-submit-btn");

        if (!checkbox || !submitBtn) return;

        const bothAgreed = tcAgreedState[type].terms && tcAgreedState[type].privacy;
        
        if (bothAgreed) {
            checkbox.disabled = false;
            checkbox.checked = true;
            checkbox.classList.remove("cursor-not-allowed");
            
            // Unlock action submit button
            submitBtn.disabled = false;
            submitBtn.classList.remove("bg-gray-300", "text-gray-500", "cursor-not-allowed");
            if (type === 'signup') {
                submitBtn.className = "w-full bg-indigo-100 hover:bg-indigo-200 border border-indigo-350 text-indigo-850 font-bold py-3 px-6 rounded shadow-sm transition-all duration-305 text-sm flex items-center justify-center space-x-2 mt-2 transform hover:scale-[1.015]";
            } else if (type === 'guest') {
                submitBtn.className = "flex-1 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 font-bold py-3 px-4 rounded shadow-sm transition-colors text-sm transform hover:scale-[1.02]";
            } else if (type === 'migrate') {
                submitBtn.className = "flex-1 bg-green-50 hover:bg-green-100 border border-green-150 text-green-700 font-bold py-3 px-4 rounded shadow-sm transition-colors text-sm transform hover:scale-[1.02]";
            }
        } else {
            checkbox.disabled = true;
            checkbox.checked = false;
            checkbox.classList.add("cursor-not-allowed");
            
            // Lock action submit button
            submitBtn.disabled = true;
            submitBtn.className = "w-full bg-gray-100 border border-gray-300 text-gray-400 font-bold py-3 px-6 rounded shadow-sm cursor-not-allowed transition-all duration-300 text-sm flex items-center justify-center space-x-2 mt-2";
            if (type === 'guest' || type === 'migrate') {
                submitBtn.className = "flex-1 bg-gray-100 border border-gray-300 text-gray-400 font-bold py-3 px-4 rounded shadow-sm cursor-not-allowed transition-colors text-sm";
            }
        }
    }

    let readingCountdownTimer = null;

    function openPolicyReadingModal(policyType, flowType) {
        const prefix = flowType === 'signup' ? 'auth' : flowType;
        const panel = document.getElementById(`${prefix}-policy-panel`);
        const titleEl = document.getElementById(`${prefix}-policy-title`);
        const bodyEl = document.getElementById(`${prefix}-policy-body`);
        const timerTextEl = document.getElementById(`${prefix}-policy-timer-text`);
        const agreeBtn = document.getElementById(`${prefix}-policy-agree-btn`);
        const closeBtn = document.getElementById(`${prefix}-policy-close-btn`);

        if (!panel || !bodyEl || !timerTextEl || !agreeBtn || !closeBtn) return;

        const isTerms = policyType === 'terms';
        titleEl.textContent = isTerms ? "Terms & Conditions" : "Privacy Policy";
        bodyEl.innerHTML = "<div class='text-center py-8 font-sans font-semibold text-gray-500'><i class='fas fa-spinner fa-spin mr-2'></i>Loading policy content...</div>";
        
        // Open slide-over transition
        panel.classList.remove("hidden");
        panel.offsetHeight; // trigger reflow
        panel.classList.remove("translate-x-full");
        panel.classList.add("translate-x-0");

        let count = 5;
        agreeBtn.disabled = true;
        agreeBtn.className = "bg-gray-100 border border-gray-300 text-gray-400 font-semibold py-2 px-4 rounded shadow-sm text-xs cursor-not-allowed transition-all duration-300";
        agreeBtn.textContent = `Agree (5s)`;
        timerTextEl.textContent = "Please read completely.";
        timerTextEl.className = "text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded animate-pulse";

        if (readingCountdownTimer) clearInterval(readingCountdownTimer);
        readingCountdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                agreeBtn.textContent = `Agree (${count}s)`;
            } else {
                clearInterval(readingCountdownTimer);
                agreeBtn.disabled = false;
                agreeBtn.className = "bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-800 font-bold py-2 px-4 rounded shadow-sm transition-all duration-150 transform hover:scale-[1.02] text-xs cursor-pointer";
                agreeBtn.textContent = "I Agree and Accept";
                timerTextEl.textContent = "You can now agree.";
                timerTextEl.className = "text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded";
            }
        }, 1000);

        const fetchUrl = isTerms ? "terms.html" : "privacy.html";
        fetch(fetchUrl)
            .then(res => res.text())
            .then(html => {
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = html;
                const article = tempDiv.querySelector("article");
                if (article) {
                    const articleClone = article.cloneNode(true);
                    
                    // Remove redundant top headings
                    const mainH1 = articleClone.querySelector("h1");
                    if (mainH1) mainH1.remove();

                    // Clear excessive paddings/margins/sizes optimized for Auth Page
                    articleClone.querySelectorAll("h2").forEach(h2 => {
                        h2.className = "text-[12px] font-extrabold text-gray-800 mt-4 mb-1.5 font-mono flex items-center";
                    });
                    articleClone.querySelectorAll("p").forEach(p => {
                        p.className = "text-[10.5px] text-gray-600 mb-2 leading-relaxed";
                    });
                    articleClone.querySelectorAll("ul").forEach(ul => {
                        ul.className = "list-disc list-inside text-[10.5px] text-gray-600 space-y-1 mb-2";
                    });
                    articleClone.querySelectorAll("div").forEach(div => {
                        div.className = "p-2.5 bg-yellow-50 border-l-4 border-yellow-500 font-mono text-[9px] text-yellow-800 mb-2 rounded-md";
                    });
                    articleClone.querySelectorAll("table").forEach(table => {
                        table.className = "min-w-full text-[9px] text-left mb-2 border border-gray-250 rounded-lg overflow-hidden";
                    });
                    articleClone.querySelectorAll("tr").forEach(tr => {
                        tr.className = "border-b border-gray-150 hover:bg-indigo-50/20";
                    });
                    articleClone.querySelectorAll("td").forEach(td => {
                        td.className = "p-1.5 font-mono text-gray-650";
                    });
                    articleClone.querySelectorAll("th").forEach(th => {
                        th.className = "p-1.5 bg-gray-105 font-bold text-gray-700 uppercase font-sans";
                    });

                    bodyEl.innerHTML = articleClone.innerHTML;
                } else {
                    bodyEl.textContent = "Failed to load formatting. Please refer to direct pages.";
                }
            })
            .catch(err => {
                bodyEl.innerHTML = `
                    <h4 class="font-bold text-gray-850 mb-1.5 text-xs">${isTerms ? "SnipVault Terms of Service Summary" : "SnipVault Privacy Shield & Policy Summary"}</h4>
                    <p class="mb-2 text-[10.5px] leading-relaxed">By accessing SnipVault, you explicitly agree to these clear developer-centric terms:</p>
                    <ul class="list-disc pl-4 space-y-1 text-[10.5px] mb-2">
                        <li><strong>Data Ownership:</strong> All snippets and categories belong 100% to you. I host no mining or selling tools.</li>
                        <li><strong>Secure Sessions:</strong> I use safe salt/hashing on Brevo & Convex. You are responsible for keeping passwords secure.</li>
                        <li><strong>GDPR Compliance:</strong> You can export everything as JSON or wipe all cloud records instantly with zero residuals.</li>
                        <li><strong>Offline Sandbox:</strong> In guest mode, all snippets stay locally inside your browser storage completely offline.</li>
                    </ul>
                    <p class="font-bold text-indigo-600 text-[10.5px]">SnipVault is crafted by Rohit as a 100% free open-source utility.</p>
                `;
            });

        const closePanel = () => {
            clearInterval(readingCountdownTimer);
            panel.classList.remove("translate-x-0");
            panel.classList.add("translate-x-full");
            setTimeout(() => {
                panel.classList.add("hidden");
            }, 300);

            // Clean event listener clones
            const newAgreeBtn = agreeBtn.cloneNode(true);
            const newCloseBtn = closeBtn.cloneNode(true);
            agreeBtn.replaceWith(newAgreeBtn);
            closeBtn.replaceWith(newCloseBtn);
        };

        closeBtn.addEventListener("click", closePanel);
        agreeBtn.addEventListener("click", () => {
            tcAgreedState[flowType][policyType] = true;
            checkAgreementStatus(flowType);
            closePanel();
            showNotification(`Agreed to ${isTerms ? 'Terms & Conditions' : 'Privacy Policy'} successfully!`, "success");
        });
    }

    setTimeout(() => {
        const signupTermsLink = document.getElementById("signup-terms-link");
        const signupPrivacyLink = document.getElementById("signup-privacy-link");
        const guestTermsLink = document.getElementById("guest-terms-link");
        const guestPrivacyLink = document.getElementById("guest-privacy-link");
        const migrateTermsLink = document.getElementById("migrate-terms-link");
        const migratePrivacyLink = document.getElementById("migrate-privacy-link");

        if (signupTermsLink) signupTermsLink.addEventListener("click", () => openPolicyReadingModal('terms', 'signup'));
        if (signupPrivacyLink) signupPrivacyLink.addEventListener("click", () => openPolicyReadingModal('privacy', 'signup'));
        if (guestTermsLink) guestTermsLink.addEventListener("click", () => openPolicyReadingModal('terms', 'guest'));
        if (guestPrivacyLink) guestPrivacyLink.addEventListener("click", () => openPolicyReadingModal('privacy', 'guest'));
        if (migrateTermsLink) migrateTermsLink.addEventListener("click", () => openPolicyReadingModal('terms', 'migrate'));
        if (migratePrivacyLink) migratePrivacyLink.addEventListener("click", () => openPolicyReadingModal('privacy', 'migrate'));
    }, 100);

    // --- Custom Confirm Modal Promise ---
    function customConfirm(message, title = "Are you sure?", iconClass = "fa-question-circle") {
        return new Promise((resolve) => {
            const modal = document.getElementById("custom-confirm-modal");
            const content = document.getElementById("custom-confirm-modal-content");
            const titleEl = document.getElementById("custom-confirm-title");
            const messageEl = document.getElementById("custom-confirm-message");
            const iconEl = document.getElementById("custom-confirm-icon");
            const yesBtn = document.getElementById("custom-confirm-yes-btn");
            const noBtn = document.getElementById("custom-confirm-no-btn");

            if (!modal || !content) {
                resolve(confirm(message));
                return;
            }

            titleEl.textContent = title;
            messageEl.textContent = message;
            iconEl.className = `fas ${iconClass} fa-2x`;

            modal.classList.remove("hidden");
            modal.offsetHeight; // trigger reflow
            content.classList.remove("scale-95", "opacity-0");
            content.classList.add("scale-100", "opacity-100");

            const handleDecision = (choice) => {
                content.classList.remove("scale-100", "opacity-100");
                content.classList.add("scale-95", "opacity-0");
                setTimeout(() => {
                    modal.classList.add("hidden");
                }, 300);
                
                yesBtn.replaceWith(yesBtn.cloneNode(true));
                noBtn.replaceWith(noBtn.cloneNode(true));
                resolve(choice);
            };

            document.getElementById("custom-confirm-yes-btn").addEventListener("click", () => handleDecision(true));
            document.getElementById("custom-confirm-no-btn").addEventListener("click", () => handleDecision(false));
        });
    }

    // --- Custom Context Menu Logic & Handlers ---
    document.addEventListener("contextmenu", (e) => {
        // Prevent default context menu
        e.preventDefault();
        showCustomContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener("click", (e) => {
        const menu = document.getElementById("custom-context-menu");
        if (menu && !menu.contains(e.target)) {
            hideCustomContextMenu();
        }
    });

    function showCustomContextMenu(x, y) {
        const menu = document.getElementById("custom-context-menu");
        if (!menu) return;

        // Check text selection
        const selection = window.getSelection().toString().trim();
        const quickSaveBtn = document.getElementById("menu-quick-save");
        if (quickSaveBtn) {
            if (selection.length > 0) {
                quickSaveBtn.classList.remove("hidden");
                quickSaveBtn.classList.add("flex");
            } else {
                quickSaveBtn.classList.add("hidden");
                quickSaveBtn.classList.remove("flex");
            }
        }

        // Context-aware options visibility filtering
        const newSnippetBtn = document.getElementById("menu-new-snippet");
        const openVaultBtn = document.getElementById("menu-open-vault");
        const manageAccountBtn = document.getElementById("menu-manage-account");
        const exportBackupBtn = document.getElementById("menu-export-backup");
        const syncBtn = document.getElementById("menu-sync");
        const logoutBtn = document.getElementById("menu-logout");

        const isOnAuthPage = appContainer && appContainer.classList.contains("hidden");

        if (isOnAuthPage) {
            // Hide all app-specific controls on Auth page
            if (newSnippetBtn) newSnippetBtn.classList.add("hidden");
            if (openVaultBtn) openVaultBtn.classList.add("hidden");
            if (manageAccountBtn) manageAccountBtn.classList.add("hidden");
            if (exportBackupBtn) exportBackupBtn.classList.add("hidden");
            if (syncBtn) syncBtn.classList.add("hidden");
            if (logoutBtn) logoutBtn.classList.add("hidden");
        } else {
            // App-specific controls visible based on login session state
            if (newSnippetBtn) newSnippetBtn.classList.remove("hidden");
            if (openVaultBtn) openVaultBtn.classList.remove("hidden");

            if (sessionToken === "guest") {
                if (manageAccountBtn) manageAccountBtn.classList.add("hidden");
                if (exportBackupBtn) exportBackupBtn.classList.add("hidden");
                if (syncBtn) {
                    syncBtn.classList.remove("hidden");
                    syncBtn.classList.add("flex");
                }
                if (logoutBtn) {
                    logoutBtn.classList.remove("hidden");
                    logoutBtn.classList.add("flex");
                }
            } else if (sessionToken) {
                if (manageAccountBtn) manageAccountBtn.classList.remove("hidden");
                if (exportBackupBtn) exportBackupBtn.classList.remove("hidden");
                if (syncBtn) syncBtn.classList.add("hidden");
                if (logoutBtn) {
                    logoutBtn.classList.remove("hidden");
                    logoutBtn.classList.add("flex");
                }
            } else {
                if (manageAccountBtn) manageAccountBtn.classList.add("hidden");
                if (exportBackupBtn) exportBackupBtn.classList.add("hidden");
                if (syncBtn) syncBtn.classList.add("hidden");
                if (logoutBtn) logoutBtn.classList.add("hidden");
            }
        }

        const menuWidth = 224; // matches w-56
        const menuHeight = menu.offsetHeight || 220;
        
        let targetX = x;
        let targetY = y;

        if (x + menuWidth > window.innerWidth) {
            targetX = window.innerWidth - menuWidth - 8;
        }
        if (y + menuHeight > window.innerHeight) {
            targetY = window.innerHeight - menuHeight - 8;
        }

        menu.style.left = `${targetX}px`;
        menu.style.top = `${targetY}px`;

        menu.classList.remove("hidden");
        menu.offsetHeight; // trigger reflow
        menu.classList.remove("scale-95", "opacity-0");
        menu.classList.add("scale-100", "opacity-100");
    }

    function hideCustomContextMenu() {
        const menu = document.getElementById("custom-context-menu");
        if (!menu) return;
        menu.classList.remove("scale-100", "opacity-100");
        menu.classList.add("scale-95", "opacity-0");
        setTimeout(() => {
            menu.classList.add("hidden");
        }, 150);
    }

    // Long press detection for mobile touchscreen users
    let touchTimer = null;
    let touchX = 0;
    let touchY = 0;

    document.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            touchX = e.touches[0].clientX;
            touchY = e.touches[0].clientY;
            touchTimer = setTimeout(() => {
                showCustomContextMenu(touchX, touchY);
            }, 600); // 600ms hold to trigger
        }
    }, { passive: true });

    document.addEventListener("touchmove", () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    document.addEventListener("touchend", () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    document.addEventListener("touchcancel", () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    }, { passive: true });

    const menuQuickSaveBtn = document.getElementById("menu-quick-save");
    if (menuQuickSaveBtn) {
        menuQuickSaveBtn.addEventListener("click", () => {
            const selectedText = window.getSelection().toString().trim();
            hideCustomContextMenu();
            if (selectedText.length > 0) {
                const snippetTextEl = document.getElementById("snippet-text");
                if (snippetTextEl) {
                    if (appContainer && appContainer.classList.contains("hidden")) {
                        showNotification("Please login or continue as Guest to save snippets.", "warning");
                        return;
                    }
                    showMainView();
                    snippetTextEl.value = selectedText;
                    snippetTextEl.scrollIntoView({ behavior: "smooth" });
                    snippetTextEl.focus();
                    showNotification("Selection loaded! Click 'Save Snippet' to store.", "success");
                }
            }
        });
    }

    const menuNewSnippetBtn = document.getElementById("menu-new-snippet");
    if (menuNewSnippetBtn) {
        menuNewSnippetBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            if (appContainer && appContainer.classList.contains("hidden")) {
                showNotification("Please login or continue as Guest to access the vault.", "warning");
                return;
            }
            showMainView();
            const snippetTextEl = document.getElementById("snippet-text");
            if (snippetTextEl) {
                snippetTextEl.value = "";
                snippetTextEl.scrollIntoView({ behavior: "smooth" });
                snippetTextEl.focus();
            }
        });
    }

    const menuOpenVaultBtn = document.getElementById("menu-open-vault");
    if (menuOpenVaultBtn) {
        menuOpenVaultBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            if (appContainer && appContainer.classList.contains("hidden")) {
                showNotification("Please login or continue as Guest to access the vault.", "warning");
                return;
            }
            showMainView();
        });
    }

    const menuManageAccountBtn = document.getElementById("menu-manage-account");
    if (menuManageAccountBtn) {
        menuManageAccountBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            if (sessionToken === "guest") {
                showNotification("Account Settings are not available in Guest mode.", "warning");
                return;
            }
            showAccountView();
        });
    }

    const menuExportBackupBtn = document.getElementById("menu-export-backup");
    if (menuExportBackupBtn) {
        menuExportBackupBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            const downloadBtn = document.getElementById("download-data-btn");
            if (downloadBtn) {
                downloadBtn.click();
            } else {
                showNotification("Export not available.", "error");
            }
        });
    }

    const menuSyncBtn = document.getElementById("menu-sync");
    if (menuSyncBtn) {
        menuSyncBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            const guestSyncBtn = document.getElementById("guest-sync-btn");
            if (guestSyncBtn) {
                guestSyncBtn.click();
            } else {
                showNotification("Sync options not available.", "error");
            }
        });
    }

    const menuLogoutBtn = document.getElementById("menu-logout");
    if (menuLogoutBtn) {
        menuLogoutBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            const logoutBtn = document.getElementById("logout-btn");
            if (logoutBtn) {
                logoutBtn.click();
            } else {
                showNotification("Logout not available.", "error");
            }
        });
    }

    const menuAboutBtn = document.getElementById("menu-about");
    if (menuAboutBtn) {
        menuAboutBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            localStorage.setItem("snipvault_skip_intro", "true");
            window.location.href = "about.html";
        });
    }

    const menuPricingBtn = document.getElementById("menu-pricing");
    if (menuPricingBtn) {
        menuPricingBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            localStorage.setItem("snipvault_skip_intro", "true");
            window.location.href = "pricing.html";
        });
    }

    const menuOpensourceBtn = document.getElementById("menu-opensource");
    if (menuOpensourceBtn) {
        menuOpensourceBtn.addEventListener("click", () => {
            hideCustomContextMenu();
            localStorage.setItem("snipvault_skip_intro", "true");
            window.location.href = "opensource.html";
        });
    }

    // --- Dedicated Page/Section Navigation Controls ---
    const toggleSnippetsViewBtn = document.getElementById('toggle-snippets-view-btn');
    const backFromSnippetsBtn = document.getElementById('back-from-snippets-btn');
    const snippetsViewEl = document.getElementById('snippets-view');

    function showSnippetsView() {
        if(mainViewEl) mainViewEl.classList.add('hidden');
        if(detailViewEl) detailViewEl.classList.add('hidden');
        if(accountViewEl) accountViewEl.classList.add('hidden');
        if(snippetsViewEl) snippetsViewEl.classList.remove('hidden');
        renderSnippets();
    }

    // Connect page navigations
    if(toggleSnippetsViewBtn) toggleSnippetsViewBtn.addEventListener('click', showSnippetsView);
    if(backFromSnippetsBtn) backFromSnippetsBtn.addEventListener('click', showMainView);



    // --- Rich Text WYSIWYG Editor Helpers & Sync ---
    const snippetWysiwyg = document.getElementById('snippet-wysiwyg');
    const editSnippetWysiwyg = document.getElementById('edit-snippet-wysiwyg');

    window.formatDoc = function(cmd, value = null) {
        if (cmd === 'formatBlock' && value && !value.startsWith('<')) {
            value = `<${value}>`;
        }
        document.execCommand(cmd, false, value);
        if (typeof updateEditorToolbarActiveStates === 'function') {
            updateEditorToolbarActiveStates();
        }
    };

    window.insertCodeBlock = function(type) {
        const editor = document.getElementById(type === 'new' ? 'snippet-wysiwyg' : 'edit-snippet-wysiwyg');
        if (!editor) return;
        
        const pre = document.createElement('pre');
        pre.className = "bg-gray-900 text-green-400 p-3 font-mono text-xs my-2 overflow-x-auto border-l-4 border-indigo-500";
        const code = document.createElement('code');
        code.textContent = '// Paste or type your code here\n';
        pre.appendChild(code);
        
        editor.focus();
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(pre);
        } else {
            editor.appendChild(pre);
        }
        window.syncWYSIWYGToTextarea(type);
    };

    window.insertTable = function(type) {
        const editor = document.getElementById(type === 'new' ? 'snippet-wysiwyg' : 'edit-snippet-wysiwyg');
        if (!editor) return;
        
        const table = document.createElement('table');
        table.className = "min-w-full text-xs text-left border border-gray-300 mt-2";
        
        const thead = document.createElement('thead');
        thead.className = "bg-gray-100 font-bold border-b border-gray-300";
        const headerRow = document.createElement('tr');
        for (let i = 1; i <= 3; i++) {
            const th = document.createElement('th');
            th.className = "p-2 border border-gray-300 font-bold";
            th.textContent = `Header ${i}`;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        for (let r = 1; r <= 2; r++) {
            const row = document.createElement('tr');
            row.className = "border-b border-gray-200 hover:bg-gray-50";
            for (let c = 1; c <= 3; c++) {
                const td = document.createElement('td');
                td.className = "p-2 border border-gray-300";
                td.textContent = `Cell ${r}-${c}`;
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        
        editor.focus();
        const sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(table);
        } else {
            editor.appendChild(table);
        }
        window.syncWYSIWYGToTextarea(type);
    };

    window.syncWYSIWYGToTextarea = function(type) {
        if (type === 'new') {
            if (snippetWysiwyg && snippetTextEl) {
                snippetTextEl.value = snippetWysiwyg.innerHTML;
            }
        } else {
            if (editSnippetWysiwyg && editSnippetTextEl) {
                editSnippetTextEl.value = editSnippetWysiwyg.innerHTML;
            }
        }
    };

    // Listen to editor keyup/input to sync immediately to hidden input form field
    if (snippetWysiwyg && snippetTextEl) {
        ['input', 'keyup', 'blur', 'paste'].forEach(evt => {
            snippetWysiwyg.addEventListener(evt, () => window.syncWYSIWYGToTextarea('new'));
        });
    }
    if (editSnippetWysiwyg && editSnippetTextEl) {
        ['input', 'keyup', 'blur', 'paste'].forEach(evt => {
            editSnippetWysiwyg.addEventListener(evt, () => window.syncWYSIWYGToTextarea('edit'));
        });
    }

    // --- Toolbar Active State Handler ---
    function updateEditorToolbarActiveStates() {
        const activeEl = document.activeElement;
        const isNewEditor = activeEl && activeEl.id === 'snippet-wysiwyg';
        const isEditEditor = activeEl && activeEl.id === 'edit-snippet-wysiwyg';
        
        if (!isNewEditor && !isEditEditor) return;
        
        const container = activeEl.closest('.border-2.border-gray-900');
        if (!container) return;
        
        const buttons = container.querySelectorAll('button[data-cmd]');
        buttons.forEach(btn => {
            const cmd = btn.getAttribute('data-cmd');
            let isActive = false;
            
            if (cmd === 'bold' || cmd === 'italic' || cmd === 'insertUnorderedList' || cmd === 'insertOrderedList') {
                try {
                    isActive = document.queryCommandState(cmd);
                } catch(e) {}
            } else if (cmd === 'h1' || cmd === 'h2' || cmd === 'h3') {
                try {
                    const val = document.queryCommandValue('formatBlock');
                    isActive = (val === cmd || val === `<${cmd}>`);
                } catch(e) {}
            }
            
            if (isActive) {
                btn.classList.add('editor-btn-active');
            } else {
                btn.classList.remove('editor-btn-active');
            }
        });
    }

    document.addEventListener('selectionchange', updateEditorToolbarActiveStates);
    if (snippetWysiwyg) {
        ['keyup', 'mouseup', 'input', 'focus'].forEach(evt => {
            snippetWysiwyg.addEventListener(evt, updateEditorToolbarActiveStates);
        });
    }
    if (editSnippetWysiwyg) {
        ['keyup', 'mouseup', 'input', 'focus'].forEach(evt => {
            editSnippetWysiwyg.addEventListener(evt, updateEditorToolbarActiveStates);
        });
    }

    // --- Initial Load ---
    setFooterYear();
});
