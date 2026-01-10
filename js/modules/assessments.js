/**
 * GymFlow - Assessments Module
 * Physical assessments, anamnesis, and progress photos
 */

import { db, STORES } from '../database.js';

class AssessmentsManager {
    constructor() {
        // Anamnesis questions organized by category
        this.anamnesisCategories = [
            {
                id: 'personal',
                title: '📋 Dados Pessoais',
                questions: [
                    { id: 'age', label: 'Idade', type: 'number', unit: 'anos' },
                    { id: 'height', label: 'Altura', type: 'number', unit: 'cm' },
                    { id: 'occupation', label: 'Profissão', type: 'text' },
                    {
                        id: 'objectives', label: 'Objetivos', type: 'multiselect', options: [
                            'Emagrecimento', 'Hipertrofia', 'Condicionamento', 'Saúde', 'Força', 'Flexibilidade'
                        ]
                    }
                ]
            },
            {
                id: 'health',
                title: '❤️ Histórico de Saúde',
                questions: [
                    {
                        id: 'diseases', label: 'Doenças diagnosticadas', type: 'multiselect', options: [
                            'Diabetes', 'Hipertensão', 'Cardiopatia', 'Asma', 'Artrite', 'Nenhuma'
                        ]
                    },
                    { id: 'medications', label: 'Medicamentos em uso', type: 'textarea' },
                    { id: 'surgeries', label: 'Cirurgias realizadas', type: 'textarea' },
                    { id: 'injuries', label: 'Lesões ou dores atuais', type: 'textarea' },
                    { id: 'familyHistory', label: 'Histórico familiar (doenças)', type: 'textarea' }
                ]
            },
            {
                id: 'lifestyle',
                title: '🏃 Estilo de Vida',
                questions: [
                    {
                        id: 'activityLevel', label: 'Nível de atividade', type: 'select', options: [
                            'Sedentário', 'Pouco ativo', 'Moderadamente ativo', 'Muito ativo', 'Atleta'
                        ]
                    },
                    {
                        id: 'exerciseFrequency', label: 'Frequência de treino atual', type: 'select', options: [
                            'Nunca', '1-2x/semana', '3-4x/semana', '5-6x/semana', 'Diário'
                        ]
                    },
                    { id: 'sleepHours', label: 'Horas de sono por noite', type: 'number', unit: 'h' },
                    {
                        id: 'sleepQuality', label: 'Qualidade do sono', type: 'select', options: [
                            'Ruim', 'Regular', 'Boa', 'Excelente'
                        ]
                    },
                    {
                        id: 'stressLevel', label: 'Nível de estresse', type: 'select', options: [
                            'Baixo', 'Moderado', 'Alto', 'Muito alto'
                        ]
                    },
                    { id: 'smoking', label: 'Fumante', type: 'select', options: ['Não', 'Sim', 'Ex-fumante'] },
                    {
                        id: 'alcohol', label: 'Consumo de álcool', type: 'select', options: [
                            'Nunca', 'Ocasional', 'Moderado', 'Frequente'
                        ]
                    }
                ]
            },
            {
                id: 'nutrition',
                title: '🍎 Alimentação',
                questions: [
                    { id: 'mealsPerDay', label: 'Refeições por dia', type: 'number' },
                    {
                        id: 'waterIntake', label: 'Consumo de água', type: 'select', options: [
                            'Menos de 1L', '1-2L', '2-3L', 'Mais de 3L'
                        ]
                    },
                    {
                        id: 'dietRestrictions', label: 'Restrições alimentares', type: 'multiselect', options: [
                            'Nenhuma', 'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Outras'
                        ]
                    },
                    { id: 'supplements', label: 'Suplementos utilizados', type: 'textarea' }
                ]
            }
        ];
    }

    /**
     * Save anamnesis data
     */
    async saveAnamnesis(userId, data) {
        const existing = await this.getLatestAnamnesis(userId);

        const anamnesis = {
            userId,
            type: 'anamnesis',
            date: new Date().toISOString(),
            data,
            id: existing?.id // Update if exists
        };

        if (existing?.id) {
            return db.update(STORES.assessments, anamnesis);
        }
        return db.add(STORES.assessments, anamnesis);
    }

    /**
     * Get latest anamnesis for user
     */
    async getLatestAnamnesis(userId) {
        const assessments = await db.getByIndex(STORES.assessments, 'userId', userId);
        const anamnesis = assessments.filter(a => a.type === 'anamnesis');
        return anamnesis.sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
    }

    /**
     * Save progress photo
     */
    async savePhoto(userId, imageData, pose, notes = '') {
        return db.add(STORES.assessments, {
            userId,
            type: 'photo',
            date: new Date().toISOString(),
            pose, // 'front', 'side', 'back'
            imageData, // Base64 encoded
            notes
        });
    }

    /**
     * Get all photos for user
     */
    async getPhotos(userId) {
        const assessments = await db.getByIndex(STORES.assessments, 'userId', userId);
        return assessments
            .filter(a => a.type === 'photo')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Render anamnesis form
     */
    renderAnamnesisForm(existingData = {}) {
        return `
      <form id="anamnesis-form" class="anamnesis-form">
        ${this.anamnesisCategories.map(category => `
          <div class="form-section" style="margin-bottom: var(--spacing-xl);">
            <h4 style="margin-bottom: var(--spacing-lg); color: var(--accent-primary);">
              ${category.title}
            </h4>
            <div style="display: grid; gap: var(--spacing-md);">
              ${category.questions.map(q => this.renderQuestion(q, existingData[q.id])).join('')}
            </div>
          </div>
        `).join('')}
      </form>
    `;
    }

    /**
     * Render individual question
     */
    renderQuestion(question, value = '') {
        const { id, label, type, unit, options } = question;

        switch (type) {
            case 'number':
                return `
          <div class="form-group">
            <label class="form-label">${label}</label>
            <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
              <input type="number" class="form-input" name="${id}" value="${value || ''}" 
                style="max-width: 120px;">
              ${unit ? `<span style="color: var(--text-muted);">${unit}</span>` : ''}
            </div>
          </div>
        `;

            case 'text':
                return `
          <div class="form-group">
            <label class="form-label">${label}</label>
            <input type="text" class="form-input" name="${id}" value="${value || ''}">
          </div>
        `;

            case 'textarea':
                return `
          <div class="form-group">
            <label class="form-label">${label}</label>
            <textarea class="form-input" name="${id}" rows="2" 
              style="resize: vertical;">${value || ''}</textarea>
          </div>
        `;

            case 'select':
                return `
          <div class="form-group">
            <label class="form-label">${label}</label>
            <select class="form-select" name="${id}">
              <option value="">Selecione...</option>
              ${options.map(opt => `
                <option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>
              `).join('')}
            </select>
          </div>
        `;

            case 'multiselect':
                const selectedValues = Array.isArray(value) ? value : [];
                return `
          <div class="form-group">
            <label class="form-label">${label}</label>
            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-sm);">
              ${options.map(opt => `
                <label style="
                  display: flex;
                  align-items: center;
                  gap: var(--spacing-xs);
                  padding: var(--spacing-sm) var(--spacing-md);
                  background: var(--bg-tertiary);
                  border-radius: var(--radius-full);
                  cursor: pointer;
                  font-size: var(--font-size-sm);
                  transition: all 0.2s;
                " class="chip-option ${selectedValues.includes(opt) ? 'selected' : ''}">
                  <input type="checkbox" name="${id}" value="${opt}" 
                    ${selectedValues.includes(opt) ? 'checked' : ''}
                    style="display: none;">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;

            default:
                return '';
        }
    }

    /**
     * Render photo upload section
     */
    renderPhotoUpload() {
        return `
      <div class="photo-upload-section">
        <h4 style="margin-bottom: var(--spacing-lg);">📸 Fotos de Progresso</h4>
        <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg); font-size: var(--font-size-sm);">
          Tire fotos de frente, lado e costas para acompanhar sua evolução física.
        </p>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md);">
          ${['Frente', 'Lado', 'Costas'].map((pose, i) => `
            <div style="text-align: center;">
              <div style="
                aspect-ratio: 3/4;
                background: var(--bg-tertiary);
                border-radius: var(--radius-lg);
                border: 2px dashed var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                margin-bottom: var(--spacing-sm);
                overflow: hidden;
                position: relative;
              " class="photo-slot" data-pose="${pose.toLowerCase()}">
                <input type="file" accept="image/*" capture="environment" 
                  style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer;"
                  class="photo-input" data-pose="${pose.toLowerCase()}">
                <div class="photo-placeholder" style="text-align: center; color: var(--text-muted);">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <div style="font-size: var(--font-size-xs); margin-top: var(--spacing-xs);">
                    Toque para foto
                  </div>
                </div>
                <img class="photo-preview" style="
                  width: 100%; 
                  height: 100%; 
                  object-fit: cover;
                  display: none;
                ">
              </div>
              <span style="font-weight: 500;">${pose}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }

    /**
     * Render photo gallery
     */
    renderPhotoGallery(photos) {
        if (!photos || photos.length === 0) {
            return `
        <div class="empty-state" style="padding: var(--spacing-xl);">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <h4 class="empty-title">Nenhuma foto registrada</h4>
          <p class="empty-description">Adicione fotos para acompanhar sua evolução</p>
        </div>
      `;
        }

        // Group photos by date
        const grouped = {};
        photos.forEach(p => {
            const dateKey = new Date(p.date).toLocaleDateString('pt-BR');
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(p);
        });

        return `
      <div class="photo-gallery">
        ${Object.entries(grouped).map(([date, datePhotos]) => `
          <div style="margin-bottom: var(--spacing-xl);">
            <h5 style="margin-bottom: var(--spacing-md); color: var(--text-muted);">${date}</h5>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-sm);">
              ${datePhotos.map(p => `
                <div style="
                  aspect-ratio: 3/4;
                  border-radius: var(--radius-md);
                  overflow: hidden;
                  cursor: pointer;
                " class="gallery-photo" data-photo-id="${p.id}">
                  <img src="${p.imageData}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    }

    /**
     * Render anamnesis summary card
     */
    renderAnamnesisSummary(anamnesis) {
        if (!anamnesis) {
            return `
        <div class="card" style="text-align: center; padding: var(--spacing-xl);">
          <h4 style="margin-bottom: var(--spacing-sm);">📋 Anamnese</h4>
          <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
            Preencha o questionário de saúde
          </p>
          <button class="btn btn-primary" id="start-anamnesis-btn">Iniciar Anamnese</button>
        </div>
      `;
        }

        const data = anamnesis.data || {};
        const date = new Date(anamnesis.date).toLocaleDateString('pt-BR');

        return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-lg);">
          <div>
            <h4 style="margin-bottom: var(--spacing-xs);">📋 Anamnese</h4>
            <span style="font-size: var(--font-size-sm); color: var(--text-muted);">
              Atualizada em ${date}
            </span>
          </div>
          <button class="btn btn-sm btn-secondary" id="edit-anamnesis-btn">Editar</button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md);">
          ${data.age ? `
            <div>
              <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Idade</div>
              <div style="font-weight: 600;">${data.age} anos</div>
            </div>
          ` : ''}
          ${data.height ? `
            <div>
              <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Altura</div>
              <div style="font-weight: 600;">${data.height} cm</div>
            </div>
          ` : ''}
          ${data.objectives && data.objectives.length > 0 ? `
            <div style="grid-column: span 2;">
              <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Objetivos</div>
              <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-xs); margin-top: var(--spacing-xs);">
                ${data.objectives.map(o => `
                  <span style="
                    background: var(--accent-primary);
                    color: white;
                    padding: 2px 8px;
                    border-radius: var(--radius-full);
                    font-size: var(--font-size-xs);
                  ">${o}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          ${data.activityLevel ? `
            <div>
              <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Atividade</div>
              <div style="font-weight: 600;">${data.activityLevel}</div>
            </div>
          ` : ''}
          ${data.sleepHours ? `
            <div>
              <div style="font-size: var(--font-size-sm); color: var(--text-muted);">Sono</div>
              <div style="font-weight: 600;">${data.sleepHours}h/noite</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    }
}

// Export singleton
const assessmentsManager = new AssessmentsManager();
export { assessmentsManager };
