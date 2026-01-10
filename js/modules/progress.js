/**
 * GymFlow - Progress Module
 * Body measurements and weight tracking
 */

import { db, STORES } from '../database.js';

class ProgressManager {
    constructor() {
        this.measurementFields = [
            { id: 'weight', name: 'Peso', unit: 'kg', icon: '⚖️' },
            { id: 'bodyFat', name: 'Gordura Corporal', unit: '%', icon: '📊' },
            { id: 'chest', name: 'Peito', unit: 'cm', icon: '📏' },
            { id: 'waist', name: 'Cintura', unit: 'cm', icon: '📏' },
            { id: 'hips', name: 'Quadril', unit: 'cm', icon: '📏' },
            { id: 'bicepsLeft', name: 'Bíceps Esq.', unit: 'cm', icon: '💪' },
            { id: 'bicepsRight', name: 'Bíceps Dir.', unit: 'cm', icon: '💪' },
            { id: 'thighLeft', name: 'Coxa Esq.', unit: 'cm', icon: '🦵' },
            { id: 'thighRight', name: 'Coxa Dir.', unit: 'cm', icon: '🦵' },
            { id: 'calfLeft', name: 'Panturrilha Esq.', unit: 'cm', icon: '🦵' },
            { id: 'calfRight', name: 'Panturrilha Dir.', unit: 'cm', icon: '🦵' }
        ];
    }

    /**
     * Save a measurement entry
     */
    async saveMeasurement(userId, measurements) {
        return db.add(STORES.progress, {
            userId,
            date: new Date().toISOString(),
            ...measurements
        });
    }

    /**
     * Get all measurements for user
     */
    async getMeasurements(userId, limit = 50) {
        const measurements = await db.getByIndex(STORES.progress, 'userId', userId);
        return measurements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
    }

    /**
     * Get latest measurement
     */
    async getLatest(userId) {
        const measurements = await this.getMeasurements(userId, 1);
        return measurements[0] || null;
    }

    /**
     * Get progress comparison
     */
    async getComparison(userId) {
        const measurements = await this.getMeasurements(userId, 100);
        if (measurements.length < 2) return null;

        const latest = measurements[0];
        const oldest = measurements[measurements.length - 1];

        const changes = {};
        this.measurementFields.forEach(field => {
            if (latest[field.id] && oldest[field.id]) {
                changes[field.id] = {
                    current: latest[field.id],
                    initial: oldest[field.id],
                    change: latest[field.id] - oldest[field.id],
                    percentChange: ((latest[field.id] - oldest[field.id]) / oldest[field.id] * 100).toFixed(1)
                };
            }
        });

        return {
            from: oldest.date,
            to: latest.date,
            changes
        };
    }

    /**
     * Get chart data for a specific measurement
     */
    async getChartData(userId, fieldId, days = 90) {
        const measurements = await this.getMeasurements(userId, 100);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return measurements
            .filter(m => new Date(m.date) >= cutoffDate && m[fieldId])
            .map(m => ({
                date: m.date,
                value: m[fieldId]
            }))
            .reverse();
    }

    /**
     * Render measurement form
     */
    renderMeasurementForm(currentValues = {}) {
        return `
      <form id="measurement-form" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-md);">
        ${this.measurementFields.map(field => `
          <div class="form-group" style="margin: 0;">
            <label class="form-label">${field.icon} ${field.name}</label>
            <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
              <input 
                type="number" 
                class="form-input" 
                name="${field.id}" 
                value="${currentValues[field.id] || ''}" 
                placeholder="0"
                step="0.1"
                min="0"
              >
              <span style="color: var(--text-muted); font-size: var(--font-size-sm);">${field.unit}</span>
            </div>
          </div>
        `).join('')}
      </form>
    `;
    }

    /**
     * Render progress card
     */
    renderProgressCard(comparison) {
        if (!comparison) {
            return `
        <div class="card">
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            <h4 class="empty-title">Sem dados suficientes</h4>
            <p class="empty-description">Registre pelo menos 2 avaliações para ver sua evolução</p>
          </div>
        </div>
      `;
        }

        const weightChange = comparison.changes.weight;

        return `
      <div class="card" style="margin-bottom: var(--spacing-lg);">
        <h4 style="margin-bottom: var(--spacing-md);">📈 Sua Evolução</h4>
        <p style="color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-lg);">
          ${new Date(comparison.from).toLocaleDateString('pt-BR')} → ${new Date(comparison.to).toLocaleDateString('pt-BR')}
        </p>
        
        ${weightChange ? `
          <div style="
            display: flex;
            align-items: center;
            gap: var(--spacing-lg);
            padding: var(--spacing-lg);
            background: var(--bg-glass);
            border-radius: var(--radius-lg);
            margin-bottom: var(--spacing-lg);
          ">
            <div style="
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: ${weightChange.change < 0 ? 'var(--accent-danger)' : 'var(--accent-success)'};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: white;
            ">
              <span style="font-size: var(--font-size-xl); font-weight: 700;">
                ${weightChange.change > 0 ? '+' : ''}${weightChange.change.toFixed(1)}
              </span>
              <span style="font-size: var(--font-size-xs);">kg</span>
            </div>
            <div>
              <div style="font-size: var(--font-size-lg); font-weight: 600;">Peso Corporal</div>
              <div style="color: var(--text-muted);">
                ${weightChange.initial}kg → ${weightChange.current}kg
              </div>
            </div>
          </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md);">
          ${Object.entries(comparison.changes)
                .filter(([key]) => key !== 'weight')
                .slice(0, 6)
                .map(([key, data]) => {
                    const field = this.measurementFields.find(f => f.id === key);
                    const isPositive = data.change > 0;
                    return `
                <div style="
                  padding: var(--spacing-md);
                  background: var(--bg-tertiary);
                  border-radius: var(--radius-md);
                  text-align: center;
                ">
                  <div style="font-size: var(--font-size-sm); color: var(--text-muted); margin-bottom: var(--spacing-xs);">
                    ${field?.name || key}
                  </div>
                  <div style="
                    font-size: var(--font-size-lg);
                    font-weight: 700;
                    color: ${isPositive ? 'var(--accent-success)' : 'var(--accent-danger)'};
                  ">
                    ${isPositive ? '+' : ''}${data.change.toFixed(1)}${field?.unit || ''}
                  </div>
                </div>
              `;
                }).join('')}
        </div>
      </div>
    `;
    }

    /**
     * Render weight chart (CSS only)
     */
    renderWeightChart(data) {
        if (!data || data.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center;">Nenhum dado de peso registrado</p>';
        }

        const values = data.map(d => d.value);
        const min = Math.min(...values) - 1;
        const max = Math.max(...values) + 1;
        const range = max - min;

        return `
      <div class="weight-chart" style="
        position: relative;
        height: 200px;
        padding: var(--spacing-md);
        background: var(--bg-tertiary);
        border-radius: var(--radius-lg);
      ">
        <svg viewBox="0 0 ${data.length * 30} 150" style="width: 100%; height: 100%;">
          <!-- Grid lines -->
          ${[0, 25, 50, 75, 100].map(y => `
            <line x1="0" y1="${y * 1.4}" x2="${data.length * 30}" y2="${y * 1.4}" 
              stroke="var(--border-color)" stroke-dasharray="4"/>
          `).join('')}
          
          <!-- Line path -->
          <path 
            d="M ${data.map((d, i) => {
            const x = i * 30 + 15;
            const y = 140 - ((d.value - min) / range) * 130;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')}"
            fill="none"
            stroke="url(#chartGradient)"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          
          <!-- Points -->
          ${data.map((d, i) => {
            const x = i * 30 + 15;
            const y = 140 - ((d.value - min) / range) * 130;
            return `
              <circle cx="${x}" cy="${y}" r="5" fill="var(--accent-primary)" stroke="white" stroke-width="2">
                <title>${new Date(d.date).toLocaleDateString('pt-BR')}: ${d.value}kg</title>
              </circle>
            `;
        }).join('')}
          
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#10b981"/>
              <stop offset="100%" stop-color="#06b6d4"/>
            </linearGradient>
          </defs>
        </svg>
        
        <!-- Y-axis labels -->
        <div style="
          position: absolute;
          left: var(--spacing-xs);
          top: var(--spacing-md);
          bottom: var(--spacing-md);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 10px;
          color: var(--text-muted);
        ">
          <span>${max.toFixed(0)}kg</span>
          <span>${((max + min) / 2).toFixed(0)}kg</span>
          <span>${min.toFixed(0)}kg</span>
        </div>
      </div>
    `;
    }
}

// Export singleton
const progressManager = new ProgressManager();
export { progressManager };
