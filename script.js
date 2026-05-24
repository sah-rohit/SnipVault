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
    const profileEmailViewEl = document.getElementById('profile-email-view');
    const profileDobViewEl = document.getElementById('profile-dob-view');
    
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
        if(detailViewEl) detailViewEl.classList.remove('hidden');

        if (mode === 'view') {
            if(detailContentViewEl) detailContentViewEl.classList.remove('hidden');
            if(detailContentEditEl) detailContentEditEl.classList.add('hidden');
            if(detailTitleEl) detailTitleEl.textContent = "Snippet Details";
            if(detailCategoryViewEl) detailCategoryViewEl.textContent = snippet.category;
            if(detailTextViewEl) detailTextViewEl.textContent = snippet.text;
            
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
            if(editSnippetTextEl) editSnippetTextEl.value = snippet.text;
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
        if (!introOverlay) { 
            if(onCompleteCallback) onCompleteCallback();
            return; 
        }
        
        if (introOverlay.style.display === 'none') {
            introOverlay.style.display = 'flex';
        }
        introOverlay.style.opacity = '1'; 
        introOverlay.style.pointerEvents = 'auto';

        if(dynamicLogo) dynamicLogo.classList.add('animate-pop');
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
        if(accountViewEl) accountViewEl.classList.remove('hidden');
        
        // Populate profile views
        if (currentUser) {
            if(profileNameViewEl) profileNameViewEl.textContent = currentUser.name;
            if(profileEmailViewEl) profileEmailViewEl.textContent = currentUser.email;
            if(profileDobViewEl) profileDobViewEl.textContent = `${currentUser.dob} (Age ${currentUser.age})`;
            
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
        convexClient.query("auth:getUser", { token: sessionToken })
            .then(user => {
                if (user) {
                    currentUser = user;
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
            const email = forgotEmailEl.value;
            showNotification(`Simulating reset email: link successfully dispatched to ${email}!`, "success", 5000);
            
            forgotPasswordModalContent.classList.remove("scale-100", "opacity-100");
            forgotPasswordModalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => {
                forgotPasswordModal.classList.add("hidden");
                forgotEmailEl.value = '';
            }, 300);
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
            if (confirm("Delete profile picture?")) {
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
    }

    // --- Verify Email Simulated Button ---
    if (verifyEmailBtn) {
        verifyEmailBtn.addEventListener("click", () => {
            convexClient.mutation("auth:verifyEmail", { token: sessionToken })
                .then(() => {
                    showNotification("Email successfully verified! Verification badge activated.", "success");
                    convexClient.query("auth:getUser", { token: sessionToken })
                        .then(user => {
                            currentUser = user;
                            showAccountView();
                        });
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
                            if (confirm("Revoke this login session?")) {
                                convexClient.mutation("auth:revokeSession", { token: sessionToken, sessionId: s.id })
                                    .then(() => {
                                        showNotification("Session revoked.", "info");
                                        loadSessionsLog();
                                    });
                            }
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
            if (confirm("Logout from all other devices?")) {
                convexClient.mutation("auth:revokeAllOtherSessions", { token: sessionToken })
                    .then(res => {
                        showNotification(`Logged out from ${res.count} other devices successfully.`, "success");
                        loadSessionsLog();
                    });
            }
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

        // Standard Convex Categories
        if (categoriesUnsubscribe) categoriesUnsubscribe(); 

        categoriesUnsubscribe = convexClient.onUpdate("categories:list", { token: sessionToken }, (categoriesList) => {
            localCategoriesCache = categoriesList;
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

        // Standard Convex Snippets
        if (snippetsUnsubscribe) snippetsUnsubscribe(); 

        snippetsUnsubscribe = convexClient.onUpdate("snippets:list", { token: sessionToken }, (snippetsList) => {
            localSnippetsCache = snippetsList.map(doc => ({ id: doc._id, ...doc }));
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
            titleCategoryDiv.className = 'snippet-title-category';
            const categoryTag = document.createElement('span');
            categoryTag.className = 'snippet-category-tag';
            categoryTag.textContent = snippet.category || 'General';
            titleCategoryDiv.appendChild(categoryTag);
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
            const textPreviewP = document.createElement('p');
            textPreviewP.className = 'snippet-text-preview';
            textPreviewP.textContent = snippet.text;
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

        // Standard Convex Insertion
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
            console.error("Error saving snippet: ", error);
            showNotification('Failed to save snippet.', 'error');
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
        if (confirm('Are you sure you want to permanently delete this snippet?')) {
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
    }
    
    function setFooterYear() {
        if(currentYearEl) currentYearEl.textContent = new Date().getFullYear();
    }

    // --- Event Listeners ---
    if(addCategoryBtn) addCategoryBtn.addEventListener('click', handleAddCategory);
    if(saveSnippetBtn) saveSnippetBtn.addEventListener('click', handleSaveSnippet);
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

    // --- Initial Load ---
    setFooterYear();
});
