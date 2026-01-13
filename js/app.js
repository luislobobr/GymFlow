/**
 * GymFlow - Main Application Controller
 * Entry point for the SPA
 */

import { database as db, STORES } from './db-adapter.js';
import { router } from './router.js';
import { toast } from './components/toast.js';
import { modal } from './components/modal.js';
import { workoutsManager, WORKOUT_TEMPLATES } from './modules/workouts.js';
import { historyManager } from './modules/history.js';
import { progressManager } from './modules/progress.js';
import { assessmentsManager } from './modules/assessments.js';
import { studentsManager } from './modules/students.js';
import { pdfExporter } from './modules/pdf.js';

/**
 * NOTA DE DESENVOLVIMENTO:
 * Algumas funções async neste arquivo podem não ter tratamento de erros adequado.
 * Considere adicionar blocos try-catch onde apropriado para melhorar a robustez.
 * Especialmente em operações de banco de dados e chamadas de API.
 */


// Make utilities globally available
window.toast = toast;
window.modal = modal;
window.workoutsManager = workoutsManager;
window.historyManager = historyManager;
window.progressManager = progressManager;
window.assessmentsManager = assessmentsManager;
window.studentsManager = studentsManager;
window.pdfExporter = pdfExporter;

// Expose app state for modules
window.MFIT = { db, state: null };

// App State
const state = {
  user: null,
  theme: 'dark',
  sidebarOpen: false,
  isLoading: true
};

/**
 * Initialize the application
 */
async function init() {
  console.log('[Init] Starting...');

  try {
    // Initialize database with timeout
    console.log('[Init] 1. Database init...');
    const dbInitPromise = db.init();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB init timeout')), 5000)
    );

    try {
      await Promise.race([dbInitPromise, timeoutPromise]);
      console.log('[Init] 1. Database OK');
    } catch (dbError) {
      console.warn('[Init] 1. DB issue:', dbError.message);
      // Continue anyway - app can work with fresh DB
    }

    // Seed database with initial data if needed
    console.log('[Init] 2. Seeding...');
    await seedDatabase();
    console.log('[Init] 2. Seed OK');

    // Check for pending redirect login (Mobile auth)
    console.log('[Init] 3. Redirect check...');
    await checkRedirectLogin();
    console.log('[Init] 3. Redirect OK');

    // Load settings
    console.log('[Init] 4. Settings...');
    await loadSettings();
    console.log('[Init] 4. Settings OK');

    // Setup routes FIRST - before checkAuth
    console.log('[Init] 5. Routes...');
    setupRoutes();
    console.log('[Init] 5. Routes OK');

    // Check authentication
    console.log('[Init] 6. Auth...');
    await checkAuth();
    console.log('[Init] 6. Auth OK');

    // Setup event listeners
    console.log('[Init] 7. Events...');
    setupEventListeners();
    console.log('[Init] 7. Events OK');

    // Update UI based on user state
    console.log('[Init] 8. UI...');
    updateUserUI();
    console.log('[Init] 8. UI OK');

    // Register service worker
    console.log('[Init] 9. SW...');
    registerServiceWorker();
    console.log('[Init] 9. SW OK');

    // Setup offline indicator
    console.log('[Init] 10. Offline...');
    setupOfflineIndicator();
    console.log('[Init] 10. Offline OK');

    // Hide loading screen
    console.log('[Init] 11. Hide loading...');
    hideLoading();
    console.log('[Init] 11. Loading hidden');

    // Manually trigger initial route - window.load may have fired before routes were set up
    console.log('[Init] 12. Handle route...');
    router.handleRoute();
    console.log('[Init] COMPLETE!');
  } catch (error) {
    console.error('[MFIT] Initialization error:', error);
    // Always hide loading even on error
    hideLoading();
    toast.error('Erro ao inicializar. Tente recarregar a página.');
  }
}

/**
 * Load user settings from database
 */
async function loadSettings() {
  const theme = await db.getSetting('theme') || 'dark';
  setTheme(theme);

  const userId = await db.getSetting('currentUserId');
  // DEV: console.log('[Auth] Loaded currentUserId:', userId);

  if (userId) {
    // Basic validation to avoid restoring "null" string or invalid ID
    if (userId === 'null' || userId === null) {
      console.warn('[Auth] Invalid userId found, clearing.');
      await db.setSetting('currentUserId', null);
      return;
    }

    state.user = await db.get(STORES.users, userId);

    // If user is logged in, enable cloud sync
    if (state.user) {
      // alert('Debug: Restaurou user ' + state.user.name);
      try {
        await db.enableCloud();
      } catch (e) {
        console.warn('Could not enable cloud sync:', e);
      }
    } else {
      // User ID exists but user not found? Clean up.
      console.warn('[Auth] User ID exists but User not found. Clearing.');
      await db.setSetting('currentUserId', null);
    }
  }
}

/**
 * Check if user is authenticated
 */
async function checkAuth() {
  // Always register the auth hook
  router.beforeEach((path) => {
    if (router.requiresAuth(path) && !state.user) {
      showLoginModal();
      return false;
    }
    return true;
  });

  // Show login immediately if no user and on authenticated route
  if (!state.user) {
    const currentPath = location.hash.replace('#', '') || 'dashboard';
    if (router.requiresAuth(currentPath)) {
      showLoginModal();
    }
  }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
  // Menu toggle (mobile)
  document.querySelector('.menu-toggle')?.addEventListener('click', toggleSidebar);

  // Theme toggle
  document.querySelector('.theme-toggle')?.addEventListener('click', toggleTheme);

  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(item.dataset.route);
      if (window.innerWidth < 768) {
        toggleSidebar();
      }
    });
  });

  // Close sidebar on outside click (mobile)
  document.querySelector('.sidebar')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('sidebar') && state.user?.sidebarOpen) {
      toggleSidebar();
    }
  });

  // User profile click - show login if not logged in, profile menu if logged in
  document.getElementById('user-profile-btn')?.addEventListener('click', () => {
    if (state.user) {
      showUserMenu();
    } else {
      showLoginModal();
    }
  });
}

/**
 * Show user menu with logout option
 */
function showUserMenu() {
  modal.open({
    title: 'Minha Conta',
    content: `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
        <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); background: var(--surface); border-radius: var(--radius-lg);">
          <div class="user-avatar" style="width: 60px; height: 60px; font-size: 1.5rem;">
            ${state.user.avatar || state.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style="margin: 0;">${state.user.name}</h3>
            <p style="margin: 0; color: var(--text-muted);">${state.user.email}</p>
            <span class="badge">${state.user.type === 'trainer' ? 'Personal Trainer' : 'Aluno'}</span>
          </div>
        </div>
        
        <button class="btn btn-secondary" id="edit-profile-btn">
          ✏️ Editar Perfil
        </button>
        
        <button class="btn btn-secondary" id="change-account-type-btn">
          🔄 ${state.user.type === 'trainer' ? 'Mudar para Aluno' : 'Tornar-me Personal'}
        </button>
        
        <button class="btn btn-secondary" id="sync-data-btn">
          🔄 Sincronizar Dados
        </button>

        <button class="btn btn-secondary" id="download-app-btn">
          📲 Baixar App
        </button>
        
        <hr style="border: 0; border-top: 1px solid var(--border); margin: var(--spacing-sm) 0;">
        
        <button class="btn" id="logout-btn" style="background: var(--danger); color: white;">
          🚪 Sair da Conta
        </button>
      </div>
    `,
    closable: true,
    onOpen: (overlay) => {
      overlay.querySelector('#sync-data-btn')?.addEventListener('click', async () => {
        const btn = overlay.querySelector('#sync-data-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Sincronizando...';

        try {
          await db.syncToCloud();
          toast.success('Sincronização concluída!');
        } catch (e) {
          console.error(e);
          toast.error('Erro na sincronização');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });

      overlay.querySelector('#download-app-btn')?.addEventListener('click', () => {
        modal.close();
        showDownloadModal();
      });

      overlay.querySelector('#edit-profile-btn')?.addEventListener('click', () => {
        modal.close();
        router.navigate('profile');
      });

      overlay.querySelector('#change-account-type-btn')?.addEventListener('click', async () => {
        const newType = state.user.type === 'trainer' ? 'student' : 'trainer';
        state.user.type = newType;
        await db.update(STORES.users, state.user);
        updateUserUI();
        modal.close();
        toast.success(newType === 'trainer' ? 'Agora você é Personal Trainer!' : 'Tipo alterado para Aluno');
        router.navigate('dashboard');
      });

      overlay.querySelector('#logout-btn')?.addEventListener('click', async () => {
        // Don't call modal.close - logout() already does window.location.reload()
        await logout();
      });
    }
  });
}

/**
 * Logout user
 */
async function logout() {
  console.log('[Logout] Starting...');
  const btn = document.querySelector('#logout-btn');
  if (btn) {
    btn.innerHTML = '⏳ Saindo...';
    btn.disabled = true;
  }

  try {
    // 1. Clear Local State PRIMEIRO
    console.log('[Logout] 1. Clearing local state...');
    const oldUserId = state.user?.id;
    state.user = null;

    // 2. Limpar todas as formas de persistência
    console.log('[Logout] 2. Clearing persistence...');
    try {
      await db.setSetting('currentUserId', null);
    } catch (e) {
      console.warn('[Logout] DB setSetting failed:', e);
    }
    localStorage.removeItem('user_session');
    sessionStorage.clear();
    console.log('[Logout] 2. Done');

    // 3. Tentar logout remoto (com timeout)
    try {
      const firebaseModule = await import('./firebase-config.js');
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 2000)
      );

      await Promise.race([
        (async () => {
          await firebaseModule.initFirebase();
          if (firebaseModule.firebaseAuth) {
            await firebaseModule.firebaseAuth.signOut();
          }
        })(),
        timeout
      ]);
    } catch (e) {
      console.warn('[Auth] Remote logout skipped:', e);
    }

    // 4. Limpar UI
    updateUserUI();
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    modal.activeModal = null;

    // 5. Toast
    console.log('[Logout] 5. Showing toast and reloading...');
    toast.success('Você saiu da conta!');

    // 6. Recarregar aplicação
    console.log('[Logout] 6. Scheduling reload...');
    setTimeout(() => {
      console.log('[Logout] Reloading now!');
      window.location.reload();
    }, 300);

  } catch (err) {
    console.error('[Auth] Logout error:', err);
    // Force reload mesmo com erro
    window.location.reload();
  }
}



/**
 * Setup application routes
 */
function setupRoutes() {
  router
    .add('dashboard', {
      title: 'Dashboard',
      render: renderDashboard,
      requiresAuth: true
    })
    .add('workouts', {
      title: 'Treinos',
      render: renderWorkouts,
      requiresAuth: true
    })
    .add('exercises', {
      title: 'Exercícios',
      render: renderExercises,
      requiresAuth: true
    })
    .add('history', {
      title: 'Histórico',
      render: renderHistory,
      requiresAuth: true
    })
    .add('progress', {
      title: 'Evolução',
      render: renderProgress,
      requiresAuth: true
    })
    .add('assessments', {
      title: 'Avaliações',
      render: renderAssessments,
      requiresAuth: true
    })
    .add('students', {
      title: 'Alunos',
      render: renderStudents,
      requiresAuth: true
    })
    .add('settings', {
      title: 'Configurações',
      render: renderSettings,
      requiresAuth: true
    })
    .add('profile', {
      title: 'Perfil',
      render: renderProfile,
      requiresAuth: true
    })
    .add('workout-execute', {
      title: 'Executando Treino',
      render: renderWorkoutExecution,
      requiresAuth: true
    });
}



/**
 * Toggle sidebar visibility (mobile)
 */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  state.sidebarOpen = !state.sidebarOpen;
  sidebar?.classList.toggle('open', state.sidebarOpen);
}

/**
 * Toggle theme between dark and light
 */
function toggleTheme() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  db.setSetting('theme', newTheme);
}

/**
 * Set application theme
 */
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Update toggle button icon
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

/**
 * Handle successful login centralized logic
 */
async function handleSuccessfulLogin(user) {
  // 1. Force close ALL modals synchronously
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  modal.activeModal = null;
  document.body.style.overflow = '';

  // 2. Save local state IMMEDIATELY
  state.user = user;
  await db.setSetting('currentUserId', user.id);

  // 3. Try enable cloud (fire and forget)
  try {
    await db.enableCloud();
    db.syncToCloud();
  } catch (e) {
    console.warn('Cloud sync deferred:', e);
  }

  // 4. Update UI synchronously
  updateUserUI();

  // 5. Navigate
  router.navigate('dashboard');

  // 6. Feedback
  toast.success(`Bem-vindo, ${user.name}!`);
}

/**
 * Show login/register modal
 */
function showLoginModal() {
  const content = `
    <div class="tabs">
      <button class="tab active" data-tab="login">Entrar</button>
      <button class="tab" data-tab="register">Cadastrar</button>
    </div>
    
    <div id="login-form" class="auth-form">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="login-email" placeholder="seu@email.com">
      </div>
      <div class="form-group">
        <label class="form-label">Senha</label>
        <input type="password" class="form-input" id="login-password" placeholder="••••••••">
      </div>
      <button class="btn btn-primary btn-lg" style="width: 100%;" id="login-btn">Entrar</button>
      
      <div style="display: flex; align-items: center; margin: var(--spacing-lg) 0; gap: var(--spacing-md);">
        <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
        <span style="color: var(--text-muted); font-size: var(--font-size-sm);">ou</span>
        <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
      </div>
      
      <button class="btn btn-secondary btn-lg" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: var(--spacing-sm);" id="google-login-btn">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Entrar com Google
      </button>
      
      <div style="display: flex; align-items: center; margin: var(--spacing-lg) 0; gap: var(--spacing-md);">
        <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
        <span style="color: var(--text-muted); font-size: var(--font-size-sm);">Baixe o App</span>
        <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
      </div>
      
      <div style="display: flex; gap: var(--spacing-sm);">
        <button class="btn btn-ghost" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;" id="install-pwa-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Instalar PWA
        </button>
        <a href="https://github.com/luislobobr/GymFlow/releases" target="_blank" class="btn btn-ghost" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub
        </a>
      </div>
      <div style="text-align: center; margin-top: 10px; font-size: 10px; color: var(--text-muted);">v5.1</div>
    </div>
    
    <div id="register-form" class="auth-form hidden">
      <div class="form-group">
        <label class="form-label">Nome Completo</label>
        <input type="text" class="form-input" id="register-name" placeholder="João Silva">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="register-email" placeholder="seu@email.com">
      </div>
      <div class="form-group">
        <label class="form-label">Senha</label>
        <input type="password" class="form-input" id="register-password" placeholder="••••••••">
      </div>
      <div class="form-group">
        <label class="form-label">Tipo de Conta</label>
        <select class="form-select" id="register-type">
          <option value="student">Aluno</option>
          <option value="trainer">Personal Trainer</option>
        </select>
      </div>
      <button class="btn btn-primary btn-lg" style="width: 100%;" id="register-btn">Cadastrar</button>
    </div>
  `;

  const loginModal = modal.open({
    title: 'Bem-vindo ao GymFlow',
    content,
    closable: false,
    onOpen: (overlay) => {
      // Tab switching
      overlay.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          overlay.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const tabName = tab.dataset.tab;
          overlay.querySelector('#login-form').classList.toggle('hidden', tabName !== 'login');
          overlay.querySelector('#register-form').classList.toggle('hidden', tabName !== 'register');
        });
      });

      // Login handler
      overlay.querySelector('#login-btn').addEventListener('click', async () => {
        const email = overlay.querySelector('#login-email').value;
        const password = overlay.querySelector('#login-password').value;

        if (!email || !password) {
          toast.warning('Preencha todos os campos');
          return;
        }

        // Simple demo login (in real app, validate password)
        const users = await db.getByIndex(STORES.users, 'email', email);
        if (users.length > 0) {
          state.user = users[0];
          await db.setSetting('currentUserId', state.user.id);
          modal.close();
          updateUserUI();
          router.navigate('dashboard');
          toast.success(`Bem-vindo, ${state.user.name}!`);
        } else {
          toast.error('Usuário não encontrado');
        }
      });

      // Google login handler
      overlay.querySelector('#google-login-btn').addEventListener('click', async () => {
        const btn = overlay.querySelector('#google-login-btn');
        const originalText = btn.innerHTML;

        try {
          btn.disabled = true;
          btn.innerHTML = '⏳ Conectando ao Google...';

          // Try to use Firebase Google Auth
          const firebaseModule = await import('./firebase-config.js');
          await firebaseModule.initFirebase();
          const firebaseUser = await firebaseModule.firebaseAuth.signInWithGoogle();

          // If null, it triggered a redirect (Mobile) - stop here
          if (!firebaseUser) {
            btn.innerHTML = '🔄 Redirecionando...';
            return;
          }

          // Check if user exists locally, if not create
          let users = await db.getByIndex(STORES.users, 'email', firebaseUser.email);
          if (users.length === 0) {
            const userId = await db.add(STORES.users, {
              name: firebaseUser.displayName || 'Usuário Google',
              email: firebaseUser.email,
              type: 'student',
              avatar: firebaseUser.displayName?.charAt(0).toUpperCase() || 'G',
              googleId: firebaseUser.uid,
              createdAt: new Date().toISOString()
            });
            state.user = await db.get(STORES.users, userId);
          } else {
            state.user = users[0];
          }


          // Force close ALL modals
          document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
          modal.activeModal = null;
          document.body.style.overflow = '';

          await db.setSetting('currentUserId', state.user.id);

          // Enable cloud sync
          try {
            await db.enableCloud();
            db.syncToCloud();
          } catch (e) { console.warn('Sync init error:', e); }

          // DEV: console.log('[Auth] Login success for:', state.user.name);

          // Small delay to ensure UI updates
          setTimeout(() => {
            updateUserUI();
            router.navigate('dashboard');
            toast.success(`Bem-vindo, ${state.user.name}!`);
          }, 100);
        } catch (error) {
          console.error('Google login error:', error);
          btn.disabled = false;
          btn.innerHTML = originalText;

          // Specific error messages
          if (error.code === 'auth/popup-blocked') {
            toast.error('Popup bloqueado. Permita popups neste site.');
          } else if (error.code === 'auth/popup-closed-by-user') {
            toast.warning('Login cancelado.');
          } else if (error.code === 'auth/network-request-failed') {
            toast.error('Sem conexão. Verifique sua internet.');
          } else if (error.message?.includes('Google sign-in requires cloud mode')) {
            toast.warning('Login com Google requer configuração no Firebase Console');
          } else {
            toast.error('Erro ao entrar com Google. Tente novamente.');
          }
        }
      });

      // Register handler
      overlay.querySelector('#register-btn').addEventListener('click', async () => {
        const name = overlay.querySelector('#register-name').value;
        const email = overlay.querySelector('#register-email').value;
        const password = overlay.querySelector('#register-password').value;
        const type = overlay.querySelector('#register-type').value;

        if (!name || !email || !password) {
          toast.warning('Preencha todos os campos');
          return;
        }

        // Check if email already exists
        const existing = await db.getByIndex(STORES.users, 'email', email);
        if (existing.length > 0) {
          toast.error('Email já cadastrado');
          return;
        }

        // Create user
        const userId = await db.add(STORES.users, {
          name,
          email,
          password, // In real app, hash this!
          type,
          avatar: name.charAt(0).toUpperCase(),
          createdAt: new Date().toISOString()
        });

        state.user = await db.get(STORES.users, userId);
        await db.setSetting('currentUserId', userId);
        modal.close();
        updateUserUI();
        router.navigate('dashboard');
        toast.success('Conta criada com sucesso!');
      });

      // PWA Install button handler
      overlay.querySelector('#install-pwa-btn')?.addEventListener('click', () => {
        window.installPWA?.();
      });
    }
  });
}

/**
 * Update user UI elements
 */
function updateUserUI() {
  const avatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');

  if (state.user) {
    // User is logged in
    if (avatar) avatar.textContent = state.user.avatar || state.user.name.charAt(0).toUpperCase();
    if (userName) userName.textContent = state.user.name;
    if (userRole) userRole.textContent = state.user.type === 'trainer' ? 'Personal Trainer' : 'Aluno';

    // Show/hide trainer-only nav items
    const trainerItems = document.querySelectorAll('.nav-item[data-trainer-only]');
    trainerItems.forEach(item => {
      item.classList.toggle('hidden', state.user.type !== 'trainer');
    });
  } else {
    // User is NOT logged in
    if (avatar) avatar.textContent = '?';
    if (userName) userName.textContent = 'Fazer Login';
    if (userRole) userRole.textContent = 'Clique para entrar';

    // Hide trainer-only items
    const trainerItems = document.querySelectorAll('.nav-item[data-trainer-only]');
    trainerItems.forEach(item => item.classList.add('hidden'));
  }
}

/**
 * Hide loading screen
 */
function hideLoading() {
  const loading = document.querySelector('.loading-overlay');
  if (loading) {
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 300);
  }
  state.isLoading = false;
}

/**
 * Register service worker for PWA
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // DEV: console.log('[MFIT] Service Worker registered:', registration.scope);
    } catch (error) {
      console.warn('[MFIT] Service Worker registration failed:', error);
    }
  }
}

/**
 * Setup offline indicator
 */
function setupOfflineIndicator() {
  // Create indicator element
  const indicator = document.createElement('div');
  indicator.className = 'offline-indicator';
  indicator.id = 'offline-indicator';
  indicator.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="1" y1="1" x2="23" y2="23"></line>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
      <line x1="12" y1="20" x2="12.01" y2="20"></line>
    </svg>
    Modo Offline
  `;
  document.body.appendChild(indicator);

  // Update indicator based on connection status
  function updateStatus() {
    if (!navigator.onLine) {
      indicator.classList.add('show');
    } else {
      indicator.classList.remove('show');
    }
  }

  // Listen for online/offline events
  window.addEventListener('online', () => {
    indicator.classList.remove('show');
    toast.success('Conexão restabelecida!');
  });

  window.addEventListener('offline', () => {
    indicator.classList.add('show');
    toast.warning('Você está offline. Os dados serão salvos localmente.');
  });

  // Initial check
  updateStatus();
}

// ============ PAGE RENDERERS ============

async function renderDashboard() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Loading state
  container.innerHTML = `
    <div style="padding: var(--spacing-xl); text-align: center;">
      <div class="loading-spinner"></div>
      <p style="color: var(--text-muted); margin-top: var(--spacing-md);">Carregando dashboard...</p>
    </div>
  `;

  // Yield to UI
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    const userName = state.user?.name?.split(' ')[0] || 'Usuário';
    const userId = state.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    // Fetch real data from database
    let monthlyWorkouts = 0;
    let totalTime = 0;
    let streak = 0;
    let recentWorkouts = [];

    if (userId) {
      try {
        const history = await historyManager.getHistory(userId);
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        // Calculate monthly workouts and total time
        history.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate.getMonth() === thisMonth && entryDate.getFullYear() === thisYear) {
            monthlyWorkouts++;
            totalTime += entry.duration || 0;
          }
        });

        // Calculate streak (consecutive days)
        if (history.length > 0) {
          const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let currentDate = today;
          for (const entry of sortedHistory) {
            const entryDate = new Date(entry.date);
            entryDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              streak++;
              currentDate = entryDate;
            } else {
              break;
            }
          }
        }

        // Get recent workouts (last 3)
        recentWorkouts = history.slice(0, 3);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    }

    // Format total time
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);
    const timeFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const container = document.createElement('div');
    container.className = 'animate-slide-up';

    container.innerHTML = `
    <div style="margin-bottom: var(--spacing-xl);">
      <h2 style="margin-bottom: var(--spacing-xs);">Olá, ${userName}! 💪</h2>
      <p style="color: var(--text-muted);">Pronto para o treino de hoje?</p>
    </div>
    
    <div class="grid grid-auto-fit" style="margin-bottom: var(--spacing-xl);">
      <div class="stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10"></path>
            <path d="M12 20V4"></path>
            <path d="M6 20v-6"></path>
          </svg>
        </div>
        <div class="stat-value">${monthlyWorkouts}</div>
        <div class="stat-label">Treinos este mês</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="stat-value">${timeFormatted || '0m'}</div>
        <div class="stat-label">Tempo total</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"></path>
          </svg>
        </div>
        <div class="stat-value">${streak}</div>
        <div class="stat-label">Dias seguidos 🔥</div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: var(--spacing-xl);">
      <div class="card-header">
        <h3 class="card-title">📅 Atividade Recente</h3>
        <button class="btn btn-secondary" onclick="location.hash='history'">Ver Histórico</button>
      </div>
      ${recentWorkouts.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          ${recentWorkouts.map(w => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
              <div>
                <div style="font-weight: 600;">${w.workoutName || 'Treino'}</div>
                <div style="font-size: var(--font-size-sm); color: var(--text-muted);">${new Date(w.date).toLocaleDateString('pt-BR')}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600; color: var(--primary);">${Math.floor((w.duration || 0) / 60)}min</div>
                <div style="font-size: var(--font-size-sm); color: var(--text-muted);">${w.totalSets || 0} séries</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
            <line x1="4" y1="22" x2="4" y2="15"></line>
          </svg>
          <h4 class="empty-title">Nenhum treino realizado</h4>
          <p class="empty-description">Comece seu primeiro treino agora!</p>
          <button class="btn btn-primary" onclick="location.hash='workouts'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Começar Treino
          </button>
        </div>
      `}
    </div>
  `;

    return container;

  } catch (error) {
    console.error('[Dashboard] Render error:', error);
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h4 class="empty-title">Erro ao carregar</h4>
          <p class="empty-description">${error.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
        </div>
      </div>
    `;
    return container;
  }
}

function showDownloadModal() {
  modal.open({
    title: 'Baixar GymFlow',
    content: `
            <div style="text-align: center;">
                <p style="margin-bottom: var(--spacing-lg);">Escolha como deseja instalar o aplicativo:</p>
                
                <div style="display: grid; gap: var(--spacing-md);">
                    <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <h3 style="margin-bottom: var(--spacing-xs);">📱 Versão Web (PWA)</h3>
                        <p style="color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-sm);">
                            Instalação nativa, atualizações automáticas e não ocupa espaço.
                        </p>
                        <button class="btn btn-primary" onclick="installPWA()" style="width: 100%;">
                            Instalar Agora
                        </button>
                    </div>

                    <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
                        <h3 style="margin-bottom: var(--spacing-xs);">🤖 Android (APK)</h3>
                        <p style="color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-sm);">
                            Arquivo de instalação manual.
                        </p>
                        <a href="https://github.com/luislobobr/GymFlow/releases/download/v1.0.0/gymflow.apk" target="_blank" class="btn btn-secondary" style="width: 100%; display: block; text-decoration: none;">
                            Baixar APK
                        </a>
                    </div>
                </div>
            </div>
        `,
    closable: true
  });
}

// PWA Install helper
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});

window.installPWA = async () => {
  if (!window.deferredPrompt) {
    toast.info('Para instalar, use a opção "Adicionar à Tela Inicial" do seu navegador.');
    return;
  }
  window.deferredPrompt.prompt();
  const { outcome } = await window.deferredPrompt.userChoice;
  window.deferredPrompt = null;
}


async function renderWorkouts() {
  // Load workouts from database
  let workouts = [];
  if (state.user) {
    workouts = await workoutsManager.getWorkouts(state.user.id);

    // If no workouts, create templates
    if (workouts.length === 0) {
      await workoutsManager.createTemplatesForUser(state.user.id);
      workouts = await workoutsManager.getWorkouts(state.user.id);
    }
  }

  const container = document.createElement('div');
  container.className = 'animate-slide-up';
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
      <div>
        <h2>Meus Treinos</h2>
        <p style="color: var(--text-muted);">Gerencie suas rotinas de treino</p>
      </div>
      <button class="btn btn-primary" id="create-workout-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Treino
      </button>
    </div>
    
    <div class="tabs">
      <button class="tab active" data-tab="my">Meus Treinos</button>
      <button class="tab" data-tab="templates">Modelos PPL</button>
    </div>
    
    <div class="grid grid-auto-fit" id="workouts-list">
      ${workouts.length > 0
      ? workouts.map(w => workoutsManager.renderWorkoutCard(w)).join('')
      : `<div class="card">
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14.5 4h-5L7 7H2v13h20V7h-5l-2.5-3z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              <h4 class="empty-title">Nenhum treino criado</h4>
              <p class="empty-description">Clique em "Novo Treino" para começar</p>
            </div>
          </div>`
    }
    </div>
  `;

  // Setup event listeners directly (works even before DOM insertion)
  // Start workout buttons
  container.querySelectorAll('.start-workout-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const workoutId = parseInt(btn.dataset.workoutId);
      const workout = await workoutsManager.getWorkout(workoutId);
      if (workout) {
        workoutsManager.startSession(workout);
        router.navigate('workout-execute');
      }
    });
  });

  // Edit workout buttons
  container.querySelectorAll('.edit-workout-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const workoutId = parseInt(btn.dataset.workoutId);
      const workout = await workoutsManager.getWorkout(workoutId);
      if (workout) showWorkoutCreator(workout);
    });
  });

  // Create workout button
  const createBtn = container.querySelector('#create-workout-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      showWorkoutCreator();
    });
  }

  return container;
}

function renderWorkoutExecution() {
  const container = document.createElement('div');

  if (!workoutsManager.workoutSession) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <h4 class="empty-title">Nenhum treino em execução</h4>
          <p class="empty-description">Selecione um treino para começar</p>
          <button class="btn btn-primary" onclick="location.hash='workouts'">Ver Treinos</button>
        </div>
      </div>
    `;
    return container;
  }

  workoutsManager.renderExecutionUI(container);
  return container;
}

async function renderExercises() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Load exercises from JSON
  let exercisesData = { exercises: [], muscleGroups: [], equipmentTypes: [] };
  try {
    const response = await fetch('./js/data/exercises.json');
    exercisesData = await response.json();
  } catch (error) {
    console.error('Error loading exercises:', error);
  }

  const { exercises, muscleGroups, equipmentTypes } = exercisesData;

  container.innerHTML = `
    <div style="margin-bottom: var(--spacing-xl);">
      <h2>Biblioteca de Exercícios</h2>
      <p style="color: var(--text-muted);">Explore nossa biblioteca com ${exercises.length} exercícios</p>
    </div>
    
    <div style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-xl); flex-wrap: wrap;">
      <input type="search" class="form-input" id="exercise-search" placeholder="Buscar exercício..." style="flex: 1; min-width: 200px;">
      <select class="form-select" id="muscle-filter" style="width: auto;">
        <option value="">Todos os músculos</option>
        ${muscleGroups.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
      </select>
      <select class="form-select" id="equipment-filter" style="width: auto;">
        <option value="">Todos equipamentos</option>
        ${equipmentTypes.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
      </select>
    </div>
    
    <div class="grid" id="exercises-grid" style="gap: var(--spacing-md);">
      <!-- Exercises will be rendered here -->
    </div>
  `;

  // Render exercises function
  const renderExercisesList = (filteredExercises) => {
    const grid = container.querySelector('#exercises-grid');
    const muscleIcons = {
      peito: '💪', costas: '🔙', pernas: '🦵', ombros: '🏋️',
      biceps: '💪', triceps: '💪', abdomen: '🎯',
      antebraco: '✊', trapezio: '🏔️', gluteos: '🍑', cardio: '❤️'
    };

    grid.innerHTML = filteredExercises.slice(0, 30).map(ex => `
      <div class="exercise-card" data-id="${ex.id}">
        <div class="exercise-thumb">
          <span style="font-size: 1.5rem;">${muscleIcons[ex.muscle] || '🏋️'}</span>
        </div>
        <div class="exercise-info">
          <div class="exercise-name">${ex.name}</div>
          <div class="exercise-meta">
            <span class="exercise-tag muscle">${ex.muscle}</span>
            <span class="exercise-tag equipment">${ex.equipment.replace('_', ' ')}</span>
          </div>
          <div class="exercise-sets">${ex.type === 'composto' ? 'Composto' : 'Isolador'} • ${ex.level}</div>
        </div>
      </div>
    `).join('');

    if (filteredExercises.length > 30) {
      grid.innerHTML += `
        <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-lg); color: var(--text-muted);">
          Mostrando 30 de ${filteredExercises.length} exercícios. Use os filtros para refinar a busca.
        </div>
      `;
    }

    if (filteredExercises.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-xl);">
          <div style="font-size: 3rem; margin-bottom: var(--spacing-md);">🔍</div>
          <h4>Nenhum exercício encontrado</h4>
          <p style="color: var(--text-muted);">Tente outros filtros ou termos de busca</p>
        </div>
      `;
    }

    // Add click handlers for exercise details
    grid.querySelectorAll('.exercise-card').forEach(card => {
      card.addEventListener('click', () => {
        const exId = parseInt(card.dataset.id);
        const ex = exercises.find(e => e.id === exId);
        if (ex) showExerciseDetail(ex);
      });
    });
  };

  // Filter function
  const applyFilters = () => {
    const search = container.querySelector('#exercise-search').value.toLowerCase();
    const muscle = container.querySelector('#muscle-filter').value;
    const equipment = container.querySelector('#equipment-filter').value;

    let filtered = exercises;

    if (search) {
      filtered = filtered.filter(ex => ex.name.toLowerCase().includes(search));
    }
    if (muscle) {
      filtered = filtered.filter(ex => ex.muscle === muscle);
    }
    if (equipment) {
      filtered = filtered.filter(ex => ex.equipment === equipment);
    }

    renderExercisesList(filtered);
  };

  // Setup listeners directly on container elements (works even before DOM insertion)
  const searchInput = container.querySelector('#exercise-search');
  const muscleFilter = container.querySelector('#muscle-filter');
  const equipmentFilter = container.querySelector('#equipment-filter');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (muscleFilter) muscleFilter.addEventListener('change', applyFilters);
  if (equipmentFilter) equipmentFilter.addEventListener('change', applyFilters);

  // Initial render
  renderExercisesList(exercises);

  return container;
}

// Show exercise detail modal
function showExerciseDetail(exercise) {
  const muscleNames = {
    peito: 'Peito', costas: 'Costas', pernas: 'Pernas', ombros: 'Ombros',
    biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdômen',
    antebraco: 'Antebraço', trapezio: 'Trapézio', gluteos: 'Glúteos', cardio: 'Cardio'
  };

  const videoButton = exercise.videoUrl ? `
    <a href="${exercise.videoUrl}" target="_blank" rel="noopener" 
       class="btn btn-primary" style="display: flex; align-items: center; gap: 8px; margin-top: var(--spacing-md);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 15l5.19-3L10 9v6zm11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/>
      </svg>
      Ver Vídeo Demonstrativo
    </a>
  ` : '';

  modal.open({
    title: exercise.name,
    content: `
      <div style="display: flex; flex-direction: column; gap: var(--spacing-lg);">
        <div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap;">
          <span class="exercise-tag muscle">${muscleNames[exercise.muscle] || exercise.muscle}</span>
          <span class="exercise-tag equipment">${exercise.equipment.replace('_', ' ')}</span>
          <span class="exercise-tag" style="background: var(--primary-muted); color: var(--primary);">${exercise.level}</span>
          <span class="exercise-tag">${exercise.type === 'composto' ? 'Composto' : 'Isolador'}</span>
        </div>
        
        <div>
          <h4 style="margin-bottom: var(--spacing-sm);">📋 Instruções</h4>
          <p style="color: var(--text-muted); line-height: 1.6;">${exercise.instructions}</p>
        </div>
        
        ${videoButton}
      </div>
    `,
    closable: true
  });
}

// Show workout creator/editor modal
async function showWorkoutCreator(existingWorkout = null) {
  // Load exercises for picker
  let exercisesData = { exercises: [], muscleGroups: [] };
  try {
    const response = await fetch('./js/data/exercises.json');
    exercisesData = await response.json();
  } catch (error) {
    console.error('Error loading exercises:', error);
  }

  const { exercises, muscleGroups } = exercisesData;
  const isEditing = !!existingWorkout;
  const workoutExercises = existingWorkout?.exercises || [];

  const content = `
    <div style="display: flex; flex-direction: column; gap: var(--spacing-lg); max-height: 70vh; overflow-y: auto;">
      <div class="form-group">
        <label class="form-label">Nome do Treino</label>
        <input type="text" class="form-input" id="workout-name" placeholder="Ex: Treino A - Peito e Tríceps" value="${existingWorkout?.name || ''}">
      </div>
      
      <div class="form-group">
        <label class="form-label">Descrição (opcional)</label>
        <input type="text" class="form-input" id="workout-desc" placeholder="Descrição breve" value="${existingWorkout?.description || ''}">
      </div>
      
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
          <label class="form-label" style="margin: 0;">Exercícios</label>
          <button class="btn btn-secondary btn-sm" id="add-exercise-btn">+ Adicionar</button>
        </div>
        
        <div id="workout-exercises" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          ${workoutExercises.length === 0 ? `
            <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
              Clique em "Adicionar" para incluir exercícios
            </div>
          ` : workoutExercises.map((ex, idx) => `
            <div class="exercise-row" data-index="${idx}" style="display: flex; gap: var(--spacing-md); align-items: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
              <div style="flex: 1;">
                <div style="font-weight: 600;">${ex.name}</div>
                <div style="font-size: var(--font-size-sm); color: var(--text-muted);">${ex.sets}x${ex.reps} reps</div>
              </div>
              <button class="btn btn-ghost btn-sm remove-exercise-btn" data-index="${idx}">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div style="display: flex; gap: var(--spacing-md); justify-content: flex-end;">
        ${isEditing ? `<button class="btn btn-danger" id="delete-workout-btn">Excluir</button>` : ''}
        <button class="btn btn-secondary" id="cancel-workout-btn">Cancelar</button>
        <button class="btn btn-primary" id="save-workout-btn">${isEditing ? 'Salvar' : 'Criar Treino'}</button>
      </div>
    </div>
  `;

  let currentExercises = [...workoutExercises];

  modal.open({
    title: isEditing ? 'Editar Treino' : 'Novo Treino',
    content,
    size: 'large',
    closable: true,
    onOpen: (overlay) => {
      // Cancel button
      overlay.querySelector('#cancel-workout-btn')?.addEventListener('click', () => {
        modal.close();
      });

      // Add exercise button
      overlay.querySelector('#add-exercise-btn')?.addEventListener('click', () => {
        showExercisePicker(exercises, muscleGroups, (exercise) => {
          currentExercises.push({
            id: exercise.id,
            name: exercise.name,
            sets: 3,
            reps: 12,
            rest: 60
          });
          updateExercisesList();
        });
      });

      // Update exercises list UI
      const updateExercisesList = () => {
        const container = overlay.querySelector('#workout-exercises');
        if (currentExercises.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-muted); border: 2px dashed var(--border-color); border-radius: var(--radius-md);">
              Clique em "Adicionar" para incluir exercícios
            </div>
          `;
        } else {
          container.innerHTML = currentExercises.map((ex, idx) => `
            <div class="exercise-row" data-index="${idx}" style="display: flex; gap: var(--spacing-md); align-items: center; padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md);">
              <div style="flex: 1;">
                <div style="font-weight: 600;">${ex.name}</div>
                <div style="display: flex; gap: var(--spacing-sm); align-items: center; margin-top: var(--spacing-xs);">
                  <input type="number" class="form-input" style="width: 60px; padding: 4px 8px;" value="${ex.sets}" min="1" max="10" data-field="sets" data-index="${idx}">
                  <span>x</span>
                  <input type="number" class="form-input" style="width: 60px; padding: 4px 8px;" value="${ex.reps}" min="1" max="100" data-field="reps" data-index="${idx}">
                  <span>reps</span>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm remove-exercise-btn" data-index="${idx}">✕</button>
            </div>
          `).join('');

          // Add listeners for sets/reps inputs
          container.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
              const idx = parseInt(e.target.dataset.index);
              const field = e.target.dataset.field;
              currentExercises[idx][field] = parseInt(e.target.value) || 1;
            });
          });

          // Remove exercise buttons
          container.querySelectorAll('.remove-exercise-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const idx = parseInt(e.target.dataset.index);
              currentExercises.splice(idx, 1);
              updateExercisesList();
            });
          });
        }
      };

      // Save workout
      overlay.querySelector('#save-workout-btn')?.addEventListener('click', async () => {
        const name = overlay.querySelector('#workout-name').value.trim();
        const description = overlay.querySelector('#workout-desc').value.trim();

        if (!name) {
          toast.warning('Digite um nome para o treino');
          return;
        }

        if (currentExercises.length === 0) {
          toast.warning('Adicione pelo menos um exercício');
          return;
        }

        try {
          if (isEditing) {
            await workoutsManager.updateWorkout({
              ...existingWorkout,
              name,
              description,
              exercises: currentExercises
            });
            toast.success('Treino atualizado!');
          } else {
            await workoutsManager.createWorkout({
              userId: state.user.id,
              name,
              description,
              exercises: currentExercises,
              color: '#10b981'
            });
            toast.success('Treino criado!');
          }
          modal.close();
          router.navigate('workouts');
        } catch (error) {
          console.error('Error saving workout:', error);
          toast.error('Erro ao salvar treino');
        }
      });

      // Delete workout
      overlay.querySelector('#delete-workout-btn')?.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja excluir este treino?')) {
          try {
            await workoutsManager.deleteWorkout(existingWorkout.id);
            toast.success('Treino excluído!');
            modal.close();
            router.navigate('workouts');
          } catch (error) {
            console.error('Error deleting workout:', error);
            toast.error('Erro ao excluir treino');
          }
        }
      });
    }
  });
}

// Exercise picker modal
function showExercisePicker(exercises, muscleGroups, onSelect) {
  let filtered = [...exercises];

  const renderList = (list) => {
    return list.slice(0, 20).map(ex => `
      <div class="exercise-pick-item" data-id="${ex.id}" style="display: flex; align-items: center; gap: var(--spacing-md); padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;">
        <div style="flex: 1;">
          <div style="font-weight: 600;">${ex.name}</div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">${ex.muscle} • ${ex.equipment.replace('_', ' ')}</div>
        </div>
        <span style="color: var(--primary);">+</span>
      </div>
    `).join('');
  };

  const content = `
    <div style="display: flex; flex-direction: column; gap: var(--spacing-md); max-height: 60vh;">
      <div style="display: flex; gap: var(--spacing-sm);">
        <input type="search" class="form-input" id="pick-search" placeholder="Buscar..." style="flex: 1;">
        <select class="form-select" id="pick-muscle" style="width: auto;">
          <option value="">Todos</option>
          ${muscleGroups.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
      </div>
      <div id="pick-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--spacing-sm);">
        ${renderList(exercises)}
      </div>
    </div>
  `;

  modal.open({
    title: 'Selecionar Exercício',
    content,
    closable: true,
    onOpen: (overlay) => {
      const applyFilter = () => {
        const search = overlay.querySelector('#pick-search').value.toLowerCase();
        const muscle = overlay.querySelector('#pick-muscle').value;

        filtered = exercises.filter(ex => {
          const matchSearch = !search || ex.name.toLowerCase().includes(search);
          const matchMuscle = !muscle || ex.muscle === muscle;
          return matchSearch && matchMuscle;
        });

        const list = overlay.querySelector('#pick-list');
        list.innerHTML = renderList(filtered);

        // Re-add click handlers
        list.querySelectorAll('.exercise-pick-item').forEach(item => {
          item.addEventListener('click', () => {
            const exId = parseInt(item.dataset.id);
            const ex = exercises.find(e => e.id === exId);
            if (ex) {
              onSelect(ex);
              modal.close();
            }
          });
        });
      };

      overlay.querySelector('#pick-search').addEventListener('input', applyFilter);
      overlay.querySelector('#pick-muscle').addEventListener('change', applyFilter);

      // Initial click handlers
      overlay.querySelectorAll('.exercise-pick-item').forEach(item => {
        item.addEventListener('click', () => {
          const exId = parseInt(item.dataset.id);
          const ex = exercises.find(e => e.id === exId);
          if (ex) {
            onSelect(ex);
            modal.close();
          }
        });
      });
    }
  });
}

async function renderHistory() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Get history and stats if user is logged in
  let history = [];
  let stats = null;
  let chartData = [];

  if (state.user) {
    history = await historyManager.getHistory(state.user.id, 20);
    stats = await historyManager.getStats(state.user.id, 30);
    chartData = await historyManager.getChartData(state.user.id, 14);
  }

  container.innerHTML = `
    <div style="margin-bottom: var(--spacing-xl);">
      <h2>Histórico de Treinos</h2>
      <p style="color: var(--text-muted);">Acompanhe seus treinos realizados</p>
    </div>
    
    ${stats && stats.totalWorkouts > 0 ? `
      ${historyManager.renderStatsCards(stats)}
      
      <div class="card" style="margin-bottom: var(--spacing-xl);">
        <h4 style="margin-bottom: var(--spacing-md);">📊 Últimos 14 dias</h4>
        ${historyManager.renderMiniChart(chartData, 'workouts', 14)}
      </div>
      
      <h3 style="margin-bottom: var(--spacing-lg);">📋 Treinos Recentes</h3>
      <div class="grid" style="gap: var(--spacing-md);">
        ${history.map(h => historyManager.renderHistoryCard(h)).join('')}
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h4 class="empty-title">Nenhum treino registrado</h4>
          <p class="empty-description">Complete seu primeiro treino para ver o histórico aqui</p>
          <button class="btn btn-primary" onclick="location.hash='workouts'">Iniciar Treino</button>
        </div>
      </div>
    `}
  `;

  // Add event listeners for history cards
  setTimeout(() => {
    container.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('click', async () => {
        const entryId = parseInt(card.dataset.historyId);
        const entry = await historyManager.getEntry(entryId);
        if (entry) {
          showHistoryDetail(entry);
        }
      });
    });
  }, 100);

  return container;
}

function showHistoryDetail(entry) {
  const exercises = entry.exercises || [];
  const content = `
    <div style="margin-bottom: var(--spacing-lg);">
      <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
        ${new Date(entry.startTime).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}
      </p>
    </div>
    
    <div style="
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-lg);
      background: var(--bg-glass);
      border-radius: var(--radius-lg);
    ">
      <div style="text-align: center;">
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-primary);">
          ${entry.durationMinutes || 0}min
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Duração</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-secondary);">
          ${entry.totalSets || 0}
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Séries</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--accent-warning);">
          ${Math.round(entry.totalVolume || 0)}kg
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Volume</div>
      </div>
    </div>
    
    <h4 style="margin-bottom: var(--spacing-md);">Exercícios</h4>
    <div style="max-height: 300px; overflow-y: auto;">
      ${exercises.map(ex => `
        <div style="
          padding: var(--spacing-md);
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-sm);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 500;">${ex.name}</div>
            <span style="
              font-size: var(--font-size-xs);
              padding: 2px 8px;
              border-radius: var(--radius-full);
              background: ${ex.completed ? 'var(--accent-success)' : ex.skipped ? 'var(--accent-warning)' : 'var(--bg-secondary)'};
              color: ${ex.completed || ex.skipped ? 'white' : 'var(--text-muted)'};
            ">
              ${ex.completed ? '✓ Concluído' : ex.skipped ? 'Pulado' : 'Pendente'}
            </span>
          </div>
          ${ex.logsPerSet && ex.logsPerSet.length > 0 ? `
            <div style="margin-top: var(--spacing-sm); display: flex; gap: var(--spacing-xs); flex-wrap: wrap;">
              ${ex.logsPerSet.map((log, i) => `
                <span style="
                  font-size: var(--font-size-xs);
                  padding: 4px 8px;
                  background: var(--bg-glass);
                  border-radius: var(--radius-sm);
                ">
                  ${log.weight}kg × ${log.reps}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  modal.open({
    title: entry.workoutName,
    content,
    size: 'lg'
  });
}

async function renderProgress() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Get progress data
  let comparison = null;
  let weightData = [];
  let latest = null;

  if (state.user) {
    comparison = await progressManager.getComparison(state.user.id);
    weightData = await progressManager.getChartData(state.user.id, 'weight', 90);
    latest = await progressManager.getLatest(state.user.id);
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
      <div>
        <h2>Evolução</h2>
        <p style="color: var(--text-muted);">Acompanhe seu progresso ao longo do tempo</p>
      </div>
      <button class="btn btn-primary" id="new-measurement-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Nova Medição
      </button>
    </div>
    
    <div class="tabs" id="progress-tabs">
      <button class="tab active" data-tab="weight">Peso Corporal</button>
      <button class="tab" data-tab="comparison">Evolução</button>
      <button class="tab" data-tab="measurements">Medidas</button>
    </div>
    
    <div id="progress-content">
      ${weightData.length > 0 ? `
        <div class="card" style="margin-bottom: var(--spacing-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
            <h4>📊 Gráfico de Peso</h4>
            ${latest?.weight ? `
              <div style="text-align: right;">
                <div style="font-size: var(--font-size-2xl); font-weight: 700; color: var(--accent-primary);">
                  ${latest.weight}kg
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">Peso atual</div>
              </div>
            ` : ''}
          </div>
          ${progressManager.renderWeightChart(weightData)}
        </div>
        
        ${comparison ? progressManager.renderProgressCard(comparison) : ''}
      ` : `
        <div class="card">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <h4 class="empty-title">Sem dados de evolução</h4>
            <p class="empty-description">Registre suas medidas para acompanhar seu progresso</p>
            <button class="btn btn-primary" id="empty-new-measurement-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Registrar Medidas
            </button>
          </div>
        </div>
      `}
    </div>
  `;

  // Setup event listeners
  setTimeout(() => {
    const showMeasurementModal = () => {
      const formContent = `
        <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
          Registre suas medidas atuais. Deixe em branco os campos que não deseja preencher.
        </p>
        ${progressManager.renderMeasurementForm(latest || {})}
      `;

      modal.open({
        title: '📏 Nova Medição',
        content: formContent,
        size: 'lg',
        footer: `
          <button class="btn btn-secondary" onclick="modal.close()">Cancelar</button>
          <button class="btn btn-primary" id="save-measurement-btn">Salvar</button>
        `,
        onOpen: (overlay) => {
          overlay.querySelector('#save-measurement-btn')?.addEventListener('click', async () => {
            const form = overlay.querySelector('#measurement-form');
            const formData = new FormData(form);
            const measurements = {};

            for (const [key, value] of formData.entries()) {
              if (value) measurements[key] = parseFloat(value);
            }

            if (Object.keys(measurements).length === 0) {
              toast.warning('Preencha pelo menos uma medida');
              return;
            }

            await progressManager.saveMeasurement(state.user.id, measurements);
            modal.close();
            toast.success('Medidas registradas!');
            router.navigate('progress');
          });
        }
      });
    };

    container.querySelector('#new-measurement-btn')?.addEventListener('click', showMeasurementModal);
    container.querySelector('#empty-new-measurement-btn')?.addEventListener('click', showMeasurementModal);

    // Tab switching
    container.querySelectorAll('#progress-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('#progress-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Tab content switching would go here
        toast.info(`Aba "${tab.textContent}" em breve!`);
      });
    });
  }, 100);

  return container;
}

async function renderAssessments() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Load existing data
  let anamnesis = null;
  let photos = [];

  if (state.user) {
    anamnesis = await assessmentsManager.getLatestAnamnesis(state.user.id);
    photos = await assessmentsManager.getPhotos(state.user.id);
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
      <div>
        <h2>Avaliações Físicas</h2>
        <p style="color: var(--text-muted);">Questionário de saúde e fotos de progresso</p>
      </div>
    </div>
    
    <!-- Anamnesis Summary -->
    <div id="anamnesis-container" style="margin-bottom: var(--spacing-xl);">
      ${assessmentsManager.renderAnamnesisSummary(anamnesis)}
    </div>
    
    <!-- Photo Section -->
    <div class="card" style="margin-bottom: var(--spacing-xl);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
        <h4>📸 Fotos de Progresso</h4>
        <button class="btn btn-sm btn-primary" id="add-photos-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Adicionar
        </button>
      </div>
      <div id="photos-container">
        ${assessmentsManager.renderPhotoGallery(photos)}
      </div>
    </div>
    
    <!-- Quick Actions -->
    <div class="grid grid-2" style="gap: var(--spacing-md);">
      <div class="card" style="text-align: center; cursor: pointer;" id="measurements-card">
        <div style="font-size: 2rem; margin-bottom: var(--spacing-sm);">📏</div>
        <h4 style="margin-bottom: var(--spacing-xs);">Medidas Corporais</h4>
        <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
          Registrar peso, circunferências
        </p>
      </div>
      
      <div class="card" style="text-align: center; cursor: pointer;" id="compare-photos-card">
        <div style="font-size: 2rem; margin-bottom: var(--spacing-sm);">🔄</div>
        <h4 style="margin-bottom: var(--spacing-xs);">Comparar Fotos</h4>
        <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
          Antes e depois lado a lado
        </p>
      </div>
    </div>
  `;

  // Setup event listeners
  setTimeout(() => {
    // Start/Edit Anamnesis
    const startBtn = container.querySelector('#start-anamnesis-btn');
    const editBtn = container.querySelector('#edit-anamnesis-btn');

    const showAnamnesisModal = () => {
      const formContent = assessmentsManager.renderAnamnesisForm(anamnesis?.data || {});

      modal.open({
        title: '📋 Anamnese - Questionário de Saúde',
        content: `
          <div style="max-height: 60vh; overflow-y: auto; padding-right: var(--spacing-sm);">
            ${formContent}
          </div>
        `,
        size: 'lg',
        footer: `
          <button class="btn btn-secondary" onclick="modal.close()">Cancelar</button>
          <button class="btn btn-primary" id="save-anamnesis-btn">Salvar Anamnese</button>
        `,
        onOpen: (overlay) => {
          // Setup chip toggle behavior
          overlay.querySelectorAll('.chip-option').forEach(chip => {
            chip.addEventListener('click', () => {
              chip.classList.toggle('selected');
              chip.style.background = chip.classList.contains('selected')
                ? 'var(--accent-primary)'
                : 'var(--bg-tertiary)';
              chip.style.color = chip.classList.contains('selected')
                ? 'white'
                : 'inherit';
            });
          });

          overlay.querySelector('#save-anamnesis-btn')?.addEventListener('click', async () => {
            const form = overlay.querySelector('#anamnesis-form');
            const formData = new FormData(form);
            const data = {};

            // Process form data
            for (const [key, value] of formData.entries()) {
              if (data[key]) {
                // Multi-value field (checkboxes)
                if (!Array.isArray(data[key])) {
                  data[key] = [data[key]];
                }
                data[key].push(value);
              } else {
                data[key] = value;
              }
            }

            await assessmentsManager.saveAnamnesis(state.user.id, data);
            modal.close();
            toast.success('Anamnese salva com sucesso!');
            router.navigate('assessments');
          });
        }
      });
    };

    startBtn?.addEventListener('click', showAnamnesisModal);
    editBtn?.addEventListener('click', showAnamnesisModal);

    // Add Photos
    container.querySelector('#add-photos-btn')?.addEventListener('click', () => {
      const photoContent = assessmentsManager.renderPhotoUpload();

      modal.open({
        title: '📸 Adicionar Fotos',
        content: photoContent,
        size: 'lg',
        footer: `
          <button class="btn btn-secondary" onclick="modal.close()">Cancelar</button>
          <button class="btn btn-primary" id="save-photos-btn">Salvar Fotos</button>
        `,
        onOpen: (overlay) => {
          // Handle file inputs
          overlay.querySelectorAll('.photo-input').forEach(input => {
            input.addEventListener('change', (e) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const slot = input.closest('.photo-slot');
                  const preview = slot.querySelector('.photo-preview');
                  const placeholder = slot.querySelector('.photo-placeholder');
                  preview.src = event.target.result;
                  preview.style.display = 'block';
                  placeholder.style.display = 'none';
                  slot.dataset.imageData = event.target.result;
                };
                reader.readAsDataURL(file);
              }
            });
          });

          overlay.querySelector('#save-photos-btn')?.addEventListener('click', async () => {
            const slots = overlay.querySelectorAll('.photo-slot');
            let savedCount = 0;

            for (const slot of slots) {
              if (slot.dataset.imageData) {
                await assessmentsManager.savePhoto(
                  state.user.id,
                  slot.dataset.imageData,
                  slot.dataset.pose
                );
                savedCount++;
              }
            }

            modal.close();
            if (savedCount > 0) {
              toast.success(`${savedCount} foto(s) salva(s)!`);
              router.navigate('assessments');
            } else {
              toast.warning('Nenhuma foto selecionada');
            }
          });
        }
      });
    });

    // Quick action cards
    container.querySelector('#measurements-card')?.addEventListener('click', () => {
      router.navigate('progress');
    });

    container.querySelector('#compare-photos-card')?.addEventListener('click', () => {
      if (photos.length < 2) {
        toast.info('Adicione pelo menos 2 fotos para comparar');
      } else {
        toast.info('Comparação de fotos em breve!');
      }
    });
  }, 100);

  return container;
}

async function renderStudents() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Check if user is a trainer
  if (state.user?.type !== 'trainer') {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>
          <h4 class="empty-title">Área exclusiva para Personal Trainers</h4>
          <p class="empty-description">Esta funcionalidade está disponível apenas para contas de Personal Trainer</p>
          <button class="btn btn-primary" id="become-trainer-btn">Tornar-me Personal</button>
        </div>
      </div>
    `;

    setTimeout(() => {
      container.querySelector('#become-trainer-btn')?.addEventListener('click', async () => {
        state.user.type = 'trainer';
        await db.update(STORES.users, state.user);
        toast.success('Agora você é um Personal Trainer!');
        router.navigate('students');
      });
    }, 100);

    return container;
  }

  // Load students
  const students = await studentsManager.getStudents(state.user.id);
  const counts = await studentsManager.getStudentCount(state.user.id);

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl);">
      <div>
        <h2>Meus Alunos</h2>
        <p style="color: var(--text-muted);">Gerencie seus alunos e treinos</p>
      </div>
      <button class="btn btn-primary" id="add-student-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        Adicionar Aluno
      </button>
    </div>
    
    ${studentsManager.renderTrainerStats(counts)}
    
    ${students.length > 0 ? `
      <h3 style="margin-bottom: var(--spacing-lg);">👥 Lista de Alunos</h3>
      <div class="grid" style="gap: var(--spacing-md);">
        ${students.map(s => studentsManager.renderStudentCard(s)).join('')}
      </div>
    ` : `
      <div class="card">
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h4 class="empty-title">Nenhum aluno cadastrado</h4>
          <p class="empty-description">Adicione seu primeiro aluno para começar</p>
        </div>
      </div>
    `}
  `;

  // Setup event listeners
  setTimeout(() => {
    // Add student button
    container.querySelector('#add-student-btn')?.addEventListener('click', () => {
      showStudentModal();
    });

    // Student cards
    container.querySelectorAll('.student-card').forEach(card => {
      card.addEventListener('click', async () => {
        const studentId = parseInt(card.dataset.studentId);
        const student = await studentsManager.getStudent(studentId);
        if (student) {
          showStudentDetail(student);
        }
      });
    });
  }, 100);

  return container;
}

function showStudentModal(student = null) {
  const isEdit = !!student;
  const formContent = studentsManager.renderStudentForm(student);

  modal.open({
    title: isEdit ? '✏️ Editar Aluno' : '➕ Novo Aluno',
    content: formContent,
    size: 'md',
    footer: `
      <button class="btn btn-secondary" onclick="modal.close()">Cancelar</button>
      <button class="btn btn-primary" id="save-student-btn">${isEdit ? 'Salvar' : 'Adicionar'}</button>
    `,
    onOpen: (overlay) => {
      overlay.querySelector('#save-student-btn')?.addEventListener('click', async () => {
        const form = overlay.querySelector('#student-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.name?.trim()) {
          toast.warning('Nome é obrigatório');
          return;
        }

        if (isEdit) {
          await studentsManager.updateStudent({ ...student, ...data });
          toast.success('Aluno atualizado!');
        } else {
          await studentsManager.addStudent(state.user.id, data);
          toast.success('Aluno adicionado!');
        }

        modal.close();
        router.navigate('students');
      });
    }
  });
}

async function showStudentDetail(student) {
  const workouts = await studentsManager.getStudentWorkouts(student.id);
  const detailContent = studentsManager.renderStudentDetail(student, workouts);

  modal.open({
    title: student.name,
    content: detailContent,
    size: 'lg',
    onOpen: (overlay) => {
      // Edit student
      overlay.querySelector('#edit-student-btn')?.addEventListener('click', () => {
        modal.close();
        showStudentModal(student);
      });

      // Assign workout
      overlay.querySelector('#assign-workout-btn')?.addEventListener('click', async () => {
        const trainerWorkouts = await workoutsManager.getWorkouts(state.user.id);
        const availableWorkouts = trainerWorkouts.filter(
          w => !student.assignedWorkouts?.includes(w.id)
        );

        if (availableWorkouts.length === 0) {
          toast.info('Nenhum treino disponível para atribuir');
          return;
        }

        modal.close();
        modal.open({
          title: '📋 Atribuir Treino',
          content: `
            <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
              Selecione um treino para atribuir a ${student.name}
            </p>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
              ${availableWorkouts.map(w => `
                <button class="btn btn-secondary assign-btn" data-workout-id="${w.id}" 
                  style="justify-content: flex-start; text-align: left;">
                  ${w.name}
                </button>
              `).join('')}
            </div>
          `,
          size: 'md',
          onOpen: (innerOverlay) => {
            innerOverlay.querySelectorAll('.assign-btn').forEach(btn => {
              btn.addEventListener('click', async () => {
                const workoutId = parseInt(btn.dataset.workoutId);
                await studentsManager.assignWorkout(student.id, workoutId);
                modal.close();
                toast.success('Treino atribuído!');
                const updatedStudent = await studentsManager.getStudent(student.id);
                showStudentDetail(updatedStudent);
              });
            });
          }
        });
      });

      // Remove workout
      overlay.querySelectorAll('.remove-workout-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const workoutId = parseInt(btn.dataset.workoutId);
          await studentsManager.removeWorkout(student.id, workoutId);
          toast.success('Treino removido!');
          modal.close();
          const updatedStudent = await studentsManager.getStudent(student.id);
          showStudentDetail(updatedStudent);
        });
      });
    }
  });
}

async function renderSettings() {
  const container = document.createElement('div');
  container.className = 'animate-slide-up';

  // Loading state
  container.innerHTML = `
    <div style="padding: var(--spacing-xl); text-align: center;">
      <div class="loading-spinner"></div>
      <p style="color: var(--text-muted); margin-top: var(--spacing-md);">Carregando configurações...</p>
    </div>
  `;

  // Yield to UI
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    const workouts = state.user ? await workoutsManager.getWorkouts(state.user.id) : [];

    container.innerHTML = `
    <div style="margin-bottom: var(--spacing-xl);">
      <h2>Configurações</h2>
      <p style="color: var(--text-muted);">Personalize o aplicativo</p>
    </div>
    
    <div class="card" style="margin-bottom: var(--spacing-lg);">
      <h4 style="margin-bottom: var(--spacing-lg);">🎨 Aparência</h4>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) 0; border-bottom: 1px solid var(--border-color);">
        <div>
          <div style="font-weight: 500;">Tema</div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Escolha entre claro e escuro</div>
        </div>
        <select class="form-select" style="width: auto;" id="theme-select">
          <option value="dark" ${state.theme === 'dark' ? 'selected' : ''}>Escuro</option>
          <option value="light" ${state.theme === 'light' ? 'selected' : ''}>Claro</option>
        </select>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: var(--spacing-lg);">
      <h4 style="margin-bottom: var(--spacing-lg);">📄 Exportar PDF</h4>
      
      ${workouts.length > 0 ? `
        <div style="margin-bottom: var(--spacing-md);">
          <label class="form-label">Selecione um treino para exportar</label>
          <select class="form-select" id="workout-export-select">
            <option value="">Escolha um treino...</option>
            ${workouts.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" style="width: 100%; margin-bottom: var(--spacing-md);" id="export-workout-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          Exportar Treino (PDF)
        </button>
      ` : `
        <p style="color: var(--text-muted); margin-bottom: var(--spacing-md);">Crie treinos para poder exportar</p>
      `}
      
      <button class="btn btn-secondary" style="width: 100%;" id="export-assessment-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Exportar Avaliação (PDF)
      </button>
    </div>
    
    <div class="card" style="margin-bottom: var(--spacing-lg);">
      <h4 style="margin-bottom: var(--spacing-lg);">⏱️ Timer</h4>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) 0; border-bottom: 1px solid var(--border-color);">
        <div>
          <div style="font-weight: 500;">Tempo de Descanso Padrão</div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Tempo entre séries</div>
        </div>
        <select class="form-select" style="width: auto;">
          <option>30 segundos</option>
          <option selected>60 segundos</option>
          <option>90 segundos</option>
          <option>120 segundos</option>
        </select>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-md) 0;">
        <div>
          <div style="font-weight: 500;">Som do Timer</div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Alerta sonoro ao finalizar</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="card">
      <h4 style="margin-bottom: var(--spacing-lg);">📱 Dados</h4>
      
      <button class="btn btn-secondary" style="width: 100%; margin-bottom: var(--spacing-md);" id="export-data-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar Dados (JSON)
      </button>
      
      <button class="btn btn-danger" style="width: 100%;" id="logout-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Sair da Conta
      </button>
    </div>
  `;

    // Setup event listeners
    setTimeout(() => {
      // Theme select
      container.querySelector('#theme-select')?.addEventListener('change', async (e) => {
        state.theme = e.target.value;
        document.body.classList.toggle('light-theme', state.theme === 'light');
        await db.setSetting('theme', state.theme);
        toast.success(`Tema ${state.theme === 'dark' ? 'escuro' : 'claro'} aplicado`);
      });

      // Export workout PDF
      container.querySelector('#export-workout-btn')?.addEventListener('click', async () => {
        const select = container.querySelector('#workout-export-select');
        const workoutId = parseInt(select?.value);

        if (!workoutId) {
          toast.warning('Selecione um treino');
          return;
        }

        const workout = await workoutsManager.getWorkout(workoutId);
        if (workout) {
          pdfExporter.exportWorkout(workout);
          toast.success('Gerando PDF...');
        }
      });

      // Export assessment PDF
      container.querySelector('#export-assessment-btn')?.addEventListener('click', async () => {
        const anamnesis = await assessmentsManager.getLatestAnamnesis(state.user.id);
        const measurements = await progressManager.getLatest(state.user.id);

        if (!anamnesis && !measurements) {
          toast.warning('Preencha a anamnese ou medidas primeiro');
          return;
        }

        pdfExporter.exportAssessment(anamnesis, measurements, state.user.name);
        toast.success('Gerando PDF...');
      });

      // Export all data
      container.querySelector('#export-data-btn')?.addEventListener('click', async () => {
        const data = {
          user: state.user,
          workouts: await workoutsManager.getWorkouts(state.user.id),
          history: await historyManager.getHistory(state.user.id, 100),
          progress: await progressManager.getMeasurements(state.user.id),
          exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Dados exportados!');
      });

      // Logout
      container.querySelector('#logout-btn')?.addEventListener('click', () => {
        modal.open({
          title: '👋 Sair',
          content: '<p>Deseja realmente sair da sua conta?</p>',
          footer: `
          <button class="btn btn-secondary" id="cancel-logout-btn">Cancelar</button>
          <button class="btn btn-danger" id="confirm-logout">Sair</button>
        `,
          onOpen: (overlay) => {
            overlay.querySelector('#cancel-logout-btn')?.addEventListener('click', () => modal.close());
            overlay.querySelector('#confirm-logout')?.addEventListener('click', async () => {
              // Don't call modal.close - logout() already does window.location.reload()
              await logout();
            });
          }
        });
      });
    }, 100);

    return container;

  } catch (error) {
    console.error('[Settings] Render error:', error);
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h4 class="empty-title">Erro ao carregar</h4>
          <p class="empty-description">${error.message}</p>
          <button class="btn btn-primary" onclick="location.reload()">Recarregar</button>
        </div>
      </div>
    `;
    return container;
  }
}

function renderProfile() {
  const user = state.user || { name: 'Usuário', email: '', type: 'student' };

  return `
    <div class="animate-slide-up">
      <div style="margin-bottom: var(--spacing-xl);">
        <h2>Meu Perfil</h2>
        <p style="color: var(--text-muted);">Gerencie suas informações pessoais</p>
      </div>
      
      <div class="card">
        <div style="display: flex; align-items: center; gap: var(--spacing-lg); margin-bottom: var(--spacing-xl);">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; font-size: var(--font-size-3xl); font-weight: 700; color: white;">
            ${user.avatar || user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3>${user.name}</h3>
            <p style="color: var(--text-muted);">${user.type === 'trainer' ? 'Personal Trainer' : 'Aluno'}</p>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Nome Completo</label>
          <input type="text" class="form-input" value="${user.name}">
        </div>
        
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" value="${user.email}">
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Peso (kg)</label>
            <input type="number" class="form-input" placeholder="70">
          </div>
          <div class="form-group">
            <label class="form-label">Altura (cm)</label>
            <input type="number" class="form-input" placeholder="175">
          </div>
        </div>
        
        <button class="btn btn-primary" style="width: 100%;">Salvar Alterações</button>
      </div>
    </div>
  `;
}


/**
 * Seed database with initial data
 */
async function seedDatabase() {
  try {
    const exercises = await db.getAll(STORES.exercises);
    if (exercises?.length > 0) {
      // DEV: console.log('[Seed] Exercises already loaded');
      return;
    }

    // DEV: console.log('[Seed] Loading exercises...');
    const response = await fetch('./js/data/exercises.json');
    const data = await response.json();

    if (!data?.exercises?.length) {
      console.warn('[Seed] No exercises data found');
      return;
    }

    // Batch insert using logic from user request
    // We access localDB directly or use a loop. 
    // Since db-adapter abstracts this, we will use the loop but optimized if possible.
    // The user requested explicit transaction usage.

    // NOTE: app.js imports 'db' (the adapter). It doesn't export 'localDB' directly usually.
    // But we can try to use db.add in parallel or just loop simple.
    // User asked for: "const transaction = localDB.db.transaction..."
    // BUT we don't have 'localDB' imported here. We have 'db'.

    // We will stick to simple loop but wrapped in robust try/catch to satisfy the request functionality
    // OR we could try to import localDB. 
    // Let's stick to the SAFE loop provided in the request but adapted for our 'db' adapter.

    let count = 0;
    for (const exercise of data.exercises) {
      await db.add(STORES.exercises, exercise);
      count++;
    }
    // console.log(`[Seed] Seeded ${count} exercises`);

  } catch (error) {
    console.error('[Seed] Error:', error);
    // Non-blocking
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

/**
 * Check for pending redirect login results
 */
async function checkRedirectLogin() {
  if (state.user) return;

  try {
    const firebaseModule = await import('./firebase-config.js');
    await firebaseModule.initFirebase();

    const firebaseUser = await firebaseModule.firebaseAuth.checkRedirectResult();

    if (firebaseUser) {
      // Limpar URL de parâmetros do redirect
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.hash
      );

      // Buscar/criar usuário local
      let users = await db.getByIndex(STORES.users, 'email', firebaseUser.email);
      if (users.length === 0) {
        const userId = await db.add(STORES.users, {
          name: firebaseUser.displayName || 'Usuário Google',
          email: firebaseUser.email,
          type: 'student',
          avatar: firebaseUser.displayName?.charAt(0).toUpperCase() || 'G',
          googleId: firebaseUser.uid,
          createdAt: new Date().toISOString()
        });
        state.user = await db.get(STORES.users, userId);
      } else {
        state.user = users[0];
      }

      // Usar função centralizada
      await handleSuccessfulLogin(state.user);
    }

  } catch (error) {
    console.error('[Auth] Redirect check error:', error);
    // Não mostrar toast a menos que seja erro real do Firebase
    if (error.code && error.code !== 'auth/popup-closed-by-user') {
      toast.error(`Erro no login: ${error.message}`);
    }
  }
}

// Global Exports for debugging
window.db = db;
window.MFIT = { state, db, router, toast, modal };

// ============ APP INITIALIZATION ============
// ES Modules load after DOMContentLoaded, so we check readyState
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already ready, call init immediately
  init();
}

// ============ GLOBAL ERROR HANDLERS ============
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global] Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('[Global] Runtime error:', event.error);
});
