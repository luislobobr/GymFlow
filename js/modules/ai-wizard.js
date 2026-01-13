/**
 * GymFlow - AI Workout Wizard
 * Generates personalized workouts based on user preferences using local logic
 */

import { db, STORES } from '../database.js';
import { WORKOUT_TEMPLATES } from './workouts.js';

class AIWizard {
    constructor() {
        this.steps = [
            {
                id: 'focus',
                question: 'Qual é o seu foco principal?',
                options: [
                    { value: 'strength', label: '💪 Força / Hipertrofia', description: 'Ganhar massa muscular e força' },
                    { value: 'cardio', label: '🏃 Cardio / Resistência', description: 'Melhorar fôlego e queimar calorias' },
                    { value: 'hybrid', label: '⚖️ Híbrido', description: 'Equilíbrio entre força e cardio' }
                ]
            },
            {
                id: 'level',
                question: 'Qual seu nível de experiência?',
                options: [
                    { value: 'iniciante', label: '👶 Iniciante', description: 'Estou começando agora' },
                    { value: 'intermediario', label: '🔥 Intermediário', description: 'Já treino há alguns meses' },
                    { value: 'avancado', label: '🦍 Avançado', description: 'Treino pesado há anos' }
                ]
            },
            {
                id: 'time',
                question: 'Quanto tempo você tem por treino?',
                options: [
                    { value: '30', label: '⚡ 30 minutos', description: 'Treino rápido e intenso' },
                    { value: '60', label: '🕐 60 minutos', description: 'Tempo padrão' },
                    { value: '90', label: '🐢 90 minutos', description: 'Treino longo e detalhado' }
                ]
            }
        ];
    }

    /**
     * Render the wizard modal content
     */
    async renderWizard() {
        // We'll manage state internally in the DOM or closure when integrating
        return `
      <div class="ai-wizard-container">
        <div class="wizard-header" style="text-align: center; margin-bottom: var(--spacing-xl);">
          <div style="font-size: 3rem; margin-bottom: var(--spacing-md);">🤖</div>
          <h2>Assistente de Treino IA</h2>
          <p style="color: var(--text-muted);">Responda 3 perguntas rápidas e eu criarei o treino ideal para você.</p>
        </div>

        <div id="wizard-steps">
          <!-- Steps will be injected here -->
        </div>
      </div>
    `;
    }

    /**
     * Generate a workout based on answers
     */
    async generateWorkout(answers, userId) {
        const { focus, level, time } = answers;
        const allExercises = await db.getAll(STORES.exercises);

        // Filter exercises by level compatibility (allow lower levels too)
        const validExercises = allExercises.filter(ex => {
            if (level === 'avancado') return true;
            if (level === 'intermediario') return ex.level !== 'avancado';
            return ex.level === 'iniciante';
        });

        const workout = {
            name: `Treino ${focus === 'strength' ? 'de Força' : focus === 'cardio' ? 'Cardio' : 'Híbrido'} IA`,
            description: `Gerado para nível ${level}, duração ~${time}min`,
            userId: userId,
            exercises: [],
            createdAt: new Date().toISOString(),
            color: focus === 'cardio' ? '#f59e0b' : '#3b82f6'
        };

        let targetCount = time === '30' ? 4 : time === '60' ? 7 : 10;

        // Strategy Pattern
        if (focus === 'cardio') {
            this._buildCardioWorkout(workout, validExercises, targetCount);
        } else if (focus === 'strength') {
            this._buildStrengthWorkout(workout, validExercises, targetCount);
        } else {
            this._buildHybridWorkout(workout, validExercises, targetCount);
        }

        return workout;
    }

    _getRandom(arr, count) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    _buildCardioWorkout(workout, exercises, count) {
        const cardioEx = exercises.filter(e => e.type === 'cardio');
        const coreEx = exercises.filter(e => e.muscle === 'abdomen');

        // Mainly cardio, some core
        const selectedCardio = this._getRandom(cardioEx, Math.min(count - 1, cardioEx.length));
        const selectedCore = this._getRandom(coreEx, count - selectedCardio.length);

        workout.exercises = [
            ...selectedCardio.map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 1,
                reps: 0,
                rest: 60,
                type: 'cardio'
                // Logic to suggest distance/time could be added here
            })),
            ...selectedCore.map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 3,
                reps: 15,
                rest: 45,
                type: 'strength'
            }))
        ];
    }

    _buildStrengthWorkout(workout, exercises, count) {
        const compounds = exercises.filter(e => e.type === 'composto' && e.muscle !== 'abdomen');
        const isolations = exercises.filter(e => e.type === 'isolador');

        // 40% Compounds, 60% Isolation
        const compoundCount = Math.floor(count * 0.4);
        const isoCount = count - compoundCount;

        const selectedCompounds = this._getRandom(compounds, compoundCount);
        const selectedIsos = this._getRandom(isolations, isoCount);

        workout.exercises = [
            ...selectedCompounds.map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 4,
                reps: 10,
                rest: 90,
                type: 'strength'
            })),
            ...selectedIsos.map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 3,
                reps: 12,
                rest: 60,
                type: 'strength'
            }))
        ];
    }

    _buildHybridWorkout(workout, exercises, count) {
        const cardio = exercises.filter(e => e.type === 'cardio');
        const strength = exercises.filter(e => e.type !== 'cardio');

        const cardioCount = Math.floor(count * 0.3); // 30% cardio
        const strengthCount = count - cardioCount;

        const selectedCardio = this._getRandom(cardio, cardioCount);
        const selectedStrength = this._getRandom(strength, strengthCount);

        workout.exercises = [
            // Warmup cardio
            ...selectedCardio.slice(0, 1).map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 1,
                reps: 0,
                rest: 60,
                type: 'cardio'
            })),
            // Strength work
            ...selectedStrength.map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 3,
                reps: 12,
                rest: 60,
                type: 'strength'
            })),
            // Finisher cardio (if any left)
            ...selectedCardio.slice(1).map(ex => ({
                exerciseId: ex.id,
                name: ex.name,
                sets: 1,
                reps: 0,
                rest: 60,
                type: 'cardio'
            }))
        ];
    }
}

export const aiWizard = new AIWizard();
