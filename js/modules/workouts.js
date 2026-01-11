/**
 * GymFlow - Workouts Module
 * Complete workout management: create, edit, execute, and log
 */

import { db, STORES } from '../database.js';
import { timer } from './timer.js';
import { modal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { logger } from '../utils/logger.js';

// Default workout templates
const WORKOUT_TEMPLATES = [
  {
    name: 'PPL - Push (Empurrar)',
    description: 'Peito, Ombros, Tríceps',
    color: '#10b981',
    muscles: ['peito', 'ombros', 'triceps'],
    exercises: [
      { exerciseId: 1, name: 'Supino Reto com Barra', sets: 4, reps: '8-12', rest: 90 },
      { exerciseId: 2, name: 'Supino Inclinado com Halteres', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 34, name: 'Desenvolvimento com Halteres', sets: 4, reps: '8-12', rest: 90 },
      { exerciseId: 35, name: 'Elevação Lateral', sets: 3, reps: '12-15', rest: 45 },
      { exerciseId: 49, name: 'Tríceps Corda', sets: 3, reps: '12-15', rest: 45 },
      { exerciseId: 48, name: 'Tríceps Testa', sets: 3, reps: '10-12', rest: 60 }
    ]
  },
  {
    name: 'PPL - Pull (Puxar)',
    description: 'Costas, Bíceps',
    color: '#06b6d4',
    muscles: ['costas', 'biceps'],
    exercises: [
      { exerciseId: 11, name: 'Barra Fixa', sets: 4, reps: '6-10', rest: 120 },
      { exerciseId: 13, name: 'Remada Curvada com Barra', sets: 4, reps: '8-12', rest: 90 },
      { exerciseId: 14, name: 'Remada Sentada no Cabo', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 12, name: 'Puxada Alta', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 41, name: 'Rosca Direta com Barra', sets: 3, reps: '10-12', rest: 60 },
      { exerciseId: 44, name: 'Rosca Martelo', sets: 3, reps: '12-15', rest: 45 }
    ]
  },
  {
    name: 'PPL - Legs (Pernas)',
    description: 'Quadríceps, Posterior, Glúteos, Panturrilha',
    color: '#8b5cf6',
    muscles: ['pernas'],
    exercises: [
      { exerciseId: 21, name: 'Agachamento Livre', sets: 4, reps: '6-10', rest: 180 },
      { exerciseId: 22, name: 'Leg Press 45°', sets: 4, reps: '10-12', rest: 120 },
      { exerciseId: 25, name: 'Stiff', sets: 3, reps: '10-12', rest: 90 },
      { exerciseId: 23, name: 'Cadeira Extensora', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 24, name: 'Mesa Flexora', sets: 3, reps: '12-15', rest: 60 },
      { exerciseId: 29, name: 'Panturrilha em Pé', sets: 4, reps: '15-20', rest: 45 }
    ]
  }
];

class WorkoutsManager {
  constructor() {
    this.currentWorkout = null;
    this.workoutSession = null;
    this.currentExerciseIndex = 0;
  }

  /**
   * Get all workouts for current user
   */
  async getWorkouts(userId) {
    try {
      return await db.getByIndex(STORES.workouts, 'userId', userId);
    } catch (error) {
      logger.error('Error getting workouts:', error);
      throw error;
    }
  }

  /**
   * Get workout by ID
   */
  async getWorkout(id) {
    try {
      return await db.get(STORES.workouts, id);
    } catch (error) {
      logger.error('Error getting workout:', error);
      throw error;
    }
  }

  /**
   * Create new workout
   */
  async createWorkout(workout) {
    try {
      return await db.add(STORES.workouts, {
        ...workout,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating workout:', error);
      throw error;
    }
  }

  /**
   * Update workout
   */
  async updateWorkout(workout) {
    try {
      return await db.update(STORES.workouts, workout);
    } catch (error) {
      logger.error('Error updating workout:', error);
      throw error;
    }
  }

  /**
   * Delete workout
   */
  async deleteWorkout(id) {
    try {
      return await db.delete(STORES.workouts, id);
    } catch (error) {
      logger.error('Error deleting workout:', error);
      throw error;
    }
  }

  /**
   * Create workouts from templates for new user
   */
  async createTemplatesForUser(userId) {
    try {
      for (const template of WORKOUT_TEMPLATES) {
        await this.createWorkout({
          userId,
          ...template
        });
      }
    } catch (error) {
      logger.error('Error creating templates:', error);
      // Don't throw, partial templates are better than none/crash
    }
  }

  /**
   * Start workout execution session
   */
  startSession(workout) {
    this.currentWorkout = workout;
    this.currentExerciseIndex = 0;
    this.workoutSession = {
      workoutId: workout.id,
      workoutName: workout.name,
      startTime: new Date().toISOString(),
      endTime: null,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        completed: false,
        setsCompleted: 0,
        logsPerSet: [] // { setNumber, reps, weight, timestamp }
      }))
    };
    return this.workoutSession;
  }

  /**
   * Get current exercise in session
   */
  getCurrentExercise() {
    if (!this.workoutSession) return null;
    return this.workoutSession.exercises[this.currentExerciseIndex];
  }

  /**
   * Log a completed set
   */
  logSet(setNumber, reps, weight) {
    if (!this.workoutSession) return;

    const exercise = this.workoutSession.exercises[this.currentExerciseIndex];
    exercise.logsPerSet.push({
      setNumber,
      reps: parseInt(reps),
      weight: parseFloat(weight),
      timestamp: new Date().toISOString()
    });
    exercise.setsCompleted = exercise.logsPerSet.length;

    // Check if all sets completed
    if (exercise.setsCompleted >= exercise.sets) {
      exercise.completed = true;
    }
  }

  /**
   * Move to next exercise
   */
  nextExercise() {
    if (!this.workoutSession) return null;

    if (this.currentExerciseIndex < this.workoutSession.exercises.length - 1) {
      this.currentExerciseIndex++;
      return this.getCurrentExercise();
    }
    return null;
  }

  /**
   * Move to previous exercise
   */
  previousExercise() {
    if (!this.workoutSession) return null;

    if (this.currentExerciseIndex > 0) {
      this.currentExerciseIndex--;
      return this.getCurrentExercise();
    }
    return null;
  }

  /**
   * Skip current exercise
   */
  skipExercise() {
    const exercise = this.getCurrentExercise();
    if (exercise) {
      exercise.skipped = true;
    }
    return this.nextExercise();
  }

  /**
   * Check if workout is complete
   */
  isWorkoutComplete() {
    if (!this.workoutSession) return false;
    return this.workoutSession.exercises.every(ex => ex.completed || ex.skipped);
  }

  /**
   * Finish workout session
   */
  async finishSession(userId) {
    if (!this.workoutSession) return null;

    this.workoutSession.endTime = new Date().toISOString();
    this.workoutSession.userId = userId;

    // Calculate duration
    const startTime = new Date(this.workoutSession.startTime);
    const endTime = new Date(this.workoutSession.endTime);
    this.workoutSession.durationMinutes = Math.round((endTime - startTime) / 60000);

    // Calculate stats
    this.workoutSession.totalSets = this.workoutSession.exercises.reduce(
      (sum, ex) => sum + ex.setsCompleted, 0
    );
    this.workoutSession.totalVolume = this.workoutSession.exercises.reduce(
      (sum, ex) => sum + ex.logsPerSet.reduce((s, l) => s + (l.reps * l.weight), 0), 0
    );

    // Save to history
    // Save to history
    try {
      const historyId = await db.add(STORES.history, this.workoutSession);

      // Clear session
      const completedSession = { ...this.workoutSession, id: historyId };
      this.workoutSession = null;
      this.currentWorkout = null;
      this.currentExerciseIndex = 0;

      return completedSession;
    } catch (error) {
      logger.error('Error finishing session:', error);
      toast.error('Erro ao salvar histórico do treino');
      return null;
    }
  }

  /**
   * Cancel workout session
   */
  cancelSession() {
    this.workoutSession = null;
    this.currentWorkout = null;
    this.currentExerciseIndex = 0;
  }

  /**
   * Get workout progress percentage
   */
  getSessionProgress() {
    if (!this.workoutSession) return 0;
    const completed = this.workoutSession.exercises.filter(ex => ex.completed || ex.skipped).length;
    return Math.round((completed / this.workoutSession.exercises.length) * 100);
  }

  /**
   * Render workout card HTML
   */
  renderWorkoutCard(workout, isExecuting = false) {
    const exerciseCount = workout.exercises?.length || 0;
    const estimatedTime = workout.exercises?.reduce((sum, ex) => {
      return sum + (ex.sets * 1.5) + (ex.sets * (ex.rest || 60) / 60);
    }, 0) || 0;

    return `
      <div class="card card-gradient workout-card" data-workout-id="${workout.id}" style="cursor: pointer; border-left: 4px solid ${workout.color || 'var(--accent-primary)'}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-md);">
          <div>
            <h4 style="margin-bottom: var(--spacing-xs);">${workout.name}</h4>
            <p style="font-size: var(--font-size-sm); color: var(--text-muted);">${workout.description || ''}</p>
          </div>
          <span style="background: var(--accent-primary); color: white; padding: 4px 12px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: 600;">
            ${exerciseCount} exercícios
          </span>
        </div>
        <div class="progress-bar" style="margin-bottom: var(--spacing-md);">
          <div class="progress-bar-fill" style="width: 0%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: var(--font-size-sm); color: var(--text-muted);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -3px;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ~${Math.round(estimatedTime)} min
          </span>
          <div style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-sm btn-secondary edit-workout-btn" data-workout-id="${workout.id}" aria-label="Editar treino ${workout.name}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn-sm btn-primary start-workout-btn" data-workout-id="${workout.id}" aria-label="Iniciar treino ${workout.name}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Iniciar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render workout execution UI
   */
  renderExecutionUI(container) {
    if (!this.workoutSession) return;

    const exercise = this.getCurrentExercise();
    const progress = this.getSessionProgress();
    const totalExercises = this.workoutSession.exercises.length;

    container.innerHTML = `
      <div class="workout-execution animate-slide-up">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-lg);">
          <div>
            <h3 style="margin-bottom: var(--spacing-xs);">${this.workoutSession.workoutName}</h3>
            <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
              Exercício ${this.currentExerciseIndex + 1} de ${totalExercises}
            </p>
          </div>
          <button class="btn btn-ghost cancel-workout-btn" title="Cancelar treino">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <!-- Progress bar -->
        <div class="progress-bar" style="margin-bottom: var(--spacing-xl); height: 8px;">
          <div class="progress-bar-fill" style="width: ${progress}%;"></div>
        </div>
        
        <!-- Exercise Card -->
        <div class="card" style="margin-bottom: var(--spacing-lg);">
          <div style="text-align: center; padding: var(--spacing-lg);">
            <div style="width: 120px; height: 120px; margin: 0 auto var(--spacing-lg); background: var(--bg-glass); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="1.5">
                <path d="M6.5 6.5L17.5 17.5"></path>
                <path d="M3 10L7 6L10 9"></path>
                <path d="M14 15L17.5 18.5L21 15"></path>
                <circle cx="5" cy="19" r="2"></circle>
                <circle cx="19" cy="5" r="2"></circle>
              </svg>
            </div>
            <h2 style="margin-bottom: var(--spacing-sm);">${exercise.name}</h2>
            <button class="btn btn-sm btn-ghost watch-video-btn" title="Ver vídeo demonstrativo" style="margin-bottom: var(--spacing-sm); color: var(--accent-primary);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Ver Vídeo
            </button>
            <div id="inline-video-container" style="margin-bottom: var(--spacing-md);"></div>
            <p style="color: var(--accent-primary); font-size: var(--font-size-xl); font-weight: 700; margin-bottom: var(--spacing-md);">
              ${exercise.sets} séries × ${exercise.reps} reps
            </p>
            <p style="color: var(--text-muted);">Descanso: ${exercise.rest}s entre séries</p>
          </div>
        </div>
        
        <!-- Sets Log -->
        <div class="card" style="margin-bottom: var(--spacing-lg);">
          <h4 style="margin-bottom: var(--spacing-md);">📝 Registrar Série</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--spacing-md); align-items: end;">
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="weight-input">Peso (kg)</label>
              <input type="number" class="form-input" id="weight-input" placeholder="0" step="0.5" min="0">
            </div>
            <div class="form-group" style="margin: 0;">
              <label class="form-label" for="reps-input">Reps</label>
              <input type="number" class="form-input" id="reps-input" placeholder="0" min="0">
            </div>
            <button class="btn btn-primary log-set-btn" style="height: 48px;" aria-label="Registrar série">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
          
          <!-- Sets completed display -->
          <div style="display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-md); flex-wrap: wrap;" id="sets-display">
            ${this.renderSetsDisplay(exercise)}
          </div>
        </div>
        
        <!-- Timer -->
        <div class="card" style="margin-bottom: var(--spacing-lg);" id="timer-container">
          <h4 style="margin-bottom: var(--spacing-md);">⏱️ Timer de Descanso</h4>
          <div id="rest-timer"></div>
        </div>
        
        <!-- Navigation -->
        <div style="display: flex; gap: var(--spacing-md);">
          <button class="btn btn-secondary prev-exercise-btn" ${this.currentExerciseIndex === 0 ? 'disabled' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Anterior
          </button>
          <button class="btn btn-ghost skip-exercise-btn" style="flex: 1;">
            Pular
          </button>
          ${this.currentExerciseIndex === totalExercises - 1
        ? `<button class="btn btn-success finish-workout-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Finalizar
              </button>`
        : `<button class="btn btn-primary next-exercise-btn">
                Próximo
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>`
      }
        </div>
      </div>
    `;

    // Initialize timer
    const timerContainer = container.querySelector('#rest-timer');
    timer.createTimerUI(timerContainer, exercise.rest || 60);

    // Setup event listeners
    this.setupExecutionListeners(container);
  }

  /**
   * Render sets display circles
   */
  renderSetsDisplay(exercise) {
    let html = '';
    for (let i = 1; i <= exercise.sets; i++) {
      const log = exercise.logsPerSet.find(l => l.setNumber === i);
      const isCompleted = !!log;
      const isCurrent = exercise.logsPerSet.length + 1 === i;

      html += `
        <div style="
          width: 48px; height: 48px; 
          border-radius: 50%; 
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: ${isCompleted ? 'var(--accent-primary)' : 'var(--bg-tertiary)'};
          border: 2px solid ${isCurrent ? 'var(--accent-primary)' : 'transparent'};
          color: ${isCompleted ? 'white' : 'var(--text-muted)'};
          font-size: var(--font-size-xs);
          font-weight: 600;
        " title="${log ? `${log.weight}kg × ${log.reps} reps` : `Série ${i}`}">
          ${isCompleted
          ? `<span>${log.weight}</span><span style="font-size: 10px;">×${log.reps}</span>`
          : `<span>${i}</span>`
        }
        </div>
      `;
    }
    return html;
  }

  /**
   * Setup execution event listeners
   */
  setupExecutionListeners(container) {
    const logSetBtn = container.querySelector('.log-set-btn');
    const weightInput = container.querySelector('#weight-input');
    const repsInput = container.querySelector('#reps-input');

    logSetBtn?.addEventListener('click', () => {
      const weight = weightInput.value;
      const reps = repsInput.value;

      if (!reps) {
        window.toast?.warning('Informe o número de repetições');
        return;
      }

      const exercise = this.getCurrentExercise();
      const setNumber = exercise.setsCompleted + 1;

      this.logSet(setNumber, reps, weight || 0);

      // Update display
      const setsDisplay = container.querySelector('#sets-display');
      setsDisplay.innerHTML = this.renderSetsDisplay(exercise);

      // Clear inputs
      repsInput.value = '';

      // Show toast
      window.toast?.success(`Série ${setNumber} registrada!`);

      // Start timer if not last set
      if (exercise.setsCompleted < exercise.sets) {
        timer.start(exercise.rest || 60, {
          onTick: (remaining, progress) => {
            const timerValue = container.querySelector('.timer-value');
            const progressRing = container.querySelector('.timer-ring-progress');
            if (timerValue) timerValue.textContent = timer.formatTime(remaining);
            if (progressRing) {
              const circumference = 2 * Math.PI * 45;
              progressRing.style.strokeDashoffset = circumference - (progress / 100) * circumference;
            }
          },
          onComplete: () => {
            window.toast?.success('Descanso finalizado! Próxima série.');
          }
        });
      }

      // Check if exercise complete
      if (exercise.completed) {
        window.toast?.success(`${exercise.name} concluído! 💪`);
      }
    });

    container.querySelector('.watch-video-btn')?.addEventListener('click', async () => {
      const exercise = this.getCurrentExercise();
      const videoContainer = container.querySelector('#inline-video-container');
      const btn = container.querySelector('.watch-video-btn');

      if (!exercise?.exerciseId || !videoContainer) return;

      // Toggle off
      if (videoContainer.innerHTML) {
        videoContainer.innerHTML = '';
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Ver Vídeo
        `;
        return;
      }

      // Loading state
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Carregando...';

      try {
        const fullExercise = await db.get(STORES.exercises, exercise.exerciseId);

        if (fullExercise?.videoUrl) {
          let videoContent = '';
          if (fullExercise.videoUrl.includes('youtube.com') || fullExercise.videoUrl.includes('youtu.be')) {
            // Extract ID
            let videoId = '';
            if (fullExercise.videoUrl.includes('v=')) {
              videoId = fullExercise.videoUrl.split('v=')[1].split('&')[0];
            } else if (fullExercise.videoUrl.includes('youtu.be/')) {
              videoId = fullExercise.videoUrl.split('youtu.be/')[1];
            }

            if (videoId) {
              videoContent = `
                <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: var(--radius-md);">
                  <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
                </div>
                <div style="margin-top: var(--spacing-sm); padding: var(--spacing-sm); background: var(--bg-tertiary); border-radius: var(--radius-sm);">
                  <p style="color: var(--text-muted); font-size: var(--font-size-sm); line-height: 1.5;">${fullExercise.instructions || 'Sem instruções.'}</p>
                </div>
              `;
            } else {
              videoContent = `<a href="${fullExercise.videoUrl}" target="_blank" class="btn btn-primary" style="width: 100%;">Abrir Vídeo no YouTube</a>`;
            }
          } else {
            videoContent = `<a href="${fullExercise.videoUrl}" target="_blank" class="btn btn-primary" style="width: 100%;">Abrir Vídeo</a>`;
          }

          videoContainer.innerHTML = videoContent;
          btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Fechar Vídeo
          `;
        } else {
          toast.warning('Vídeo não disponível');
          btn.innerHTML = originalText;
        }
      } catch (error) {
        logger.error(error);
        toast.error('Erro ao carregar vídeo');
        btn.innerHTML = originalText;
      }
    });

    container.querySelector('.prev-exercise-btn')?.addEventListener('click', () => {
      timer.stop();
      this.previousExercise();
      this.renderExecutionUI(container);
    });

    container.querySelector('.next-exercise-btn')?.addEventListener('click', () => {
      timer.stop();
      const next = this.nextExercise();
      if (next) {
        this.renderExecutionUI(container);
      }
    });

    container.querySelector('.skip-exercise-btn')?.addEventListener('click', async () => {
      const confirm = await window.modal?.confirm({
        title: 'Pular Exercício',
        message: 'Deseja pular este exercício?',
        confirmText: 'Pular',
        cancelText: 'Cancelar'
      });

      if (confirm) {
        timer.stop();
        const next = this.skipExercise();
        if (next) {
          this.renderExecutionUI(container);
        } else {
          // Was last exercise
          this.renderExecutionUI(container);
        }
      }
    });

    container.querySelector('.cancel-workout-btn')?.addEventListener('click', async () => {
      const confirm = await window.modal?.confirm({
        title: 'Cancelar Treino',
        message: 'Tem certeza que deseja cancelar o treino? Todo progresso será perdido.',
        confirmText: 'Cancelar Treino',
        cancelText: 'Continuar',
        danger: true
      });

      if (confirm) {
        timer.stop();
        this.cancelSession();
        window.location.hash = 'workouts';
      }
    });

    container.querySelector('.finish-workout-btn')?.addEventListener('click', async () => {
      timer.stop();
      const userId = window.MFIT?.state?.user?.id;
      const result = await this.finishSession(userId);

      if (result) {
        window.toast?.success(`Treino finalizado! 🎉 ${result.durationMinutes} min, ${result.totalSets} séries`);
        window.location.hash = 'workouts';
      }
    });
  }

  /**
   * Render create/edit workout modal
   */
  renderWorkoutForm(workout = null) {
    const isEdit = !!workout;
    const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

    return `
      <div id="workout-form">
        <div class="form-group">
          <label class="form-label" for="workout-name">Nome do Treino</label>
          <input type="text" class="form-input" id="workout-name" value="${workout?.name || ''}" placeholder="Ex: Treino A - Push">
        </div>
        
        <div class="form-group">
          <label class="form-label" for="workout-description">Descrição</label>
          <input type="text" class="form-input" id="workout-description" value="${workout?.description || ''}" placeholder="Ex: Peito, Ombro, Tríceps">
        </div>
        
        <div class="form-group">
          <label class="form-label">Cor do Card</label>
          <div style="display: flex; gap: var(--spacing-sm);">
            ${colors.map(c => `
              <button type="button" class="color-pick" data-color="${c}" aria-label="Selecionar cor ${c}" style="
                width: 40px; height: 40px; border-radius: var(--radius-md);
                background: ${c}; border: 3px solid ${c === (workout?.color || '#10b981') ? 'white' : 'transparent'};
                cursor: pointer;
              "></button>
            `).join('')}
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Exercícios</label>
          <div id="exercises-list" style="margin-bottom: var(--spacing-md);">
            ${workout?.exercises?.map((ex, i) => this.renderExerciseItem(ex, i)).join('') || '<p style="color: var(--text-muted); font-size: var(--font-size-sm);">Nenhum exercício adicionado</p>'}
          </div>
          <button type="button" class="btn btn-secondary add-exercise-btn" style="width: 100%;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Adicionar Exercício
          </button>
        </div>
      </div>
    `;
  }

  renderExerciseItem(exercise, index) {
    return `
      <div class="exercise-item" data-index="${index}" style="
        display: flex; align-items: center; gap: var(--spacing-md);
        padding: var(--spacing-md); background: var(--bg-tertiary);
        border-radius: var(--radius-md); margin-bottom: var(--spacing-sm);
      ">
        <div style="flex: 1;">
          <div style="font-weight: 500;">${exercise.name}</div>
          <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
            ${exercise.sets} × ${exercise.reps} | Descanso: ${exercise.rest}s
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm remove-exercise-btn" data-index="${index}" aria-label="Remover exercício ${exercise.name}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }
}

// Export singleton
const workoutsManager = new WorkoutsManager();
export { workoutsManager, WORKOUT_TEMPLATES };
